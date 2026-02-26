import { GoogleGenAI } from "@google/genai";
import { withRetry } from "./retry";
import { calculateCost, Usage } from "./pricing";

const apiKey = process.env.GEMINI_API_KEY;

export interface GenerationResult {
  text: string;
  cost: number;
  usage?: Usage;
}

/**
 * Common AI generation interface using Gemini.
 * Maps GPT-4o calls to gemini-2.0-flash for optimal speed and cost.
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  model: string = "gemini-2.0-flash", // Default to 2.0 Flash
  temperature: number = 0.7,
  isJson: boolean = false
): Promise<GenerationResult> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const client = new GoogleGenAI({ apiKey });
  
  // Map models if needed (e.g., if code explicitly asks for gpt-4o)
  const modelToUse = model.includes("gpt") ? "gemini-2.0-flash" : model;
  
  return withRetry(async () => {
    const response = await client.models.generateContent({
      model: modelToUse,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature,
        responseMimeType: isJson ? "application/json" : "text/plain",
      },
    });

    const text = response?.text;
    const usage = response?.usageMetadata;
    let cost = 0;

    if (usage) {
      cost = calculateCost(modelToUse, {
        promptTokenCount: usage.promptTokenCount || 0,
        candidatesTokenCount: usage.candidatesTokenCount || 0,
      });
      console.log(`[AI Usage] Model: ${modelToUse} | Tokens: ${usage.promptTokenCount} in, ${usage.candidatesTokenCount} out | Est. Cost: $${cost.toFixed(6)}`);
    }

    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return { 
      text: text as string, 
      cost,
      usage: usage ? {
        promptTokenCount: usage.promptTokenCount || 0,
        candidatesTokenCount: usage.candidatesTokenCount || 0,
      } : undefined
    };
  }, {
    maxAttempts: 3,
    initialDelay: 2000,
  });
}


