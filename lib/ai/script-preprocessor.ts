import { generateText } from "./gemini-client";

export interface PreprocessResult {
  cleanedScript: string;
  wasModified: boolean;
  changes: string[];
}

/**
 * Preprocess a raw script to optimize it for verbatim mode.
 * Uses LLM to detect and normalize visual markers, scene boundaries, etc.
 */
export async function preprocessVerbatimScript(
  rawScript: string
): Promise<PreprocessResult> {
  // Quick check: if script already looks well-formatted, skip preprocessing
  const hasProperMarkers = /\[(?:Visual|Scene|Image):/i.test(rawScript);
  const hasBlankLines = /\n\s*\n/.test(rawScript);

  if (hasProperMarkers && hasBlankLines) {
    console.log("[Preprocessor] Script already well-formatted, skipping");
    return {
      cleanedScript: rawScript,
      wasModified: false,
      changes: [],
    };
  }

  console.log("[Preprocessor] Cleaning script format...");

  const prompt = `You are a script formatter for video generation. Your job is to restructure user scripts for optimal processing while PRESERVING the exact narration wording.

**INPUT SCRIPT:**
\`\`\`
${rawScript}
\`\`\`

**YOUR TASKS:**

1. **Identify Visual Directions** - Find any indicators of visual/scene descriptions in ANY format:
   - Explicit: "[Visual: ...]", "(visual: ...)", "// scene:", "Cut to:", "[Scene: ...]"
   - Implicit: Parentheticals describing actions/visuals
   - Context clues: Lines that describe what to show vs. what to say

2. **Normalize Visual Markers** - Convert ALL visual directions to standardized format:
   - Format: \`[Visual: clear description]\`
   - Place BEFORE the narration they accompany

3. **Separate Scenes** - Add blank lines between distinct scenes/segments

4. **Remove Timing Hints** - Strip out explicit timing markers:
   - "pause 3s", "hold for 5 seconds", "(2 second pause)", etc.

5. **Group Related Lines** - Keep narration that goes together on the same scene

6. **CRITICAL: PRESERVE NARRATION WORDING**
   - DO NOT rewrite, rephrase, or improve the spoken text
   - ONLY restructure the formatting
   - Keep the user's exact words for what should be spoken

**OUTPUT FORMAT:**

Return ONLY the cleaned script in this structure:

\`\`\`
[Visual: description of first scene]
Exact narration text for first scene.

[Visual: description of second scene]
Exact narration text for second scene.

[Visual: description of third scene]
Exact narration text for third scene.
\`\`\`

**RULES:**
- If no visual directions are present, infer scene boundaries from natural breaks in narration
- If script is already well-formatted, return it unchanged
- Preserve ALL narration words exactly as written
- Only add/modify structural elements (markers, spacing)

Output the cleaned script now:`;

  try {
    const { text: cleanedScript } = await generateText(
      prompt,
      "You are a script formatting expert. Return ONLY the cleaned script, no explanations.",
      "gpt-4o",
      0.3 // Low temperature for consistent formatting
    );


    // Extract script from markdown code blocks if present
    const scriptMatch = cleanedScript.match(/```(?:markdown|text)?\n?([\s\S]*?)```/);
    const finalScript = scriptMatch ? scriptMatch[1].trim() : cleanedScript.trim();

    // Detect what changed
    const changes: string[] = [];
    const originalHasVisualMarkers = /\[(?:Visual|Scene|Image):/i.test(rawScript);
    const cleanedHasVisualMarkers = /\[(?:Visual|Scene|Image):/i.test(finalScript);

    if (!originalHasVisualMarkers && cleanedHasVisualMarkers) {
      const markerCount = (finalScript.match(/\[(?:Visual|Scene|Image):/gi) || []).length;
      changes.push(`Added ${markerCount} normalized visual markers`);
    }

    if (finalScript !== rawScript) {
      changes.push("Restructured scene formatting");
    }

    const wasModified = finalScript.toLowerCase().trim() !== rawScript.toLowerCase().trim();

    console.log(`[Preprocessor] ${wasModified ? "Modified" : "No changes"}`);
    if (changes.length > 0) {
      console.log(`[Preprocessor] Changes: ${changes.join(", ")}`);
    }

    return {
      cleanedScript: finalScript,
      wasModified,
      changes,
    };
  } catch (error) {
    console.error("[Preprocessor] Error cleaning script:", error);
    // On error, return original script
    return {
      cleanedScript: rawScript,
      wasModified: false,
      changes: ["Error during preprocessing - using original script"],
    };
  }
}
