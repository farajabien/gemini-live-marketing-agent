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
}

export interface StandardGenerationOptions {
  verbatimMode?: false;
  // Visual strategy
  visualMode?: "image" | "broll" | "gif_voice" | "text_motion";
  seamlessMode?: boolean;
  strategy?: StrategyContext;
}

export type GenerationOptions = VerbatimGenerationOptions | StandardGenerationOptions;

/**
 * Generate a video plan with optional verbatim mode.
 */
export async function generateVideoPlanWithOptions(
  idea: string,
  // Fix argument order/types to match usage in GenerateScreen.tsx logic
  formatOrPrompt: "video" | "carousel" | string,
  durationOrThumbnail: "30s" | "60s" | string = "30s", 
  optionsOrFormat: GenerationOptions | "video" | "carousel" = {},
  settingsOrImages: ContentSettings | ReferenceImage[] = DEFAULT_SETTINGS,
  imagesArg: ReferenceImage[] | ContentSettings = []
): Promise<VideoPlan> {
    // Handle overloaded arguments to support both calling conventions
    // Case 1: Called from GenerateScreen.tsx (Standard Mode - Legacy Call)
    // generateVideoPlanWithOptions(refinedPrompt, thumbnailPrompt, duration, format, imagesPayload, settings)
    if (typeof optionsOrFormat === 'string') {
        const refinedPrompt = idea;
        const thumbnailPrompt = formatOrPrompt as string;
        const duration = durationOrThumbnail as "30s" | "60s";
        const format = optionsOrFormat as "video" | "carousel";
        const images = settingsOrImages as ReferenceImage[];
        const settings = imagesArg as unknown as ContentSettings;

        // Implementation for Standard Mode (Legacy flow)
        // Default to 'image' if not specified in this legacy path
        return generatePlanFromRefinedPrompt(refinedPrompt, thumbnailPrompt, duration, format, images, settings, 'image');
    }

    // Case 2: Called from GenerateScreen.tsx (New Flow & Verbatim)
    // generateVideoPlanWithOptions(idea, format, duration, { verbatimMode: true ... }, settings, images)
    const format = formatOrPrompt as "video" | "carousel";
    const duration = durationOrThumbnail as "30s" | "60s";
    const options = optionsOrFormat as GenerationOptions;
    const settings = settingsOrImages as ContentSettings;
    const images = imagesArg as ReferenceImage[];

  // Verbatim Mode: Use the new pipeline
  if (options.verbatimMode) {
    const verbatimOptions = options as VerbatimGenerationOptions;

    console.log("Generating in VERBATIM MODE - preserving exact script text");

    // Generate verbatim plan (preserves exact text, generates visual prompts)
    const verbatimResult = await generateVerbatimPlan(
      idea,
      verbatimOptions.sceneChunkOptions,
      verbatimOptions.strategy,
      format // Pass format to enable carousel-specific chunking
    );

    // Enhance scenes with sub-scenes for dynamic multi-visual sequences (VIDEOS ONLY)
    // Carousels should map 1 scene = 1 slide, do not split into sub-scenes!
    let enhancedScenes = verbatimResult.scenes;
    if (format === "video") {
        console.log("[Generation] Enhancing scenes with multi-visual sub-scenes...");
        enhancedScenes = await enhanceScenesWithSubScenes(verbatimResult.scenes);
    }

    // Generate thumbnail prompt separately
    const thumbnailPrompt = await generateThumbnailPromptForVerbatim(idea, verbatimResult.title);

    // Build the final VideoPlan
    const videoPlan: VideoPlan = {
      title: verbatimResult.title,
      tone: verbatimOptions.tone || "neutral",
      scenes: enhancedScenes, // Use enhanced scenes with sub-scenes
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
      // Pass strategy fields to the plan
      problem: options.strategy?.problem,
      solution: options.strategy?.solution,
      voice: options.strategy?.voice,
      positioning: options.strategy?.positioning,
      pillars: options.strategy?.pillars,
    };
    
    return videoPlan;
  }
  
  // Standard Mode: Use existing flow
  const standardOptions = options as StandardGenerationOptions;
  const visualMode = standardOptions.visualMode || "image";
  const seamlessMode = standardOptions.seamlessMode || false;

  const { refinedPrompt, thumbnailPrompt } = await refineIdea(idea, format, settings, standardOptions.strategy);
  return generatePlanFromRefinedPrompt(refinedPrompt, thumbnailPrompt, duration, format, images, settings, visualMode, seamlessMode, standardOptions.strategy);
}

/**
 * Generate a thumbnail prompt for verbatim content
 */
async function generateThumbnailPromptForVerbatim(script: string, title: string): Promise<string> {
  const promptTemplate = VISUAL_PROMPTS.VERBATIM_THUMBNAIL(script, title);
  const prompt = injectStyleConstraint(promptTemplate, VISUAL_STYLE_CONSTRAINT);
  return await generateText(prompt, "You are an expert visual director.", "gpt-4o", 0.7);
}

async function refineIdea(
  idea: string,
  format: "video" | "carousel",
  settings: ContentSettings,
  strategy?: StrategyContext
): Promise<{ refinedPrompt: string; thumbnailPrompt: string }> {
  const context = buildPromptContext(settings);
  const strategyContext = strategy ? buildStrategyContext(strategy) : "";

  const prompt = `
  You are an expert video content planner.
  Rewrite this idea for clarity and engagement, and generate a thumbnail prompt.
  
  **Idea:** ${idea}
  ${context}
  ${strategyContext}
  ${VISUAL_STYLE_CONSTRAINT}
  
  Respond with:
  1. Refined video prompt (detailed)
  2. Thumbnail prompt (visual description)
  `;

  const rawText = await generateText(prompt, "You are an expert content strategist.", "gpt-4o", 0.7);

  const [refinedPrompt, thumbnailPrompt] = rawText.split(/(?:\n2\.|\nThumbnail prompt:)/).map(s => s.trim());

  return {
    refinedPrompt: refinedPrompt || idea,
    thumbnailPrompt: thumbnailPrompt || `Stylized flat illustration thumbnail for: ${idea}. Bold colors, clean design, magazine style.`,
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
    strategy?: StrategyContext
): Promise<VideoPlan> {
    
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
    
    RESPOND WITH ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATIONS.
    `;

    const response = await generateText(prompt, "You are a JSON generator. Output only valid JSON.", "gpt-4o", 0.3);
    
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

        return {
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
    } catch (e) {
        console.error("Failed to parse plan JSON:", e);
        console.error("Raw AI response:", response.substring(0, 1000));
        throw new Error("Failed to generate video plan. Please try again.");
    }
}
