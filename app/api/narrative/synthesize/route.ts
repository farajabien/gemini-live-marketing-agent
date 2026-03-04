import { NextRequest } from "next/server";
import { generateText } from "@/lib/ai/gemini-client";
import { adminDb } from "@/lib/firebase-admin";
import { withRetry } from "@/lib/ai/retry";

const SYNTHESIZE_PROMPT = (title: string, answers: Record<string, string>) => `
You are synthesizing a Founder Narrative for a startup called "${title}".

Here are the founder's raw answers to 8 deep questions about their venture:

## The Moment (when the problem became undeniable)
${answers.theMoment}

## The Pain (who suffers and how)
${answers.thePain}

## Failed Solutions (what exists and why it fails)
${answers.failedSolutions}

## Their Belief (contrarian insight)
${answers.yourBelief}

## Their Approach (philosophy, not features)
${answers.yourApproach}

## Their Ideal User
${answers.idealUser}

## The Change They Want to Create
${answers.desiredChange}

## Founder Voice Style: ${answers.founderVoice}

---

From these answers, generate a comprehensive Founder Narrative. Return ONLY valid JSON in this exact format:

{
  "synthesizedNarrative": "A 300-500 word narrative document written in the founder's voice. This should read like a manifesto — clear, authentic, compelling. It should weave together all 8 answers into a cohesive story. Write in first person.",
  "narrativeAngles": [
    "Angle 1: A specific topic/perspective for content (10-15 of these)",
    "Angle 2: Another angle...",
    "..."
  ],
  "oneLiner": "One sentence elevator pitch (max 15 words)",
  "problemStatement": "2-3 sentence distilled problem statement in the user's language"
}

RULES:
- The narrative MUST match the founder voice style: ${answers.founderVoice}
- Narrative angles should be SPECIFIC and ACTIONABLE content topics, not generic
- Each angle should be a different lens on the same core story
- The one-liner should be punchy and memorable
- Don't be salesy — be genuine and excited about the product
- Use simple, clear language
- IMPORTANT: DO NOT include the startup title or tagline (H1/H2) inside the generated narrative text itself; the UI already handles displaying these. Start directly with the narrative content.
`;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  let totalCost = 0;

  const sendProgress = (controller: ReadableStreamDefaultController, message: string) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "progress", message, totalCost })}\n\n`));
  };


  const sendError = (controller: ReadableStreamDefaultController, error: string) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error })}\n\n`));
  };

  const sendSuccess = (controller: ReadableStreamDefaultController, data: any) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "success", data })}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { narrativeId, title, answers } = await request.json();

        // Authenticate
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          sendError(controller, "Unauthorized");
          controller.close();
          return;
        }
        const token = authHeader.split(" ")[1];
        const user = await adminDb.auth.verifyToken(token);
        if (!user?.id) {
          sendError(controller, "Unauthorized: Invalid session");
          controller.close();
          return;
        }

        // Fetch narrative to verify ownership
        const narrativeResult = await adminDb.query({
          narratives: {
            $: { where: { id: narrativeId } },
            owner: {},
          },
        });

        const narrative = (narrativeResult as any)?.narratives?.[0];
        if (!narrative) {
          sendError(controller, "Narrative not found");
          controller.close();
          return;
        }

        // Security check: If there's an owner, it must be the current user.
        // If there's NO owner yet, we allow it if it's in 'wizard' status (handling race conditions)
        const narrativeOwnerId = narrative.owner?.[0]?.id;
        if (narrativeOwnerId && narrativeOwnerId !== user.id) {
          sendError(controller, "Forbidden: You do not own this narrative");
          controller.close();
          return;
        }

        if (!narrativeOwnerId && narrative.status !== "wizard") {
          sendError(controller, "Forbidden: Narrative ownership missing");
          controller.close();
          return;
        }

        sendProgress(controller, "Synthesizing your founder narrative...");

        // Call AI to synthesize narrative
        const { text: synthesisText, cost } = await withRetry(() =>
          generateText(
            SYNTHESIZE_PROMPT(title, answers),
            "You are a JSON generator. Respond with ONLY valid JSON.",
            "gemini-1.5-pro",
            0.4
          )
        );
        totalCost += cost;



        sendProgress(controller, "Parsing narrative structure...");

        // Parse AI response
        let synthesized: {
          synthesizedNarrative: string;
          narrativeAngles: string[];
          oneLiner: string;
          problemStatement: string;
        };

        try {
          const jsonMatch = synthesisText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found in AI response");
          synthesized = JSON.parse(jsonMatch[0]);

          if (!synthesized.synthesizedNarrative || !Array.isArray(synthesized.narrativeAngles)) {
            throw new Error("Incomplete narrative structure");
          }
        } catch (e: any) {
          console.error("[Narrative] Parse failed:", e, "Raw:", synthesisText);
          throw new Error("Failed to parse narrative. Please try again.");
        }

        sendProgress(controller, "Saving your narrative to database...");

        // Update narrative in DB with synthesized data AND ensure owner link
        await adminDb.transact([
          adminDb.tx.narratives[narrativeId].update({
            userId: user.id, // Ensure userId is set for security rules
            synthesizedNarrative: synthesized.synthesizedNarrative,
            narrativeAngles: synthesized.narrativeAngles,
            oneLiner: synthesized.oneLiner,
            problemStatement: synthesized.problemStatement,
            status: "active",
            currentWizardStep: 9,
            updatedAt: Date.now(),
          }),
          adminDb.tx.narratives[narrativeId].link({ owner: user.id }),
        ]);

        console.log(`[Narrative] Synthesized narrative ${narrativeId} for user ${user.id}`);

        sendSuccess(controller, { narrativeId });
        controller.close();
      } catch (error: any) {
        console.error("[Narrative] Synthesis error:", error);
        sendError(controller, error.message || "An unexpected error occurred");
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
