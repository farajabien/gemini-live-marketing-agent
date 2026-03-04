/**
 * Core Type Definitions for IdeaToVideo
 * 
 * This file provides type-safe interfaces for all entities and data structures
 * used across the application. Import from here instead of using `any`.
 * 
 * IMPORTANT: Keep these types in sync with instant.schema.ts
 * When adding/modifying fields in the schema, update the corresponding types here.
 */

// ============================================================================
// Scene & Video Plan Types (Core Domain)
// ============================================================================

export interface SubScene {
  id: string;
  visualPrompt: string;
  duration: number; // Dynamic: 1-3 seconds per visual
  imageUrl?: string;
  videoClipUrl?: string;
  operationId?: string;
}

export interface Scene {
  id: string;
  duration: number; // in seconds, e.g., 5-10
  voiceover: string;
  visualPrompt: string; // Primary visual (legacy/fallback)
  textOverlay?: string;
  imageUrl?: string; // Primary image (legacy/fallback)
  audioUrl?: string;
  videoClipUrl?: string; // Veo-generated b-roll clip (Pro only)
  operationId?: string; // Veo async operation ID for polling
  isVerbatimLocked?: boolean; // When true, voiceover text is locked (verbatim mode)

  // NEW: Multi-visual sequence support
  subScenes?: SubScene[]; // Multiple visual cuts for this voiceover segment
}

// ============================================================================
// Verbatim Mode Types
// ============================================================================

export type VoiceTone = "calm" | "neutral" | "confident";

export interface SceneChunkOptions {
  maxWordsPerScene: number; // Default: 30
  respectBlankLines: boolean; // Default: true
}

export interface VerbatimConfig {
  enabled: boolean;
  tone: VoiceTone;
  autoChunk: boolean;
  sceneChunkOptions: SceneChunkOptions;
}

export interface VideoPlan {
  id?: string;
  title: string;
  tone: string;
  scenes: Scene[];
  estimatedDuration?: number; // Legacy field - optional
  duration?: number; // Total video duration in seconds (calculated from scenes)
  type: "video" | "carousel";
  thumbnailPrompt?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  visualConsistency?: string;
  status?: VideoPlanStatus;
  voiceId?: string;
  visualMode?: "image" | "broll" | "text_motion" | "gif_voice"; // Pro users only for broll
  createdAt?: number;
  postedAt?: number;
  // New settings fields
  style?: ContentStyle;
  audience?: TargetAudience;
  goal?: ContentGoal;
  outputFormat?: OutputFormat;
  // Verbatim mode fields
  verbatimMode?: boolean;
  verbatimTone?: VoiceTone;
  originalScript?: string; // Preserved original user script

  narrativeId?: string; // Link to parent narrative (Legacy)
  
  // Strategy & Context Fields (Unified Narrative)
  sourceContentPieceId?: string; // Link to the original draft this was generated from
  problem?: string;
  solution?: string;
  voice?: string; // Brand voice
  positioning?: BrandPositioning;
  pillars?: ContentPillar[];
  socialMetadata?: {
    suggestedCaptions?: {
      linkedin?: string;
      tiktok?: string;
      twitter?: string;
    };
    hashtags?: string[];
  };
}

export type VideoPlanStatus = "draft" | "pending" | "generating" | "rendering" | "rendering_video" | "completed";

// ============================================================================
// Content Settings Types (New Dropdown Options)
// ============================================================================

export type ContentStyle = 
  | "laundry-model" 
  | "truth-skeleton" 
  | "friction-killer" 
  | "insider-tips" 
  | "success-story" 
  | "technical-deep-dive";

export type TargetAudience = 
  | "job-seekers" 
  | "software-engineers" 
  | "career-changers" 
  | "recruiters" 
  | "high-volume-applicants" 
  | "general";

export type ContentGoal = 
  | "drive-uploads" 
  | "build-trust" 
  | "explain-process" 
  | "handle-objections" 
  | "maximize-engagement" 
  | "inspire";

export type OutputFormat =
  | "short-video"
  | "long-video"
  | "carousel"
  | "video-carousel"
  | "tiktok-video"
  | "tiktok-carousel";

export interface ContentSettings {
  style: ContentStyle;
  audience: TargetAudience;
  goal: ContentGoal;
  outputFormat: OutputFormat;
}

// ============================================================================
// User & Plan Types (InstantDB Schema Aligned)
// ============================================================================

