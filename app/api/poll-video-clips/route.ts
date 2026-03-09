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
      },
    });

    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = (plan as any).userId;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    const updatedScenes: Scene[] = [...((plan.scenes || []) as Scene[])];
    const { GoogleGenAI, GenerateVideosOperation } = await import("@google/genai");
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

        // Reconstruct operation object from stored name
        const operationRef = new GenerateVideosOperation();
        operationRef.name = scene.operationId;

        const operation = await ai.operations.getVideosOperation({
          operation: operationRef,
        });

        if (operation.done) {
          // Check for errors
          if (operation.error) {
            console.error(`Operation failed for scene ${index}:`, operation.error);
            scene.operationId = null;
            await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes })]);
            continue;
          }

          console.log(`Operation complete for scene ${index}`);

          // Extract video URI from response
          const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;

          if (!videoUri) {
            console.error(`No video URI in completed operation for scene ${index}`);
            scene.operationId = null;
            await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes })]);
            continue;
          }

          // Store the video URI directly (it's a GCS URI accessible via the API)
          scene.videoClipUrl = videoUri;
          scene.operationId = null;

          // Save incrementally
          await adminDb.transact([adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes })]);

          console.log(`Video clip saved for scene ${index}: ${videoUri}`);
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
