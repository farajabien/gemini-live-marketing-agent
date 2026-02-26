import { nanoid } from "nanoid";
import type { Scene, SceneChunkOptions, VoiceTone, StrategyContext } from "../types";
import { buildStrategyContext } from "../content-settings";
import { VISUAL_STYLE_CONSTRAINT, wrapWithStyleConstraint } from "../constants";
import { generateText } from "./gemini-client";
import { VISUAL_PROMPTS, SCRIPT_PROMPTS, injectStyleConstraint } from "@/lib/prompts";
import { sanitizeJson } from "./json-utils";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHUNK_OPTIONS: SceneChunkOptions = {
  maxWordsPerScene: 30, // For videos
  respectBlankLines: true,
};

const CAROUSEL_CHUNK_OPTIONS: SceneChunkOptions = {
  maxWordsPerScene: 15, // Carousels need punchier, shorter text per slide
  respectBlankLines: true,
};

// Words per minute for duration calculation (average speaking pace)
const WORDS_PER_MINUTE = 150;
const DURATION_PADDING_SECONDS = 0.0;
const MIN_SCENE_DURATION = 3;
const MAX_SCENE_DURATION = 12;

// ============================================================================
// Text Processing Utilities
// ============================================================================

/**
 * Extract visual direction markers like [Visual: ...] or [Scene: ...]
 * Returns the text and extracted visual hints
 */
export function extractVisualMarkers(text: string): { text: string; visualHints: string[] } {
  const visualMarkerRegex = /\[(?:Visual|Scene|Image):\s*([^\]]+)\]/gi;
  const visualHints: string[] = [];

  // Extract all visual hints
  let match;
  while ((match = visualMarkerRegex.exec(text)) !== null) {
    visualHints.push(match[1].trim());
  }

  // Remove visual markers from text
  const cleanedText = text.replace(visualMarkerRegex, '').trim();

  return { text: cleanedText, visualHints };
}

/**
 * Tidy up punctuation and formatting without changing words.
 * Always applied to make scripts sound sweet.
 */
