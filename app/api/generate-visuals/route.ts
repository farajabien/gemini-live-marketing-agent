import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Scene, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { wrapWithStyleConstraint } from "@/lib/constants";
import { withRetry } from "@/lib/ai/retry";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token with Firebase Auth
    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;

    console.log(`Generating visuals for plan: ${planId} (requested by ${userId})`);

    // Fetch Plan using Admin SDK
    const queryResult = await adminDb.query({
      videoPlans: {
        $: { where: { id: planId } },
      },
    });

    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
      console.error("Plan not found via Admin SDK");
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
    // Visual generation is just completing an already-approved plan.

    const visualMode = plan.visualMode || "image";
    const isCarousel = plan.type === "carousel";

    // Force image mode for carousels (magazine also uses image generation)
    if (isCarousel || visualMode === "image" || visualMode === "magazine") {
      return await generateImages(plan, planId);
    } else if (visualMode === "broll") {
      // B-Roll is Pro Max only
      // HACKATHON: Bypassing check for demo purposes
      // if (owner?.planId !== "pro_max") {
      //   return NextResponse.json({ error: "B-Roll generation requires Pro Max plan" }, { status: 403 });
      // }
      return await generateBRollClips(plan, planId);
    } else if (visualMode === "text_motion" || visualMode === "gif_voice") {
      // NEW: Giphy integration (used for both Text Motion and GIF + Voice modes)
      return await generateGiphyVisuals(plan, planId);
    }

    return NextResponse.json({ error: "Invalid visual mode" }, { status: 400 });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Visual generation error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Generate (Fetch) Giphy visuals for Text Motion mode
 */
async function generateGiphyVisuals(plan: VideoPlanWithOwner, planId: string) {
  const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];
  const { searchGiphy } = await import("@/lib/giphy");

  const scenesToGenerate: number[] = [];
  updatedScenes.forEach((scene, index) => {
    // Treat imageUrl as the holder for Giphy URL in this mode
    if (!scene.imageUrl) {
      scenesToGenerate.push(index);
    }
  });

  if (scenesToGenerate.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: "No visuals needed" });
  }

  console.log(`Fetching Giphys for scenes: ${scenesToGenerate.join(", ")}`);

  for (const index of scenesToGenerate) {
    const scene = updatedScenes[index];
    try {
      console.log(`Searching Giphy for scene ${index}: "${scene.visualPrompt}"`);
      
      // Add keywords to improve "background" quality
      const query = `${scene.visualPrompt} aesthetic background loop`;
      const results = await searchGiphy(query, 1);
      
      if (results && results.length > 0) {
          // Store the Giphy MP4 URL in imageUrl
          // We use imageUrl field because Remotion can just treat it as a video source if we handle it right
          scene.imageUrl = results[0].url;

          // IMPORTANT: Clear videoUrl to invalidate cache (scenes changed)
          await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes, videoUrl: null })]);
          console.log(`✅ Giphy found for scene ${index}: ${results[0].id}`);
      } else {
          console.warn(`⚠️ No Giphy found for: "${scene.visualPrompt}"`);
          // Fallback? Leave null for now or use a placeholder
      }
    } catch (err) {
      console.error(`Failed to fetch Giphy for scene ${index}:`, err);
    }
  }

  return NextResponse.json({ success: true, count: scenesToGenerate.length });
}

/**
 * Generate static images using Gemini
 * Now supports sub-scenes for multi-visual sequences
 */
