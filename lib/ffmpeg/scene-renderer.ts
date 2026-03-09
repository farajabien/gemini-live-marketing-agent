/**
 * FFmpeg Scene Renderer
 * Renders a single scene (image + audio + text) into a video segment
 * This replaces Remotion's browser-based rendering with direct FFmpeg processing
 */

import ffmpeg from "fluent-ffmpeg";
import { Scene } from "../types";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import { getFileUrl } from "@/lib/firebase-client";

export interface SceneRenderOptions {
  format: "9:16" | "1:1" | "16:9"; // Aspect ratio
  resolution: "1080p" | "720p" | "4k";
  fps: number;
  useGPU: boolean; // Enable GPU acceleration if available
  videoBitrate: string; // e.g., "3M"
  audioBitrate: string; // e.g., "192k"
}

export const DEFAULT_SCENE_OPTIONS: SceneRenderOptions = {
  format: "9:16",
  resolution: "1080p",
  fps: 30,
  useGPU: true,
  videoBitrate: "3M",
  audioBitrate: "192k",
};

/**
 * Get video dimensions based on format
 */
function getVideoDimensions(format: "9:16" | "1:1" | "16:9", resolution: "1080p" | "720p" | "4k"): { width: number; height: number } {
  const resolutionMap = {
    "1080p": { "9:16": { width: 1080, height: 1920 }, "1:1": { width: 1080, height: 1080 }, "16:9": { width: 1920, height: 1080 } },
    "720p": { "9:16": { width: 720, height: 1280 }, "1:1": { width: 720, height: 720 }, "16:9": { width: 1280, height: 720 } },
    "4k": { "9:16": { width: 2160, height: 3840 }, "1:1": { width: 2160, height: 2160 }, "16:9": { width: 3840, height: 2160 } },
  };

  return resolutionMap[resolution][format];
}

/**
 * Download an asset from URL or Firebase Storage to temp file
 */
async function downloadAsset(url: string, ext: string): Promise<string> {
  const tempPath = join(tmpdir(), `asset-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`);

  // If it's a storage path (not a full URL), get the download URL
  const downloadUrl = url.startsWith("http") ? url : getFileUrl(url);

  console.log(`[FFmpeg] Downloading asset: ${downloadUrl.substring(0, 60)}...`);

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(tempPath, buffer);

  console.log(`[FFmpeg] ✅ Downloaded to ${tempPath} (${(buffer.length / 1024).toFixed(2)} KB)`);
  return tempPath;
}

/**
 * Detect if GPU acceleration is available
 */
export function detectGPUEncoder(): string | null {
  const platform = process.platform;

  if (platform === "darwin") {
    // macOS - VideoToolbox (h264_videotoolbox)
    return "h264_videotoolbox";
  } else if (platform === "linux" || platform === "win32") {
    // Linux/Windows - NVIDIA NVENC (h264_nvenc) or Intel QSV (h264_qsv)
    // Note: This requires proper driver installation
    // For now, we'll default to software encoding on non-macOS
    return null;
  }

  return null;
}

/**
 * Render a single scene to a video segment using FFmpeg
 */
