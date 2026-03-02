/**
 * FFmpeg Video Renderer with Scene-Level Caching
 * This is the main orchestrator that replaces Remotion
 *
 * Performance Targets:
 * - First render (all scenes new): 2-3 minutes
 * - Partial update (1-2 scenes changed): 30-60 seconds
 * - Fully cached: 10-20 seconds (just concat)
 */

import { VideoPlan, Scene } from "../types";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

import {
  generateSceneHash,
  isSceneCached,
  saveSceneToCache,
  getSceneFromCache,
  getCachedScenePath,
  getCacheStats,
  cleanupCache,
} from "./scene-cache";

import {
  renderSceneToBuffer,
  SceneRenderOptions,
  DEFAULT_SCENE_OPTIONS,
} from "./scene-renderer";

import { stitchSceneSegments } from "./concat-stitcher";

export interface FFmpegRenderOptions extends SceneRenderOptions {
  enableCache?: boolean; // Default: true
  forceRerender?: boolean; // Bypass cache
  cleanupOldCache?: boolean; // Run LRU cleanup before render
}

export interface RenderProgress {
  phase: "preparing" | "rendering_scenes" | "stitching" | "finalizing" | "complete";
  totalScenes: number;
  completedScenes: number;
  cachedScenes: number;
  newScenes: number;
  currentSceneIndex?: number;
  estimatedTimeRemaining?: number;
}

export type ProgressCallback = (progress: RenderProgress) => void;

/**
 * Render a complete video from a VideoPlan using FFmpeg + scene caching
 */
