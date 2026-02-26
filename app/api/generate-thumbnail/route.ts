
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Allow long-running thumbnail generation
import { init } from "@instantdb/admin";
import type { VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";

// Initialize Admin SDK
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN!;

if (!APP_ID || !ADMIN_TOKEN) {
  throw new Error("Missing InstantDB Environment Variables for Admin SDK");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token with InstantDB
    const authUser = await db.auth.verifyToken(token);
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
    const planQuery = await db.query({ 
      videoPlans: { 
        $: { where: { id: planId } },
        owner: {}
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
      planOwner: plan.owner,
      planOwnerId: plan.owner?.[0]?.id,
      ownerLength: plan.owner?.length,
      matches: plan.owner?.[0]?.id === userId
    });

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = plan.owner?.[0]?.id;
    if (planOwnerId !== userId) {
      console.error("[ERROR] Ownership check failed:", {
        expected: userId,
        actual: planOwnerId,
        ownerArray: plan.owner
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
              imageSize: "1080p",
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

        const buffer = Buffer.from(base64Image, "base64");
        const contentType = "image/png";

        console.log(`[Gemini] Thumbnail base64 length: ${base64Image.length}`);
        console.log(`[Gemini] Thumbnail buffer size: ${buffer.length}`);

        // 5. Upload to InstantDB Storage
        const fileName = `thumbnails/${planId}-${Date.now()}.png`;

        // Use Admin SDK for upload
        const adminDb = db as any;
        if (adminDb.storage && adminDb.storage.uploadFile) {
            console.log(`Uploading thumbnail to InstantDB via SDK: ${fileName}`);
            await adminDb.storage.uploadFile(fileName, buffer, { contentType: contentType });
        } else {
            throw new Error("InstantDB Admin SDK storage.uploadFile not found");
        }

      // 6. Update DB with thumbnail storage path
      await db.transact([
        db.tx.videoPlans[planId].update({ thumbnailUrl: fileName })
      ]);

      console.log("✅ Thumbnail generated and uploaded successfully");
      return NextResponse.json({ success: true, url: fileName });

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
