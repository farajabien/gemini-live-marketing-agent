/**
 * Content Settings Presets for TailorYourCV
 * 
 * Centralized configuration for content generation dropdowns.
 * These settings are injected into AI prompts to create coherent, targeted content.
 */

import type {
  ContentStyle,
  TargetAudience,
  ContentGoal,
  OutputFormat,
  ContentSettings,
  StrategyContext,
} from "./types";

// ============================================================================
// Style Presets
// ============================================================================

export interface StylePreset {
  id: ContentStyle;
  label: string;
  description: string;
  promptContext: string; // Injected into AI prompts
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "laundry-model",
    label: "Laundry Model",
    description: "Input dirty, output clean. The service-not-editor approach.",
    promptContext: `STYLE: The CV Laundry Model. Focus on the transformation.
      - Use the metaphor of "running a load"
      - Contrast "dirty" raw input vs "clean" tailored output
      - Emphasize that this is a transformation service, not a design tool
      - Focus on the result (submission-ready) rather than the process
      - Tone: Efficient, professional, result-oriented`,
  },
  {
    id: "truth-skeleton",
    label: "Truth Skeleton",
    description: "Anti-hallucination and factual integrity focused.",
    promptContext: `STYLE: The Truth Skeleton. Emphasize accuracy and honesty.
      - Focus on the fact that we NEVER invent experience
      - Explain how we map the candidate's existing truth to new job requirements
      - Highlight the preservation of dates, roles, and employers
      - Position as the "honest AI" that prevents hallucinations
      - Tone: Trustworthy, grounded, high-integrity`,
  },
  {
    id: "friction-killer",
    label: "Friction Killer",
    description: "Punchy, fast-paced focus on saving time and momentum.",
    promptContext: `STYLE: Friction Killer. Focus on speed and momentum.
      - Highlight how much time is wasted manually rewriting bullets
      - Call out the "friction" of job applications as the enemy
      - Focus on "Pay for momentum, not subscriptions"
      - Use short, punchy sentences
      - Tone: Energetic, direct, impatient with inefficiency`,
  },
  {
    id: "insider-tips",
    label: "Insider Tips",
    description: "Educational advice on ATS and hiring practices.",
    promptContext: `STYLE: Insider/Expert. Share high-value hiring insights.
      - Explain WHY certain keywords matter (ATS optimization)
      - Provide "hacker-level" tips for beating the screening process
      - Use professional but accessible language
      - Focus on the "hiring manager's perspective"
      - Tone: Knowledgeable, helpful, authoritative`,
  },
  {
    id: "success-story",
    label: "Success Story",
    description: "Narrative-driven results and 'The Transformation'.",
    promptContext: `STYLE: Success Story. Narrative-driven transformation.
      - Start with the "before" (frustrated applicant, no interviews)
      - Introduce the "turning point" (using the CV Laundry)
      - Show the "after" (interviews, job offers, confidence)
      - Focus on the emotional relief of finally being seen
      - Tone: Narrative-driven, inspiring, emotionally resonant`,
  },
  {
    id: "technical-deep-dive",
    label: "Technical Deep Dive",
    description: "Detailed look at the 10-step pipeline and engineering.",
    promptContext: `STYLE: Technical Deep Dive. Show the engineering under the hood.
      - Reference the 10-step pipeline (Extraction, Semantic Analysis, etc.)
      - Mention the tech stack (GitHub Models, GPT-4o, InstantDB)
      - Discuss semantic matching and gap analysis logic
      - Appeal to the logic of the transformation engine
      - Tone: Analytical, detailed, intellectual`,
  },
];

// ============================================================================
// Audience Presets
// ============================================================================

export interface AudiencePreset {
  id: TargetAudience;
  label: string;
  description: string;
  promptContext: string;
}

