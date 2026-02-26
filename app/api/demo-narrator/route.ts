import { NextRequest, NextResponse } from "next/server";
import { generateGeminiTTS, type GeminiVoiceName } from "@/lib/ai/gemini-tts";
import { generateText } from "@/lib/ai/gemini-client";
import { pcmToWav } from "@/lib/audio-utils";
import JSZip from "jszip";

// --- Types ---
interface Segment {
  id: number;
  startSec: number;
  endSec: number;
  onScreen: string;
  roughCaption: string;
}

interface RefinedSegment {
  id: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  voiceoverText: string;
}

// --- Constants ---
const SAMPLE_RATE = 24000;
const BYTES_PER_SAMPLE = 2; // 16-bit PCM

// --- Helper Functions ---

function createSilence(durationSec: number): Buffer {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  return Buffer.alloc(numSamples * BYTES_PER_SAMPLE); // zeros = silence
}

function wavToPcm(wavBuffer: Buffer): Buffer {
  // WAV header is 44 bytes, PCM data follows
  return wavBuffer.subarray(44);
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function generateSrt(segments: RefinedSegment[]): string {
  let index = 1;
  const entries: string[] = [];

  for (const seg of segments) {
    if (!seg.voiceoverText || seg.voiceoverText.trim() === "") continue;

    entries.push(
      `${index}\n${formatSrtTime(seg.startSec)} --> ${formatSrtTime(seg.endSec)}\n${seg.voiceoverText}\n`
    );
    index++;
  }

  return entries.join("\n");
}

/**
 * The Demo Narrator API Route
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    // We don't need the full user object yet, but we verify the token exists
    const { adminDb } = await import("@/lib/instant-admin");
    const user = await adminDb.auth.verifyToken(token);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      segments, 
      productDocs, 
      voiceName = "Kore" as GeminiVoiceName,
      skipRefinement = false,
      providedScript = null // Allow passing a pre-refined script
    } = body;

    if (!segments || !Array.isArray(segments)) {
      return NextResponse.json({ error: "Segments are required" }, { status: 400 });
    }

    let refinedSegments: RefinedSegment[];

    if (providedScript && Array.isArray(providedScript)) {
      refinedSegments = providedScript;
    } else if (skipRefinement) {
      refinedSegments = segments.map(s => ({
        id: s.id,
        startSec: s.startSec,
        endSec: s.endSec,
        durationSec: s.endSec - s.startSec,
        voiceoverText: s.roughCaption
      }));
    } else {
      // 1. Refine Script with GPT-4o
      console.log("[Demo Narrator] Refining script with GPT-4o...");
      const segmentDescriptions = segments
        .map(
          (s: Segment) =>
            `Segment ${s.id} (${s.startSec}s–${s.endSec}s, ${s.endSec - s.startSec}s duration):\n  On screen: ${s.onScreen}\n  Rough caption: "${s.roughCaption}"`
        )
        .join("\n\n");

      const totalDuration = segments[segments.length - 1].endSec;
      const systemPrompt = "You are a professional voiceover script writer for product demo videos. You always output valid JSON.";
      const prompt = `I have a ${totalDuration}-second screen recording demo of a product. I need you to write the voiceover narration for each segment.

## Product Context
${productDocs || "No product documentation provided."}

## Video Segments
${segmentDescriptions}

## Instructions
- Write natural, conversational voiceover text for each segment
- The voiceover must be SPEAKABLE within the segment's duration. A rough guideline: ~2.5 words per second for natural speech pace.
- For very short segments (1-2s), use just a word or short phrase, or leave empty if silence works better
- The tone should be confident, warm, and professional — like a founder showing off their product to a friend
- Weave in product value props naturally, don't just describe what's on screen
- The overall narrative should flow smoothly from segment to segment
- Don't be salesy — be genuine and excited about the product
- Use simple, clear language

## Output Format
Return ONLY a JSON array with this structure (no markdown, no code fences):
[
  {"id": 1, "voiceoverText": "..."},
  {"id": 2, "voiceoverText": "..."},
  ...
]

If a segment should be silent, use an empty string for voiceoverText.`;

      const { text: rawText } = await generateText(prompt, systemPrompt, "gpt-4o", 0.7);
      const { sanitizeJson } = await import("@/lib/ai/json-utils");
      const jsonStr = sanitizeJson(rawText.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim());

      const refinedRaw: Array<{ id: number; voiceoverText: string }> = JSON.parse(jsonStr);

      refinedSegments = refinedRaw.map((r) => {
        const seg = segments.find((s: Segment) => s.id === r.id)!;
        return {
          id: r.id,
          startSec: seg.startSec,
          endSec: seg.endSec,
          durationSec: seg.endSec - seg.startSec,
          voiceoverText: r.voiceoverText,
        };
      });
    }

    // 2. Generate Audio per segment
    console.log("[Demo Narrator] Generating audio segments...");
    const pcmBuffers: Buffer[] = [];

    for (const seg of refinedSegments) {
      if (!seg.voiceoverText || seg.voiceoverText.trim() === "") {
        pcmBuffers.push(createSilence(seg.durationSec));
        continue;
      }

      try {
        const wavBuffer = await generateGeminiTTS({
          text: seg.voiceoverText,
          voiceName: voiceName
        });

        const pcmData = wavToPcm(wavBuffer);
        const audioDurationSec = pcmData.length / (SAMPLE_RATE * BYTES_PER_SAMPLE);

        if (audioDurationSec <= seg.durationSec) {
          const padDuration = seg.durationSec - audioDurationSec;
          pcmBuffers.push(Buffer.concat([pcmData, createSilence(padDuration)]));
        } else {
          const maxBytes = Math.floor(seg.durationSec * SAMPLE_RATE * BYTES_PER_SAMPLE);
          pcmBuffers.push(pcmData.subarray(0, maxBytes));
        }
      } catch (err) {
        console.error(`[Demo Narrator] TTS failed for segment ${seg.id}`, err);
        pcmBuffers.push(createSilence(seg.durationSec));
      }
    }

    // 3. Assemble Files
    console.log("[Demo Narrator] Assembling ZIP...");
    const fullPcm = Buffer.concat(pcmBuffers);
    const fullWav = pcmToWav(fullPcm, SAMPLE_RATE, 1);
    const srtContent = generateSrt(refinedSegments);

    const zip = new JSZip();
    zip.file("voiceover.wav", fullWav);
    zip.file("voiceover.srt", srtContent);
    zip.file("script.json", JSON.stringify(refinedSegments, null, 2));

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    // Cast to any to bypass weird environment-specific BodyInit type mismatch
    return new NextResponse(zipBuffer as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=demo-narrator-output.zip",
      },
    });

  } catch (error: any) {
    console.error("[Demo Narrator API Error]:", error);
    return NextResponse.json({ 
      error: error.message || "Failed to generate narration bundle" 
    }, { status: 500 });
  }
}
