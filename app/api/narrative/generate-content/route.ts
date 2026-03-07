import { NextRequest } from "next/server";
import { generateText } from "@/lib/ai/gemini-client";
import { adminDb } from "@/lib/firebase-admin";
import { withRetry } from "@/lib/ai/retry";

const GENERATE_CONTENT_PROMPT = (
  narrative: {
    title: string;
    synthesizedNarrative: string;
    narrativeAngles: string[];
    founderVoice: string;
    oneLiner: string;
    problemStatement: string;
  },
  format: string = "linkedin-post",
  batchSize: number = 3,
  preferredAngle?: string,
  existingContent: Array<{ hook: string; title: string }> = []
) => {
  const formatDescriptions: Record<string, string> = {
    "linkedin-post": "LinkedIn posts (150-300 words, punchy, scannable, line breaks).",
    "x-post": "X/Twitter posts or short threads (short, punchy, under 280 characters per thought, use visual hooks).",
    "short-video": "Short form video scripts (15-60s) perfect for TikTok, Instagram Reels, or YouTube Shorts. High-impact, fast-paced, hook-driven. Focus on immediate value or strong emotional reaction. Use punchy, spoken language. Include visual scene descriptions in brackets like [Visual: ...].",
    "long-video": "Long-form video scripts (5-15 mins) for YouTube. Detailed outlines with strong opening hooks, retention spikes every 2 mins, B-roll suggestions, and a concluding call to action.",
    "carousel": "LinkedIn Carousel copy (7-10 slides). Structure: Slide 1 (Hook), Slides 2-5 (Core Tips/Steps), Slide 6 (Tactical Example/Counter-intuitive insight), Slide 7-8 (Specific 'How-to'), Slide 9 (Summary), Slide 10 (Soft CTA). Keep text per slide VERY short and punchy. CRITICAL: DO NOT include labels like 'Slide 1:', 'Slide 2:', 'Scene 1:', etc. in the body text - write raw content only, no prefixes or slide numbers.",
    "tiktok-carousel": "TikTok Photo Mode/IG Carousel copy (5-15 slides). High-density visual storytelling. Each slide must have a clear visual hook and minimal, high-impact text. Structure: Slide 1 (The Hook/Scroll Stopper), Slides 2-N (The Story/Value Build), Final Slide (Engagement CTA).",
    "blog-post": "Full blog posts (800-1500 words). Structure: Compelling headline, engaging intro with hook, 3-5 main sections with subheadings, actionable insights, real examples, conclusion with key takeaways. Include suggestions for [IMAGE: description] placeholders and [REFERENCE: source/link] citations where relevant. Write for SEO with natural keyword integration. Tone should match founder voice while being accessible and valuable.",
  };

  const avoidList = existingContent.map(c => `- ${c.title}: ${c.hook}`).join("\n");
  const angleFocus = preferredAngle ? `CRITICAL: Focus specifically on this angle: "${preferredAngle}"` : "Vary the angles used based on the available list.";

  return `
You are generating ${formatDescriptions[format] || format} for a founder based on their Founder Narrative.

## Startup: ${narrative.title}
## One-liner: ${narrative.oneLiner}

## Full Narrative:
${narrative.synthesizedNarrative}

## Problem Statement:
${narrative.problemStatement}

## Founder Voice: ${narrative.founderVoice}

## Available Narrative Angles:
${narrative.narrativeAngles.map((a, i) => `${i + 1}. ${a}`).join("\n")}

---

${angleFocus}

Generate ${batchSize} DIFFERENT content pieces in the "${format}" format. Each piece should:
1. Use a DIFFERENT perspective (unless a preferred angle is specified)
2. Open with a strong, scroll-stopping hook (first line)
3. Match the founder voice: ${narrative.founderVoice}
4. End naturally — no forced CTAs unless contextual
5. Feel like a real founder sharing genuine insight, NOT marketing

${existingContent.length > 0 ? `
## IMPORTANT: Avoid Repeating Past Content
We have already generated the following content. Do NOT use these exact hooks or titles. Ensure the new pieces feel fresh and cover new ground:
${avoidList}
` : ""}

CONTENT RULES:
- Every piece traces back to THE narrative
- No trend-jacking unless it reinforces the belief
- No motivational fluff
- Product mentions must be contextual, not CTA-driven
- Repetition of ideas is allowed — wording repetition is NOT
- Line breaks for readability

ANTI-ROBOTICS RULES (CRITICAL):
- NO generic summaries at the end (e.g., "In conclusion," "To summarize").
- NO robotic CTAs (e.g., "Ready to scale?", "Join the journey.", "Let's build together.").
- NO "LinkedIn-bro" tropes (e.g., "Agree?", "Thoughts?", "Wait for it.").
- NO artificial polish. If you're stuck, use a trailing thought or an open question that feels like a real human thinking.
- The ending should feel like the founder just stopped talking because they finished their thought, not because they are trying to "close" a sale.
- Use variety in sentence length and occasional fragments for rhythm.

Return ONLY valid JSON:
{
  "pieces": [
    {
      "title": "Short descriptive title for internal reference",
      "hook": "The opening line that stops the scroll",
      "body": "The full content text including the hook. For threads, use 'Tweet 1: ... Tweet 2: ...' format within the body.",
      "angle": "Which narrative angle this uses",
      "format": "${format}"
    }
  ]
}
`;
};

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
        const { narrativeId, format = "linkedin-post", count = 3, preferredAngle, pillarId } = await request.json();

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

        sendProgress(controller, "Loading your narrative and history...");

        // Fetch narrative and existing content pieces from DB
        const narrativeResult = await adminDb.query({
          narratives: {
            $: { where: { id: narrativeId } },
            owner: {},
            contentPieces: {},
          },
        });
        
        // Fields like aiPositioning and angles are fetched automatically as they are not relations

        const narrative = (narrativeResult as any)?.narratives?.[0];
        if (!narrative) {
          sendError(controller, "Narrative not found");
          controller.close();
          return;
        }

        // UNIFY CONTEXT: Handle both legacy and new narrative formats
        const synthesizedNarrative = narrative.synthesizedNarrative || 
          (narrative.aiPositioning ? `
            BRAND STRATEGY:
            Villain: ${narrative.aiPositioning.villain}
            Hero: ${narrative.aiPositioning.hero}
            Promise: ${narrative.aiPositioning.promise}
            Unique Mechanism: ${narrative.aiPositioning.mechanism}
            
            TRANSFORMATION:
            From: ${narrative.aiPositioning.contrast?.before}
            To: ${narrative.aiPositioning.contrast?.after}
            
            AUDIENCE: ${narrative.audience}
            PROBLEM: ${narrative.problem}
            SOLUTION: ${narrative.solution}
          ` : null);

        if (!synthesizedNarrative) {
          sendError(controller, "Narrative strategy is incomplete. Please finish the wizard first.");
          controller.close();
          return;
        }

        const narrativeAngles = narrative.narrativeAngles || 
          (narrative.angles ? [
            ...(narrative.angles.painAngles || []),
            ...(narrative.angles.costAngles || []),
            ...(narrative.angles.mechanismAngles || []),
            ...(narrative.angles.identityAngles || []),
            ...(narrative.angles.outcomeAngles || [])
          ] : []);

        // Security check: If there's an owner, it must be the current user.
        const narrativeOwnerId = narrative.owner?.[0]?.id;
        if (narrativeOwnerId && narrativeOwnerId !== user.id) {
          sendError(controller, "Forbidden: You do not own this narrative");
          controller.close();
          return;
        }

        const existingContent = (narrative.contentPieces || [])
          .filter((c: any) => c.status !== "rejected")
          .map((c: any) => ({
            title: c.title,
            hook: c.hook,
          }));

        sendProgress(controller, `Generating ${count} ${format} suggestions...`);

        const { text: contentText, cost } = await withRetry(() =>
          generateText(
            GENERATE_CONTENT_PROMPT(
              {
                title: narrative.title,
                synthesizedNarrative: synthesizedNarrative,
                narrativeAngles: narrativeAngles,
                founderVoice: narrative.founderVoice || narrative.voice || "calm",
                oneLiner: narrative.oneLiner || narrative.aiPositioning?.promise || "",
                problemStatement: narrative.problemStatement || narrative.aiPositioning?.stakes || "",
              },
              format,
              count,
              preferredAngle,
              existingContent
            ),
            "You are a JSON generator. Respond with ONLY valid JSON.",
            "gemini-2.0-flash",
            0.7 // Higher temperature for creative content
          )
        );
        totalCost += cost;



        sendProgress(controller, "Parsing content suggestions...");

        let pieces: Array<{
          title: string;
          hook: string;
          body: string;
          angle: string;
          format: string;
        }>;

        try {
          const jsonMatch = contentText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("No JSON found in AI response");
          const parsed = JSON.parse(jsonMatch[0]);
          pieces = parsed.pieces || parsed.posts; // backward compatibility

          if (!Array.isArray(pieces) || pieces.length === 0) {
            throw new Error("No content generated");
          }
        } catch (e: any) {
          console.error("[Content] Parse failed:", e, "Raw:", contentText);
          throw new Error("Failed to parse content. Please try again.");
        }

        sendProgress(controller, `Saving ${pieces.length} content suggestions...`);

        // Save content pieces to DB
        const contentIds: string[] = [];
        const now = Date.now();

        for (const piece of pieces) {
          const contentId = crypto.randomUUID();
          contentIds.push(contentId);

          await adminDb.transact([
            adminDb.tx.contentPieces[contentId].set({
              narrativeId: narrativeId, // Required by schema
              userId: user.id, // Required by security rules
              title: piece.title,
              body: piece.body,
              hook: piece.hook,
              angle: piece.angle,
              format: (piece.format || format) as any,
              status: "suggested",
              pillarId: pillarId || undefined,
              createdAt: now,
              updatedAt: now,
            }),
            adminDb.tx.contentPieces[contentId].link({ narrative: narrativeId }),
          ]);
        }

        // Ensure narrative is linked to owner if it wasn't already
        if (!narrativeOwnerId) {
          await adminDb.transact([adminDb.tx.narratives[narrativeId].link({ owner: user.id })]);
        }

        console.log(
          `[Content] Generated ${contentIds.length} ${format} pieces for narrative ${narrativeId}`
        );

        sendSuccess(controller, { contentIds, count: contentIds.length });
        controller.close();
      } catch (error: any) {
        console.error("[Content] Generation error:", error);
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
