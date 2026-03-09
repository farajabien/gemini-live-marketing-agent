import { GoogleGenAI, Modality } from "@google/genai";
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
  languageCode?: string;
}

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * Generate audio using Gemini 2.5 Flash via @google/genai SDK.
 * Uses generateContent with responseModalities: ["AUDIO"] and speechConfig.
 */
export async function generateGeminiTTS({ text, voiceName }: GeminiTTSOptions): Promise<Buffer> {
  return withRetry(async () => {
    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });

    // Extract audio data from response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini TTS response");
    }

    const audioPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("audio/"));
    if (!audioPart?.inlineData?.data) {
      throw new Error("No audio data received from Gemini TTS");
    }

    const pcmBuffer = Buffer.from(audioPart.inlineData.data, "base64");

    // Wrap raw PCM in WAV header (Gemini uses 24kHz, 1 channel, 16-bit PCM)
    return pcmToWav(pcmBuffer, 24000, 1);
  }, {
    retryOnStatusCodes: [429, 500, 502, 503, 504],
    maxAttempts: 3
  });
}
