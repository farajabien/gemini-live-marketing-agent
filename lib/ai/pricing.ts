/**
 * Pricing for Gemini models based on the latest rates.
 * Prices are per 1M tokens in USD.
 */

export interface Pricing {
  inputSub200k: number;
  inputOver200k: number;
  outputSub200k: number;
  outputOver200k: number;
}

export const PRICING_MAP: Record<string, Pricing> = {
  "gemini-3-pro": {
    inputSub200k: 2.00,
    inputOver200k: 4.00,
    outputSub200k: 12.00,
    outputOver200k: 18.00,
  },
  "gemini-3-flash": {
    inputSub200k: 0.50,
    inputOver200k: 0.50,
    outputSub200k: 3.00,
    outputOver200k: 3.00,
  },
  "gemini-2.5-pro": {
    inputSub200k: 1.25,
    inputOver200k: 2.50,
    outputSub200k: 10.00,
    outputOver200k: 15.00,
  },
  "gemini-2.5-flash": {
    inputSub200k: 0.15,
    inputOver200k: 0.15,
    outputSub200k: 0.60,
    outputOver200k: 0.60,
  },
  "gemini-2.5-flash-lite": {
    inputSub200k: 0.10,
    inputOver200k: 0.10,
    outputSub200k: 0.40,
    outputOver200k: 0.40,
  },
  // Default fallback for legacy or unspecified models
  "gemini-2.0-flash": {
    inputSub200k: 0.15,
    inputOver200k: 0.15,
    outputSub200k: 0.60,
    outputOver200k: 0.60,
  },
};

export interface Usage {
  promptTokenCount: number;
  candidatesTokenCount: number;
}

/**
 * Calculates the cost of a request based on the model and token usage.
 * Returns cost in USD.
 */
export function calculateCost(model: string, usage: Usage): number {
  // Normalize model name (remove 'models/' prefix if present)
  const normalizedModel = (model.startsWith("models/") ? model.slice(7) : model).toLowerCase();
  
  // Find the closest matching pricing
  const pricing = PRICING_MAP[normalizedModel] || 
                 Object.entries(PRICING_MAP).find(([k]) => normalizedModel.includes(k))?.[1] ||
                 PRICING_MAP["gemini-2.0-flash"];

  const inputTokens = usage.promptTokenCount;
  const outputTokens = usage.candidatesTokenCount;
  
  const isLargeContext = inputTokens > 200000;
  
  const inputRate = isLargeContext ? pricing.inputOver200k : pricing.inputSub200k;
  const outputRate = isLargeContext ? pricing.outputOver200k : pricing.outputSub200k;
  
  const inputCost = (inputTokens / 1_000_000) * inputRate;
  const outputCost = (outputTokens / 1_000_000) * outputRate;
  
  return inputCost + outputCost;
}
