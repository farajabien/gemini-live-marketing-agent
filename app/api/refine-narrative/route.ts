import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { googleVertex } from "@/lib/ai/google-provider";
import { z } from "zod";

export const maxDuration = 60; // Increased to 60s for Gemini 1.5 Pro

export async function POST(req: Request) {
  try {
    const { stepId, stepTitle, stepDescription, currentValue } = await req.json();

    if (!currentValue) {
      return NextResponse.json(
        { error: "Current value is required" },
        { status: 400 }
      );
    }

    const systemPrompt = `You are an expert brand strategist and copywriter helping a founder refine their brand narrative.
The user is filling out a form step titled: "${stepTitle}".
The instructions for this step are: "${stepDescription}".

Their current answer is:
"${currentValue}"

Your job is to analyze their answer against the instructions. If their answer is vague, generic, or misses the point, YOU MUST IMPROVE IT. 
Make the answer highly specific, evocatory, and strategic. Do NOT change the core idea of what they are trying to say, but rather elevate it to professional marketing copy.
Keep the refined answer relatively concise (1-3 sentences max). Return ONLY the refined text.`;

    // Use Gemini 1.5 Pro via Vertex AI for complex reasoning and copywriting
    // This fixes the 401 Error by using Google Cloud Application Default Credentials
    console.log("Starting refinement with Vertex AI...");
    const { object } = await generateObject({
      model: googleVertex,
      system: systemPrompt,
      prompt: "Please provide a refined version of the user's answer.",
      schema: z.object({
        refinedText: z.string().describe("The significantly improved, specific, and strategic version of the user's input."),
        explanation: z.string().describe("A brief 1-sentence explanation of why you made these changes and how it improves their narrative."),
      }),
    });

    console.log("Refinement successful:", object);
    return NextResponse.json(object);
  } catch (error) {
    console.error("❌ Error refining with AI:", error);
    return NextResponse.json(
      { 
        error: "Failed to refine content", 
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : "UnknownError",
        stack: error instanceof Error ? error.stack : undefined,
        debug: {
          hasClientEmail: !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_ADMIN_PRIVATE_KEY,
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || 'gemini-live-marketing-agent'
        }
      },
      { status: 500 }
    );
  }
}