export interface User {
  id: string;
  email?: string;
  imageURL?: string;
  planId?: "free" | "pro" | "pro_max";
  type?: string;
  // Quota tracking
  lifetimeGenerations?: number; // Total generations ever
  monthlyGenerations?: number; // Generations this month
  generationResetDate?: number; // UTC timestamp of last monthly reset
}

export interface VideoPlanWithOwner extends VideoPlan {
  owner?: User[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface GeminiImagePart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

export interface GeminiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
      inlineData?: {
        data: string;
        mimeType: string;
      };
    }>;
  };
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export interface StorageUploadResult {
  data?: {
    path?: string;
    url?: string;
  };
  url?: string;
  path?: string;
}

export interface StorageDownloadResult {
  data?: string;
  url?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

// ============================================================================
// Pricing Types
// ============================================================================

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
  buttonText: string;
  isPopular: boolean;
  features: string[];
}

// ============================================================================
// Series & Episode Types (Serial Content Feature)
// ============================================================================

export interface SeriesMetadata {
  title: string;
  tagline?: string;
  visualConsistency: string; // Character/style guide for all episodes
  episodes: Array<{
    title: string;
    beats: string[]; // Key narrative beats for this episode
  }>;
}

export type SeriesStatus = "draft" | "generating" | "complete";
export type EpisodeStatus = "draft" | "script_ready" | "generating" | "complete" | "failed";

export interface Series {
  id: string;
  userId: string;
  title: string;
  tagline?: string;
  megaPrompt: string; // Original user input
  formalizedJson: SeriesMetadata; // AI-structured output
  visualConsistency: string; // Character/style guide
  episodeCount: number;
  status: SeriesStatus;
  seriesNarrativeId?: string; // Link to narrative architecture
  createdAt: number;
  updatedAt: number;
}

export interface SeriesNarrative {
  id: string;
  title: string;
  genre: string;
  worldSetting: string;
  conflictType: string;
  protagonistArchetype: string;
  centralTheme: string;
  narrativeTone: string;
  visualStyle: string;
  episodeHooks: string;
  
  characterDynamics?: any;
  plotBeats?: string[];
  
  createdAt: number;
  updatedAt: number;
  totalCost?: number;
}

export interface Episode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  script: string; // Verbatim narration text
  visualPrompts: string[]; // Scene visual descriptions
  status: EpisodeStatus;
  videoPlanId?: string; // Links to existing VideoPlan
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number; // Video duration in seconds
  createdAt: number;
  updatedAt: number;
}

export interface SeriesWithEpisodes extends Series {
  episodes?: Episode[];
}

// ============================================================================
// Reference Image Types
// ============================================================================

export interface ReferenceImage {
  url: string;
  mimeType: string;
  mode: "direct" | "inspiration";
}

// ============================================================================
// Founder Narrative Types
// ============================================================================

export interface BrandPositioning {
  villain: string;
  hero: string;
  transformation: string;
  corePromise: string;
  emotionalArc: string;
}

export interface ContentPillar {
  title: string;
  description: string;
  angles: string[];
}

export interface StrategyContext {
  problem?: string;
  solution?: string;
  voice?: string;
  positioning?: BrandPositioning;
  pillars?: ContentPillar[];
}


export type FounderVoice = "calm" | "sharp" | "reflective" | "blunt";
export type NarrativeStatus = "wizard" | "active" | "archived";
export type ContentFormat = "linkedin-post" | "x-post" | "thread" | "short-video" | "long-video" | "carousel" | "tiktok-video" | "tiktok-carousel" | "blog-post" | "youtube-long" | "youtube-short" | "instagram-reel";
export type ContentStatus = "suggested" | "approved" | "rejected" | "edited" | "published";

export interface FounderNarrative {
  id: string;
  title: string;

  // === New Wizard Fields (Narrative Intelligence) ===
  audience?: string;
  currentState?: string;
  problem?: string;
  costOfInaction?: string;
  solution?: string;
  afterState?: string;
  identityShift?: string;
  voice?: string;

  // === AI-Extracted Fields ===
  positioning?: {
    villain: string;
    hero: string;
    stakes: string;
    promise: string;
    mechanism: string;
    contrast: { before: string; after: string };
  };
  angles?: {
    painAngles?: string[];
    costAngles?: string[];
    mechanismAngles?: string[];
    identityAngles?: string[];
    outcomeAngles?: string[];
  };
  narrativeStrength?: {
    specificityScore: number;
    emotionalClarity: number;
    tensionStrength: number;
    contrastScore: number;
    overallScore: number;
  };
  versions?: Array<{
    timestamp: number;
    changes: Record<string, { old: any; new: any }>;
    updatedBy: string;
  }>;