export const AUDIENCE_PRESETS: AudiencePreset[] = [
  {
    id: "job-seekers",
    label: "Active Job Seekers",
    description: "People currently applying to multiple roles",
    promptContext: `AUDIENCE: Active Job Seekers.
      - They are feeling the "application fatigue"
      - They need results quickly and consistently
      - They value efficiency over complex features
      - Speak to the urgency of their situation
      - Acknowledge the competitive nature of today's market`,
  },
  {
    id: "software-engineers",
    label: "Software Engineers",
    description: "Devs, PMs, and tech-focused candidates",
    promptContext: `AUDIENCE: Software Engineers and Tech Professionals.
      - They appreciate technical accuracy and logic
      - They are skeptical of generic AI "builders"
      - Mention tech stacks and engineering principles
      - Focus on ATS optimization as a "system optimization" problem
      - Speak to their preference for automation and high-quality output`,
  },
  {
    id: "career-changers",
    label: "Career Changers",
    description: "People pivoting to new industries or roles",
    promptContext: `AUDIENCE: Career Changers.
      - They struggle with how to "translate" their experience
      - They need a "Pivot Narrative" (Strategy Formation step)
      - Focus on transferable skills and semantic matching
      - Provide encouragement for the transition
      - Highlight how the tool finds the "truth" in their past for their future`,
  },
  {
    id: "high-volume-applicants",
    label: "High-Volume Applicants",
    description: "The 'apply-to-100-jobs' power users",
    promptContext: `AUDIENCE: High-Volume / Power Users.
      - They see applications as a numbers game
      - They need a "workflow replacement" more than anything
      - Value the ability to "run a load" in seconds
      - Focus on the "Bulk Tailoring" and "Momentum" aspects
      - Speak to the scaling of their application process`,
  },
  {
    id: "recruiters",
    label: "Recruiters/Hiring Managers",
    description: "The gatekeepers who receive the output",
    promptContext: `AUDIENCE: Recruiters and Hiring Managers.
      - They value clarity and relevance above all else
      - They hate fluff and obvious AI hallucinations
      - Highlight that our tool provides "Truth" and "Relevance"
      - Explain how this helps them find the right signal in the noise
      - Tone: Respectful, professional, focus on value delivery`,
  },
  {
    id: "general",
    label: "General Professional",
    description: "Broad professional audience, non-tech",
    promptContext: `AUDIENCE: General Professionals.
      - Avoid deep technical jargon
      - Focus on the simple benefit: getting more interviews
      - Use relatable workplace examples
      - Keep instructions and explanations simple
      - Focus on the core promise: "Submission-ready in minutes"`,
  },
];

// ============================================================================
// Goal Presets
// ============================================================================

export interface GoalPreset {
  id: ContentGoal;
  label: string;
  description: string;
  promptContext: string;
}

export const GOAL_PRESETS: GoalPreset[] = [
  {
    id: "drive-uploads",
    label: "Drive Uploads",
    description: "Get users to start their first 'load'",
    promptContext: `GOAL: Drive CV Uploads.
      - Create curiosity about their "Match Score"
      - Call to action: "Upload your CV and see the gap"
      - Focus on the ease of getting started
      - Highlight the "Stateless" nature (no account needed)
      - End with a strong nudge to "Run a load"`,
  },
  {
    id: "build-trust",
    label: "Build Trust",
    description: "Demonstrate integrity and quality",
    promptContext: `GOAL: Build trust and credibility.
      - Explain the "Rewrite Guardrails" (no invented experience)
      - Show snippets of "Before vs After" bullets
      - Reference the 10-step pipeline for transparency
      - Address the "AI hallucination" fear head-on
      - Use data or logical arguments for accuracy`,
  },
  {
    id: "explain-process",
    label: "Explain Process",
    description: "Educate on how the CV Laundry works",
    promptContext: `GOAL: Educate on the "Laundry" concept.
      - Walk through the 🧺 Input Dirty -> 🧼 Processing -> ✨ Output Clean flow
      - Explain the "Truth Skeleton" as the engine
      - Transition from "CV Editing" (old way) to "CV Laundry" (new way)
      - Make the complexity seem simple and efficient`,
  },
  {
    id: "handle-objections",
    label: "Handle Objections",
    description: "Address fears about AI or cost",
    promptContext: `GOAL: Address common hesitations.
      - "Will ATS reject AI?" (Ans: Not if it's Truth-based)
      - "Why is it paid?" (Ans: Pay for momentum, not a subscription)
      - "Is it safe?" (Ans: Stateless, 24-hour deletion)
      - Reframe costs as an investment in a faster job search`,
  },
  {
    id: "maximize-engagement",
    label: "Maximize Engagement",
    description: "Start a conversation about job hunting",
    promptContext: `GOAL: Spark discussion.
      - Ask provocative questions about the current job market
      - Invite people to share their worst CV advice
      - Challenge the "traditional" way of tailoring CVs
      - Use polls or open-ended questions
      - Position TailorYourCV as a "rational response" to a broken system`,
  },
  {
    id: "inspire",
    label: "Inspire Hope",
    description: "Motivate job seekers to keep going",
    promptContext: `GOAL: Motivate and encourage.
      - Acknowledge that job hunting is hard
      - Reframing rejection as a "lack of alignment" not "lack of value"
      - Position the tool as a "suit of armor" for the application battle
      - End with an empowering call to action
      - Tone: Empathetic, strong, supportive`,
  },
];

