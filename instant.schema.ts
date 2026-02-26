// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
       $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      planId: i.string().optional(), // 'free' | 'pro'
      type: i.string().optional(),
      // Quota tracking fields
      lifetimeGenerations: i.number().optional(), // Never resets
      monthlyGenerations: i.number().optional(), // Resets on 1st of each month
      generationResetDate: i.number().optional(), // UTC timestamp of last reset
    }),
    videoPlans: i.entity({
      title: i.string(),
      tone: i.string().optional(),
      scenes: i.json(), // Stores the array of scenes
      type: i.string().optional(), // 'video' | 'carousel'
      status: i.string().optional(), // 'draft', 'pending', 'rendering', 'completed'
      voiceId: i.string().optional(), // Gemini voice name for TTS
      thumbnailUrl: i.string().optional(),
      thumbnailPrompt: i.string().optional(),
      visualConsistency: i.string().optional(),
      videoUrl: i.string().optional(),
      visualMode: i.string().optional(), // 'image' | 'broll' - Pro users only for broll
      duration: i.number().optional(), // Total video duration in seconds
      createdAt: i.number().indexed(),
      // Content settings for context injection
      style: i.string().optional(), // ContentStyle: 'educational' | 'founder-pov' | 'storytelling' | etc.
      audience: i.string().optional(), // TargetAudience: 'solo-founders' | 'indie-builders' | etc.
      goal: i.string().optional(), // ContentGoal: 'validate-demand' | 'build-awareness' | etc.
      outputFormat: i.string().optional(), // OutputFormat: 'short-video' | 'long-video' | 'carousel' | etc.
      // Verbatim mode fields
      verbatimMode: i.boolean().optional(), // If true, user's exact script is used for voiceover
      verbatimTone: i.string().optional(), // Voice tone for verbatim mode: 'calm' | 'neutral' | 'confident'
      originalScript: i.string().optional(), // Original user script when in verbatim mode
      // Strategy & Context Fields (Unified Narrative)
      problem: i.string().optional(),
      solution: i.string().optional(),
      voice: i.string().optional(), // Brand voice: 'calm' | 'sharp' | 'reflective' | 'blunt'
      pillars: i.json().optional(), // Generated content pillars
      socialMetadata: i.json().optional(), // { suggestedCaptions: { linkedin, tiktok, twitter }, hashtags: string[] }
      postedAt: i.number().optional(), // Track when the content was posted
      // === Content Tagging for AI Analysis ===
      contentTags: i.json().optional(), // { primaryAngle: string, specificAngles: string[], hookType: string, emotionalTone: string }
      // === Performance Tracking ===
      metrics: i.json().optional(), // { posted: boolean, postedAt: number, platform: string, videoUrl: string, metrics24h: { views, likes, shares, saves, comments }, metrics7d: { views, likes, shares, saves, comments }, boosted: boolean, organic: boolean }
      totalCost: i.number().optional(),
    }),

    voices: i.entity({
      voice_id: i.string().unique().indexed(),
      name: i.string(),
      category: i.string(),
      description: i.string().optional(),
      preview_url: i.string().optional(),
      labels: i.json().optional(),
    }),
    series: i.entity({
      title: i.string(),
      tagline: i.string().optional(),
      megaPrompt: i.string(), // Original user input
      formalizedJson: i.json(), // AI-structured SeriesMetadata
      visualConsistency: i.string(), // Character/style guide
      episodeCount: i.number(),
      status: i.string(), // 'draft' | 'generating' | 'complete'
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
      totalCost: i.number().optional(),
      seriesNarrativeId: i.string().optional(),
    }),
    episodes: i.entity({
      episodeNumber: i.number().indexed(),
      title: i.string(),
      script: i.string(), // Verbatim narration text
      visualPrompts: i.json(), // Array of visual prompt strings
      status: i.string(), // 'draft' | 'script_ready' | 'generating' | 'complete' | 'failed'
      videoPlanId: i.string().optional(), // Links to videoPlan ID
      videoUrl: i.string().optional(),
      thumbnailUrl: i.string().optional(),
      duration: i.number().optional(), // Video duration in seconds
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
      totalCost: i.number().optional(),
    }),
    narratives: i.entity({
      title: i.string(),

      // === Wizard Answers (Raw Strategic Inputs) ===
      audience: i.string().optional(), // Who are you helping?
      currentState: i.string().optional(), // What does their current reality look like?
      problem: i.string().optional(), // What is their expensive pain?
      costOfInaction: i.string().optional(), // What is this costing them?
      solution: i.string().optional(), // What is your unique mechanism?
      afterState: i.string().optional(), // What does life look like after?
      identityShift: i.string().optional(), // Who do they become?
      voice: i.string().optional(), // Brand voice: 'calm' | 'sharp' | 'reflective' | 'blunt'

      // === Legacy Fields (kept for backward compatibility) ===
      theMoment: i.string().optional(),
      thePain: i.string().optional(),
      failedSolutions: i.string().optional(),
      yourBelief: i.string().optional(),
      yourApproach: i.string().optional(),
      idealUser: i.string().optional(),
      desiredChange: i.string().optional(),
      founderVoice: i.string().optional(),

      // === AI-Extracted Positioning ===
      aiPositioning: i.json().optional(), // { villain, hero, stakes, promise, mechanism, contrast: { before, after } }

      // === Content Angles (for tagging) ===
      angles: i.json().optional(), // { painAngles: string[], costAngles: string[], mechanismAngles: string[], identityAngles: string[], outcomeAngles: string[] }

      // === Narrative Quality Metrics ===
      narrativeStrength: i.json().optional(), // { specificityScore, emotionalClarity, tensionStrength, contrastScore, overallScore }

      // === Version History ===
      versions: i.json().optional(), // Array of { timestamp, changes: { [field]: { old, new } }, updatedBy }

      // === Legacy AI-Synthesized Fields ===
      synthesizedNarrative: i.string().optional(),
      narrativeAngles: i.json().optional(), // string[]
      oneLiner: i.string().optional(),
      problemStatement: i.string().optional(),

      // === Metadata ===
      status: i.string(), // 'wizard' | 'active' | 'archived'
      currentWizardStep: i.number().optional(),
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
      totalCost: i.number().optional(),
    }),
    seriesNarratives: i.entity({
      title: i.string(),
      genre: i.string(),
      worldSetting: i.string(),
      conflictType: i.string(),
      protagonistArchetype: i.string(),
      centralTheme: i.string(),
      narrativeTone: i.string(),
      visualStyle: i.string(),
      episodeHooks: i.string(),
      
      // AI Processed
      characterDynamics: i.json().optional(),
      plotBeats: i.json().optional(),
      
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
      totalCost: i.number().optional(),
    }),
    contentPieces: i.entity({
      title: i.string(),
      body: i.string(),
      angle: i.string().optional(),
      format: i.string(), // 'linkedin-post' | 'x-post' | 'thread' | 'short-video' | 'carousel' | 'tiktok-video' | 'tiktok-carousel' | 'blog-post'
      hook: i.string().optional(),
      callToAction: i.string().optional(),
      status: i.string(), // 'suggested' | 'approved' | 'rejected' | 'edited' | 'published'
      editedBody: i.string().optional(),
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
      publishedAt: i.number().optional(),
      narrativeId: i.string().indexed(), // Link to narrative (Project)
    }),

    // --- AI Marketing Assistant Entities ---
    brandPositioning: i.entity({
      narrativeId: i.string().unique().indexed(), // One positioning per narrative
      villain: i.string(),
      hero: i.string(),
      transformation: i.string(),
      corePromise: i.string(),
      pricingNarrative: i.string().optional(),
      emotionalArc: i.string().optional(),
      createdAt: i.number(),
      updatedAt: i.number(),
    }),

    contentPillars: i.entity({
      narrativeId: i.string().indexed(),
      title: i.string(), // e.g., "Chaos vs Clarity"
      description: i.string().optional(),
      angles: i.json(), // Array of strings (content angles)
      status: i.string(), // 'active' | 'archived'
      createdAt: i.number(),
    }),

    contentDrafts: i.entity({
      narrativeId: i.string().indexed(),
      pillarId: i.string().optional(),
      angle: i.string(),
      title: i.string(),
      
      // Generated Content
      slides: i.json(), // Array of slide objects
      visualPrompts: i.json(), // Array of strings
      captions: i.json(), // { tiktok: "...", linkedin: "..." }
      
      // Status
      status: i.string().indexed(), // 'draft' | 'generating' | 'review' | 'scheduled' | 'posted'
      scheduledFor: i.number().optional(),
      postedAt: i.number().optional(),
      
      // Linked Media
      videoPlanId: i.string().optional(),
      
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
    }),
 
  },
  links: {
    usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    usersVideoPlans: {
      forward: {
        on: "$users",
        has: "many",
        label: "videoPlans",
      },
      reverse: {
        on: "videoPlans",
        has: "one",
        label: "owner",
      },
    },
    usersSeries: {
      forward: {
        on: "$users",
        has: "many",
        label: "series",
      },
      reverse: {
        on: "series",
        has: "one",
        label: "owner",
      },
    },
    seriesEpisodes: {
      forward: {
        on: "series",
        has: "many",
        label: "episodes",
      },
      reverse: {
        on: "episodes",
        has: "one",
        label: "series",
        onDelete: "cascade", // Delete episodes when series is deleted
      },
    },
    usersNarratives: {
      forward: {
        on: "$users",
        has: "many",
        label: "narratives",
      },
      reverse: {
        on: "narratives",
        has: "one",
        label: "owner",
      },
    },
    usersSeriesNarratives: {
      forward: {
        on: "$users",
        has: "many",
        label: "seriesNarratives",
      },
      reverse: {
        on: "seriesNarratives",
        has: "one",
        label: "owner",
      },
    },
    narrativesContentPieces: {
      forward: {
        on: "narratives",
        has: "many",
        label: "contentPieces",
      },
      reverse: {
        on: "contentPieces",
        has: "one",
        label: "narrative",
        onDelete: "cascade",
      },
    },
    narrativesBrandPositioning: {
      forward: {
        on: "narratives",
        has: "one",
        label: "positioning",
      },
      reverse: {
        on: "brandPositioning",
        has: "one",
        label: "narrative",
        onDelete: "cascade",
      },
    },
    narrativesContentPillars: {
      forward: {
        on: "narratives",
        has: "many",
        label: "pillars",
      },
      reverse: {
        on: "contentPillars",
        has: "one",
        label: "narrative",
        onDelete: "cascade",
      },
    },
    narrativesContentDrafts: {
      forward: {
        on: "narratives",
        has: "many",
        label: "drafts",
      },
      reverse: {
        on: "contentDrafts",
        has: "one",
        label: "narrative",
        onDelete: "cascade",
      },
    },
    videoPlansNarrative: {
      forward: {
        on: "narratives",
        has: "many",
        label: "videoPlans",
      },
      reverse: {
        on: "videoPlans",
        has: "one",
        label: "narrative",
        onDelete: "cascade",
      },
    },
    // Link an AI generated video plan back to the original draft Content Piece
    sourceContentPivot: {
      forward: {
        on: "videoPlans",
        has: "one",
        label: "sourceContentPiece",
      },
      reverse: {
        on: "contentPieces",
        has: "many",
        label: "generatedPlans",
      },
    },
    seriesNarrativeLink: {
      forward: {
        on: "seriesNarratives",
        has: "many",
        label: "series",
      },
      reverse: {
        on: "series",
        has: "one",
        label: "narrativeConfig",
      },
    }
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
