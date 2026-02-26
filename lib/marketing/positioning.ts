import { generateText } from "@/lib/ai/gemini-client";

export interface PositioningInput {
  audience: string;
  problem: string;
  solution: string;
  voice: string;
}

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

export async function generateBrandPositioning(input: PositioningInput): Promise<BrandPositioning> {
  const prompt = `
    You are an expert brand strategist.
    Based on the following inputs, define the core brand narrative elements.
    
    Inputs:
    - Target Audience: ${input.audience}
    - The Problem (Villain): ${input.problem}
    - The Solution (Unique Mechanism): ${input.solution}
    - Brand Voice: ${input.voice}
    
    Output JSON ONLY:
    {
      "villain": "Refine the problem into a clear 'villain' the audience is fighting.",
      "hero": "Define the customer as the hero (not the brand). Who do they become?",
      "transformation": "The journey from 'Before' to 'After' state.",
      "corePromise": "One punchy sentence describing the result.",
      "emotionalArc": "The emotional shift (e.g., Frustrated -> Empowered)."
    }
  `;

  const response = await generateText(prompt, "You are a brand strategist. Output JSON only.", "gpt-4o", 0.7);
  
  try {
     const jsonMatch = response.match(/\{[\s\S]*\}/);
     if (!jsonMatch) throw new Error("No JSON found");
     return JSON.parse(jsonMatch[0]);
  } catch (e) {
      console.error("Failed to parse positioning:", e);
      throw new Error("Failed to generate brand positioning.");
  }
}

export async function generateContentPillars(positioning: BrandPositioning, input: PositioningInput): Promise<ContentPillar[]> {
  const prompt = `
    Based on this brand positioning, generate 5 strategic content pillars.
    
    Positioning:
    - Villain: ${positioning.villain}
    - Transformation: ${positioning.transformation}
    - Core Promise: ${positioning.corePromise}
    - Audience: ${input.audience}
    
    For each pillar, provide a title, description, and 5 specific content angles/hooks.
    
    Output JSON ONLY (Array of Objects):
    [
      {
        "title": "Pillar Title (e.g. 'The Hidden Cost')",
        "description": "What this pillar teaches or reveals.",
        "angles": ["Angle 1", "Angle 2", "Angle 3", "Angle 4", "Angle 5"]
      }
    ]
  `;
  
  const response = await generateText(prompt, "You are a content strategist. Output JSON array only.", "gpt-4o", 0.7);

  try {
     const jsonMatch = response.match(/\[[\s\S]*\]/);
     if (!jsonMatch) throw new Error("No JSON found");
     return JSON.parse(jsonMatch[0]);
  } catch (e) {
      console.error("Failed to parse pillars:", e);
      throw new Error("Failed to generate content pillars.");
  }
}
