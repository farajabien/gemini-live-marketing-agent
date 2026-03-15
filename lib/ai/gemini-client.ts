import { generateText as aiGenerateText } from "ai";
import { googleVertex, googleVertexFlash } from "./google-provider";
import { withRetry } from "./retry";
import { calculateCost, Usage } from "./pricing";

export interface GenerationResult {
  text: string;
  cost: number;
  usage?: Usage;
}

/**
 * Common AI generation interface using Gemini on Vertex AI.
 * Maps GPT-4o calls to gemini-1.5-pro or 1.5-flash for optimal speed and cost.
 * This satisfies hackathon requirements for Google Cloud integration.
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  model: string = "gemini-1.5-flash", // Default to 2.0 Flash
  temperature: number = 0.7,
  isJson: boolean = false
): Promise<GenerationResult> {
  
  // Map models to Vertex equivalents
  // Using 2.0 Flash by default for speed, 1.5 Pro for complex reasoning
  const providerModel = model.includes("pro") ? googleVertex : googleVertexFlash;
  const modelToUse = model.includes("pro") ? "gemini-2.5-pro" : "gemini-2.5-flash";
  
  return withRetry(async () => {
    const { text, usage } = await aiGenerateText({
      model: providerModel,
      system: systemPrompt,
      prompt: prompt,
      temperature,
    });

    let cost = 0;
    if (usage) {
      const promptTokenCount = (usage as any).promptTokens || 0;
      const completionTokenCount = (usage as any).completionTokens || 0;
      
      cost = calculateCost(modelToUse, {
        promptTokenCount,
        candidatesTokenCount: completionTokenCount,
      });
      console.log(`[Vertex AI Usage] Model: ${modelToUse} | Tokens: ${promptTokenCount} in, ${completionTokenCount} out | Est. Cost: $${cost.toFixed(6)}`);
    }

    if (!text) {
      throw new Error("Vertex AI returned an empty response.");
    }

    return { 
      text, 
      cost,
      usage: usage ? {
        promptTokenCount: (usage as any).promptTokens || 0,
        candidatesTokenCount: (usage as any).completionTokens || 0,
      } : undefined
    };
  }, {
    maxAttempts: 3,
    initialDelay: 2000,
  });
}



