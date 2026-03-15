import { NextRequest } from "next/server";
import { adminDb, generateId } from "@/lib/firebase-admin";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { googleVertexFlash } from "@/lib/ai/google-provider";
import { NarrativeInput, SeriesNarrativeInput } from "@/lib/marketing/narrative-intelligence";
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
    const body = await request.json();
    
    // Support both AI SDK v6 'messages' and potential legacy/custom 'message' singular
    const chatMessages = body.messages || (body.message ? [{ role: "user", content: body.message, text: body.message }] : []);
    const lastMessage = chatMessages && chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;

    if (!lastMessage) {
      return new Response(JSON.stringify({ 
        error: "Missing message", 
        debug_received_body: body 
      }), { status: 400 });
    }

    // Robustly extract user message from content, parts, text, or the singular 'message' from body
    const userMessage = lastMessage.content || 
                        lastMessage.text || 
                        (lastMessage.parts as any[])?.filter(p => p.type === 'text').map(p => p.text).join('') || 
                        body.message ||
                        "";

    if (!userMessage) {
      console.error("[Chat API] Missing message in payload:", JSON.stringify(lastMessage));
      return new Response(JSON.stringify({ 
        error: "Missing message", 
        debug_received_last_message: lastMessage,
        debug_all_messages: chatMessages 
      }), { status: 400 });
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

    // 1. Fetch Narrative Context (Try both collections)
    let contextResults = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    let narrative = contextResults.narratives?.[0];
    let isSeries = false;

    if (!narrative) {
      contextResults = await adminDb.query({
        seriesNarratives: { $: { where: { id: narrativeId } } }
      });
      narrative = contextResults.seriesNarratives?.[0];
      isSeries = true;
    }

    if (!narrative) {
      return new Response(JSON.stringify({ error: "Narrative not found" }), { status: 404 });
    }

    // Check ownership
    const narrativeUserId = narrative.userId || (narrative as any).owner;
    if (narrativeUserId !== decodedToken.id) {
       return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // 3. Persist User Message (Immediate)
    const userMsgId = generateId();
    const chatCollection = isSeries ? `seriesNarratives/${narrativeId}/chat_messages` : `narratives/${narrativeId}/chat_messages`;
    
    await adminDb.transact([
      adminDb.tx[chatCollection][userMsgId].set({
        role: "user",
        text: userMessage,
        userId: decodedToken.id,
        createdAt: Date.now(),
      })
    ]);

    // 4. Return Stream Immediately
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          // A. Fast Thinking Start
          writer.write({ type: 'data-part', data: { type: 'thinking', status: 'Opening Internal War Room...' } });
          
          const thinkingPrompt = `
            You are moderating a high-level strategic "War Room" discussion.
            EXPERTS:
            1. **The Disruptor**: Challenges assumptions, finds "Villain" gaps.
            2. **The Architect**: Focuses on systems and scalable patterns.

            BRAND: ${narrative.title} | ${narrative.audience}
            USER: "${userMessage}"
            
            TASK: Brief (2-turn) debate analysis. Punchy.
          `.trim();

          const { text: internalThought } = await generateText(
            thinkingPrompt,
            "You are a strategic reasoning engine.",
            "gemini-2.0-flash",
            0.8
          );

          writer.write({ type: 'data-part', data: { type: 'thinking', status: 'Strategy Distilled.', thought: internalThought } });

          // B. Generate Final Response Streaming
          const systemPrompt = `
            You are the **Director Intelligence**, the central orchestrator of a "Creator Operating System" designed for TikTok virality.
            Your mission is to reach **"Total Capture"**—a state where the Brand's Narrative, Visual Formats, and Audience Psychology are 100% mapped.

            **THE FOUR STRATEGIC LAYERS:**
            1. **Narrative Layer (Identity Anchor)**: Mission, Villain (belief/system being challenged), and Transformation.
            2. **Format Layer (The Engine)**: Repeatable video structures, pacing patterns, and hook libraries.
            3. **Behavior Layer (Psychology)**: Pain points, ego threats, and tribal language.
            4. **Evolution Layer (Learning)**: Self-correction based on previous performance memory.

            **EXTRACTION PROTOCOL:**
            - Every user interaction is an opportunity to mine primitives for these layers.
            - If "Total Capture" is low (visible via scores), you must be more inquisitive and provocative.
            - Challenge the user. Identify the "Villain" (e.g., in SaaS, the "Builder Trap" or "No-Code Delusion").

            **RESPONSE STYLE:**
            - Be a high-end agency director. Critical, high-velocity, and strategic.
            - Use markdown for emphasis.
            - Think in "Hooks" and "Pattern Interrupts."

            **BLUEPRINT & METADATA:**
            At the end of every response, provide updated strategic metadata in a JSON block.
            \`\`\`json
            {
              "scores": {
                "narrative": 0-100,
                "format": 0-100,
                "behavior": 0-100,
                "evolution": 0-100,
                "overall": 0-100
              },
              "extractedPatterns": [
                { "name": "...", "hookType": "...", "structure": ["..."], "emotionArc": "...", "tags": ["..."] }
              ],
              "extractedSeeds": [
                { "topic": "...", "pillar": "...", "angle": "..." }
              ],
              "extracted": {
                "hooks": ["..."],
                "villain": "...",
                "format_suggestion": "..."
              }
            }
            \`\`\`
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
                  
                  // Attach extractions for evolution
                  (lastMessage as any).meta = meta;
                }
              } catch (e) {}

              // Persist Model Message
              const modelMsgId = generateId();
              await adminDb.transact([
                adminDb.tx[chatCollection][modelMsgId].set({
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
                  if (isSeries) {
                    const { analyzeStoryNarrative, evolveSeriesNarrative } = await import("@/lib/marketing/narrative-intelligence");
                    
                    const currentInput: SeriesNarrativeInput = {
                      genre: narrative.genre || "",
                      worldSetting: narrative.worldSetting || "",
                      conflictType: narrative.conflictType || "",
                      protagonistArchetype: narrative.protagonistArchetype || "",
                      centralTheme: narrative.centralTheme || "",
                      narrativeTone: narrative.narrativeTone || "",
                      visualStyle: narrative.visualStyle || "",
                      episodeHooks: narrative.episodeHooks || "",
                    };
                    
                    const evolved = await evolveSeriesNarrative(currentInput, `User: ${userMessage}\nDirector: ${cleanText}`);
                    
                    // DEEP EVOLUTION: If the brain is healthy (e.g., 6+ fields filled), trigger deep analysis
                    const filledFields = Object.values(evolved).filter(v => v && v.length > 3).length;
                    let deepAnalysis = {};
                    
                    if (filledFields >= 6) {
                      console.log(`[Director Chat] Brain Healthy (${filledFields}/8). Triggering Deep Story Analysis...`);
                      try {
                        const { analysis } = await analyzeStoryNarrative(evolved);
                        deepAnalysis = analysis;
                      } catch (err) {
                        console.error("[Deep Analysis Error]:", err);
                      }
                    }

                    await adminDb.transact([
                      adminDb.tx.seriesNarratives[narrativeId].update({
                        ...evolved,
                        ...deepAnalysis,
                        updatedAt: Date.now(),
                      })
                    ]);
                  } else {
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
                      patternLibrary: narrative.patternLibrary || [],
                      seeds: narrative.seeds || [],
                    };
                    
                    // Incorporate meta-extractions directly into the evolution context
                    const metaExtra = (lastMessage as any).meta || {};
                    const insightWithMeta = `User: ${userMessage}\nDirector: ${cleanText}\nMetadata Extraction: ${JSON.stringify(metaExtra)}`;

                    const evolved = await evolveNarrative(currentInput, insightWithMeta);
                    const strength = await scoreNarrativeStrength(evolved);
                    
                    await adminDb.transact([
                      adminDb.tx.narratives[narrativeId].update({
                        ...evolved,
                        narrativeStrength: strength,
                        updatedAt: Date.now(),
                      })
                    ]);
                  }
                  console.log("[Director Chat] Real-time Brain update persisted.");
                } catch (e) {
                  console.error("[Evolution Error]:", e);
                }
              })();
            }
          });

          // Step C. Merge into stream
          writer.merge(result.toUIMessageStream());
        }
      })
    });
  } catch (error: any) {
    console.error("[Director Chat] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