  // === Legacy Wizard Fields (backward compatibility) ===
  theMoment?: string;
  thePain?: string;
  failedSolutions?: string;
  yourBelief?: string;
  yourApproach?: string;
  idealUser?: string;
  desiredChange?: string;
  founderVoice?: FounderVoice;

  // === Legacy AI-synthesized Fields ===
  synthesizedNarrative?: string;
  narrativeAngles?: string[];
  oneLiner?: string;
  problemStatement?: string;

  // Metadata
  status: NarrativeStatus;
  currentWizardStep?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ContentPiece {
  id: string;
  title: string;
  body: string;
  angle?: string;
  format: ContentFormat;
  hook?: string;
  callToAction?: string;
  status: ContentStatus;
  editedBody?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  narrativeId?: string;
  generatedPlans?: VideoPlan[];
}

export interface NarrativeWithContent extends FounderNarrative {
  contentPieces?: ContentPiece[];
}

export const WIZARD_STEPS = [
  {
    key: "theMoment" as const,
    title: "The Moment",
    question: "When did this problem become undeniable to you?",
    helper: "Describe the specific moment, experience, or frustration that made you say 'someone has to fix this.'",
    placeholder: "I was working on... when I realized that...",
  },
  {
    key: "thePain" as const,
    title: "The Pain",
    question: "Who suffers from this problem, and what does that suffering look like?",
    helper: "Describe real people and real situations. Skip personas — use the language your users would use.",
    placeholder: "Every day, [people] struggle with...",
  },
  {
    key: "failedSolutions" as const,
    title: "Failed Solutions",
    question: "What have people tried before, and why did it fail them?",
    helper: "What do they currently do? Why is it broken, slow, or painful? What's the gap?",
    placeholder: "Most people try to solve this by... but it fails because...",
  },
  {
    key: "yourBelief" as const,
    title: "Your Belief",
    question: "What do you believe about this problem that most people don't?",
    helper: "This is your contrarian insight — the thing that makes your approach different.",
    placeholder: "I believe that... even though most people think...",
  },
  {
    key: "yourApproach" as const,
    title: "Your Approach",
    question: "How are you solving this differently?",
    helper: "Not features — philosophy. What principle drives your solution?",
    placeholder: "Instead of... we... because we believe...",
  },
  {
    key: "idealUser" as const,
    title: "Your User",
    question: "Describe the person you're building this for.",
    helper: "One specific person. What's their day like? What do they care about most?",
    placeholder: "They are a... who spends their day... and cares deeply about...",
  },
  {
    key: "desiredChange" as const,
    title: "The Change",
    question: "What does the world look like if you succeed?",
    helper: "Describe the transformation — before and after.",
    placeholder: "Before: ... After: ...",
  },
  {
    key: "founderVoice" as const,
    title: "Your Voice",
    question: "How do you naturally talk about this?",
    helper: "Pick the voice that feels most like you when you're explaining your startup to someone who gets it.",
    placeholder: "",
    isChoice: true,
    choices: [
      { value: "calm", label: "Calm & Thoughtful", description: "Measured, patient, explains with clarity" },
      { value: "sharp", label: "Sharp & Direct", description: "No-nonsense, cuts to the point fast" },
      { value: "reflective", label: "Reflective & Deep", description: "Philosophical, connects dots others miss" },
      { value: "blunt", label: "Blunt & Honest", description: "Raw, unfiltered, says what others won't" },
    ],
  },
] as const;

// ============================================================================
// Component Props Types
// ============================================================================

export interface ProjectCardProps {
  plan: VideoPlan;
  onPreview: (plan: VideoPlan) => void;
}

export interface PreviewDialogProps {
  plan: VideoPlan | null;
  onClose: () => void;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
}

/**
 * Type guard to safely extract error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * Type guard for checking if a value is a valid Scene
 */
export function isScene(value: unknown): value is Scene {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.duration === "number" &&
    typeof obj.voiceover === "string" &&
    typeof obj.visualPrompt === "string"
  );
}

/**
 * Type guard for checking if a value is a valid VideoPlan
 */
export function isVideoPlan(value: unknown): value is VideoPlan {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.tone === "string" &&
    Array.isArray(obj.scenes) &&
    (obj.type === "video" || obj.type === "carousel")
  );
}
