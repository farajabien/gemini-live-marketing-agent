/**
 * Visual generation prompts for Gemini image and video generation
 */

/**
 * Shared sub-scene instructions used by both verbatim and standard prompts.
 * Kept DRY to ensure consistent behavior across modes.
 */
const SUB_SCENE_INSTRUCTIONS = `
**SUB-SCENE VISUAL CUTS (B-Roll Sequencing):**
For scenes with an estimated duration OVER 3 seconds, create a "subSceneVisuals" array of 2-6 rapid visual cuts.
These are distinct images shown one after another while the voiceover plays continuously.

**How to determine cut points:**
- Analyze the voiceover text for natural concept boundaries (new idea, new object, new action = new visual)
- Each sub-scene should be 1-3 seconds long
- Sub-scene durations MUST sum to the scene's estimated total duration
- Vary pacing: some cuts are quick (1-1.5s) for energy, some longer (2-3s) for emphasis

**B-Roll Sequencing Strategy:**
1. **Establish** - Wide/context shot to set the scene
2. **Detail** - Close-up or specific action related to the voiceover
3. **Emphasis** - Key moment, object, or concept being discussed
4. **Context** - Pull back, show reaction, or environment
5. **Transition** - Bridge to next concept (if applicable)

**Visual Variety Rules for Sub-Scenes:**
- Vary shot types: wide, medium, close-up, detail
- Vary angles: front, side, over-shoulder, birds-eye
- Vary focus: person, object, environment, abstract
- Maintain visual consistency with the parent scene and visualConsistency guide
- Each sub-scene prompt must use the SAME art style defined in visualConsistency
- Do NOT hardcode "Flat 2D illustration" unless that is the chosen style

For scenes 3 seconds or under, set "subSceneVisuals" to an empty array [].
`;

export const VISUAL_PROMPTS = {
  /**
   * Generate visual prompts (with inline sub-scenes) for verbatim scenes.
   * Used in: lib/ai/verbatim.ts
   *
   * sceneDurations: estimated duration per scene (seconds) so the LLM can size sub-scenes.
   */
  VERBATIM_VISUAL_GENERATION: (fullScript: string, scenes: string[], sceneCount: number, sceneDurations?: number[]) => `
You are a visual director creating prompts for stylized animated illustrations.

**Full Script Context:**
"${fullScript}"

**Individual Scenes to visualize:**
${scenes.map((s, i) => `Scene ${i + 1} (~${sceneDurations?.[i] ?? '?'}s): "${s}"`).join('\n')}

**Your Tasks:**

1. **Extract Characters & Setting:**
   Identify any recurring characters, settings, objects, or themes from the full script.
   Create a visual consistency guide that defines:
   - Character design (age, clothing, style - must be animated/stylized, NOT realistic)
   - Setting/environment style
   - Color palette
   - Art style (flat 2D, editorial, minimalist cartoon, animated 3D, etc.)

2. **Generate Visual Prompts WITH Sub-Scene Cuts:**
   For each scene, create:
   - A main "visualPrompt": the overarching visual concept for the scene
   - A "subSceneVisuals" array: rapid visual cuts for B-roll sequencing (see rules below)

   Every visual prompt must:
   - Capture the essence/mood of that specific scene text
   - Maintain consistency with the overall visual guide
   - Use specific visual elements, composition, colors
   - NEVER include realistic humans or photography
   - Keep character/object/setting design identical across all prompts
   - Be a direct, clean description ready to send to an image generator
${SUB_SCENE_INSTRUCTIONS}

**{{VISUAL_STYLE_CONSTRAINT}}**

**Output Format (JSON only):**
{
  "title": "A catchy title for this content (3-6 words)",
  "visualConsistency": "2-3 sentence style guide for consistent character/setting/style across all scenes",
  "scenes": [
    {
      "visualPrompt": "Stylized illustration of a curious alien character examining Earth from a spaceship window, bold blues and purples, clean outlines",
      "subSceneVisuals": [
        { "visualPrompt": "Wide establishing shot: the alien's spaceship floating above a colorful cartoon Earth, starry background, same bold blue palette", "duration": 2.0 },
        { "visualPrompt": "Close-up of the alien pressing their face against the glass, large curious eyes reflecting the planet below", "duration": 1.5 },
        { "visualPrompt": "Detail shot of the alien's hand pointing at a continent on a holographic map, glowing UI elements", "duration": 2.5 }
      ]
    },
    {
      "visualPrompt": "Short scene with a single visual concept",
      "subSceneVisuals": []
    }
  ]
}

CRITICAL RULES:
1. The scenes array must have exactly ${sceneCount} entries, one for each scene
2. Each prompt should be a CLEAN description with NO "Scene X:" prefix
3. Each prompt should directly describe the visual, ready to be sent to an image generator
4. Maintain character and style consistency across ALL prompts using the visualConsistency guide
5. Sub-scene durations must sum to the scene's estimated duration
6. Use the art style from visualConsistency in ALL prompts (parent and sub-scene)
`,

  /**
   * Generate thumbnail prompt for verbatim content
   * Used in: lib/ai/generation.ts
   */
  VERBATIM_THUMBNAIL: (script: string, title: string) => `
You are creating a thumbnail prompt for a video titled "${title}".
**Script excerpt:** "${script.substring(0, 500)}${script.length > 500 ? '...' : ''}"
**{{VISUAL_STYLE_CONSTRAINT}}**
REQUIREMENTS: Eye-catching flat illustration, bold colors, simple composition.
Output ONLY the prompt text.
`,
} as const;

/**
 * Shared sub-scene instruction block, exported for use in standard mode prompts.
 */
export { SUB_SCENE_INSTRUCTIONS };

export default VISUAL_PROMPTS;
