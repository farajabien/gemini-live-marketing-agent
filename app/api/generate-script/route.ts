import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/gemini-client";
import { getErrorMessage } from "@/lib/types";

// Force dynamic since we use AI
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { productInfo, icp, tone = "professional", length = "60s" } = await req.json();

    if (!productInfo) {
      return NextResponse.json(
        { error: "Product information is required." },
        { status: 400 }
      );
    }

    // 1. Construct prompt
    const prompt = `
    **Goal:** Create a ready-to-record voiceover video script based on the following product details.
    
    **Input Data:**
    - **Product/Service:** ${productInfo}
    - **Target Audience (ICP):** ${icp || "General audience"}
    - **Desired Tone:** ${tone}
    - **Target Duration:** ${length} (approx. ${length === '30s' ? '60-80' : length === '60s' ? '120-150' : '180+'} words)
    
    **Script Structure:**
    1. **Hook:** Grab attention immediately (question, shocking stat, or relatable struggle).
    2. **Problem/Agitation:** Briefly empathize with the pain point.
    3. **Solution/Benefit:** Introduce the product as the fix. Focus on benefits, not just features.
    4. **Social Proof/Objection Handling:** (Optional, if fits length) Briefly mention why it works or address a common doubt.
    5. **CTA:** Clear, strong call to action.

    **Output Format:**
    - Output ONLY the script text.
    - Do not encompass the script in quotes.
    - Use blank lines to separate distinct visual scenes or thoughts.
    - Do NOT include scene numbers (e.g. "Scene 1:"), visual directions (e.g. "[Camera pans]"), or speaker labels (e.g. "Narrator:"). 
    - JUST the spoken voiceover text.
    - Make it sound natural and spoken, not like a written ad.
    `;

    // 2. Call GitHub Models via our client helper
    const generatedScript = await generateText(
      prompt,
      "You are an expert video copywriter specializing in high-conversion scripts for social media (TikTok, Reels, LinkedIn)."
    );

    if (!generatedScript) {
      throw new Error("AI returned empty response.");
    }

    // 3. Return result
    return NextResponse.json({ script: generatedScript });

  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: message || "Failed to generate script." },
      { status: 500 }
    );
  }
}