export function tidyPunctuation(text: string): string {
  // Regex to match "Slide 1:", "Scene 02 -", "S1.", "N1:", etc. at start of lines
  const slideMarkerRegex = /^(Slide|Scene|S|N|Point)\s*\d+[:.-]?\s*/i;

  return text
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    // Apply slide marker stripping to each line
    .split('\n')
    .map(line => {
      let l = line.trim();
      // Keep stripping if there are nested markers or extra spaces (e.g., "Slide 1: Scene 1: ...")
      let previousL;
      do {
        previousL = l;
        l = l.replace(slideMarkerRegex, '').trim();
      } while (l !== previousL);
      return l;
    })
    .filter(line => line.length > 0)
    .join('\n')
    // Fix common punctuation issues
    .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
    .replace(/([.,!?;:])([a-zA-Z])/g, '$1 $2') // Add space after punctuation if missing
    .replace(/([.,!?])([.,!?])+/g, '$1') // Remove duplicate punctuation
    .replace(/\.\.\./g, '…') // Normalize ellipsis
    .replace(/--/g, '—') // Normalize em-dash
    // Fix capitalization after sentence-ending punctuation
    .replace(/([.!?])\s+([a-z])/g, (_, punct, letter) => `${punct} ${letter.toUpperCase()}`)
    // Final cleanup of whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Escape SSML-sensitive characters for TTS
 */
export function escapeForSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate scene duration based on word count
 */
export function calculateDuration(text: string): number {
  const wordCount = countWords(text);
  const baseDuration = (wordCount / WORDS_PER_MINUTE) * 60;
  
  // Clamp to reasonable bounds
  return Math.max(MIN_SCENE_DURATION, Math.min(MAX_SCENE_DURATION, Math.round(baseDuration * 10) / 10));
}

// ============================================================================
// Scene Splitting
// ============================================================================

/**
 * Split script into scenes based on user markers or automatic sentence chunking.
 * Preserves the exact verbatim text and extracts visual hints.
 */
export function splitScriptIntoScenes(
  script: string,
  options: SceneChunkOptions = DEFAULT_CHUNK_OPTIONS
): Array<{ text: string; visualHint?: string }> {
  // PRIORITY 1: Check for [Visual:] markers - these are explicit scene boundaries
  const visualMarkerRegex = /\[(?:Visual|Scene|Image):[^\]]+\]/gi;
  const hasVisualMarkers = visualMarkerRegex.test(script);

  if (hasVisualMarkers) {
    console.log("Detected [Visual:] markers - splitting by visual directions");

    // Split by visual markers, keeping the markers with their associated text
    const segments = script.split(/(?=\[(?:Visual|Scene|Image):)/i);

    const scenes = segments
      .map(segment => {
        const { text: cleanText, visualHints } = extractVisualMarkers(segment);
        const tidiedText = tidyPunctuation(cleanText);

        if (tidiedText.length === 0) return null;

        return {
          text: tidiedText,
          visualHint: visualHints[0] // Use first visual hint for this scene
        };
      })
      .filter(s => s !== null) as Array<{ text: string; visualHint?: string }>;

    console.log(`Split into ${scenes.length} scenes from visual markers`);
    return scenes;
  }

  // PRIORITY 2: Check for slide/scene markers BEFORE tidying
  const slideMarkerRegex = /^(Slide|Scene|S|N|Point)\s*\d+[:.-]?\s*/im;
  const hasSlideMarkers = slideMarkerRegex.test(script);

  if (hasSlideMarkers) {
    console.log("Detected slide/scene markers - splitting by newlines");
    const scenes = script
      .split('\n')
      .map(line => {
        const { text: cleanText } = extractVisualMarkers(line);
        const tidiedText = tidyPunctuation(cleanText);
        return tidiedText.length > 0 ? { text: tidiedText } : null;
      })
      .filter((s): s is { text: string } => s !== null);

    console.log(`Split into ${scenes.length} scenes from slide markers`);
    return scenes;
  }

  // PRIORITY 3: Otherwise, tidy first then check for blank lines
  const { text: cleanedScript } = extractVisualMarkers(script);
  const tidied = tidyPunctuation(cleanedScript);

  // Check for explicit scene markers (blank lines or ---)
  const hasExplicitMarkers = /\n\s*\n|^---$|^\n---\n/m.test(tidied);

  if (options.respectBlankLines && hasExplicitMarkers) {
    // Split by blank lines or ---
    const segments = tidied
      .split(/\n\s*\n|^---$|\n---\n/m)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // If segments are reasonable size, use them directly
    const allReasonable = segments.every(s => countWords(s) <= options.maxWordsPerScene * 1.5);

    if (allReasonable && segments.length >= 2) {
      return segments.map(text => ({ text }));
    }

    // Otherwise, further split large segments
    return segments
      .flatMap(segment => splitBySentences(segment, options.maxWordsPerScene))
      .map(text => ({ text }));
  }

  // No markers - split by sentences with word count target
  return splitBySentences(tidied, options.maxWordsPerScene).map(text => ({ text }));
}

/**
 * Split text by sentence boundaries, grouping to target word count
 */
function splitBySentences(text: string, maxWords: number): string[] {
  // Split into sentences (preserve punctuation)
  const sentenceRegex = /[^.!?]+[.!?]+\s*/g;
  const sentences: string[] = [];
  let match;
  
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push(match[0].trim());
  }
  
  // Handle remaining text without ending punctuation
  const lastMatch = text.match(/[^.!?]+$/);
  if (lastMatch && lastMatch[0].trim()) {
    sentences.push(lastMatch[0].trim());
  }
  
  // If no sentences found, treat whole text as one
  if (sentences.length === 0) {
    return [text];
  }
  
  // Group sentences into chunks
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWords = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    
    // If single sentence exceeds max, split at comma/clause boundaries
    if (sentenceWords > maxWords && currentChunk.length === 0) {
      const subChunks = splitAtClauses(sentence, maxWords);
      chunks.push(...subChunks);
      continue;
    }
    
    // If adding this sentence would exceed max, start new chunk
    if (currentWords + sentenceWords > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentWords = 0;
    }
    
    currentChunk.push(sentence);
    currentWords += sentenceWords;
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

/**
 * Split a long sentence at comma/clause boundaries
 */
function splitAtClauses(sentence: string, maxWords: number): string[] {
  const clauses = sentence.split(/,\s*|;\s*|:\s*|—\s*|\s+-\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentWords = 0;
  
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i].trim();
    if (!clause) continue;
    
    const clauseWords = countWords(clause);
    
    if (currentWords + clauseWords > maxWords && currentChunk.length > 0) {
      chunks.push(currentChunk.join(', '));
      currentChunk = [];
      currentWords = 0;
    }
    
    currentChunk.push(clause);
    currentWords += clauseWords;
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(', '));
  }
  
  return chunks.length > 0 ? chunks : [sentence];
}

// ============================================================================
// Visual Prompt Generation
// ============================================================================

/**
 * Generate visual prompts for verbatim scenes using GitHub Models.
 * Extracts visual cues from the text and creates stylized illustration prompts.
 */

/**
 * Clean up visual prompts by removing any accidental "Scene X:" or "Scene X visual prompt:" prefixes
 */