async function generateImages(plan: VideoPlanWithOwner, planId: string) {
  const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];

  // Collect all visuals that need generation (parent scenes + sub-scenes)
  interface VisualToGenerate {
    sceneIndex: number;
    subSceneIndex?: number;
    visualPrompt: string;
    isSubScene: boolean;
  }

  const visualsToGenerate: VisualToGenerate[] = [];

  updatedScenes.forEach((s: any, sceneIndex: number) => {
    // @ts-ignore - subScenes exists in lib/types.ts but compiler is persistent
    if (s.subScenes && s.subScenes.length > 0) {
      // Generate images for each sub-scene
      s.subScenes.forEach((subScene: any, subIndex: number) => {
        if (!subScene.imageUrl) {
          visualsToGenerate.push({
            sceneIndex,
            subSceneIndex: subIndex,
            visualPrompt: subScene.visualPrompt,
            isSubScene: true,
          });
        }
      });
    } else {
      // No sub-scenes, check parent scene
      if (!s.imageUrl) {
        visualsToGenerate.push({
          sceneIndex,
          visualPrompt: s.visualPrompt,
          isSubScene: false,
        });
      }
    }
  });

  if (visualsToGenerate.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: "No images needed" });
  }

  console.log(`Generating ${visualsToGenerate.length} images (${visualsToGenerate.filter(v => v.isSubScene).length} sub-scenes)`);
  console.time(`[Gemini] Total image generation time`);

  const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Helper function to generate a single visual (scene or sub-scene)
  const generateSingleVisual = async (visual: VisualToGenerate, visualIndex: number) => {
    const logPrefix = visual.isSubScene
      ? `scene ${visual.sceneIndex} sub-scene ${visual.subSceneIndex}`
      : `scene ${visual.sceneIndex}`;

    console.log(`Generating Gemini image for ${logPrefix}...`);
    const aspectRatio = plan.type === "carousel" ? "1:1" : "9:16";

    let response;
    const modelToUse = "gemini-3-pro-image-preview";
    const visualPrompt = plan.visualConsistency
      ? wrapWithStyleConstraint(
          `Visual Style Guide: ${plan.visualConsistency}\\n\\nScene Prompt: ${visual.visualPrompt}`
        )
      : wrapWithStyleConstraint(visual.visualPrompt);

    response = await withRetry(() => ai.models.generateContent({
      model: modelToUse,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: visualPrompt,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: "2K",
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    }));

    if (!response) throw new Error(`Failed to get response from Gemini (${logPrefix})`);

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error(`No candidates returned for ${logPrefix}`);

    let base64Image: string | null = null;
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }

    if (!base64Image) {
      throw new Error(`No image data found in response for ${logPrefix}`);
    }

    // Upload to Firebase Storage
    const fileName = visual.isSubScene
      ? `generated/${planId}/${visual.sceneIndex}-sub-${visual.subSceneIndex}-${Date.now()}.png`
      : `generated/${planId}/${visual.sceneIndex}-${Date.now()}.png`;
    const buffer = Buffer.from(base64Image, "base64");

    console.log(`[Gemini] Uploading ${logPrefix}, buffer size: ${buffer.length} bytes`);

    await adminDb.storage.uploadFile(fileName, buffer, { contentType: "image/png" });
    console.log(`✅ Uploaded ${logPrefix} successfully`);

    return { visual, fileName };
  };

  // Process visuals in batches to stay under Gemini's 20 RPM quota
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 2000;
  type BatchResult = { status: 'fulfilled'; value: { visual: VisualToGenerate; fileName: string } } | { status: 'rejected'; reason: any; visual: VisualToGenerate };
  const allResults: BatchResult[] = [];

  for (let i = 0; i < visualsToGenerate.length; i += BATCH_SIZE) {
    const batch = visualsToGenerate.slice(i, i + BATCH_SIZE);
    console.log(`[Gemini] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(visualsToGenerate.length / BATCH_SIZE)} (${batch.length} images)`);

    const batchResults = await Promise.all(
      batch.map((visual, idx) =>
        generateSingleVisual(visual, i + idx)
          .then(result => ({ status: 'fulfilled' as const, value: result }))
          .catch(error => ({ status: 'rejected' as const, reason: error, visual }))
      )
    );
    allResults.push(...batchResults);

    // Wait between batches to avoid rate limiting
    if (i + BATCH_SIZE < visualsToGenerate.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Update scenes with successful results (both parent scenes and sub-scenes)
  let successCount = 0;
  for (const result of allResults) {
    if (result.status === 'fulfilled') {
      const { visual, fileName } = result.value;

      if (visual.isSubScene && visual.subSceneIndex !== undefined) {
        // Update sub-scene
        const scene = updatedScenes[visual.sceneIndex];
        const anyScene = scene as any;
        if (anyScene.subScenes && anyScene.subScenes[visual.subSceneIndex]) {
          anyScene.subScenes[visual.subSceneIndex].imageUrl = fileName;
          console.log(`✅ Set image for scene ${visual.sceneIndex} sub-scene ${visual.subSceneIndex}`);
        }
      } else {
        // Update parent scene
        updatedScenes[visual.sceneIndex].imageUrl = fileName;
        console.log(`✅ Set image for scene ${visual.sceneIndex}`);
      }

      successCount++;
    } else {
      const visualInfo = result.visual.isSubScene
        ? `scene ${result.visual.sceneIndex} sub-scene ${result.visual.subSceneIndex}`
        : `scene ${result.visual.sceneIndex}`;
      console.error(`Failed to generate image for ${visualInfo}:`, result.reason);
    }
  }

  // Save all updates in a single transaction
  if (successCount > 0) {
    // IMPORTANT: Clear videoUrl to invalidate cache (scenes changed)
    await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes, videoUrl: null })]);
    console.log(`✅ Saved ${successCount}/${visualsToGenerate.length} images to database (video cache invalidated)`);
  }

  console.timeEnd(`[Gemini] Total image generation time`);

  return NextResponse.json({
    success: true,
    count: successCount,
    failed: visualsToGenerate.length - successCount,
    message: `Generated ${successCount}/${visualsToGenerate.length} images (including sub-scenes)`
  });
}

/**
 * Generate B-Roll video clips using Google Veo
 */
async function generateBRollClips(plan: VideoPlanWithOwner, planId: string) {
  const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];

  const scenesToGenerate: number[] = [];
  updatedScenes.forEach((scene, index) => {
    if (!scene.videoClipUrl && !scene.operationId) {
      scenesToGenerate.push(index);
    }
  });

  if (scenesToGenerate.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: "No b-roll clips needed" });
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  for (const index of scenesToGenerate) {
    const scene = updatedScenes[index];
    try {
      const durationSeconds = Math.min(8, Math.max(4, Math.round(scene.duration || 6)));

      const operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt: plan.visualConsistency
          ? `Visual Style: ${plan.visualConsistency}\n\nScene: ${scene.visualPrompt}`
          : scene.visualPrompt,
        config: {
          aspectRatio: "9:16",
          resolution: "1080p",
          durationSeconds: durationSeconds,
          numberOfVideos: 1,
        },
      });

      scene.operationId = operation.name;
      // IMPORTANT: Clear videoUrl to invalidate cache (scenes changed)
      await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes, videoUrl: null })]);

      console.log(`Veo operation started for scene ${index}: ${operation.name}`);
    } catch (err: unknown) {
      console.error(`Failed to start Veo operation for scene ${index}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    count: scenesToGenerate.length,
    message: "B-roll generation started.",
  });
}
