
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Allow long-running thumbnail generation
import { adminDb } from "@/lib/firebase-admin";
import type { VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";




export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token with InstantDB
    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;

    const { planId } = await req.json();

    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    console.log(`Thumbnail generation requested for plan: ${planId} (requested by ${userId})`);

    // 1. Get Plan using Admin SDK
    const planQuery = await adminDb.query({
      videoPlans: {
        $: { where: { id: planId } },
      }
    });
    const plan = planQuery.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
      console.error("Plan not found");
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // DEBUG: Log ownership information
    console.log("[DEBUG] Plan owner check:", {
      planId,
      userId,
      planUserId: (plan as any).userId,
      matches: (plan as any).userId === userId
    });

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = (plan as any).userId;
    if (planOwnerId !== userId) {
      console.error("[ERROR] Ownership check failed:", {
        expected: userId,
        actual: planOwnerId,
      });
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    // NOTE: No usage/quota check here - that's enforced at video plan creation.
    // Thumbnail generation is just completing an already-approved plan.

    // 2. Check if thumbnail already exists
    if (plan.thumbnailUrl) {
      console.log("Thumbnail already exists, returning cached URL");
      return NextResponse.json({ success: true, url: plan.thumbnailUrl, cached: true });
    }

    // 3. Check if thumbnailPrompt exists
    const thumbnailPrompt = plan.thumbnailPrompt;
    if (!thumbnailPrompt) {
      console.log("No thumbnail prompt found, skipping generation");
      return NextResponse.json({ success: false, error: "No thumbnail prompt available" }, { status: 400 });
    }

    console.log(`Generating thumbnail with prompt: "${thumbnailPrompt.substring(0, 100)}..."`);

      // 4. Generate thumbnail using Gemini Imagen
      try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

        const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        console.log("Calling Gemini for thumbnail...");
        const response = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: [{ role: "user", parts: [{ text: thumbnailPrompt }] }],
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "16:9",
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          },
        });

        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("No candidates returned from Gemini");

        let base64Image: string | null = null;
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }

        if (!base64Image) {
            console.error("Gemini Response:", JSON.stringify(response, null, 2));
            throw new Error("No image data found in Gemini response");
        }

        // 5. Upload thumbnail to Firebase Storage
        const buffer = Buffer.from(base64Image, "base64");
        const thumbnailPath = `thumbnails/${planId}-${Date.now()}.png`;
        console.log(`[Gemini] Uploading thumbnail, buffer size: ${buffer.length} bytes`);

        await adminDb.storage.uploadFile(thumbnailPath, buffer, { contentType: "image/png" });
        console.log(`✅ Thumbnail uploaded to ${thumbnailPath}`);

      // 6. Update DB with thumbnail storage path
      await adminDb.transact([
        adminDb.tx.videoPlans[planId].update({ thumbnailUrl: thumbnailPath })
      ]);

      console.log("✅ Thumbnail generated and saved successfully");
      return NextResponse.json({ success: true, url: thumbnailPath });

    } catch (genError: unknown) {
      const message = getErrorMessage(genError);
      console.error("Thumbnail generation failed:", genError);
      return NextResponse.json({
        success: false,
        error: "Thumbnail generation failed",
        details: message
      }, { status: 500 });
    }

  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Thumbnail API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