export async function renderScene(
  scene: Scene,
  outputPath: string,
  options: SceneRenderOptions = DEFAULT_SCENE_OPTIONS
): Promise<void> {
  console.log(`[FFmpeg Scene Renderer] Starting render for scene...`);
  console.time("[FFmpeg Scene Renderer] Total render time");

  const { width, height } = getVideoDimensions(options.format, options.resolution);
  const tempFiles: string[] = [];

  try {
    // 1. Download assets
    console.time("[FFmpeg] Asset download");

    let imagePath: string | null = null;
    let audioPath: string | null = null;

    if (scene.imageUrl) {
      imagePath = await downloadAsset(scene.imageUrl, "png");
      tempFiles.push(imagePath);
    }

    if (scene.audioUrl) {
      audioPath = await downloadAsset(scene.audioUrl, "mp3");
      tempFiles.push(audioPath);
    }

    console.timeEnd("[FFmpeg] Asset download");

    if (!imagePath) {
      throw new Error("Scene must have an imageUrl");
    }

    // 2. Build FFmpeg command
    console.time("[FFmpeg] Video encoding");

    const gpuEncoder = options.useGPU ? detectGPUEncoder() : null;
    const codec = gpuEncoder || "libx264";

    console.log(`[FFmpeg] Using codec: ${codec} (GPU: ${gpuEncoder ? "YES" : "NO"})`);

    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      // Input: Loop the image for the duration
      command = command
        .input(imagePath!)
        .inputOptions([
          "-loop", "1",
          "-t", scene.duration.toString(),
          "-framerate", options.fps.toString()
        ]);

      // Input: Audio (if available)
      if (audioPath) {
        command = command.input(audioPath);
      }

      // Video filter: scale + fade transitions
      const videoFilter = [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`, // Center with black bars if needed
        `format=yuv420p`, // Ensure compatibility
      ];

      // Add fade in/out for smoother transitions
      const transition = (scene as any).transition;
      if (transition === "fade" || !transition) {
        videoFilter.push(`fade=t=in:st=0:d=0.3`); // Fade in first 0.3s
        videoFilter.push(`fade=t=out:st=${scene.duration - 0.3}:d=0.3`); // Fade out last 0.3s
      }

      command = command.videoFilters(videoFilter);

      // Output options
      command = command
        .outputOptions([
          "-pix_fmt", "yuv420p",
          "-r", options.fps.toString(),
          "-t", scene.duration.toString(),
        ]);

      // Codec selection
      if (codec === "h264_videotoolbox") {
        // macOS VideoToolbox (GPU)
        command = command
          .videoCodec("h264_videotoolbox")
          .outputOptions([
            "-b:v", options.videoBitrate,
            "-allow_sw", "1", // Fallback to software if GPU unavailable
          ]);
      } else {
        // Software encoding (libx264)
        command = command
          .videoCodec("libx264")
          .outputOptions([
            "-preset", "veryfast", // Speed/quality tradeoff
            "-crf", "23", // Quality (lower = better, 23 is default)
            "-b:v", options.videoBitrate,
          ]);
      }

      // Audio options (if audio exists)
      if (audioPath) {
        command = command
          .audioCodec("aac")
          .audioBitrate(options.audioBitrate)
          .audioFrequency(44100)
          .outputOptions(["-shortest"]); // Match video duration to shortest stream
      } else {
        // No audio - add silent track for consistency
        command = command
          .outputOptions(["-an"]); // No audio
      }

      // Progressive download support
      command = command.outputOptions(["-movflags", "+faststart"]);

      // Output
      command = command.output(outputPath);

      // Event handlers
      command.on("start", (commandLine) => {
        console.log(`[FFmpeg] Executing: ${commandLine.substring(0, 100)}...`);
      });

      command.on("progress", (progress) => {
        if (progress.percent) {
          console.log(`[FFmpeg] Progress: ${progress.percent.toFixed(1)}%`);
        }
      });

      command.on("end", () => {
        console.timeEnd("[FFmpeg] Video encoding");
        resolve();
      });

      command.on("error", (err, stdout, stderr) => {
        console.error("[FFmpeg] Error:", err.message);
        console.error("[FFmpeg] stderr:", stderr);
        reject(err);
      });

      // Run
      command.run();
    });

    console.timeEnd("[FFmpeg Scene Renderer] Total render time");
    console.log(`[FFmpeg] ✅ Scene rendered successfully: ${outputPath}`);

  } finally {
    // Cleanup temp files
    for (const tempFile of tempFiles) {
      try {
        if (existsSync(tempFile)) {
          await unlink(tempFile);
        }
      } catch (err) {
        console.warn(`[FFmpeg] Failed to cleanup temp file: ${tempFile}`);
      }
    }
  }
}

/**
 * Render scene and return as buffer (for caching)
 */
export async function renderSceneToBuffer(
  scene: Scene,
  options: SceneRenderOptions = DEFAULT_SCENE_OPTIONS
): Promise<Buffer> {
  const tempOutput = join(tmpdir(), `scene-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`);

  try {
    await renderScene(scene, tempOutput, options);

    if (!existsSync(tempOutput)) {
      throw new Error("Rendered scene file not found");
    }

    const buffer = await readFile(tempOutput);
    return buffer;
  } finally {
    // Cleanup
    try {
      if (existsSync(tempOutput)) {
        await unlink(tempOutput);
      }
    } catch (err) {
      console.warn(`[FFmpeg] Failed to cleanup output file: ${tempOutput}`);
    }
  }
}
