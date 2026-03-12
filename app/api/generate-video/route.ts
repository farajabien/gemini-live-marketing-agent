import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { existsSync } from "fs";
import { unlink, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { canUserGenerate } from "@/lib/pricing";
import { startOfMonth } from "date-fns";
import type { Scene, User, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { renderRemotionVideo } from "@/lib/remotion-renderer";
import { renderVideoWithFFmpeg, estimateRenderTime } from "@/lib/ffmpeg/renderer";
import { getRenderPreset, type RenderPresetName } from "@/lib/render-presets";




// Feature flag: Use FFmpeg renderer (default: true)
// Set to false to use Remotion (legacy)
const USE_FFMPEG_RENDERER = process.env.USE_FFMPEG_RENDERER !== "false";

const rendersInProgress = new Set<string>();

export async function POST(request: NextRequest) {
  let lockedPlanId: string | null = null;
  try {
    const { planId, background = false, forceRerender = false, useFFmpeg, renderPreset } = await request.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    if (rendersInProgress.has(planId)) {
      console.log(`[VideoGen] Render already in progress for plan: ${planId}, returning 409`);
      return NextResponse.json(
        { error: "Render already in progress", inProgress: true },
        { status: 409 }
      );
    }
    rendersInProgress.add(planId);
    lockedPlanId = planId;

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

    console.log(`[VideoGen Remotion] Generating video for plan: ${planId} (Background: ${background}, Force: ${forceRerender}) (requested by ${userId})`);
    console.time('[VideoGen] Total render pipeline');

    const queryResult = await adminDb.query({
      videoPlans: {
        $: { where: { id: planId } },
      },
    });
    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = (plan as any).userId;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    // --- Cache Check (Early Exit for Performance) ---
    // If video already exists and we're not forcing a rerender, return immediately
    if (plan.videoUrl && !forceRerender) {
      console.log(`[Cache Hit] ✅ Video already rendered: ${plan.videoUrl}`);

      if (background) {
        return NextResponse.json({ success: true, url: plan.videoUrl, cached: true });
      }

      // For non-background requests, we'd need to fetch and stream the video
      // For now, just return the URL (frontend can fetch it)
      return NextResponse.json({ success: true, url: plan.videoUrl, cached: true });
    }

    if (forceRerender && plan.videoUrl) {
      console.log(`[Cache Bypass] 🔄 Force rerender requested for plan: ${planId}`);
    }

    // --- Usage Check with Monthly Reset ---
    const owner: User | undefined = plan.owner?.[0];
    if (owner) {
        const currentMonthStartUTC = startOfMonth(new Date()).getTime();
        const needsReset = (owner.generationResetDate ?? 0) < currentMonthStartUTC;
        
        if (needsReset) {
            await adminDb.transact([
                adminDb.tx.$users[owner.id].update({
                    monthlyGenerations: 0,
                    generationResetDate: currentMonthStartUTC,
                }),
            ]);
            owner.monthlyGenerations = 0;
            owner.generationResetDate = currentMonthStartUTC;
        }
        
        const usageCount = owner.monthlyGenerations ?? 0;
        if (!canUserGenerate(owner.planId, usageCount)) {
            return NextResponse.json({ 
                error: "Limit Reached", 
                limitReached: true 
            }, { status: 403 });
        }
    }

    // Cache check moved earlier (line 66) for better performance

    const scenes = plan.scenes as Scene[];
    const visualMode = plan.visualMode || "image";
    
    // Log scene durations for debugging
    console.log(`[VideoGen] Plan has ${scenes.length} scenes with durations:`);
    scenes.forEach((scene, i) => {
      const hasVisual = (scene as any).subScenes?.length > 0
        ? (scene as any).subScenes.every((sub: any) => !!sub.imageUrl)
        : !!(scene.imageUrl || scene.videoClipUrl);
      console.log(`  Scene ${i}: ${scene.duration}s - Audio: ${scene.audioUrl ? 'YES' : 'NO'} - Visual: ${hasVisual ? 'YES' : 'NO'}${(scene as any).subScenes?.length ? ` (${(scene as any).subScenes.length} sub-scenes)` : ''}`);
    });
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    console.log(`[VideoGen] Total video duration should be: ${totalDuration.toFixed(2)}s`);

    // Check asset readiness (basic check)
    if (visualMode === "broll") {
      if (scenes.some((s) => !s.videoClipUrl || !s.audioUrl)) {
        return NextResponse.json({ error: "B-roll clips or audio not ready" }, { status: 400 });
      }
    } else if (visualMode === "text_motion") {
      // Text Motion is silent first, so we only check for imageUrl (which holds the Giphy URL)
      if (scenes.some((s: any) => {
        if (s.subScenes && s.subScenes.length > 0) {
          return s.subScenes.some((sub: any) => !sub.imageUrl);
        }
        return !s.imageUrl;
      })) {
        return NextResponse.json({ error: "Visuals not ready" }, { status: 400 });
      }
    } else {
      if (scenes.some((s: any) => {
        const hasVisuals = s.subScenes && s.subScenes.length > 0
          ? s.subScenes.every((sub: any) => !!sub.imageUrl)
          : !!s.imageUrl;
        return !hasVisuals || !s.audioUrl;
      })) {
        return NextResponse.json({ error: "Images or audio not ready" }, { status: 400 });
      }
    }

    // Remotion's <Img>, <Video>, and <Audio> components automatically handle asset loading
    // and ensure assets are fully loaded before rendering, so no pre-verification needed.
    // This saves 8+ seconds and eliminates 425 retry loops.
    console.log("[VideoGen] Trusting Remotion's built-in asset loading (no pre-verification needed)");

    // Set status to rendering
    await adminDb.transact([adminDb.tx.videoPlans[planId].update({ status: 'rendering', renderProgress: 0 })]);

    // Throttled progress callback — writes to Firestore at most every 3s
    let lastProgressUpdate = 0;
    const updateRenderProgress = async (percent: number) => {
      const now = Date.now();
      if (now - lastProgressUpdate < 3000 && percent < 100) return;
      lastProgressUpdate = now;
      try {
        await adminDb.transact([
          adminDb.tx.videoPlans[planId].update({ renderProgress: percent })
        ]);
      } catch (_) {
        // Don't let progress updates break the render
      }
    };

    const videoPath = join(tmpdir(), `render-${planId}.mp4`);

    // Choose renderer: FFmpeg (new, fast) or Remotion (legacy)
    // FFmpeg doesn't support sub-scenes — force Remotion when sub-scenes are present
    const hasSubScenes = scenes.some((s: any) => s.subScenes && s.subScenes.length > 0);
    const shouldUseFFmpeg = hasSubScenes
      ? false
      : (useFFmpeg !== undefined ? useFFmpeg : USE_FFMPEG_RENDERER);

    if (hasSubScenes) {
      console.log('[VideoGen] Plan has sub-scenes — forcing Remotion renderer (FFmpeg does not support sub-scenes)');
    }


    const effectivePreset = renderPreset
      || (process.env.NODE_ENV === 'development' ? 'fast_preview' : undefined);
    const preset = getRenderPreset(effectivePreset as RenderPresetName | undefined);
    console.log(`[VideoGen] Render preset: ${preset.name} (${preset.width}x${preset.height} @ ${preset.fps}fps)`);

    if (shouldUseFFmpeg) {
      console.log('[VideoGen] Using FFmpeg renderer (with scene caching)');
      console.time('[VideoGen] FFmpeg render');
      try {
        const ffmpegResolution = preset.height >= 1920 ? "1080p" : preset.height >= 1280 ? "720p" : "540p";
        const estimate = await estimateRenderTime(plan, plan.type === "carousel" ? "1:1" : "9:16");
        console.log(`[VideoGen] Estimated render time: ${estimate.estimatedSeconds}s (${estimate.cachedScenes} cached, ${estimate.newScenes} new)`);
        await renderVideoWithFFmpeg(plan, videoPath, {
          format: plan.type === "carousel" ? "1:1" : "9:16",
          resolution: ffmpegResolution as any,
          fps: preset.fps,
          videoBitrate: preset.videoBitrate,
          audioBitrate: preset.audioBitrate,
          useGPU: true,
          enableCache: true,
          forceRerender: forceRerender,
          cleanupOldCache: true,
        }, (progress) => {
          const percent = progress.totalScenes > 0
            ? Math.round((progress.completedScenes / progress.totalScenes) * 100)
            : 0;
          updateRenderProgress(percent);
        });
        console.timeEnd('[VideoGen] FFmpeg render');
      } catch (renderErr) {
        console.timeEnd('[VideoGen] FFmpeg render');
        console.error("FFmpeg rendering failed:", renderErr);
        throw new Error(`Rendering failed: ${getErrorMessage(renderErr)}`);
      }
    } else {
      // --- Pre-download all Remotion assets to a dedicated temp dir ---
      const { randomBytes } = await import("crypto");
      const renderTempDir = join(tmpdir(), `remotion-${planId}-${randomBytes(4).toString("hex")}`);
      await mkdir(renderTempDir, { recursive: true });

      const fetchAndSave = async (url: string, ext: string): Promise<string> => {
        const { writeFile } = await import("fs/promises");
        const tempPath = join(renderTempDir, `remotion-asset-${randomBytes(6).toString("hex")}.${ext}`);
        let downloadUrl = url;
        if (!url.startsWith("http") && !url.startsWith("data:")) {
          // Use Firebase Storage admin to get signed URL if needed
          if (adminDb.storage?.getDownloadUrl) {
            downloadUrl = await adminDb.storage.getDownloadUrl(url);
          } else {
            throw new Error("No storage.getDownloadUrl available for: " + url);
          }
        }
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`Failed to fetch asset: ${url}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(tempPath, buf);
        return tempPath;
      };

      // Deep clone plan to avoid mutating DB object
      const localPlan = JSON.parse(JSON.stringify(plan));
      const scenes = localPlan.scenes as Scene[];
      for (const scene of scenes) {
        if (scene.imageUrl) {
          scene.imageUrl = await fetchAndSave(scene.imageUrl, "png");
        }
        if (scene.audioUrl) {
          scene.audioUrl = await fetchAndSave(scene.audioUrl, "mp3");
        }
        if (scene.videoClipUrl) {
          scene.videoClipUrl = await fetchAndSave(scene.videoClipUrl, "mp4");
        }
        if (scene.subScenes && Array.isArray(scene.subScenes)) {
          for (const sub of scene.subScenes) {
            if (sub.imageUrl) {
              sub.imageUrl = await fetchAndSave(sub.imageUrl, "png");
            }
            if (sub.videoClipUrl) {
              sub.videoClipUrl = await fetchAndSave(sub.videoClipUrl, "mp4");
            }
          }
        }
      }

      console.log('[VideoGen] All Remotion assets pre-downloaded to local temp files.');

      const { createAssetServer } = await import("@/lib/asset-server");
      const assetServer = await createAssetServer(renderTempDir);
      localPlan.assetServerBaseUrl = assetServer.url;
      console.log(`[VideoGen] Asset server running at ${assetServer.url}`);

      // LEGACY: Remotion renderer (now with local assets via dedicated server)
      console.log('[VideoGen] Using Remotion renderer (legacy, optimized)');
      console.time('[VideoGen] Remotion render');
      try {
        await renderRemotionVideo(localPlan, videoPath, {
          preset: preset.name,
          onProgressCallback: updateRenderProgress,
        });
        console.timeEnd('[VideoGen] Remotion render');
      } catch (renderErr) {
        console.timeEnd('[VideoGen] Remotion render');
        console.error("Remotion rendering failed:", renderErr);
        throw new Error(`Rendering failed: ${getErrorMessage(renderErr)}`);
      } finally {
        assetServer.close();
        try { await rm(renderTempDir, { recursive: true, force: true }); } catch {}
      }
    }

    // Read and Upload to Storage
    console.time('[VideoGen] Upload to storage');
    if (!existsSync(videoPath)) {
      throw new Error("Rendered video file not found after rendering process.");
    }
    
    const videoBuffer = await readFile(videoPath);
    const fileName = `renders/${planId}.mp4`;
    
    console.log("Uploading rendered video to storage...");
    type AdminStorage = { storage?: { uploadFile?: (path: string, file: Buffer, opts?: { contentType?: string }) => Promise<unknown> } };
    const storageDb = adminDb as unknown as AdminStorage;

    if (storageDb.storage?.uploadFile) {
      await storageDb.storage.uploadFile(fileName, videoBuffer, { contentType: "video/mp4" });
      console.log(`✅ Uploaded video (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      console.warn("Storage upload unavailable, skipping upload.");
    }
    console.timeEnd('[VideoGen] Upload to storage');

    // Update DB
    await adminDb.transact([
        adminDb.tx.videoPlans[planId].update({ 
            videoUrl: fileName,
            status: 'completed'
        })
    ]);

    // Cleanup local temp
    try { await unlink(videoPath); } catch (e) {}

    console.timeEnd('[VideoGen] Total render pipeline');
    console.log(`🎉 Video generation complete! URL: ${fileName}`);

    if (background) {
        return NextResponse.json({ success: true, url: fileName });
    }

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="ideatovideo-${planId}.mp4"`,
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message || "Video generation failed" }, { status: 500 });
  } finally {
    if (lockedPlanId) rendersInProgress.delete(lockedPlanId);
  }
}
