/**
 * Script generation and scene title prompts
 */

export const SCRIPT_PROMPTS = {
  /**
   * Generate scene titles/context for verbatim scenes
   * Used in: lib/ai/verbatim.ts
   */
  SCENE_TITLES: (sceneTexts: string[]) => `
You are an expert video content planner. Given the following scenes from a story, generate a concise, punchy title or context phrase for each scene (max 6 words). Avoid using the first sentence verbatim. Make each title unique, clear, and matching the mood of the scene. Output ONLY a JSON array of strings, one per scene.

Scenes:
${sceneTexts.map((s, i) => `Scene ${i + 1}: "${s}"`).join('\n')}
`,

  /**
   * Refine idea for standard mode
   * Used in: lib/ai/generation.ts
   */
  REFINE_IDEA: (idea: string, context: string) => `
You are an expert video content planner.
Rewrite this idea for clarity and engagement, and generate a thumbnail prompt.

**Idea:** ${idea}
${context}
**{{VISUAL_STYLE_CONSTRAINT}}**

Respond with:
1. Refined video prompt (detailed)
2. Thumbnail prompt (visual description)
`,

  /**
   * Generate video plan from refined prompt
   * Used in: lib/ai/generation.ts
   */
  VIDEO_PLAN: (
    refinedPrompt: string,
    format: string,
    duration: string,
    visualPromptInstruction: string
  ) => `
You are an expert video director. Create a detailed video plan based on:
${refinedPrompt}

Format: ${format}
Duration: ${duration}

Output JSON with:
- title
- tone
- visualConsistency (style guide)
- scenes array (voiceover, visualPrompt, textOverlay, duration)

IMPORTANT: For 'textOverlay', generate SHORT, punchy, thematic titles (2-5 words max). 
DO NOT generate full sentences or captions.
Example: "The Golden Hour", "Speed & Power", "Silence Falls"

IMPORTANT: For 'visualPrompt':
${visualPromptInstruction}

Ensure scenes match the duration and flow logically.
`,
} as const;

export default SCRIPT_PROMPTS;