function cleanVisualPrompt(prompt: string): string {
  // Remove patterns like "Scene 1:", "Scene 1 visual prompt:", etc.
  return prompt
    .replace(/^Scene\s+\d+\s*visual\s+prompt:\s*/i, '')
    .replace(/^Scene\s+\d+:\s*/i, '')
    .trim();
}

export async function generateVisualPromptsForVerbatimScenes(
  scenes: string[],
  fullScript: string,
  strategy?: StrategyContext,
  visualHints?: Array<string | undefined>
): Promise<{ visualPrompts: string[]; visualConsistency: string; title: string; cost: number }> {

  let promptTemplate = VISUAL_PROMPTS.VERBATIM_VISUAL_GENERATION(fullScript, scenes, scenes.length);

  // If user provided visual hints, include them in the prompt
  if (visualHints && visualHints.some(h => h)) {
    promptTemplate += `\n\n**User's Visual Direction Hints:**\nThe user provided these visual directions for specific scenes. Use them as strong guidance:\n`;
    visualHints.forEach((hint, i) => {
      if (hint) {
        promptTemplate += `\nScene ${i + 1}: ${hint}`;
      }
    });
  }

  if (strategy) {
    const sContext = buildStrategyContext(strategy);
    promptTemplate += `\n\n**Strategic Brand Context (Use this to align visual themes):**\n${sContext}`;
  }

  const prompt = injectStyleConstraint(promptTemplate, VISUAL_STYLE_CONSTRAINT);

  try {
    const { text: rawText, cost } = await generateText(prompt, "You are an expert visual director.", "gpt-4o", 0.7);


    
    // Extract JSON from response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    
    const parsed = JSON.parse(sanitizeJson(jsonMatch[0]));

    // Sanitize visualConsistency
    if (typeof parsed.visualConsistency === 'object' && parsed.visualConsistency !== null) {
        parsed.visualConsistency = JSON.stringify(parsed.visualConsistency);
    } else if (typeof parsed.visualConsistency !== 'string') {
        parsed.visualConsistency = String(parsed.visualConsistency || "");
    }
    
    // Clean up visual prompts to remove any prefixes
    parsed.visualPrompts = parsed.visualPrompts.map((p: string) => cleanVisualPrompt(p));
    
    // Validate we have prompts for all scenes
    if (parsed.visualPrompts.length !== scenes.length) {
      console.warn(`Expected ${scenes.length} prompts, got ${parsed.visualPrompts.length}`);
      // Pad or truncate to match
      while (parsed.visualPrompts.length < scenes.length) {
        parsed.visualPrompts.push(
          `Stylized illustration representing: "${scenes[parsed.visualPrompts.length].substring(0, 50)}..."`
        );
      }
      parsed.visualPrompts = parsed.visualPrompts.slice(0, scenes.length);
    }
    
    return { ...parsed, cost };

  } catch (parseError) {
    console.error("Failed to parse visual prompts:", parseError);
    
    // Fallback: generate basic prompts
    return {
      title: "Untitled Video",
      visualConsistency: "Flat 2D illustration style with bold colors and minimalist characters.",
      visualPrompts: scenes.map((scene) => 
        `Flat 2D illustration, magazine style: Visual representation of "${scene.substring(0, 80)}..." Bold colors, clean lines, stylized characters.`
      ),
      cost: 0,
    };
  }
}


// ============================================================================
// Main Verbatim Pipeline
// ============================================================================

export interface VerbatimPlanResult {
  title: string;
  scenes: Scene[];
  visualConsistency: string;
  estimatedDuration: number;
  originalScript: string;
  cost: number;
}


/**
 * Generate a video plan from verbatim script.
 * The voiceover text is preserved exactly as provided.
 */
