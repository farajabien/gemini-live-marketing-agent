export const PRICING_TIERS = {
  FREE: {
    id: "free",
    name: "Free",
    price: 0,
    videos: 1,
    description: "Test the idea-to-video flow.",
    buttonText: "Try It Free",
    isPopular: false,
    features: [
      "1 Video (total)",
      "Standard AI Voice",
      "Watermarked Export",
      "Image-based scenes",
    ],
  },

  PRO: {
    id: "pro",
    name: "Pro",
    price: 19,
    videos: 20,
    description: "Turn ideas and docs into daily content.",
    buttonText: "Upgrade to Pro",
    isPopular: true,
    features: [
      "20 Videos / month",
      "Consistent AI Voice",
      "No Watermark",
      "1080p Export",
      "Image-based scenes",
      "Scene variations",
      "Demo Narrator (Video → Voice)",
    ],
  },

  PRO_MAX: {
    id: "pro_max",
    name: "AI Marketing Assistant",
    price: 49,
    videos: 30,
    description: "Full positioning engine & daily content system.",
    buttonText: "Hire the Assistant",
    isPopular: true,
    features: [
      "30 Videos / month",
      "Positioning & Narrative Engine",
      "Content Pillar Generator",
      "Auto-captions & DM Funnels",
      "Cinematic motion scenes",
      "Consistent AI Voice",
      "No Watermark",
      "Priority generation",
    ],
  },
};

export const PLAN_LIMITS = {
  free: 1,
  pro: 20,
  pro_max: 20,
};

export const DEFAULT_TIER = PRICING_TIERS.FREE;


export function getTierConfig(tierId?: string) {
  if (!tierId) return DEFAULT_TIER;
  const key = tierId.toUpperCase() as keyof typeof PRICING_TIERS;
  return PRICING_TIERS[key] || DEFAULT_TIER;
}

/**
 * Checks if a user is eligible to generate a new video or carousel
 */
export function canUserGenerate(
  planId: string | undefined,
  currentUsage: number
) {
  const limit =
    PLAN_LIMITS[planId as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
  return currentUsage < limit;
}

export const UPGRADE_FAQ = [
  {
    q: "How many videos can I create?",
    a: "Free users get 1 video total to test the flow. Pro and Pro Max users get 20 videos per month — roughly one video per workday.",
  },
  {
    q: "What’s the difference between Pro and Pro Max?",
    a: "Pro uses high-quality image-based scenes. Pro Max adds cinematic motion scenes (B-roll) for richer storytelling and premium visuals.",
  },
  {
    q: "Is there a watermark on Pro videos?",
    a: "No. Both Pro and Pro Max include clean, watermark-free 1080p MP4 exports ready for posting.",
  },
  {
    q: "What kind of content can I generate?",
    a: "Educational videos, listicles, storytelling content, product explainers, and LinkedIn-style carousels — all from raw text, docs, or screenshots.",
  },
  {
    q: "Do I own the content I create?",
    a: "Yes. You fully own all content generated using IdeaToVideo, including commercial rights.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel anytime. Your plan stays active until the end of your billing cycle.",
  },
];