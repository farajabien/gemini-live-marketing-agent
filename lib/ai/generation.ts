"use server";
import { generateText } from "./gemini-client";

import type {
  ContentSettings,
  ReferenceImage,
  SceneChunkOptions,
  VideoPlan,
  VoiceTone,
  StrategyContext,
} from "../types";
import { DEFAULT_SETTINGS, buildPromptContext, buildStrategyContext } from "../content-settings";
import { SEAMLESS_CAROUSEL_HINT, VISUAL_STYLE_CONSTRAINT } from "../constants";
import { injectStyleConstraint, VISUAL_PROMPTS } from "@/lib/prompts";
import { generateVerbatimPlan } from "./verbatim";
import { enhanceScenesWithSubScenes } from "./subscene-generator";
import { sanitizeJson } from "./json-utils";

// Re-export refineIdea so it can be imported
export { refineIdea };

// ============================================================================
// Verbatim Mode Generation
// ============================================================================

export interface VerbatimGenerationOptions {
  verbatimMode: true;
  tone?: VoiceTone;
  sceneChunkOptions?: SceneChunkOptions;
  strategy?: StrategyContext;
  previousContent?: string;
}

export interface StandardGenerationOptions {
  verbatimMode?: false;
  // Visual strategy
  visualMode?: "image" | "broll" | "gif_voice" | "text_motion";
  seamlessMode?: boolean;
  strategy?: StrategyContext;
  previousContent?: string;
}

export type GenerationOptions = VerbatimGenerationOptions | StandardGenerationOptions;

/**
 * Generate a video plan with optional verbatim mode.
 */
export async function generateVideoPlanWithOptions(
  idea: string,
  formatOrPrompt: "video" | "carousel" | string,
  durationOrThumbnail: "30s" | "60s" | string = "30s", 
  optionsOrFormat: GenerationOptions | "video" | "carousel" = {},
  settingsOrImages: ContentSettings | ReferenceImage[] = DEFAULT_SETTINGS,
  imagesArg: ReferenceImage[] | ContentSettings = []
): Promise<{ plan: VideoPlan; cost: number }> {
    let totalCost = 0;

    // Handle overloaded arguments to support both calling conventions
    if (typeof optionsOrFormat === 'string') {
        const refinedPrompt = idea;
        const thumbnailPrompt = formatOrPrompt as string;
        const duration = durationOrThumbnail as "30s" | "60s";
        const format = optionsOrFormat as "video" | "carousel";
        const images = settingsOrImages as ReferenceImage[];
        const settings = imagesArg as unknown as ContentSettings;

        return generatePlanFromRefinedPrompt(refinedPrompt, thumbnailPrompt, duration, format, images, settings, 'image');
    }

    const format = formatOrPrompt as "video" | "carousel";
    const duration = durationOrThumbnail as "30s" | "60s";
    const options = optionsOrFormat as GenerationOptions;
    const settings = settingsOrImages as ContentSettings;
    const images = imagesArg as ReferenceImage[];

  if (options.verbatimMode) {
    const verbatimOptions = options as VerbatimGenerationOptions;
    const verbatimResult = await generateVerbatimPlan(
      idea,
      verbatimOptions.sceneChunkOptions,
      verbatimOptions.strategy,
      format
    );
    totalCost += verbatimResult.cost;

    let enhancedScenes = verbatimResult.scenes;
    if (format === "video") {
        enhancedScenes = await enhanceScenesWithSubScenes(verbatimResult.scenes);
    }

    const { text: thumbnailPrompt, cost: thumbnailCost } = await generateThumbnailPromptForVerbatim(idea, verbatimResult.title);
    totalCost += thumbnailCost;

    const videoPlan: VideoPlan = {
      title: verbatimResult.title,
      tone: verbatimOptions.tone || "neutral",
      scenes: enhancedScenes,
      estimatedDuration: verbatimResult.estimatedDuration,
      type: format,
      thumbnailPrompt,
      visualConsistency: verbatimResult.visualConsistency,
      verbatimMode: true,
      verbatimTone: verbatimOptions.tone || "neutral",
      originalScript: verbatimResult.originalScript,
      style: settings.style,
      audience: settings.audience,
      goal: settings.goal,
      outputFormat: settings.outputFormat,
      problem: options.strategy?.problem,
      solution: options.strategy?.solution,
      voice: options.strategy?.voice,
      positioning: options.strategy?.positioning,
      pillars: options.strategy?.pillars,
    };
    
    return { plan: videoPlan, cost: totalCost };
  }

  const standardOptions = options as StandardGenerationOptions;
  const visualMode = standardOptions.visualMode || "image";
  const seamlessMode = standardOptions.seamlessMode || false;

  const { refinedPrompt, thumbnailPrompt, cost: refineCost } = await refineIdea(idea, format, settings, standardOptions.strategy, standardOptions.previousContent);
  totalCost += refineCost;
  const planResult = await generatePlanFromRefinedPrompt(refinedPrompt, thumbnailPrompt, duration, format, images, settings, visualMode, seamlessMode, standardOptions.strategy, standardOptions.previousContent);
  totalCost += planResult.cost;
  return { plan: planResult.plan, cost: totalCost + planResult.cost };
}