// ============================================================================
// Output Format Presets
// ============================================================================

export interface OutputPreset {
  id: OutputFormat;
  label: string;
  description: string;
  sceneCount: string;
  duration: "30s" | "60s" | null;
  format: "video" | "carousel";
}

export const OUTPUT_PRESETS: OutputPreset[] = [
  {
    id: "short-video",
    label: "Short Video (30s)",
    description: "Quick, punchy vertical video for TikTok/Reels/Shorts",
    sceneCount: "3-4",
    duration: "30s",
    format: "video",
  },
  {
    id: "long-video",
    label: "Long Video (60s)",
    description: "Detailed walkthrough or deep dive vertical video",
    sceneCount: "5-6",
    duration: "60s",
    format: "video",
  },
  {
    id: "carousel",
    label: "Carousel (5-7 slides)",
    description: "Educational LinkedIn carousel with visuals",
    sceneCount: "5-7",
    duration: null,
    format: "carousel",
  },
  {
    id: "video-carousel",
    label: "Video + Carousel",
    description: "Combined format for multi-platform distribution",
    sceneCount: "5-6",
    duration: "60s",
    format: "video",
  },
  {
    id: "tiktok-video",
    label: "TikTok Optimized Video",
    description: "High-engagement vertical format with text overlays",
    sceneCount: "3-5",
    duration: "60s",
    format: "video",
  },
  {
    id: "tiktok-carousel",
    label: "TikTok Photo Mode",
    description: "Dense, swipeable carousel for rapid learning",
    sceneCount: "5-10",
    duration: null,
    format: "carousel",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getStylePreset(id: ContentStyle): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id);
}

export function getAudiencePreset(id: TargetAudience): AudiencePreset | undefined {
  return AUDIENCE_PRESETS.find((p) => p.id === id);
}

export function getGoalPreset(id: ContentGoal): GoalPreset | undefined {
  return GOAL_PRESETS.find((p) => p.id === id);
}

export function getOutputPreset(id: OutputFormat): OutputPreset | undefined {
  return OUTPUT_PRESETS.find((p) => p.id === id);
}

/**
 * Build the complete context injection block for AI prompts
 */
export function buildPromptContext(settings: ContentSettings): string {
  const style = getStylePreset(settings.style);
  const audience = getAudiencePreset(settings.audience);
  const goal = getGoalPreset(settings.goal);

  return `
=== CONTENT GENERATION CONTEXT ===

${style?.promptContext || ""}

${audience?.promptContext || ""}

${goal?.promptContext || ""}

=== END CONTEXT ===
`;
}

/**
 * Build the strategy context injection block for AI prompts
 */
export function buildStrategyContext(strategy: StrategyContext): string {
  if (!strategy || (!strategy.problem && !strategy.solution && !strategy.positioning)) {
    return "";
  }

  let context = `\n=== STRATEGIC CONTEXT (Use this to ground the content) ===\n`;

  if (strategy.problem) context += `THE PROBLEM (Villain): ${strategy.problem}\n`;
  if (strategy.solution) context += `THE SOLUTION (Mechanism): ${strategy.solution}\n`;
  if (strategy.voice) context += `BRAND VOICE: ${strategy.voice}\n`;

  if (strategy.positioning) {
    context += `\nBRAND POSITIONING:\n`;
    context += `- Villain: ${strategy.positioning.villain}\n`;
    context += `- Hero: ${strategy.positioning.hero}\n`;
    context += `- Transformation: ${strategy.positioning.transformation}\n`;
    context += `- Core Promise: ${strategy.positioning.corePromise}\n`;
  }

  context += `=== END STRATEGY ===\n`;
  return context;
}

// ============================================================================
// Local Storage Persistence
// ============================================================================

const SETTINGS_STORAGE_KEY = "tailoryourcv_content_settings";

export function saveSettingsToLocalStorage(settings: ContentSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("Failed to save settings to localStorage:", e);
  }
}

export function loadSettingsFromLocalStorage(): ContentSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ContentSettings;
  } catch (e) {
    console.warn("Failed to load settings from localStorage:", e);
    return null;
  }
}

export const DEFAULT_SETTINGS: ContentSettings = {
  style: "laundry-model",
  audience: "job-seekers",
  goal: "drive-uploads",
  outputFormat: "short-video",
};
