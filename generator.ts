import { generateVideoPlanWithOptions } from "@/lib/ai/generation";
import { generateText } from "@/lib/ai/gemini-client";
import { ContentSettings } from "@/lib/types";

export interface DraftGenerationInput {
  angle: string;
  pillarId: string;
  narrativeId: string;
  format: "carousel" | "video";
  style: string; // e.g., "educational"
  audience: string;
}

export interface ContentDraftResult {
  title: string;
  slides: any[]; // Scenes from videoPlan
  visualPrompts: string[];
  captions: {
    linkedin: string;
    twitter: string;
    instagram: string;
  };
  videoPlan: any;
}

export async function generateDraftFromAngle(input: DraftGenerationInput): Promise<ContentDraftResult> {
  // 1. Generate the core content (VideoPlan)
  // Map simple format to strict OutputFormat
  const outputFormat = input.format === "video" ? "short-video" : "carousel";

  const settings: ContentSettings = {
    style: input.style as any, // Cast for now as we trust the input/prompt or will validate later
    audience: input.audience as any,
    goal: "drive-uploads", // Default goal
    outputFormat: outputFormat,
  };

  const { plan: videoPlan } = await generateVideoPlanWithOptions(
    input.angle,
    input.format,
    "30s", 
    {
      visualMode: "image", 
    },
    settings
  );

  // 2. Generate Captions & Hooks
  const captionPrompt = `
    You are an expert social media copywriter.
    Based on this content plan, write captions for LinkedIn, Twitter, and Instagram.
    
    Title: ${videoPlan.title}
    Scenes: ${JSON.stringify(videoPlan.scenes.map((s: any) => s.voiceover))}
    Target Audience: ${input.audience}
    
    Requirements:
    - LinkedIn: Professional, storytelling, spacing for readability.
    - Twitter: Thread hook + short summary.
    - Instagram: Engaging, heavily hashtagged.
    - Call to Action: "DM me 'SYSTEM' to build this."
    
    Output JSON ONLY:
    {
      "linkedin": "...",
      "twitter": "...",
      "instagram": "..."
    }
  `;
  
  const { text: captionResponse } = await generateText(captionPrompt, "You are a copywriter. Output JSON only.", "gpt-4o", 0.7);
  let captions = { linkedin: "", twitter: "", instagram: "" };
  
  try {
     const jsonMatch = captionResponse.match(/\{[\s\S]*\}/);
     if (jsonMatch) {
        const { sanitizeJson } = await import("@/lib/ai/json-utils");
        captions = JSON.parse(sanitizeJson(jsonMatch[0]));
     }

  } catch (e) {
      console.error("Failed to parse captions:", e);
      // Fallback
      captions.linkedin = `New content on ${videoPlan.title}! #marketing`;
  }

  return {
    title: videoPlan.title,
    slides: videoPlan.scenes,
    visualPrompts: videoPlan.scenes.map((s: any) => s.visualPrompt),
    captions,
    videoPlan,
  };
}
