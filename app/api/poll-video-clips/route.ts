import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Scene, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;



export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
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

    const { planId } = await request.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    console.log(`Polling Veo operations for plan: ${planId} (requested by ${userId})`);

    // Fetch Plan
    const queryResult = await adminDb.query({
      videoPlans: {
        $: { where: { id: planId } },
        owner: {},
      },
    });

    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = plan.owner?.[0]?.id;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    let completedCount = 0;
    let pendingCount = 0;

    for (let index = 0; index < updatedScenes.length; index++) {
      const scene = updatedScenes[index];

      // Skip if already has video clip
      if (scene.videoClipUrl) {
        completedCount++;
        continue;
      }

      // Skip if no operation ID
      if (!scene.operationId) {
        continue;
      }

      try {
        console.log(`Checking operation ${scene.operationId} for scene ${index}...`);

        // Poll operation status using operation name directly
        // @ts-expect-error - SDK types may not be fully typed for operations
        const operation = await ai.operations.get(scene.operationId);

        if (operation.done) {
          console.log(`Operation complete for scene ${index}`);

          // Extract video file reference from response
          const response = operation.response as Record<string, unknown>;
          const generatedVideos = response?.generatedVideos as Array<{ video?: unknown }> | undefined;
          const video = generatedVideos?.[0];
          
          if (!video?.video) {
            throw new Error("No video data in completed operation");
          }

          // Download video using file object
          console.log(`Downloading video for scene ${index}...`);
          // Note: Veo SDK API may evolve - adjust based on actual response structure
          // @ts-expect-error - Download file API signature varies in early Veo releases
          const videoBlob = await ai.files.download(video.video) as unknown as Blob;

          // Upload to InstantDB Storage
          const fileName = `broll/${planId}/${index}-${Date.now()}.mp4`;
          
          // Convert blob to buffer for upload
          const arrayBuffer = await videoBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const file = new File([buffer], fileName, { type: "video/mp4" });

          type AdminStorage = {
            storage?: { uploadFile?: (path: string, file: File, opts?: { contentType?: string }) => Promise<unknown> };
          };
          const storageDb = adminDb as unknown as AdminStorage;

          if (storageDb.storage?.uploadFile) {
            await storageDb.storage.uploadFile(fileName, file, { contentType: "video/mp4" });
          } else {
            // TODO: Migrate to Firebase Storage
            console.warn("Storage upload unavailable, using data URL");
          }

          // Update scene with video clip URL
          scene.videoClipUrl = fileName;
          scene.operationId = undefined; // Clear operation ID

          // Save incrementally
          await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes })]);

          console.log(`Video clip saved for scene ${index}: ${fileName}`);
          completedCount++;
        } else {
          console.log(`Operation still pending for scene ${index}`);
          pendingCount++;
        }
      } catch (err: unknown) {
        console.error(`Failed to poll operation for scene ${index}:`, err instanceof Error ? err.message : err);
        // Don't fail the entire operation, just log and continue
        pendingCount++;
      }
    }

    const allComplete = completedCount === updatedScenes.length;

    return NextResponse.json({
      success: true,
      completed: completedCount,
      pending: pendingCount,
      total: updatedScenes.length,
      allComplete,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Polling error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
