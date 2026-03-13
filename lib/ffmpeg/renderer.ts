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
  downloadAsset,
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

  const sceneSegmentPaths: string[] = new Array(plan.scenes.length).fill("");
  const tempFiles: string[] = [];

  try {
    // PHASE 0: Pre-download all unique assets
    console.log(`[FFmpeg Renderer] PHASE 0: Pre-downloading unique assets...`);
    const uniqueImages = new Set<string>();
    const uniqueAudio = new Set<string>();

    for (const scene of plan.scenes) {
      if (scene.imageUrl) uniqueImages.add(scene.imageUrl);
      if (scene.audioUrl) uniqueAudio.add(scene.audioUrl);
    }

    const assetMap = new Map<string, string>();
    const assetDownloadPromises: Promise<void>[] = [];

    // Download images
    for (const url of uniqueImages) {
      if (url.startsWith("/") || url.startsWith("file://")) continue;
      assetDownloadPromises.push((async () => {
        try {
          const localPath = await downloadAsset(url, "png");
          assetMap.set(url, localPath);
          tempFiles.push(localPath);
        } catch (err) {
          console.warn(`[FFmpeg Renderer] Failed to pre-download image: ${url}`, err);
        }
      })());
    }

    // Download audio
    for (const url of uniqueAudio) {
      if (url.startsWith("/") || url.startsWith("file://")) continue;
      assetDownloadPromises.push((async () => {
        try {
          const localPath = await downloadAsset(url, "mp3");
          assetMap.set(url, localPath);
          tempFiles.push(localPath);
        } catch (err) {
          console.warn(`[FFmpeg Renderer] Failed to pre-download audio: ${url}`, err);
        }
      })());
    }

    await Promise.all(assetDownloadPromises);
    console.log(`[FFmpeg Renderer] Pre-downloaded ${assetMap.size} unique assets.`);

    // PHASE 1: Render or retrieve each scene (PARALLEL)
    updateProgress({ phase: "rendering_scenes" });

    const startTime = Date.now();
    const log = (msg: string) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[FFmpeg Renderer][${elapsed}s] ${msg}`);
    };

    const CONCURRENCY = process.platform === "darwin" ? 2 : 3;
    log(`Processing ${plan.scenes.length} scenes (Pool size: ${CONCURRENCY})...`);

    // Worker pool: Render N scenes at once
    const queue = Array.from({ length: plan.scenes.length }, (_, i) => i);
    
    const processScene = async (i: number) => {
      const scene = JSON.parse(JSON.stringify(plan.scenes[i])) as Scene;
      const sceneNumber = i + 1;

      log(`Starting Scene ${sceneNumber}/${plan.scenes.length} (ID: ${scene.id || 'N/A'})`);

      // Generate scene hash BEFORE swapping URLs for local paths (for deterministic caching)
      const sceneHash = generateSceneHash(scene, format);

      // Swap URLs for local paths if available
      if (scene.imageUrl && assetMap.has(scene.imageUrl)) {
        scene.imageUrl = assetMap.get(scene.imageUrl)!;
      }
      if (scene.audioUrl && assetMap.has(scene.audioUrl)) {
        scene.audioUrl = assetMap.get(scene.audioUrl)!;
      }
      let segmentPath: string;

      // Check cache (unless forced rerender)
      if (enableCache && !forceRerender && await isSceneCached(sceneHash)) {
        log(`♻️  Cache HIT - Scene ${sceneNumber}`);
        segmentPath = getCachedScenePath(sceneHash);
        progress.cachedScenes++;
      } else {
        log(`🎬 Cache MISS - Rendering Scene ${sceneNumber}...`);
        const sceneBuffer = await renderSceneToBuffer(scene, renderOptions, plan.id);

        if (enableCache) {
          await saveSceneToCache(sceneHash, sceneBuffer);
          segmentPath = getCachedScenePath(sceneHash);
        } else {
          const tempSegmentPath = join(tmpdir(), `scene-${i}-${Date.now()}.mp4`);
          await writeFile(tempSegmentPath, sceneBuffer);
          segmentPath = tempSegmentPath;
          tempFiles.push(tempSegmentPath);
        }
        progress.newScenes++;
      }

      sceneSegmentPaths[i] = segmentPath;
      progress.completedScenes++;
      
      const percent = Math.round((progress.completedScenes / progress.totalScenes) * 100);
      updateProgress({ currentSceneIndex: i });
      log(`Progress: ${progress.completedScenes}/${progress.totalScenes} (${percent}%)`);
    };

    // Start workers
    const workers = Array(CONCURRENCY).fill(null).map(async () => {
      while (queue.length > 0) {
        const idx = queue.shift();
        if (idx !== undefined) {
          try {
            await processScene(idx);
          } catch (err) {
            console.error(`[FFmpeg Renderer] Fatal error in worker processing scene ${idx}:`, err);
            throw err; // Propagate to Promise.all
          }
        }
      }
    });

    await Promise.all(workers);

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
