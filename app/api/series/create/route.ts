import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/gemini-client";
import type { SeriesMetadata } from "@/lib/types";
import { adminDb } from "@/lib/instant-admin";
import { withRetry } from "@/lib/ai/retry";
import { sanitizeJson } from "@/lib/ai/json-utils";


const FORMALIZE_SERIES_PROMPT = (megaPrompt: string) => `
You are creating a structured JSON plan for a video series based on this mega-prompt:

"${megaPrompt}"

Generate a JSON object with:
- title: Catchy series title (3-6 words)
- tagline: One-sentence hook describing the series
- visualConsistency: 2-3 sentence style guide for character/setting/style consistency across ALL episodes (animated/illustrated style ONLY, never realistic)
- episodes: Array of episode objects, each with:
  - title: Episode title (3-5 words)
  - beats: Array of 3-5 key narrative beats/plot points for this episode

CRITICAL VISUAL STYLE RULES:
- All visuals must be ANIMATED/ILLUSTRATED style (flat 2D, motion graphics, stylized 3D cartoon)
- NEVER realistic, photographic, or live-action
- Characters should be stylized icons, stick figures, or cartoon designs
- Maintain consistent character/style across all episodes

Each episode should contain ~60-90 seconds worth of content when narrated.

Return ONLY valid JSON in this exact format:
{
  "title": "Series Title Here",
  "tagline": "One sentence describing the series journey",
  "visualConsistency": "Style guide: flat 2D illustration with bold colors, minimalist cartoon characters, simple geometric shapes. Characters: stick figure style with consistent color palette (blues/purples). Environments: abstract representations of spaces.",
  "episodes": [
    {
      "title": "Episode 1 Title",
      "beats": [
        "Opening beat describing the setup",
        "Second beat with conflict or discovery",
        "Third beat escalating the situation",
        "Closing beat with cliffhanger or resolution"
      ]
    }
  ]
}
`;

const GENERATE_EPISODE_SCRIPT_PROMPT = (
  episodeTitle: string,
  beats: string[],
  episodeNumber: number,
  visualConsistency: string
) => `
You are writing a verbatim narration script for Episode ${episodeNumber}: "${episodeTitle}"

Episode Beats:
${beats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

Visual Style Guide:
${visualConsistency}

Generate a NATURAL, conversational narration script that:
1. Tells the story following these beats
2. Is ~60-90 seconds when read aloud
3. Breaks naturally into 5-7 scenes (one paragraph per scene, separated by blank lines)
4. Uses engaging, accessible language
5. Each scene should be 10-15 seconds of narration

Also generate visual prompts for each scene that:
- Follow the visual consistency guide strictly
- Describe animated/illustrated visuals (NOT realistic)
- Maintain character/setting consistency
- Are specific and detailed for image generation

Return ONLY valid JSON:
{
  "script": "Scene 1 paragraph\n\nScene 2 paragraph\n\nScene 3 paragraph...",
  "visualPrompts": [
    "Flat 2D illustration of [scene 1 description], consistent with style guide",
    "Flat 2D illustration of [scene 2 description], same character design",
    ...
  ]
}
`;

