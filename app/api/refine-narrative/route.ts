import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 30;

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
Make the answer highly specific, evocative, and strategic. Do NOT change the core idea of what they are trying to say, but rather elevate it to professional marketing copy.
Keep the refined answer relatively concise (1-3 sentences max). Return ONLY the refined text.`;

    // Use Gemini 1.5 Pro for complex reasoning and copywriting
    const { object } = await generateObject({
      model: google("models/gemini-1.5-pro-latest"),
      system: systemPrompt,
      prompt: "Please provide a refined version of the user's answer.",
      schema: z.object({
        refinedText: z.string().describe("The significantly improved, specific, and strategic version of the user's input."),
        explanation: z.string().describe("A brief 1-sentence explanation of why you made these changes and how it improves their narrative."),
      }),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error refining with AI:", error);
    return NextResponse.json(
      { error: "Failed to refine content" },
      { status: 500 }
    );
  }
}
