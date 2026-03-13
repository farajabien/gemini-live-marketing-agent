import { NextRequest, NextResponse } from "next/server";
import { adminDb, generateId } from "@/lib/firebase-admin";
import { generateText } from "@/lib/ai/gemini-client";
import { NarrativeInput } from "@/lib/marketing/narrative-intelligence";

/**
 * POST /api/narrative/[id]/chat
 * Simple request-response chat for the Director.
 * Persists history and returns streaming-like response (though initially simple).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: narrativeId } = await params;
    const { message: userMessage } = await request.json();

    if (!userMessage) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminDb.auth.verifyToken(token);
    if (!decodedToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // 1. Fetch Narrative Context
    const query = {
      narratives: {
        $: { where: { id: narrativeId } }
      }
    };
    const results = await adminDb.query(query);
    const narrative = results.narratives?.[0];

    if (!narrative) {
      return NextResponse.json({ error: "Narrative not found" }, { status: 404 });
    }

    // Check ownership
    const narrativeUserId = narrative.userId || (narrative as any).owner;
    if (narrativeUserId !== decodedToken.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Fetch recent history
    const historyQuery = {
      chat_messages: {
        $: {
          where: { narrativeId },
          orderBy: { createdAt: "asc" },
          limit: 10
        }
      }
    };
    // Note: Our current schema uses sub-collections for chat_messages often, 
    // but the query above assumes a top-level or handled by InstantDB.
    // Let's use the sub-collection pattern seen in LiveDirectorDialog.tsx:
    // `narratives/${narrativeId}/chat_messages`
    
    // For now, let's pull history manually if needed, or just rely on the LLM being stateless 
    // and the client providing history if we want to be efficient.
    // However, the prompt in `LiveDirectorDialog` already includes building the context.
    
    // Let's fetch the sub-collection messages
    const historyData = await adminDb.query({
      [`narratives/${narrativeId}/chat_messages`]: {
        $: { order: { createdAt: 'asc' }, limit: 10 }
      }
    });
    
    const history = (historyData as any)[`narratives/${narrativeId}/chat_messages`] || [];
    const formattedHistory = history.map((m: any) => `${m.role === 'user' ? 'User' : 'Director'}: ${m.text}`).join("\n");

    // 3. Multi-Agent Thinking Chain: Internal Discussion
    const thinkingPrompt = `
You are moderating a high-level strategic "War Room" discussion about this user request.
Two internal experts are debating:
1. **The Disruptor**: Always looking for why this might fail, what's missing, or where the "Villain" is hiding in the user's logic.
2. **The Architect**: Focusing on systems, scalability, and how to turn these ideas into a repeatable process.

BRAND CONTEXT:
Title: ${narrative.title}
Audience: ${narrative.audience}
Problem: ${narrative.problem}

USER MESSAGE:
"${userMessage}"

CONVERSATION HISTORY:
${formattedHistory}

TASK:
Write a brief, 2-turn internal dialogue between the Disruptor and the Architect. 
They should quickly analyze the user's message and find a deeper strategic angle.
Keep it punchy and professional.
`.trim();

    const { text: internalThought } = await generateText(
      thinkingPrompt,
      "You are a strategic reasoning engine. Output only the dialogue between the Disruptor and Architect.",
      "gemini-2.0-flash", // Use 2.0 for speed in the thinking step
      0.8
    );

    // 4. Build Final System Prompt with Integrated Reasoning
    const systemPrompt = `
You are the Brainstorming Director for a high-end marketing agency. 
Your goal is to act as a strategic sparring partner, helping the user build their brand narrative ORGANICALLY through conversation.

BRAND CONTEXT:
Title: ${narrative.title}
Audience: ${narrative.audience || "Not yet identified"}
Problem: ${narrative.problem || "Not yet identified"}
Narrative Strength: ${narrative.narrativeStrength?.overallScore || 0}%

INTERNAL STRATEGY WAR ROOM NOTES (Read this before responding):
${internalThought}

STRATEGY PHILOSOPHY:
- Don't just agree. Push back or offer a new angle based on the War Room notes.
- Focus on identifying the "Villain" (Problem) and the "Hero" (Transformation).
- YOUR MISSION: If the Narrative Strength is below 80%, subtly guide the conversation to extract missing pieces (Audience, Pain, Unique Mechanism, Identity Shift).
- If the Narrative Strength is above 80%, focus on deducing strategy and generating high-impact video content angles.

CONVERSATION HISTORY:
${formattedHistory}

INSTRUCTIONS:
1. Respond in 2-3 sentences. Be sharp, visionary, and tactical.
2. Use markdown (bold, italics) in the "text" field to emphasize key strategy points.
3. CRITICAL: Your entire output must be a valid JSON object. 
4. The "suggestions" should be strategic inquiries or next steps.

FORMAT:
{
  "text": "...",
  "suggestions": ["...", "...", "..."],
  "thoughtProcess": "Brief summary of extraction goal",
  "blueprint": {
    "key_strategy": "...",
    "narrative_focus": "...",
    "extraction_goal": "..."
  }
}
`.trim();

    // 5. Generate Final Response
    const { text: rawResponse } = await generateText(
      userMessage,
      systemPrompt,
      "gemini-2.0-flash",
      0.7
    );

    let modelData;
    try {
      const startIdx = rawResponse.indexOf('{');
      const endIdx = rawResponse.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        let jsonContent = rawResponse.substring(startIdx, endIdx + 1);
        // Basic cleanup for common LLM JSON errors
        jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']'); 
        modelData = JSON.parse(jsonContent);
      } else {
        throw new Error("No JSON found");
      }
    } catch (e) {
      console.warn("[Director Chat] Parsing fallback for:", rawResponse);
      modelData = { 
        text: rawResponse.replace(/```json|```/g, "").trim(), 
        suggestions: ["Explain more", "Next angle", "Deep dive"],
        thoughtProcess: "Direct analysis synthesized.",
        blueprint: {
           "key_strategy": "Direct guidance",
           "status": "Fallback mode"
        }
      };
    }

    const { text: modelResponse, suggestions = [], thoughtProcess = "", blueprint = {} } = modelData;

    // 6. Persist User Message
    const userMsgId = generateId();
    await adminDb.transact([
      adminDb.tx[`narratives/${narrativeId}/chat_messages`][userMsgId].set({
        role: "user",
        text: userMessage,
        userId: decodedToken.id,
        createdAt: Date.now(),
      })
    ]);

    // 7. Persist Model Message
    const modelMsgId = generateId();
    await adminDb.transact([
      adminDb.tx[`narratives/${narrativeId}/chat_messages`][modelMsgId].set({
        role: "model",
        text: modelResponse,
        userId: decodedToken.id,
        thoughtProcess,
        warRoomDialogue: internalThought,
        blueprint,
        createdAt: Date.now(),
      })
    ]);

    // 8. Secret Extraction & Brain Evolution (The Loop)
    let evolvedNarrative = null;
    let newStrength = null;

    try {
      const currentNarrativeInput: NarrativeInput = {
        audience: narrative.audience || "",
        currentState: narrative.currentState || "",
        problem: narrative.problem || "",
        costOfInaction: narrative.costOfInaction || "",
        solution: narrative.solution || "",
        afterState: narrative.afterState || "",
        identityShift: narrative.identityShift || "",
        voice: narrative.voice || "calm",
      };

      const interactionInsight = `User: "${userMessage}"\nDirector: "${modelResponse}"`;
      
      // Evolve the brain
      const { evolveNarrative, scoreNarrativeStrength } = await import("@/lib/marketing/narrative-intelligence");
      evolvedNarrative = await evolveNarrative(currentNarrativeInput, interactionInsight);
      
      // Score the new strength
      newStrength = await scoreNarrativeStrength(evolvedNarrative);

      // Update narrative with evolved data
      await adminDb.transact([
        adminDb.tx.narratives[narrativeId].update({
          ...evolvedNarrative,
          narrativeStrength: newStrength,
          updatedAt: Date.now(),
        })
      ]);
      console.log("[Director Chat] Narrative brain evolved successfully.");
    } catch (evolutionError) {
      console.error("[Director Chat] Evolution failed (non-blocking):", evolutionError);
    }

    return NextResponse.json({ 
      text: modelResponse,
      suggestions: suggestions,
      thoughtProcess: thoughtProcess,
      blueprint: blueprint,
      role: "model",
      narrativeStrength: newStrength || narrative.narrativeStrength
    });

  } catch (error: any) {
    console.error("[Director Chat] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