export async function renderVideoWithFFmpeg(
  plan: VideoPlan,
  outputPath: string,
  options: FFmpegRenderOptions = DEFAULT_SCENE_OPTIONS,
  onProgress?: ProgressCallback
): Promise<void> {
  console.log(`[FFmpeg Renderer] Starting render for "${plan.title}" (${plan.scenes.length} scenes)`);
  console.time("[FFmpeg Renderer] Total render time");

  const enableCache = options.enableCache !== false;
  const forceRerender = options.forceRerender || false;

  // Determine format based on plan type
  const format: "9:16" | "1:1" | "16:9" = plan.type === "carousel" ? "1:1" : "9:16";
  const renderOptions: SceneRenderOptions = {
    ...DEFAULT_SCENE_OPTIONS,
    ...options,
    format,
  };

  // Progress tracking
  const progress: RenderProgress = {
    phase: "preparing",
    totalScenes: plan.scenes.length,
    completedScenes: 0,
    cachedScenes: 0,
    newScenes: 0,
  };

  const updateProgress = (updates: Partial<RenderProgress>) => {
    Object.assign(progress, updates);
    if (onProgress) {
      onProgress({ ...progress });
    }
  };

  updateProgress({ phase: "preparing" });

  // Optional: Cleanup old cache entries
  if (options.cleanupOldCache && enableCache) {
    console.log("[FFmpeg Renderer] Running cache cleanup...");
    await cleanupCache(500); // Keep cache under 500 MB
  }

  // Show cache stats
  if (enableCache) {
    const stats = await getCacheStats();
    console.log(`[FFmpeg Renderer] Cache stats: ${stats.count} scenes, ${stats.totalSizeMB.toFixed(2)} MB`);
  }

  const sceneSegmentPaths: string[] = [];
  const tempFiles: string[] = [];

  try {
    // PHASE 1: Render or retrieve each scene
    updateProgress({ phase: "rendering_scenes" });

    console.log(`[FFmpeg Renderer] Processing ${plan.scenes.length} scenes...`);

    for (let i = 0; i < plan.scenes.length; i++) {
      const scene = plan.scenes[i] as Scene;
      const sceneNumber = i + 1;

      updateProgress({ currentSceneIndex: i });

      console.log(`\n[FFmpeg Renderer] === Scene ${sceneNumber}/${plan.scenes.length} ===`);
      console.log(`[FFmpeg Renderer] Voiceover: "${scene.voiceover.substring(0, 60)}..."`);
      console.log(`[FFmpeg Renderer] Duration: ${scene.duration}s`);

      // Generate scene hash
      const sceneHash = generateSceneHash(scene, format);
      console.log(`[FFmpeg Renderer] Scene hash: ${sceneHash}`);

      let segmentPath: string;

      // Check cache (unless forced rerender)
      if (enableCache && !forceRerender && await isSceneCached(sceneHash)) {
        // Cache HIT - retrieve cached segment
        console.log(`[FFmpeg Renderer] ♻️  Cache HIT - retrieving scene ${sceneNumber}`);

        segmentPath = getCachedScenePath(sceneHash);
        progress.cachedScenes++;

      } else {
        // Cache MISS - render new segment
        console.log(`[FFmpeg Renderer] 🎬 Cache MISS - rendering scene ${sceneNumber}...`);
        console.time(`[FFmpeg Renderer] Scene ${sceneNumber} render`);

        const sceneBuffer = await renderSceneToBuffer(scene, renderOptions);

        console.timeEnd(`[FFmpeg Renderer] Scene ${sceneNumber} render`);

        // Save to cache
        if (enableCache) {
          await saveSceneToCache(sceneHash, sceneBuffer);
          segmentPath = getCachedScenePath(sceneHash);
        } else {
          // No caching - save to temp file
          const tempSegmentPath = join(tmpdir(), `scene-${i}-${Date.now()}.mp4`);
          await writeFile(tempSegmentPath, sceneBuffer);
          segmentPath = tempSegmentPath;
          tempFiles.push(tempSegmentPath);
        }

        progress.newScenes++;
      }

      sceneSegmentPaths.push(segmentPath);
      progress.completedScenes++;

      updateProgress({});

      const cacheHitRate = ((progress.cachedScenes / progress.completedScenes) * 100).toFixed(1);
      console.log(`[FFmpeg Renderer] Progress: ${progress.completedScenes}/${progress.totalScenes} scenes (${cacheHitRate}% cache hit rate)`);
    }

    // PHASE 2: Stitch all segments together
    updateProgress({ phase: "stitching" });

    console.log(`\n[FFmpeg Renderer] === Stitching ${sceneSegmentPaths.length} segments ===`);
    console.time("[FFmpeg Renderer] Stitching time");

    await stitchSceneSegments(sceneSegmentPaths, outputPath, {
      reEncode: false, // Use stream copy for speed
    });

    console.timeEnd("[FFmpeg Renderer] Stitching time");

    // PHASE 3: Finalize
    updateProgress({ phase: "finalizing" });

    if (!existsSync(outputPath)) {
      throw new Error("Final video file not created");
    }

    const videoStats = await readFile(outputPath);
    const videoSizeMB = videoStats.length / 1024 / 1024;

    updateProgress({ phase: "complete" });

    console.timeEnd("[FFmpeg Renderer] Total render time");
    console.log(`\n[FFmpeg Renderer] ✅ Render complete!`);
    console.log(`[FFmpeg Renderer] Output: ${outputPath}`);
    console.log(`[FFmpeg Renderer] Size: ${videoSizeMB.toFixed(2)} MB`);
    console.log(`[FFmpeg Renderer] Cache Performance: ${progress.cachedScenes} cached, ${progress.newScenes} new`);

    if (progress.cachedScenes > 0) {
      const timeSaved = progress.cachedScenes * 30; // Estimate 30s per cached scene
      console.log(`[FFmpeg Renderer] ⚡ Estimated time saved by caching: ${timeSaved}s`);
    }

  } finally {
    // Cleanup temp files (but not cached files)
    for (const tempFile of tempFiles) {
      try {
        if (existsSync(tempFile)) {
          await unlink(tempFile);
        }
      } catch (err) {
        console.warn(`[FFmpeg Renderer] Failed to cleanup temp file: ${tempFile}`);
      }
    }
  }
}

/**
 * Estimate render time based on cache hit rate
 */
export async function estimateRenderTime(plan: VideoPlan, format: "9:16" | "1:1" | "16:9" = "9:16"): Promise<{
  estimatedSeconds: number;
  cachedScenes: number;
  newScenes: number;
}> {
  let cachedScenes = 0;
  let newScenes = 0;

  for (const scene of plan.scenes) {
    const sceneHash = generateSceneHash(scene as Scene, format);
    if (await isSceneCached(sceneHash)) {
      cachedScenes++;
    } else {
      newScenes++;
    }
  }

  // Estimation:
  // - Cached scene: ~0s (retrieval is instant)
  // - New scene: ~30s average (varies by complexity)
  // - Stitching: ~5-10s
  const estimatedSeconds = (newScenes * 30) + 10;

  return {
    estimatedSeconds,
    cachedScenes,
    newScenes,
  };
}