export async function generateVerbatimPlan(
  script: string,
  options?: SceneChunkOptions,
  strategy?: StrategyContext,
  format?: "video" | "carousel"
): Promise<VerbatimPlanResult> {
  let totalCost = 0;

  // Use carousel-specific chunking if format is carousel and no custom options provided
  const chunkOptions = options || (format === "carousel" ? CAROUSEL_CHUNK_OPTIONS : DEFAULT_CHUNK_OPTIONS);

  console.log(`[Verbatim] Splitting into scenes...`);
  const sceneData = splitScriptIntoScenes(script, chunkOptions);
  const sceneTexts = sceneData.map(s => s.text);
  const visualHints = sceneData.map(s => s.visualHint);

  console.log(`[Verbatim] Split into ${sceneTexts.length} scenes`);
  if (visualHints.some(h => h)) {
    console.log(`[Verbatim] Found ${visualHints.filter(h => h).length} visual direction hints`);
  }

  // 2. Generate visual prompts (AI paraphrases for visuals only)
  console.log(`[Verbatim] Generating visual prompts for ${sceneTexts.length} scenes...`);

  let visualPrompts: string[];
  let visualConsistency: string;
  let title: string;

  try {
    const result = await generateVisualPromptsForVerbatimScenes(
      sceneTexts,
      script,
      strategy,
      visualHints
    );
    visualPrompts = result.visualPrompts;
    visualConsistency = result.visualConsistency;
    title = result.title;
    totalCost += result.cost;

    console.log(`[Verbatim] ✅ Visual prompts generated successfully.`);
  } catch (error) {
    console.error(`[Verbatim] ❌ Visual prompt generation failed:`, error);
    console.log(`[Verbatim] Using fallback visual prompts from script hints`);

    // Fallback: Use visual hints or generate simple prompts from voiceover text
    visualPrompts = sceneTexts.map((text, i) => {
      if (visualHints[i]) {
        return `Flat 2D illustration: ${visualHints[i]}`;
      }
      // Extract first 100 chars of voiceover as visual description
      const snippet = text.substring(0, 100).trim();
      return `Flat 2D illustration depicting: ${snippet}${text.length > 100 ? '...' : ''}`;
    });

    visualConsistency = "Flat 2D illustration style with bold colors and clean design, magazine-quality aesthetic";
    title = script.split('\n')[0]?.substring(0, 50) || "Video";
  }
  
  // 3. Generate AI-driven scene titles/context for overlays
  console.log(`[Verbatim] Generating scene titles...`);
  const sceneTitlesPrompt = SCRIPT_PROMPTS.SCENE_TITLES(sceneTexts);

  let sceneTitles: string[] = [];
  try {
    const { text: rawTitles, cost: titlesCost } = await generateText(sceneTitlesPrompt, "You are an expert content strategist.", "gpt-4o", 0.7);
    totalCost += titlesCost;


    const jsonMatch = rawTitles.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      sceneTitles = JSON.parse(sanitizeJson(jsonMatch[0]));
    } else {
      sceneTitles = sceneTexts.map((s, i) => `Scene ${i + 1}`);
    }
  } catch {
    sceneTitles = sceneTexts.map((s, i) => `Scene ${i + 1}`);
  }

  // 4. Build scenes with verbatim voiceover and generated visual prompts
  const scenes: Scene[] = sceneTexts.map((text, i) => ({
    id: nanoid(),
    voiceover: text, // Exact verbatim text
    visualPrompt: visualPrompts[i],
    duration: calculateDuration(text),
    textOverlay: '', // Remove text overlays for cleaner visuals
    sceneTitle: sceneTitles[i], // Add AI-generated scene title/context
    isVerbatimLocked: true, // Mark as locked
  }));
  
  const estimatedDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  
  return {
    title,
    scenes,
    visualConsistency,
    estimatedDuration,
    originalScript: tidyPunctuation(script),
    cost: totalCost,
  };
}


/**
 * Extract a short key phrase from scene text for text overlay
 */
function extractKeyPhrase(text: string): string {
  // Use first 2-4 words maximum for a punchy title/theme
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) return "";
  
  // Clean up punctuation from the last word if needed
  const cleanWords = words.map(w => w.replace(/[.,!?;:]/g, ''));
  
  if (cleanWords.length <= 3) {
    return cleanWords.join(' ');
  }
  
  return cleanWords.slice(0, 3).join(' ');
}

// ============================================================================
// SSML Enhancement for TTS
// ============================================================================

/**
 * Convert punctuation to SSML-friendly pauses for better prosody.
 * Does NOT change the spoken words, only adds timing hints.
 */
export function enhanceWithSSMLPauses(text: string): string {
  // Gemini handles SSML naturally, but we can also use plain text with strategic spacing
  // For now, we'll return the text with normalized pauses
  
  return text
    // Em-dash or ellipsis = longer pause (add space around)
    .replace(/—/g, ' — ')
    .replace(/…/g, ' … ')
    // Double space after period for slight pause emphasis
    .replace(/\.\s+/g, '.  ')
    // Normalize other punctuation
    .replace(/,\s*/g, ', ')
    .replace(/;\s*/g, '; ')
    .replace(/:\s*/g, ': ')
    .trim();
}

/**
 * Apply tone settings to TTS parameters (does not change words)
 */
export function getTTSSettingsForTone(tone: VoiceTone): {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
} {
  switch (tone) {
    case 'calm':
      return {
        stability: 0.7,
        similarity_boost: 0.6,
        style: 0.3,
        speed: 0.9, // Slightly slower
      };
    case 'confident':
      return {
        stability: 0.5,
        similarity_boost: 0.7,
        style: 0.6,
        speed: 1.05, // Slightly faster
      };
    case 'neutral':
    default:
      return {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        speed: 1.0,
      };
  }
}
