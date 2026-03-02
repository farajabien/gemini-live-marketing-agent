/**
 * Scene-level caching system for FFmpeg rendering
 * Each scene is rendered once and cached for reuse across videos
 */

import { createHash } from "crypto";
import { Scene } from "../types";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export interface SceneCacheKey {
  imageUrl: string;
  audioUrl?: string;
  duration: number;
  voiceover: string;
  visualPrompt: string;
  transition?: string;
  textOverlay?: string;
  format?: "9:16" | "1:1" | "16:9"; // Aspect ratio
}

/**
 * Generate deterministic hash for a scene configuration
 */
export function generateSceneHash(scene: Scene, format: "9:16" | "1:1" | "16:9" = "9:16"): string {
  const cacheKey: SceneCacheKey = {
    imageUrl: scene.imageUrl || "",
    audioUrl: scene.audioUrl || "",
    duration: scene.duration,
    voiceover: scene.voiceover,
    visualPrompt: scene.visualPrompt,
    transition: (scene as any).transition || "fade",
    format,
  };

  const canonical = JSON.stringify(cacheKey, Object.keys(cacheKey).sort());
  return createHash("sha256").update(canonical).digest("hex").substring(0, 16);
}

/**
 * Get the cache directory for scene segments
 */
export function getSceneCacheDir(): string {
  const cacheDir = join(tmpdir(), "ideatovideo-scene-cache");
  return cacheDir;
}

/**
 * Get the file path for a cached scene segment
 */
export function getCachedScenePath(sceneHash: string): string {
  return join(getSceneCacheDir(), `${sceneHash}.mp4`);
}

/**
 * Check if a scene segment is cached
 */
export async function isSceneCached(sceneHash: string): Promise<boolean> {
  const cachePath = getCachedScenePath(sceneHash);
  return existsSync(cachePath);
}

/**
 * Save a rendered scene segment to cache
 */
export async function saveSceneToCache(sceneHash: string, videoBuffer: Buffer): Promise<void> {
  const cacheDir = getSceneCacheDir();

  // Ensure cache directory exists
  if (!existsSync(cacheDir)) {
    await mkdir(cacheDir, { recursive: true });
  }

  const cachePath = getCachedScenePath(sceneHash);
  await writeFile(cachePath, videoBuffer);

  console.log(`[SceneCache] ✅ Saved scene ${sceneHash} (${(videoBuffer.length / 1024).toFixed(2)} KB)`);
}

/**
 * Retrieve a cached scene segment
 */
export async function getSceneFromCache(sceneHash: string): Promise<Buffer | null> {
  const cachePath = getCachedScenePath(sceneHash);

  if (!existsSync(cachePath)) {
    return null;
  }

  const buffer = await readFile(cachePath);
  console.log(`[SceneCache] ♻️  Retrieved cached scene ${sceneHash}`);
  return buffer;
}

/**
 * Get cache statistics (size, count, oldest entry)
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSizeMB: number;
  oldestEntryAge: number;
}> {
  const cacheDir = getSceneCacheDir();

  if (!existsSync(cacheDir)) {
    return { count: 0, totalSizeMB: 0, oldestEntryAge: 0 };
  }

  const files = await readdir(cacheDir);
  let totalSize = 0;
  let oldestTime = Date.now();

  for (const file of files) {
    if (file.endsWith(".mp4")) {
      const filePath = join(cacheDir, file);
      const stats = await stat(filePath);
      totalSize += stats.size;

      if (stats.mtimeMs < oldestTime) {
        oldestTime = stats.mtimeMs;
      }
    }
  }

  return {
    count: files.filter(f => f.endsWith(".mp4")).length,
    totalSizeMB: totalSize / 1024 / 1024,
    oldestEntryAge: Date.now() - oldestTime,
  };
}

/**
 * Clean up old cache entries (LRU eviction)
 * Keeps cache under maxSizeMB by removing oldest entries
 */
export async function cleanupCache(maxSizeMB: number = 500): Promise<number> {
  const cacheDir = getSceneCacheDir();

  if (!existsSync(cacheDir)) {
    return 0;
  }

  const files = await readdir(cacheDir);
  const fileStats: Array<{ path: string; size: number; mtime: number }> = [];

  // Collect file stats
  for (const file of files) {
    if (file.endsWith(".mp4")) {
      const filePath = join(cacheDir, file);
      const stats = await stat(filePath);
      fileStats.push({
        path: filePath,
        size: stats.size,
        mtime: stats.mtimeMs,
      });
    }
  }

  // Sort by modification time (oldest first)
  fileStats.sort((a, b) => a.mtime - b.mtime);

  // Calculate total size
  const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMB = totalSize / 1024 / 1024;

  if (totalSizeMB <= maxSizeMB) {
    console.log(`[SceneCache] Cache size OK: ${totalSizeMB.toFixed(2)} MB / ${maxSizeMB} MB`);
    return 0;
  }

  // Delete oldest files until we're under the limit
  let deletedCount = 0;
  let currentSize = totalSize;

  for (const file of fileStats) {
    if (currentSize / 1024 / 1024 <= maxSizeMB) {
      break;
    }

    await unlink(file.path);
    currentSize -= file.size;
    deletedCount++;
  }

  console.log(`[SceneCache] Cleaned up ${deletedCount} old entries (freed ${((totalSize - currentSize) / 1024 / 1024).toFixed(2)} MB)`);
  return deletedCount;
}

/**
 * Clear entire cache (useful for testing or debugging)
 */
export async function clearCache(): Promise<void> {
  const cacheDir = getSceneCacheDir();

  if (!existsSync(cacheDir)) {
    return;
  }

  const files = await readdir(cacheDir);

  for (const file of files) {
    if (file.endsWith(".mp4")) {
      await unlink(join(cacheDir, file));
    }
  }

  console.log(`[SceneCache] 🗑️  Cleared all cached scenes`);
}
