import { nanoid } from "nanoid";
import { generateText } from "./gemini-client";
import type { Scene, SubScene } from "../types";

/**
 * Determine if a scene should be split into multiple sub-scenes
 * Always split if > 3 seconds for more dynamic visuals
 */
function shouldSplitScene(duration: number): boolean {
  return duration > 3;
}

/**
 * Calculate optimal number of sub-scenes and their durations
 * Dynamic: 1-3s per visual based on total duration
 */
function calculateSubSceneDurations(totalDuration: number): number[] {
  const durations: number[] = [];

  let remaining = totalDuration;

  // Strategy: Vary sub-scene lengths for dynamic pacing
  // Start with 2s, then alternate between 1.5s, 2.5s, 2s
  const patterns = [2, 1.5, 2.5, 2, 1.8, 2.2];
  let patternIndex = 0;

  while (remaining > 0) {
    // Use pattern, but never exceed remaining duration
    const targetDuration = Math.min(patterns[patternIndex % patterns.length], remaining);

    // If less than 1s remaining, merge with previous
    if (remaining < 1 && durations.length > 0) {
      durations[durations.length - 1] += remaining;
      break;
    }

    durations.push(Math.max(1, targetDuration)); // Minimum 1s per sub-scene
    remaining -= targetDuration;
    patternIndex++;
  }

  // Round to 1 decimal place
  return durations.map(d => Math.round(d * 10) / 10);
}

/**
 * Generate multiple visual prompts for a single voiceover segment.
 * This is the FALLBACK path — used when batch generation didn't produce sub-scenes.
 *
 * @param parentScene - The parent scene to split
 * @param subSceneCount - Number of sub-scenes to generate
 * @param visualConsistency - Optional style guide to maintain consistency (avoids hardcoded styles)
 */
async function generateSubSceneVisualPrompts(
  parentScene: Scene,
  subSceneCount: number,
  visualConsistency?: string
): Promise<string[]> {
  console.log(`[SubScenes:Fallback] Starting AI generation for ${subSceneCount} visual prompts (scene: ${parentScene.id})`);

  const styleContext = visualConsistency
    ? `\n**VISUAL STYLE GUIDE (match this style for all prompts):**\n${visualConsistency}\n`
    : '';

  const prompt = `You are creating a B-roll visual sequence for a video scene.

**SCENE VOICEOVER:**
"${parentScene.voiceover}"

**ORIGINAL VISUAL CONCEPT:**
${parentScene.visualPrompt}
${styleContext}
**YOUR TASK:**
Create ${subSceneCount} distinct visual prompts that work as a sequence to illustrate this voiceover. Think like a video editor cutting between B-roll shots every 1-3 seconds.

**B-ROLL SEQUENCING STRATEGY:**
1. **Establish** - Wide/context shot to set the scene
2. **Detail** - Close-up or specific action
3. **Emphasis** - Key moment or object
4. **Context** - Pull back or show reaction
5. **Transition** - Bridge to next concept (if applicable)

**VISUAL VARIETY RULES:**
- Vary shot types: wide, medium, close-up, detail
- Vary angles: front, side, over-shoulder, birds-eye
- Vary focus: person, object, environment, abstract
- Maintain visual consistency (same style/character as the original visual concept)
- Each shot should smoothly transition to the next
${visualConsistency ? '- Use the SAME art style described in the Visual Style Guide above' : ''}

**OUTPUT FORMAT:**
Return a JSON array of exactly ${subSceneCount} visual prompts:

\`\`\`json
[
  "[shot 1 description matching the visual style]",
  "[shot 2 description matching the visual style]",
  "[shot 3 description matching the visual style]"
]
\`\`\`

Generate the ${subSceneCount} visual prompts now:`;

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<string[]>((_, reject) =>
      setTimeout(() => reject(new Error("AI generation timeout after 30s")), 30000)
    );

    const aiPromise = generateText(
      prompt,
      "You are a visual director. Return ONLY the JSON array of visual prompts.",
      "gemini-1.5-pro",
      0.7
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    const response = typeof result === 'string' ? result : (result as any).text;


    console.log(`[SubScenes:Fallback] AI response received (${response.length} chars)`);

    // Extract JSON array
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error("[SubScenes:Fallback] No JSON array found in AI response");
      return generateFallbackVisuals(parentScene, subSceneCount);
    }

    const prompts = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(prompts) || prompts.length !== subSceneCount) {
      console.error(`[SubScenes:Fallback] Expected ${subSceneCount} prompts, got ${prompts.length}`);
      return generateFallbackVisuals(parentScene, subSceneCount);
    }

    console.log(`[SubScenes:Fallback] Generated ${prompts.length} visual prompts successfully`);
    return prompts;
  } catch (error) {
    console.error("[SubScenes:Fallback] Error generating visual prompts:", error);
    console.log("[SubScenes:Fallback] Using fallback visuals instead");
    return generateFallbackVisuals(parentScene, subSceneCount);
  }
}

