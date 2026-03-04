import { generateText as aiGenerateText } from "ai";
import { googleVertexFlash } from "./google-provider";
import { pcmToWav } from "@/lib/audio-utils";
import { withRetry } from "./retry";

export type GeminiVoiceName = 
  | "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Leda" 
  | "Orus" | "Aoede" | "Callirrhoe" | "Autonoe" | "Enceladus" 
  | "Iapetus" | "Umbriel" | "Algieba" | "Despina" | "Erinome" 
  | "Algenib" | "Rasalgethi" | "Laomedeia" | "Achernar" | "Alnilam" 
  | "Schedar" | "Gacrux" | "Pulcherrima" | "Achird" | "Zubenelgenubi" 
  | "Vindemiatrix" | "Sadachbia" | "Sadaltager" | "Sulafat";

export interface GeminiTTSOptions {
  text: string;
  voiceName: GeminiVoiceName;
  languageCode?: string; // Gemini detects automatically
}

/**
 * Generate audio using Gemini 2.0 Flash on Vertex AI.
 * This satisfies hackathon criteria for Google Cloud integration.
 */
export async function generateGeminiTTS({ text, voiceName }: GeminiTTSOptions): Promise<Buffer> {
  return withRetry(async () => {
    const { experimental_output } = await aiGenerateText({
      model: googleVertexFlash,
      prompt: text,
      experimental_activeModality: "audio",
      experimental_output: {
        // @ts-expect-error - AI SDK types might not have audio output defined yet
        audio: {
          voice: voiceName,
        }
      }
    });

    const audioData = experimental_output?.audio?.data;

    if (!audioData) {
        throw new Error("No audio data received from Vertex AI TTS");
    }

    const pcmBuffer = Buffer.from(audioData, "base64");
    
    // Wrap raw PCM in WAV header (Gemini 2.0 Flash uses 24kHz, 1 channel)
    return pcmToWav(pcmBuffer, 24000, 1);
  }, {
    retryOnStatusCodes: [429, 500, 502, 503, 504],
    maxAttempts: 3
  });
}

