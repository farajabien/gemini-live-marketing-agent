import { generateText } from "@/lib/ai/gemini-client";
import type { VideoPlan } from "@/lib/types";

export interface SocialCaptionsResult {
  suggestedCaptions: {
    linkedin: string;
    tiktok: string;
    twitter: string;
  };
  hashtags: string[];
}

export async function generateSocialMetadata(plan: VideoPlan): Promise<SocialCaptionsResult> {
  const prompt = `
    You are an expert social media strategist and copywriter.
    Based on the following content plan, generate optimized captions for LinkedIn, TikTok/Instagram Reels, and X (Twitter).
    
    CONTENT TYPE: ${plan.type}
    TITLE: ${plan.title}
    SCENES: ${JSON.stringify(plan.scenes.map(s => s.voiceover))}
    
    REQUIREMENTS:
    1. LinkedIn: Professional yet engaging, narrative-driven, includes spacing for readability. Focus on authority and expertise.
    2. TikTok / Reels: High-energy, punchy, use emojis. Focus on relatability and "watch till the end" hooks.
    3. X (Twitter): Short, provocative, or insight-dense.
    4. Hashtags: Provide a list of 5-10 highly relevant hashtags (without the # symbol).
    
    OUTPUT JSON ONLY:
    {
      "suggestedCaptions": {
        "linkedin": "...",
        "tiktok": "...",
        "twitter": "..."
      },
      "hashtags": ["tag1", "tag2", ...]
    }
  `;

  const response = await generateText(prompt, "You are a social media copywriter. Output valid JSON only.", "gpt-4o", 0.7);
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Failed to parse social metadata:", e);
  }

  // Fallback
  return {
    suggestedCaptions: {
      linkedin: `Check out our latest ${plan.type}: ${plan.title}`,
      tiktok: `New ${plan.type} alert! 🔥 ${plan.title}`,
      twitter: `Just dropped a new ${plan.type} on ${plan.title}`
    },
    hashtags: ["content", "ai", "marketing"]
  };
}
