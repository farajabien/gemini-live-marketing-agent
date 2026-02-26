import { NextResponse } from "next/server";
import type { Voice } from "@/lib/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cache voices for 5 minutes to reduce processing
let cachedVoices: Voice[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Return cached voices if still valid
    const now = Date.now();
    if (cachedVoices && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({ voices: cachedVoices, cached: true });
    }

    const voices: Voice[] = [];

    // Add Gemini Voices
    if (GEMINI_API_KEY) {
        const geminiVoices: Voice[] = [
            { voice_id: "Zephyr", name: "Zephyr", category: "premade", description: "Bright", preview_url: "" },
            { voice_id: "Puck", name: "Puck", category: "premade", description: "Upbeat", preview_url: "" },
            { voice_id: "Charon", name: "Charon", category: "premade", description: "Informative", preview_url: "" },
            { voice_id: "Kore", name: "Kore", category: "premade", description: "Firm", preview_url: "" },
            { voice_id: "Fenrir", name: "Fenrir", category: "premade", description: "Excitable", preview_url: "" },
            { voice_id: "Leda", name: "Leda", category: "premade", description: "Youthful", preview_url: "" },
            { voice_id: "Orus", name: "Orus", category: "premade", description: "Firm", preview_url: "" },
            { voice_id: "Aoede", name: "Aoede", category: "premade", description: "Breezy", preview_url: "" },
            { voice_id: "Callirrhoe", name: "Callirrhoe", category: "premade", description: "Easy-going", preview_url: "" },
            { voice_id: "Autonoe", name: "Autonoe", category: "premade", description: "Bright", preview_url: "" },
            { voice_id: "Enceladus", name: "Enceladus", category: "premade", description: "Breathy", preview_url: "" },
            { voice_id: "Iapetus", name: "Iapetus", category: "premade", description: "Clear", preview_url: "" },
            { voice_id: "Umbriel", name: "Umbriel", category: "premade", description: "Easy-going", preview_url: "" },
            { voice_id: "Algieba", name: "Algieba", category: "premade", description: "Smooth", preview_url: "" },
            { voice_id: "Despina", name: "Despina", category: "premade", description: "Smooth", preview_url: "" },
            { voice_id: "Erinome", name: "Erinome", category: "premade", description: "Clear", preview_url: "" },
            { voice_id: "Algenib", name: "Algenib", category: "premade", description: "Gravelly", preview_url: "" },
            { voice_id: "Rasalgethi", name: "Rasalgethi", category: "premade", description: "Informative", preview_url: "" },
            { voice_id: "Laomedeia", name: "Laomedeia", category: "premade", description: "Upbeat", preview_url: "" },
            { voice_id: "Achernar", name: "Achernar", category: "premade", description: "Soft", preview_url: "" },
            { voice_id: "Alnilam", name: "Alnilam", category: "premade", description: "Firm", preview_url: "" },
            { voice_id: "Schedar", name: "Schedar", category: "premade", description: "Even", preview_url: "" },
            { voice_id: "Gacrux", name: "Gacrux", category: "premade", description: "Mature", preview_url: "" },
            { voice_id: "Pulcherrima", name: "Pulcherrima", category: "premade", description: "Forward", preview_url: "" },
            { voice_id: "Achird", name: "Achird", category: "premade", description: "Friendly", preview_url: "" },
            { voice_id: "Zubenelgenubi", name: "Zubenelgenubi", category: "premade", description: "Casual", preview_url: "" },
            { voice_id: "Vindemiatrix", name: "Vindemiatrix", category: "premade", description: "Gentle", preview_url: "" },
            { voice_id: "Sadachbia", name: "Sadachbia", category: "premade", description: "Lively", preview_url: "" },
            { voice_id: "Sadaltager", name: "Sadaltager", category: "premade", description: "Knowledgeable", preview_url: "" },
            { voice_id: "Sulafat", name: "Sulafat", category: "premade", description: "Warm", preview_url: "" },
        ];
        voices.push(...geminiVoices);
    }

    if (voices.length === 0) {
        // Fallback to default voices on error
        console.warn("No voices configured, returning default voices");
        return NextResponse.json({
            voices: getDefaultVoices(),
            source: "fallback",
        });
    }

    // Update cache
    cachedVoices = voices;
    cacheTimestamp = now;

    return NextResponse.json({ voices, source: "api" });
  } catch (error: unknown) {
    console.error("Error fetching voices:", error);

    // Fallback to default voices on error
    return NextResponse.json({
      voices: getDefaultVoices(),
      source: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function getDefaultVoices() {
  return [
    {
      voice_id: "Puck",
      name: "Puck (Gemini)",
      category: "premade",
      description: "Upbeat",
    },
    {
      voice_id: "Kore",
      name: "Kore (Gemini)",
      category: "premade",
      description: "Firm",
    },
    {
      voice_id: "Zephyr",
      name: "Zephyr (Gemini)",
      category: "premade",
      description: "Bright",
    }
  ];
}