/**
 * Fallback: Generate basic visual variations if AI fails.
 * Uses the parent scene's visualPrompt as the base (no hardcoded style prefix).
 */
function generateFallbackVisuals(parentScene: Scene, count: number): string[] {
  const base = parentScene.visualPrompt;
  const variations = [
    `${base} - wide establishing shot`,
    `${base} - close-up detail view`,
    `${base} - different angle perspective`,
    `${base} - emphasizing key element`,
    `${base} - contextual environment view`,
  ];

  // Return first N variations, or repeat base if needed
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(variations[i % variations.length]);
  }

  return result;
}

/**
 * Split a scene into multiple sub-scenes with varied visuals.
 * ALWAYS applies to scenes > 3s for more dynamic videos.
 *
 * @param scene - The scene to split
 * @param visualConsistency - Optional style guide for consistent visuals
 */
export async function generateSubScenes(scene: Scene, visualConsistency?: string): Promise<SubScene[] | null> {
  // Check if scene should be split
  if (!shouldSplitScene(scene.duration)) {
    console.log(`[SubScenes] Scene ${scene.id} (${scene.duration}s) - too short, keeping single visual`);
    return null; // Keep original single scene
  }

  // Calculate sub-scene durations (dynamic 1-3s each)
  const durations = calculateSubSceneDurations(scene.duration);

  console.log(`[SubScenes] Scene ${scene.id} (${scene.duration}s) -> ${durations.length} sub-scenes: [${durations.join("s, ")}s]`);

  // Generate visual prompts for each sub-scene
  const visualPrompts = await generateSubSceneVisualPrompts(scene, durations.length, visualConsistency);

  // Build sub-scenes
  const subScenes: SubScene[] = durations.map((duration, index) => ({
    id: `${scene.id}-sub-${index}`,
    visualPrompt: visualPrompts[index],
    duration,
    // Images will be generated later by the visual generation API
  }));

  return subScenes;
}

/**
 * Ensure all scenes > 3s have sub-scenes.
 * Used as a fallback when the batch generation didn't produce them.
 *
 * @param scenes - The scenes to check
 * @param visualConsistency - Style guide for consistent visuals
 */
export async function ensureSubScenes(scenes: Scene[], visualConsistency?: string): Promise<Scene[]> {
  console.log(`[SubScenes] Ensuring sub-scenes for ${scenes.length} scenes...`);

  const enhanced = await Promise.all(
    scenes.map(async (scene, index) => {
      // Skip if scene already has sub-scenes or is too short
      if (scene.subScenes && scene.subScenes.length > 0) return scene;
      if (scene.duration <= 3) return scene;

      try {
        const subScenes = await generateSubScenes(scene, visualConsistency);
        if (subScenes && subScenes.length > 0) {
          console.log(`[SubScenes] Scene ${index + 1} backfilled with ${subScenes.length} sub-scenes`);
          return { ...scene, subScenes };
        }
        return scene;
      } catch (error) {
        console.error(`[SubScenes] Failed to backfill scene ${index + 1}:`, error);
        return scene;
      }
    })
  );

  return enhanced;
}

/**
 * @deprecated Use batch sub-scene generation in visual-prompts.ts instead.
 * Kept for backward compatibility. Use ensureSubScenes() as a fallback.
 */
export async function enhanceScenesWithSubScenes(scenes: Scene[]): Promise<Scene[]> {
  return ensureSubScenes(scenes);
}
