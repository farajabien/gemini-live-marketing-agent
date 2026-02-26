import { generateText } from "@/lib/ai/gemini-client";
import type { VideoPlan } from "@/lib/types";

export interface ContentTags {
  primaryAngle: string; // Main content angle (e.g., "Pain-focused", "Outcome-focused")
  specificAngles: string[]; // Specific angles from narrative (e.g., ["Manual chaos costs revenue", "Staff burnout"])
  hookType: string; // Type of hook (e.g., "Question", "Bold Statement", "Storytelling")
  emotionalTone: string; // Emotional tone (e.g., "Urgent", "Aspirational", "Educational")
}

export async function autoTagContent(
  videoPlan: VideoPlan,
  narrativeAngles?: {
    painAngles?: string[];
    costAngles?: string[];
    mechanismAngles?: string[];
    identityAngles?: string[];
    outcomeAngles?: string[];
  }
): Promise<ContentTags> {
  const sceneTexts = videoPlan.scenes.map(s => s.voiceover).join("\n");

  // Build available angles list for AI to match against
  const availableAngles = narrativeAngles ? [
    ...(narrativeAngles.painAngles || []),
    ...(narrativeAngles.costAngles || []),
    ...(narrativeAngles.mechanismAngles || []),
    ...(narrativeAngles.identityAngles || []),
    ...(narrativeAngles.outcomeAngles || []),
  ] : [];

  const prompt = `
You are a content strategist analyzing a video script to extract content tags.

VIDEO TITLE: ${videoPlan.title}

VIDEO SCRIPT:
${sceneTexts}

${availableAngles.length > 0 ? `
AVAILABLE NARRATIVE ANGLES (from brand narrative):
${availableAngles.map((angle, i) => `${i + 1}. ${angle}`).join('\n')}
` : ''}

Analyze this content and extract tags:

OUTPUT JSON ONLY:
{
  "primaryAngle": "Choose ONE: Pain-focused | Cost-focused | Mechanism-focused | Identity-focused | Outcome-focused",
  "specificAngles": ${availableAngles.length > 0
    ? '["Select 1-3 angles from the AVAILABLE NARRATIVE ANGLES list that best match this content"]'
    : '["Extract 1-3 specific content angles from the script itself"]'
  },
  "hookType": "Choose ONE: Question | Bold Statement | Storytelling | Statistics | Contrarian | Problem-Solution | Before-After",
  "emotionalTone": "Choose ONE: Urgent | Aspirational | Educational | Confrontational | Empowering | Reflective | Practical"
}

Be specific and accurate based on the actual script content.
`;

  const response = await generateText(
    prompt,
    "You are a content analyst. Output JSON only.",
    "gpt-4o",
    0.5
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse content tags:", e);

    // Fallback: basic tags
    return {
      primaryAngle: "Outcome-focused",
      specificAngles: [],
      hookType: "Educational",
      emotionalTone: "Practical",
    };
  }
}

// Helper: Match video content to narrative angles
export function matchContentToNarrativeAngles(
  contentTags: ContentTags,
  narrativeAngles?: {
    painAngles?: string[];
    costAngles?: string[];
    mechanismAngles?: string[];
    identityAngles?: string[];
    outcomeAngles?: string[];
  }
): {
  matchedCategory: string;
  matchedAngles: string[];
  matchScore: number; // 0-100
} {
  if (!narrativeAngles) {
    return {
      matchedCategory: "Unknown",
      matchedAngles: [],
      matchScore: 0,
    };
  }

  // Determine category from primaryAngle
  const categoryMap: Record<string, keyof typeof narrativeAngles> = {
    "Pain-focused": "painAngles",
    "Cost-focused": "costAngles",
    "Mechanism-focused": "mechanismAngles",
    "Identity-focused": "identityAngles",
    "Outcome-focused": "outcomeAngles",
  };

  const category = categoryMap[contentTags.primaryAngle] || "outcomeAngles";
  const categoryAngles = narrativeAngles[category] || [];

  // Calculate match score based on overlap
  const matchedAngles = contentTags.specificAngles.filter(specificAngle =>
    categoryAngles.some(narrativeAngle =>
      narrativeAngle.toLowerCase().includes(specificAngle.toLowerCase()) ||
      specificAngle.toLowerCase().includes(narrativeAngle.toLowerCase())
    )
  );

  const matchScore = categoryAngles.length > 0
    ? Math.round((matchedAngles.length / Math.max(contentTags.specificAngles.length, 1)) * 100)
    : 0;

  return {
    matchedCategory: category.replace('Angles', ''),
    matchedAngles,
    matchScore,
  };
}
