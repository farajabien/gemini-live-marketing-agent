import { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * AI Provider Configuration
 * 
 * We fallback to standard Google AI Studio (GEMINI_API_KEY) when Vertex AI
 * is not fully configured (missing billing or API access) to ensure the 
 * application remains fully functional.
 */

// Initialize the standard Google AI provider
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// We keep the export names as "Vertex" to seamlessly plug into the rest of the codebase
// without needing a massive refactor, but they are now powered by the standard API Key
export const googleVertex = googleAI('gemini-2.5-pro');
export const googleVertexFlash = googleAI('gemini-2.5-flash');

/**
 * Helper to get the preferred model based on task complexity.
 */
export function getVertexModel(modelName: string) {
  if (modelName.includes('pro')) {
    return googleVertex;
  }
  return googleVertexFlash;
}