// Force dynamic since we use AI and increase duration for long series generation
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max allowed for hobby/pro on Vercel

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  let totalCost = 0;

  // Helper to send progress updates
  const sendProgress = (controller: ReadableStreamDefaultController, message: string) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message, totalCost })}\n\n`));
  };


  const sendError = (controller: ReadableStreamDefaultController, error: string) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error })}\n\n`));
  };

  const sendSuccess = (controller: ReadableStreamDefaultController, data: any) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'success', data })}\n\n`));
  };

  const stream = new ReadableStream({
    async start(controller) {
      
      try {
        const { megaPrompt } = await request.json();

        if (!megaPrompt || megaPrompt.length < 100) {
          sendError(controller, "Mega-prompt must be at least 100 characters");
          controller.close();
          return;
        }

        // Authenticate user
        const authHeader = request.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          sendError(controller, "Unauthorized: Missing or invalid token");
          controller.close();
          return;
        }
        const token = authHeader.split(" ")[1];
        
        // Verify the token with InstantDB
        const user = await adminDb.auth.verifyToken(token);
        if (!user || !user.id) {
          sendError(controller, "Unauthorized: Invalid session");
          controller.close();
          return;
        }
        
        const userId = user.id;

        // Step 1: Formalize mega-prompt into structured series JSON
        console.log("[Series] Formalizing mega-prompt for user:", userId);
        sendProgress(controller, "Analyzing your idea and creating series structure...");
        
        const { text: formalizeText, cost: formalizeCost } = await withRetry(() => generateText(
          FORMALIZE_SERIES_PROMPT(megaPrompt),
          "You are a JSON generator. Respond with ONLY valid JSON.",
          "gpt-4o",
          0.3,
          true
        ));
        totalCost += formalizeCost;

        
        // Safe JSON extraction for formalizeText
        let formalizedJson: SeriesMetadata;
        try {
          let jsonMatch = formalizeText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            console.error("[Series] No JSON found in formalize response:", formalizeText);
            throw new Error("AI failed to generate a structured plan. Please try again.");
          }
          const sanitized = sanitizeJson(jsonMatch[0]);
          console.log("[Series] Formalized sanitized JSON (start):", sanitized.slice(0, 100));
          formalizedJson = JSON.parse(sanitized);
          
          // Basic validation
          if (!formalizedJson.title || !Array.isArray(formalizedJson.episodes)) {
            throw new Error("AI returned an incomplete plan structure.");
          }
        } catch (e: any) {
          console.error("[Series] Formalization parse failed:", e, "Raw text:", formalizeText);
          throw new Error(e.message.includes("Unexpected token") 
            ? "Failed to parse series structure. The AI response was malformed." 
            : e.message);
        }
        
        console.log(`[Series] Generated structure for "${formalizedJson.title}" with ${formalizedJson.episodes.length} episodes`);
        sendProgress(controller, `✓ Series structure created: "${formalizedJson.title}"`);

        // Step 2: Generate scripts for all episodes in parallel
        sendProgress(controller, `Generating scripts for all ${formalizedJson.episodes.length} episodes...`);
        
        const generationPromises = formalizedJson.episodes.map(async (episode, index) => {
          const { text: scriptText, cost: scriptCost } = await withRetry(() => generateText(
            GENERATE_EPISODE_SCRIPT_PROMPT(
              episode.title,
              episode.beats,
              index + 1,
              formalizedJson.visualConsistency
            ),
            "You are a JSON generator. Respond with ONLY valid JSON.",
            "gpt-4o",
            0.3,
            true
          ));
          totalCost += scriptCost;

          
          try {
            let episodeJsonMatch = scriptText.match(/\{[\s\S]*\}/);
            if (!episodeJsonMatch) {
              throw new Error(`AI failed to generate script for episode ${index + 1}`);
            }
            const sanitized = sanitizeJson(episodeJsonMatch[0]);
            console.log(`[Series] Episode ${index + 1} sanitized JSON (start):`, sanitized.slice(0, 100));
            const parsed = JSON.parse(sanitized);
            if (!parsed.script || !Array.isArray(parsed.visualPrompts)) {
              throw new Error(`Incomplete script data for episode ${index + 1}`);
            }
            
            sendProgress(controller, `✓ Episode ${index + 1} script ready`);
            
            return {
              episodeNumber: index + 1,
              title: episode.title,
              script: parsed.script,
              visualPrompts: parsed.visualPrompts,
            };
          } catch (e: any) {
            console.error(`[Series] Episode ${index + 1} parse failed:`, e, "Raw text:", scriptText);
            throw new Error(e.message.includes("Unexpected token") 
              ? `Failed to parse script for episode ${index + 1}. The AI response was malformed.` 
              : e.message);
          }
        });

        const episodeScripts = await Promise.all(generationPromises);

        console.log(`[Series] Generated ${episodeScripts.length} episode scripts`);
        sendProgress(controller, "Saving your series to database...");

        const seriesId = crypto.randomUUID();
        const now = Date.now();

        // Create series
        await adminDb.transact(
          adminDb.tx.series[seriesId].update({
            title: formalizedJson.title,
            tagline: formalizedJson.tagline,
            megaPrompt,
            formalizedJson,
            visualConsistency: formalizedJson.visualConsistency,
            episodeCount: formalizedJson.episodes.length,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          })
        );

        // Create episodes
        const episodeIds: string[] = [];
        for (let i = 0; i < episodeScripts.length; i++) {
          const episodeId = crypto.randomUUID();
          episodeIds.push(episodeId);
          
          await adminDb.transact([
            adminDb.tx.episodes[episodeId].update({
              episodeNumber: episodeScripts[i].episodeNumber,
              title: episodeScripts[i].title,
              script: episodeScripts[i].script,
              visualPrompts: episodeScripts[i].visualPrompts,
              status: "script_ready",
              createdAt: now,
              updatedAt: now,
            }),
            // Link episode to series
            adminDb.tx.episodes[episodeId].link({ series: seriesId }),
          ]);
        }

        // Link series to user
        await adminDb.transact(
          adminDb.tx.series[seriesId].link({ owner: userId })
        );

        console.log(`[Series] Created series ${seriesId} with ${episodeIds.length} episodes`);
        
        sendSuccess(controller, {
          seriesId,
          episodeIds,
          title: formalizedJson.title,
        });

        controller.close();

      } catch (error: any) {
        console.error("[Series] Final error in POST handler:", error);
        sendError(controller, error.message || "An unexpected error occurred while creating the series.");
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