/**
 * Generate a thumbnail prompt for verbatim content
 */
async function generateThumbnailPromptForVerbatim(script: string, title: string): Promise<{ text: string; cost: number }> {

  const promptTemplate = VISUAL_PROMPTS.VERBATIM_THUMBNAIL(script, title);
  const prompt = injectStyleConstraint(promptTemplate, VISUAL_STYLE_CONSTRAINT);
  const { text, cost } = await generateText(prompt, "You are an expert visual director.", "gpt-4o", 0.7);
  return { text, cost };


}

async function refineIdea(
  idea: string,
  format: "video" | "carousel",
  settings: ContentSettings,
  strategy?: StrategyContext,
  previousContent?: string
): Promise<{ refinedPrompt: string; thumbnailPrompt: string; cost: number }> {

  const context = buildPromptContext(settings);
  const strategyContext = strategy ? buildStrategyContext(strategy) : "";

  const prompt = `
  You are an expert video content planner.
  Rewrite this idea for clarity and engagement, and generate a thumbnail prompt.
  
  **Idea:** ${idea}
  ${context}
  ${strategyContext}
  ${previousContent ? `\n**PREVIOUS CONTENT ALREADY GENERATED (DO NOT REPEAT):**\n${previousContent}\n` : ""}
  ${VISUAL_STYLE_CONSTRAINT}
  
  Respond with:
  1. Refined video prompt (detailed)
  2. Thumbnail prompt (visual description)
  `;

  const { text: rawText, cost } = await generateText(prompt, "You are an expert content strategist.", "gpt-4o", 0.7);



  const [refinedPrompt, thumbnailPrompt] = rawText.split(/(?:\n2\.|\nThumbnail prompt:)/).map(s => s.trim());

  return {
    refinedPrompt: refinedPrompt || idea,
    thumbnailPrompt: thumbnailPrompt || `Stylized flat illustration thumbnail for: ${idea}. Bold colors, clean design, magazine style.`,
    cost,
  };
}


/**
 * Split out the actual plan generation from refined prompt
 */
