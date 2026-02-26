export type SeriesNarrativeStepId =
  | "genre"
  | "worldSetting"
  | "conflictType"
  | "protagonistArchetype"
  | "centralTheme"
  | "narrativeTone"
  | "visualStyle"
  | "episodeHooks";

export interface SeriesNarrativeStep {
  id: SeriesNarrativeStepId;
  title: string;
  description: string;
  placeholder: string;
  type: "text" | "choice";
  choices?: {
    value: string;
    label: string;
    description: string;
    icon: string;
  }[];
}

export const SERIES_NARRATIVE_STEPS: SeriesNarrativeStep[] = [
  {
    id: "genre",
    title: "What is the Genre?",
    description: "The core category that defines the rules of your story world.",
    placeholder: "",
    type: "choice",
    choices: [
      {
        value: "sci-fi",
        label: "Sci-Fi / Futuristic",
        description: "Technology, space, or alternative futures",
        icon: "rocket_launch",
      },
      {
        value: "mystery",
        label: "Mystery / Noir",
        description: "Intrigue, secrets, and investigation",
        icon: "search",
      },
      {
        value: "educational",
        label: "Educational / Docu",
        description: "Informative, factual, and guiding",
        icon: "school",
      },
      {
        value: "thriller",
        label: "Thriller / Action",
        description: "High stakes, tension, and momentum",
        icon: "speed",
      },
      {
        value: "adventure",
        label: "Epic Adventure",
        description: "A grand journey and discovery",
        icon: "explore",
      },
    ],
  },
  {
    id: "worldSetting",
    title: "The World & Setting",
    description: "Where and when does this story take place? Define the environment.",
    placeholder: "e.g. A dystopian underwater city in 2150 where air is the primary currency.",
    type: "text",
  },
  {
    id: "conflictType",
    title: "Primary Conflict",
    description: "What is the core tension driving the story forward?",
    placeholder: "",
    type: "choice",
    choices: [
      {
        value: "internal",
        label: "Person vs Self",
        description: "Internal struggle, doubt, or character growth",
        icon: "psychology",
      },
      {
        value: "external-human",
        label: "Person vs Person",
        description: "Direct rivalry, betrayal, or competition",
        icon: "groups",
      },
      {
        value: "society",
        label: "Person vs System",
        description: "Fighting against a corrupt society or fate",
        icon: "account_balance",
      },
      {
        value: "technology",
        label: "Person vs Tech",
        description: "The struggle with AI, machines, or progress",
        icon: "memory",
      },
    ],
  },
  {
    id: "protagonistArchetype",
    title: "Protagonist Archetype",
    description: "Who is the lead character? What defines their role?",
    placeholder: "",
    type: "choice",
    choices: [
      {
        value: "hero",
        label: "The Reluctant Hero",
        description: "Doesn't want the spotlight but steps up",
        icon: "shield",
      },
      {
        value: "outcast",
        label: "The Outcast",
        description: "Operates on the fringes, follows own rules",
        icon: "fingerprint",
      },
      {
        value: "sage",
        label: "The Sage / Visionary",
        description: "Guided by wisdom or a grand vision",
        icon: "visibility",
      },
      {
        value: "rebel",
        label: "The Rebel",
        description: "Seeks to disrupt the status quo",
        icon: "campaign",
      },
    ],
  },
  {
    id: "centralTheme",
    title: "What is the Central Theme?",
    description: "What is the story *really* about? The underlying message.",
    placeholder: "e.g. The cost of convenience in a hyper-connected world.",
    type: "text",
  },
  {
    id: "narrativeTone",
    title: "Tone & Atmosphere",
    description: "The emotional frequency of the series.",
    placeholder: "",
    type: "choice",
    choices: [
      {
        value: "stoic",
        label: "Stoic & Gritty",
        description: "Serious, grounded, and resilient",
        icon: "mountain_flag",
      },
      {
        value: "whimsical",
        label: "Whimsical / Surreal",
        description: "Unexpected, bright, and imaginative",
        icon: "auto_fix_high",
      },
      {
        value: "dark",
        label: "Dark & Suspenseful",
        description: "Heavy atmosphere, high stakes",
        icon: "dark_mode",
      },
      {
        value: "inspiring",
        label: "Inspiring & Uplifting",
        description: "Hopeful and motivation-focused",
        icon: "light_mode",
      },
    ],
  },
  {
    id: "visualStyle",
    title: "Visual Consistency Guide",
    description: "Describe the lighting, color palette, and camera style.",
    placeholder: "e.g. Neon-drenched nights, handheld camera, high contrast, cyberpunk aesthetic.",
    type: "text",
  },
  {
    id: "episodeHooks",
    title: "Episode Hooks & Pacing",
    description: "How should each episode leave the audience feeling?",
    placeholder: "e.g. Each episode ends with a cliffhanger that challenges a moral belief.",
    type: "text",
  },
];
