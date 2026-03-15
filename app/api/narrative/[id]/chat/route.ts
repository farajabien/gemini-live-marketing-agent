import { NextRequest } from "next/server";
import { adminDb, generateId } from "@/lib/firebase-admin";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { googleVertexFlash } from "@/lib/ai/google-provider";
import { NarrativeInput } from "@/lib/marketing/narrative-intelligence";
import { generateText } from "@/lib/ai/gemini-client";

/**
 * POST /api/narrative/[id]/chat
 * Refactored to use High-Fidelity Streaming and StreamData signals.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const thinkingSteps: any[] = [];
  
  try {
    const { id: narrativeId } = await params;
    const { messages: chatMessages } = await request.json();
    const lastMessage = chatMessages[chatMessages.length - 1];
    const userMessage = lastMessage.content;

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await adminDb.auth.verifyToken(token);
    if (!decodedToken) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    }

    // 1. Fetch Narrative Context
    const contextResults = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative = contextResults.narratives?.[0];

    if (!narrative) {
      return new Response(JSON.stringify({ error: "Narrative not found" }), { status: 404 });
    }

    // Check ownership
    const narrativeUserId = narrative.userId || (narrative as any).owner;
    if (narrativeUserId !== decodedToken.id) {
       return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 2. Multi-Agent Thinking Chain (Async but fast)
    thinkingSteps.push({ type: 'thinking', status: 'Opening Internal War Room...' });
    
    const thinkingPrompt = `
      You are moderating a high-level strategic "War Room" discussion.
      EXPERTS:
      1. **The Disruptor**: Challenges assumptions, finds "Villain" gaps.
      2. **The Architect**: Focuses on systems and scalable patterns.

      BRAND: ${narrative.title} | ${narrative.audience}
      USER: "${userMessage}"
      
      TASK: Brief (2-turn) debate analysis. Punchy.
    `.trim();

    // Use a non-streaming call for the fast thinking logic
    const { text: internalThought } = await generateText(
      thinkingPrompt,
      "You are a strategic reasoning engine.",
      "gemini-2.0-flash",
      0.8
    );

    thinkingSteps.push({ type: 'thinking', status: 'Strategy Distilled.', thought: internalThought });

    // 3. Persist User Message (Immediate)
    const userMsgId = generateId();
    await adminDb.transact([
      adminDb.tx[`narratives/${narrativeId}/chat_messages`][userMsgId].set({
        role: "user",
        text: userMessage,
        userId: decodedToken.id,
        createdAt: Date.now(),
      })
    ]);

    // 4. Final Response Generation (Streaming)
    const systemPrompt = `
      You are the Brainstorming Director. Spar with the user to build their brand brain.
      
      CONTEXT:
      Title: ${narrative.title}
      Health: ${narrative.narrativeStrength?.overallScore || 0}%
      
      WAR ROOM NOTES:
      ${internalThought}
      
      MISSION: Subtly extract missing pillars if health < 80%. Deduce high-impact angles if > 80%.
      
      FORMAT: Respond as if you are speaking. Use markdown for emphasis.
      Special: Wrap structured metadata (suggestions, blueprint) in a JSON block at the END of your response.
    `.trim();

    const result = streamText({
      model: googleVertexFlash,
      system: systemPrompt,
      prompt: userMessage,
      temperature: 0.7,
      onFinish: async ({ text }) => {

        // Parse trailing JSON if any
        let cleanText = text;
        let blueprint = {};
        let suggestions = [];

        try {
           const jsonMatch = text.match(/\{[\s\S]*\}$/);
           if (jsonMatch) {
             const meta = JSON.parse(jsonMatch[0]);
             blueprint = meta.blueprint || {};
             suggestions = meta.suggestions || [];
             cleanText = text.replace(jsonMatch[0], '').trim();
           }
        } catch (e) {}

        // Persist Model Message
        const modelMsgId = generateId();
        await adminDb.transact([
          adminDb.tx[`narratives/${narrativeId}/chat_messages`][modelMsgId].set({
            role: "model",
            text: cleanText,
            userId: decodedToken.id,
            warRoomDialogue: internalThought,
            blueprint,
            createdAt: Date.now(),
          })
        ]);

        // Background Evolution (Non-blocking)
        (async () => {
          try {
            const { evolveNarrative, scoreNarrativeStrength } = await import("@/lib/marketing/narrative-intelligence");
            const currentInput: NarrativeInput = {
              audience: narrative.audience || "",
              currentState: narrative.currentState || "",
              problem: narrative.problem || "",
              costOfInaction: narrative.costOfInaction || "",
              solution: narrative.solution || "",
              afterState: narrative.afterState || "",
              identityShift: narrative.identityShift || "",
              voice: narrative.voice || "calm",
            };
            
            const evolved = await evolveNarrative(currentInput, `User: ${userMessage}\nDirector: ${cleanText}`);
            const strength = await scoreNarrativeStrength(evolved);
            
            await adminDb.transact([
              adminDb.tx.narratives[narrativeId].update({
                ...evolved,
                narrativeStrength: strength,
                updatedAt: Date.now(),
              })
            ]);
            console.log("[Director Chat] Real-time Brain update persisted.");
          } catch (e) {
            console.error("[Evolution Error]:", e);
          }
        })();
      }
    });

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          // Custom data (thinking steps)
          for (const step of thinkingSteps) {
            writer.write({
              type: 'data-part',
              data: step
            });
          }

          // Merge the AI SDK text stream
          writer.merge(result.toUIMessageStream());
        }
      })
    });
  } catch (error: any) {
    console.error("[Director Chat] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
