import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import type { Scene, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";

export const maxDuration = 300; // 5 minutes for full pipeline including Veo polling

/**
 * Server-side orchestration for the full video generation pipeline.
 * Runs visuals -> (Veo polling) -> audio -> thumbnail -> video render sequentially.
 * Updates plan.status in Firestore at each stage so the client can observe progress.
 *
 * The client fires this once and can navigate away — the pipeline continues server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authUser.id;

    const { planId, force = false } = await request.json();
    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    // Fetch and validate plan
    const queryResult = await adminDb.query({
      videoPlans: { $: { where: { id: planId } } },
    });
    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const planOwnerId = (plan as any).userId;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If already completed, skip
    if (plan.status === "completed") {
      return NextResponse.json({ success: true, status: "completed", cached: true });
    }

    const scenes = (plan.scenes || []) as Scene[];
    const isCarousel = plan.type === "carousel";
    const visualMode = plan.visualMode || "image";

    console.log(`[Orchestrate] Starting pipeline for plan ${planId} (${visualMode}, ${scenes.length} scenes)`);

    // Build the base URL for internal API calls
    // Prefer the public app URL when configured, otherwise fall back to the incoming request origin.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.length > 0
        ? process.env.NEXT_PUBLIC_APP_URL
        : request.nextUrl.origin;

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    // Helper to call internal API routes
    async function callApi(path: string, body: Record<string, unknown>) {
      const url = `${baseUrl}${path}`;
      console.log(`[Orchestrate] Calling ${path}...`);
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 429) {
        console.error(`[Orchestrate] ${path} failed (${res.status}):`, data);
      }
      return { ok: res.ok, status: res.status, data };
    }

    // ========================================================================
    // STEP 1: Generate Visuals
    // ========================================================================
    await updateStatus(planId, "generating");

    const missingVisuals = visualMode === "broll"
      ? scenes.some((s) => !s.videoClipUrl && !s.operationId)
      : scenes.some((s: any) => {
          if (s.subScenes && s.subScenes.length > 0) {
            return s.subScenes.some((sub: any) => !sub.imageUrl);
          }
          return !s.imageUrl;
        });

    if (missingVisuals) {
      const visualResult = await callApi("/api/generate-visuals", { planId });
      console.log(`[Orchestrate] Visuals: ${visualResult.ok ? "OK" : "FAILED"}`);
    } else {
      console.log("[Orchestrate] Visuals already complete, skipping.");
    }

    // ========================================================================
    // STEP 2: Poll Veo Operations (B-Roll only)
    // ========================================================================
    if (visualMode === "broll") {
      console.log("[Orchestrate] Starting Veo polling loop...");
      const maxPolls = 60; // 60 * 5s = 5 minutes max
      let polls = 0;

      while (polls < maxPolls) {
        // Re-fetch plan to check current state
        const freshResult = await adminDb.query({
          videoPlans: { $: { where: { id: planId } } },
        });
        const freshPlan = freshResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;
        const freshScenes = ((freshPlan?.scenes || []) as Scene[]);

        const allClipsReady = freshScenes.every((s) => !!s.videoClipUrl);
        if (allClipsReady) {
          console.log("[Orchestrate] All B-roll clips ready.");
          break;
        }

        const hasOperations = freshScenes.some((s) => !!s.operationId);
        if (!hasOperations) {
          console.log("[Orchestrate] No pending Veo operations. Breaking poll loop.");
          break;
        }

        await callApi("/api/poll-video-clips", { planId });
        polls++;

        // Wait 5 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      if (polls >= maxPolls) {
        console.warn("[Orchestrate] Veo polling timed out after max polls.");
      }
    }

    // ========================================================================
    // STEP 3: Generate Thumbnail (fire and forget — non-blocking)
    // ========================================================================
    // Re-fetch plan after visuals
    const postVisualsResult = await adminDb.query({
      videoPlans: { $: { where: { id: planId } } },
    });
    const postVisualsPlan = postVisualsResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (postVisualsPlan?.thumbnailPrompt && !postVisualsPlan?.thumbnailUrl) {
      // Fire and forget — don't block pipeline for thumbnail
      callApi("/api/generate-thumbnail", { planId }).then((r) => {
        console.log(`[Orchestrate] Thumbnail: ${r.ok ? "OK" : "FAILED"}`);
      });
    }

    // ========================================================================
    // STEP 4: Generate Audio (non-carousel only)
    // ========================================================================
    if (!isCarousel) {
      // Check if audio files are actually present in Storage (not just referenced in Firestore)
      let audioMissing = false;
      const scenes = (postVisualsPlan?.scenes || []) as Scene[];
      for (const s of scenes) {
        if (!s.audioUrl) { audioMissing = true; break; }
        // Treat full Firebase Storage URLs as stale
        if (s.audioUrl.startsWith("https://firebasestorage.googleapis.com/")) { audioMissing = true; break; }
        // Skip data URIs — they're always valid
        if (s.audioUrl.startsWith("data:")) continue;
        // Verify the file actually exists in Storage
        const exists = await (adminDb as any).storage.fileExists(s.audioUrl);
        if (!exists) {
          console.log(`[Orchestrate] Audio file missing in Storage: ${s.audioUrl}`);
          audioMissing = true;
          break;
        }
      }

      if (audioMissing && postVisualsPlan?.visualMode !== "text_motion") {
        await updateStatus(planId, "generating_audio");

        let audioResult = await callApi("/api/generate-audio", { planId });
        console.log(`[Orchestrate] Audio: ${audioResult.ok ? "OK" : "FAILED"}`);

        if (audioResult.status === 429) {
          console.warn("[Orchestrate] Audio rate-limited. Will retry once after delay.");
          await new Promise((resolve) => setTimeout(resolve, 10000));
          audioResult = await callApi("/api/generate-audio", { planId });
          console.log(`[Orchestrate] Audio retry: ${audioResult.ok ? "OK" : "FAILED"}`);
        }

        if (!audioResult.ok) {
          console.error(`[Orchestrate] Audio generation failed (${audioResult.status}). Stopping pipeline.`);
          await updateStatus(planId, "audio_failed");
          return NextResponse.json({ success: false, status: "audio_failed", error: audioResult.data });
        }
      } else {
        console.log("[Orchestrate] Audio already complete or not needed.");
      }
    }

    // ========================================================================
    // STEP 5: Render Final Video (non-carousel only)
    // ========================================================================
    if (!isCarousel) {
      // Re-fetch to check assets
      const preRenderResult = await adminDb.query({
        videoPlans: { $: { where: { id: planId } } },
      });
      const preRenderPlan = preRenderResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;
      const preRenderScenes = ((preRenderPlan?.scenes || []) as Scene[]);

      function hasVisuals(s: any): boolean {
        if (s.subScenes && s.subScenes.length > 0) {
          return s.subScenes.every((sub: any) => !!sub.imageUrl);
        }
        return !!s.imageUrl;
      }

      const readyForRender = visualMode === "broll"
        ? preRenderScenes.every((s: any) => !!s.videoClipUrl && !!s.audioUrl)
        : visualMode === "text_motion"
          ? preRenderScenes.every((s: any) => hasVisuals(s))
          : preRenderScenes.every((s: any) => hasVisuals(s) && !!s.audioUrl);

      if (readyForRender && !preRenderPlan?.videoUrl) {
        // LOCK: Check if already rendering to prevent duplicate processes
        if (preRenderPlan?.status === "rendering" && !force) {
          console.log("[Orchestrate] Already rendering, skipping redundant dispatch.");
          return NextResponse.json({ success: true, status: "rendering_in_progress" });
        }

        await updateStatus(planId, "rendering");

        // Fire-and-forget: generate-video self-marks "completed" in Firestore.
        // We trigger it and let it run in the background.
        fetch(`${baseUrl}/api/generate-video`, {
          method: "POST",
          headers,
          body: JSON.stringify({ planId, background: true, forceRerender: force }),
        }).catch((err) => {
          console.error("[Orchestrate] generate-video background dispatch error:", err);
        });

        // Give the background request a tiny head-start to ensure the body is sent
        await new Promise((resolve) => setTimeout(resolve, 500));

        console.log("[Orchestrate] Render dispatched (background process started).");
      } else if (preRenderPlan?.videoUrl) {
        console.log("[Orchestrate] Video already rendered.");
      } else {
        console.warn("[Orchestrate] Assets not ready for render. Skipping video generation.");
      }
    }

    // ========================================================================
    // STEP 6: Mark Completed (for carousels — videos self-mark via generate-video)
    // ========================================================================
    if (isCarousel) {
      const finalResult = await adminDb.query({
        videoPlans: { $: { where: { id: planId } } },
      });
      const finalPlan = finalResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;
      const finalScenes = ((finalPlan?.scenes || []) as Scene[]);
      const allVisuals = finalScenes.every((s: any) => {
        if (s.subScenes && s.subScenes.length > 0) {
          return s.subScenes.every((sub: any) => !!sub.imageUrl);
        }
        return !!s.imageUrl;
      });

      if (allVisuals) {
        await updateStatus(planId, "completed");
        console.log("[Orchestrate] Carousel marked completed.");
      }
    }

    console.log(`[Orchestrate] Pipeline finished for plan ${planId}.`);
    return NextResponse.json({ success: true, status: "pipeline_complete" });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("[Orchestrate] Pipeline error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function updateStatus(planId: string, status: string) {
  await adminDb.transact([
    adminDb.tx.videoPlans[planId].update({ status }),
  ]);
  console.log(`[Orchestrate] Status -> ${status}`);
}
