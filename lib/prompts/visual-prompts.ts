/**
 * Visual generation prompts for Gemini image and video generation
 */

export const VISUAL_PROMPTS = {
  /**
   * Generate visual prompts for verbatim scenes
   * Used in: lib/ai/verbatim.ts
   */
  VERBATIM_VISUAL_GENERATION: (fullScript: string, scenes: string[], sceneCount: number) => `
You are a visual director creating prompts for stylized animated illustrations.

**Full Script Context:**
"${fullScript}"

**Individual Scenes to visualize:**
${scenes.map((s, i) => `Scene ${i + 1}: "${s}"`).join('\n')}

**Your Tasks:**

1. **Extract Characters & Setting:**
   Identify any recurring characters, settings, objects, or themes from the full script.
   Create a visual consistency guide that defines:
   - Character design (age, clothing, style - must be animated/stylized, NOT realistic)
   - Setting/environment style
   - Color palette
   - Art style (flat 2D, editorial, minimalist cartoon, animated 3D, etc.)

2. **Generate Visual Prompts:**
   For each scene, create a CLEAN visual prompt (no "Scene X:" prefix) that:
   - Captures the essence/mood of that specific scene text
   - Maintains consistency with the overall visual guide
   - Uses specific visual elements, composition, colors
   - NEVER includes realistic humans or photography
   - If a character, object, or setting appears in multiple scenes, keep their design, clothing, and environment identical across all prompts
   - Is a direct, clean description ready to send to an image generator

**{{VISUAL_STYLE_CONSTRAINT}}**

**Output Format (JSON only):**
{
  "title": "A catchy title for this content (3-6 words)",
  "visualConsistency": "2-3 sentence style guide for consistent character/setting/style across all scenes",
  "visualPrompts": [
    "A stylized flat illustration showing a curious alien with large eyes examining Earth from space, bold blues and purples, minimalist cartoon style",
    "Flat 2D illustration of the same alien character landing on Earth, vibrant greens, simple geometric shapes, magazine editorial style",
    ...
  ]
}

CRITICAL RULES:
1. The visualPrompts array must have exactly ${sceneCount} entries, one for each scene
2. Each prompt should be a CLEAN description with NO "Scene X:" or "Scene X visual prompt:" prefix
3. Each prompt should directly describe the visual, ready to be sent to an image generator
4. Maintain character and style consistency across ALL prompts using the visualConsistency guide
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

export default VISUAL_PROMPTS;