async function generatePlanFromRefinedPrompt(
    refinedPrompt: string, 
    thumbnailPrompt: string,
    duration: "30s" | "60s",
    format: "video" | "carousel",
    images: ReferenceImage[],
    settings: ContentSettings,
    visualMode: "image" | "broll" | "gif_voice" | "text_motion" = "image",
    seamlessMode: boolean = false,
    strategy?: StrategyContext,
    previousContent?: string
): Promise<{ plan: VideoPlan; cost: number }> {

    
    // Customize prompt based on visual mode
    let visualPromptInstruction = "visualPrompt: Detailed cinematic description of the scene visuals. Do NOT include the scene's caption/voiceover text as burnt-in text in the image. Contextual text (e.g. signs) is allowed.";
    
    if (visualMode === 'gif_voice' || visualMode === 'text_motion') {
        visualPromptInstruction = "visualPrompt: 2-3 specific keywords for searching Giphy. Example: 'cat typing', 'office stress', 'success celebration'. DO NOT use full sentences.";
    }

    const rules = [
      'textOverlay: 2-5 words max (e.g., "The Golden Hour")',
      `visualPrompt: ${visualPromptInstruction}`,
      'duration: number in seconds',
      `scenes: ${duration === '30s' ? '5-7 scenes' : '10-12 scenes'}`,
      'IMPORTANT: Do NOT burn the voiceover or caption text into the generated image. Text is only allowed if it is a natural part of the scene (e.g. a street sign).',
    ];

    if (format === 'carousel') {
      rules.push('CRITICAL: Since this is a CAROUSEL, ensure visuals are static or slow-moving. Favor punchy, central subjects compatible with square cropping.');
      if (seamlessMode) {
        rules.push(SEAMLESS_CAROUSEL_HINT);
      }
    }

    // Generate the plan JSON using GitHub Models
    const prompt = `
    Create a ${format} plan based on the content. Respond with ONLY valid JSON, no other text.
    
    Content: ${refinedPrompt}
    Format: ${format}
    Duration: ${duration}
    
    JSON structure (copy this exactly):
    {
      "title": "string",
      "tone": "string",
      "visualConsistency": "string",
      "scenes": [
        {
          "id": "1",
          "voiceover": "string",
          "visualPrompt": "string",
          "textOverlay": "string (2-5 words)",
          "duration": 5
        }
      ]
    }

    Rules:
    ${rules.map(r => `- ${r}`).join('\n')}
    
    ${strategy ? buildStrategyContext(strategy) : ""}
    
    ${previousContent ? `\n**IMPORTANT: PREVIOUSLY GENERATED CONTENT FOR THIS ANGLE:**\n${previousContent}\nEnsure this new plan provides a fresh perspective and does not repeat the exact same hooks or narrative beats as the previous content shown above.\n` : ""}
    
    RESPOND WITH ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATIONS.
    `;

    const { text: response, cost } = await generateText(prompt, "You are a JSON generator. Output only valid JSON.", "gpt-4o", 0.3);


    
    try {
        // Clean the response - remove markdown, whitespace, etc.
        let cleanedResponse = response.trim();
        
        // Remove markdown code blocks if present
        cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
        
        // Try to extract JSON object
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            console.error("❌ AI Response (no JSON found):", response.substring(0, 1000));
            throw new Error("No JSON found in AI response");
        }
        
        const planData = JSON.parse(sanitizeJson(jsonMatch[0]));

        // Validate required fields
        if (!planData.title || !planData.scenes || !Array.isArray(planData.scenes)) {
            console.error("Invalid plan structure:", planData);
            throw new Error("AI returned invalid plan structure");
        }

        // Fix: Ensure visualConsistency is a string (AI sometimes returns an object)
        let visualConsistency = planData.visualConsistency;
        if (typeof visualConsistency === 'object' && visualConsistency !== null) {
             visualConsistency = JSON.stringify(visualConsistency);
        } else if (typeof visualConsistency !== 'string') {
             visualConsistency = String(visualConsistency || "");
        }
        const videoPlan: VideoPlan = {
            ...planData,
            visualConsistency,
            type: format,
            thumbnailPrompt,
            estimatedDuration: duration === '30s' ? 30 : 60,
            style: settings.style,
            audience: settings.audience,
            goal: settings.goal,
            outputFormat: settings.outputFormat,
            // Pass strategy fields
            problem: strategy?.problem,
            solution: strategy?.solution,
            voice: strategy?.voice,
            positioning: strategy?.positioning,
            pillars: strategy?.pillars,
        };

        return { plan: videoPlan, cost };
    } catch (e) {
        console.error("Failed to parse plan JSON:", e);
        console.error("Raw AI response:", response.substring(0, 1000));
        throw new Error("Failed to generate video plan. Please try again.");
    }
}
