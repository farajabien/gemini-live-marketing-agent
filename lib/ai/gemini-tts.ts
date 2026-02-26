import { GoogleGenAI } from "@google/genai";
import { pcmToWav } from "@/lib/audio-utils";
import { withRetry } from "./retry";

const apiKey = process.env.GEMINI_API_KEY!;
const client = new GoogleGenAI({ apiKey });

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
  languageCode?: string; // Gemini detects automatically, but keeping interface consistent
}

export async function generateGeminiTTS({ text, voiceName }: GeminiTTSOptions): Promise<Buffer> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  return withRetry(async () => {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) {
        throw new Error("No audio data received from Gemini TTS");
    }

    const pcmBuffer = Buffer.from(data, "base64");
    // Wrap raw PCM in WAV header (assuming 24kHz, 1 channel)
    return pcmToWav(pcmBuffer, 24000, 1);
  }, {
    retryOnStatusCodes: [429, 500, 502, 503, 504],
    maxAttempts: 3
  });
}
