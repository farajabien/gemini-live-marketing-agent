/**
 * FFmpeg Concat Stitcher
 * Stitches multiple scene segments into a final video using concat demuxer
 * This is ultra-fast since it's just muxing (no re-encoding)
 */

import ffmpeg from "fluent-ffmpeg";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

export interface ConcatOptions {
  videoBitrate?: string; // Optional re-encoding bitrate
  audioBitrate?: string;
  reEncode?: boolean; // Force re-encoding (slower but ensures compatibility)
}

/**
 * Stitch scene segments using FFmpeg concat demuxer
 * This is VERY fast (no re-encoding) - typically < 5 seconds
 */
export async function stitchSceneSegments(
  segmentPaths: string[],
  outputPath: string,
  options: ConcatOptions = {}
): Promise<void> {
  console.log(`[FFmpeg Concat] Stitching ${segmentPaths.length} segments...`);
  console.time("[FFmpeg Concat] Total stitch time");

  // Validate inputs
  for (const segment of segmentPaths) {
    if (!existsSync(segment)) {
      throw new Error(`Segment not found: ${segment}`);
    }
  }

  // Create concat file list
  const concatFilePath = join(tmpdir(), `concat-${Date.now()}.txt`);
  const concatFileContent = segmentPaths
    .map(path => `file '${path.replace(/'/g, "'\\''")}'`) // Escape single quotes
    .join("\n");

  await writeFile(concatFilePath, concatFileContent, "utf-8");
  console.log(`[FFmpeg Concat] Created concat file: ${concatFilePath}`);

  try {
    await new Promise<void>((resolve, reject) => {
      let command = ffmpeg();

      // Input: concat demuxer
      command = command
        .input(concatFilePath)
        .inputOptions([
          "-f", "concat",
          "-safe", "0" // Allow absolute paths
        ]);

      if (options.reEncode) {
        // Re-encode (slower but ensures compatibility)
        console.log("[FFmpeg Concat] Re-encoding segments for compatibility...");

        command = command
          .videoCodec("libx264")
          .outputOptions([
            "-preset", "veryfast",
            "-crf", "23",
            "-b:v", options.videoBitrate || "3M",
          ])
          .audioCodec("aac")
          .audioBitrate(options.audioBitrate || "192k")
          .outputOptions(["-movflags", "+faststart"]);

      } else {
        // Stream copy (ultra-fast, no re-encoding)
        console.log("[FFmpeg Concat] Using stream copy (no re-encoding)...");

        command = command
          .videoCodec("copy")
          .audioCodec("copy");
      }

      command = command.output(outputPath);

      // Event handlers
      command.on("start", (commandLine) => {
        console.log(`[FFmpeg Concat] Executing: ${commandLine.substring(0, 100)}...`);
      });

      command.on("progress", (progress) => {
        if (progress.percent) {
          console.log(`[FFmpeg Concat] Progress: ${progress.percent.toFixed(1)}%`);
        }
      });

      command.on("end", () => {
        console.timeEnd("[FFmpeg Concat] Total stitch time");
        console.log(`[FFmpeg Concat] ✅ Stitched ${segmentPaths.length} segments successfully`);
        resolve();
      });

      command.on("error", (err, stdout, stderr) => {
        console.error("[FFmpeg Concat] Error:", err.message);
        console.error("[FFmpeg Concat] stderr:", stderr);
        reject(err);
      });

      command.run();
    });

  } finally {
    // Cleanup concat file
    try {
      if (existsSync(concatFilePath)) {
        await unlink(concatFilePath);
      }
    } catch (err) {
      console.warn(`[FFmpeg Concat] Failed to cleanup concat file: ${concatFilePath}`);
    }
  }
}

/**
 * Alternative: Stitch with custom transitions between segments
 * This requires re-encoding but allows xfade filter
 */
export async function stitchWithTransitions(
  segmentPaths: string[],
  outputPath: string,
  transitionDuration: number = 0.5,
  transitionType: "fade" | "wipeleft" | "wiperight" | "slideup" | "slidedown" = "fade"
): Promise<void> {
  console.log(`[FFmpeg Concat] Stitching ${segmentPaths.length} segments with ${transitionType} transitions...`);
  console.time("[FFmpeg Concat] Total stitch time");

  // Note: xfade filter requires re-encoding and is complex for >2 inputs
  // For now, we'll use a simpler approach with ffmpeg concat + dissolve

  // This is a complex implementation - for MVP, we'll stick with concat demuxer
  // and handle transitions at the scene level (fade in/out)
  throw new Error("Transitions not yet implemented - use scene-level fade in/out instead");
}
