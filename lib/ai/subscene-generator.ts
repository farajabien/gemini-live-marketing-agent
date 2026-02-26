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
 * Generate multiple visual prompts for a single voiceover segment
 * Creates B-roll style sequence (wide → detail → context)
 */
async function generateSubSceneVisualPrompts(
  parentScene: Scene,
  subSceneCount: number
): Promise<string[]> {
  console.log(`[SubScenes] Starting AI generation for ${subSceneCount} visual prompts (scene: ${parentScene.id})`);

  const prompt = `You are creating a B-roll visual sequence for a video scene.

**SCENE VOICEOVER:**
"${parentScene.voiceover}"

**ORIGINAL VISUAL CONCEPT:**
${parentScene.visualPrompt}

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
- Maintain visual consistency (same style/character)
- Each shot should smoothly transition to the next

**OUTPUT FORMAT:**
Return a JSON array of exactly ${subSceneCount} visual prompts:

\`\`\`json
[
  "Flat 2D illustration: [shot 1 description]",
  "Flat 2D illustration: [shot 2 description]",
  "Flat 2D illustration: [shot 3 description]"
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
      "gpt-4o",
      0.7
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    const response = typeof result === 'string' ? result : (result as any).text;


    console.log(`[SubScenes] AI response received (${response.length} chars)`);

    // Extract JSON array
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error("[SubScenes] No JSON array found in AI response");
      return generateFallbackVisuals(parentScene, subSceneCount);
    }

    const prompts = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(prompts) || prompts.length !== subSceneCount) {
      console.error(`[SubScenes] Expected ${subSceneCount} prompts, got ${prompts.length}`);
      return generateFallbackVisuals(parentScene, subSceneCount);
    }

    console.log(`[SubScenes] ✅ Generated ${prompts.length} visual prompts successfully`);
    return prompts;
  } catch (error) {
    console.error("[SubScenes] ❌ Error generating visual prompts:", error);
    console.log("[SubScenes] Using fallback visuals instead");
    return generateFallbackVisuals(parentScene, subSceneCount);
  }
}

/**
 * Fallback: Generate basic visual variations if AI fails
 */
function generateFallbackVisuals(parentScene: Scene, count: number): string[] {
  const base = parentScene.visualPrompt;
  const variations = [
    `${base} - wide shot`,
    `${base} - close-up detail`,
    `${base} - different angle`,
    `${base} - emphasizing key element`,
    `${base} - contextual view`,
  ];

  // Return first N variations, or repeat base if needed
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(variations[i % variations.length]);
  }

  return result;
}

/**
 * Split a scene into multiple sub-scenes with varied visuals
 * ALWAYS applies to scenes > 3s for more dynamic videos
 */
export async function generateSubScenes(scene: Scene): Promise<SubScene[] | null> {
  // Check if scene should be split
  if (!shouldSplitScene(scene.duration)) {
    console.log(`[SubScenes] Scene ${scene.id} (${scene.duration}s) - too short, keeping single visual`);
    return null; // Keep original single scene
  }

  // Calculate sub-scene durations (dynamic 1-3s each)
  const durations = calculateSubSceneDurations(scene.duration);

  console.log(`[SubScenes] Scene ${scene.id} (${scene.duration}s) → ${durations.length} sub-scenes: [${durations.join("s, ")}s]`);

  // Generate visual prompts for each sub-scene
  const visualPrompts = await generateSubSceneVisualPrompts(scene, durations.length);

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
 * Process all scenes in a video plan to add sub-scenes where appropriate
 */
export async function enhanceScenesWithSubScenes(scenes: Scene[]): Promise<Scene[]> {
  console.log(`[SubScenes] Enhancing ${scenes.length} scenes with multi-visual sequences...`);
  console.time("[SubScenes] Total enhancement time");

  const enhancedScenes = await Promise.all(
    scenes.map(async (scene, index) => {
      try {
        console.log(`[SubScenes] Processing scene ${index + 1}/${scenes.length} (${scene.id})`);

        const subScenes = await generateSubScenes(scene);

        if (subScenes && subScenes.length > 0) {
          console.log(`[SubScenes] ✅ Scene ${index + 1} enhanced with ${subScenes.length} sub-scenes`);
          return {
            ...scene,
            subScenes,
          };
        }

        console.log(`[SubScenes] Scene ${index + 1} kept as single visual (${scene.duration}s ≤ 3s)`);
        return scene;
      } catch (error) {
        console.error(`[SubScenes] ❌ Failed to enhance scene ${index + 1} (${scene.id}):`, error);
        console.log(`[SubScenes] Continuing with original scene for ${scene.id}`);
        // Return original scene on error - graceful degradation
        return scene;
      }
    })
  );

  const totalSubScenes = (enhancedScenes as any[]).reduce(
    (sum, scene) => sum + (scene.subScenes?.length || 0),
    0
  );

  console.timeEnd("[SubScenes] Total enhancement time");
  console.log(`[SubScenes] ✅ Enhancement complete: ${enhancedScenes.length} scenes, ${totalSubScenes} total sub-scenes`);

  return enhancedScenes;
}
