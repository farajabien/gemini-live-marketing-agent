export type NarrativeStepId =
  | "audience"
  | "currentState"
  | "problem"
  | "costOfInaction"
  | "solution"
  | "afterState"
  | "identityShift"
  | "voice";

export interface NarrativeStep {
  id: NarrativeStepId;
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

export const NARRATIVE_STEPS: NarrativeStep[] = [
  {
    id: "audience",
    title: "Who are you helping?",
    description:
      'Be extremely specific. Role, revenue, maturity, situation. "Everyone" is no one.',
    placeholder:
      "e.g. Laundry shop owners with 1–3 locations managing orders manually via WhatsApp and notebooks.",
    type: "text",
  },
  {
    id: "currentState",
    title: "What does their current reality look like?",
    description:
      "Describe their daily workflow, chaos, habits, tools, and environment. Make it visual.",
    placeholder:
      "e.g. Orders written in notebooks, customers calling to check status, staff constantly asking questions, no centralized tracking.",
    type: "text",
  },
  {
    id: "problem",
    title: "What is their expensive pain?",
    description:
      "What frustrates them emotionally and operationally? What keeps them stuck?",
    placeholder:
      "e.g. They can’t track orders accurately, miss updates, and feel constantly reactive instead of in control.",
    type: "text",
  },
  {
    id: "costOfInaction",
    title: "What is this costing them if nothing changes?",
    description:
      "Be concrete. Money, stress, lost growth, reputation damage, burnout.",
    placeholder:
      "e.g. Lost repeat customers, staff inefficiency, hidden revenue leakage, inability to scale to a second location.",
    type: "text",
  },
  {
    id: "solution",
    title: "What is your unique mechanism?",
    description:
      "Explain your approach or system. Not feature list. What makes your method different?",
    placeholder:
      "e.g. A centralized order management system that logs, tracks, and updates every order in real time with visibility for the owner.",
    type: "text",
  },
  {
    id: "afterState",
    title: "What does life look like after they fix this?",
    description:
      "Describe operational clarity and emotional relief.",
    placeholder:
      "e.g. Orders visible instantly, fewer customer complaints, staff aligned, clear daily revenue tracking.",
    type: "text",
  },
  {
    id: "identityShift",
    title: "Who do they become after solving this?",
    description:
      "How does this change how they see themselves as an operator?",
    placeholder:
      "e.g. From reactive shop owner to confident business operator with full visibility.",
    type: "text",
  },
  {
    id: "voice",
    title: "What is your brand voice?",
    description: "How should your content sound?",
    placeholder: "",
    type: "choice",
    choices: [
      {
        value: "calm",
        label: "Calm & Thoughtful",
        description: "Measured, patient, clear explanations",
        icon: "spa",
      },
      {
        value: "sharp",
        label: "Sharp & Direct",
        description: "Clear, structured, straight to the point",
        icon: "bolt",
      },
      {
        value: "reflective",
        label: "Reflective & Deep",
        description: "Philosophical, insightful, connects hidden dots",
        icon: "psychology",
      },
      {
        value: "blunt",
        label: "Blunt & Honest",
        description: "Direct, slightly confrontational, truth-heavy",
        icon: "local_fire_department",
      },
    ],
  },
];