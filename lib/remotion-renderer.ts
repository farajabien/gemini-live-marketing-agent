import path from "path";
import os from "os";
import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import { VideoPlan } from "../lib/types";

// Cache bundle location and timestamp for reuse across renders
let cachedBundleLocation: string | null = null;
let cachedBundleTimestamp: number = 0;

async function getRemotionFilesModifiedTime(remotionDir: string): Promise<number> {
  try {
    const files = await readdir(remotionDir, { withFileTypes: true });
    let latestTimestamp = 0;

    for (const file of files) {
      const filePath = path.join(remotionDir, file.name);
      if (file.isFile() && (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))) {
        const stats = await stat(filePath);
        if (stats.mtimeMs > latestTimestamp) {
          latestTimestamp = stats.mtimeMs;
        }
      }
    }

    return latestTimestamp;
  } catch (err) {
    console.warn("[Remotion] Could not check file timestamps, will rebuild bundle:", err);
    return Date.now(); // Force rebuild on error
  }
}

export async function renderRemotionVideo(
  plan: VideoPlan,
  outputPath: string,
  onProgressCallback?: (percent: number) => void
) {
  // Use dynamic imports to prevent Next.js from bundling Remotion packages
  // This is required because @remotion/bundler includes Webpack, and Next.js
  // cannot bundle Webpack with Webpack (creates React.createContext errors)
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const entryPoint = path.resolve(process.cwd(), "remotion/index.ts");
  const remotionDir = path.resolve(process.cwd(), "remotion");

  // Check if bundle is cached and still valid
  const remotionFilesTimestamp = await getRemotionFilesModifiedTime(remotionDir);
  // Smart caching: Only rebuild if Remotion files changed
  const bundleIsValid = cachedBundleLocation &&
                        existsSync(cachedBundleLocation) &&
                        remotionFilesTimestamp <= cachedBundleTimestamp;

  let bundleLocation: string;

  if (bundleIsValid && cachedBundleLocation) {
    console.log("[Remotion] ♻️  Reusing cached bundle (skip 10s rebuild)");
    bundleLocation = cachedBundleLocation;
  } else {
    const bundleStartTime = Date.now();
    console.log("[Remotion] 🎬 Starting bundle step (first time or code changed)...");
    bundleLocation = await bundle(
      entryPoint,
      () => {},
      {
        webpackOverride: (config) => {
          return {
            ...config,
            cache: { type: 'filesystem' },
          };
        },
      }
    );

    // Cache the bundle location and timestamp
    cachedBundleLocation = bundleLocation;
    cachedBundleTimestamp = Date.now();

    console.log(`[Remotion] ✅ Bundle complete in ${((Date.now() - bundleStartTime) / 1000).toFixed(2)}s`);
  }

  const compositionId = "Video";
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps: { plan },
  });

  console.log(`[Remotion] 🎬 Starting render of "${plan.title}" (${composition.durationInFrames} frames)...`);
  const startTime = Date.now();
  
  const cpuCount = os.cpus().length;
  // Lower concurrency for shared/limited resources
  const optimalConcurrency = Math.max(1, Math.min(2, Math.floor(cpuCount / 4)));

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { plan },
    timeoutInMilliseconds: 300000,
    concurrency: optimalConcurrency,
    chromiumOptions: {
      disableWebSecurity: true,
      gl: "swangle",
      headless: true,
      args: ["--disable-gpu", "--no-sandbox"],
    },
    videoBitrate: "3M", // Balanced quality/speed
    enforceAudioTrack: true,
    ffmpegOverride: ({ args }) => {
      // Optimized for speed while maintaining good quality
      return [
        ...args,
        '-preset', 'veryfast',      // Better quality than ultrafast, still very fast
        '-tune', 'zerolatency',     // Low latency encoding
        '-crf', '23',               // Better quality (default: 23, lower = better quality)
        '-threads', '0',            // Use all available CPU cores
        '-movflags', '+faststart',  // Enable progressive download/streaming
      ];
    },
    onProgress: ({ renderedFrames, encodedFrames, encodedDoneIn, renderedDoneIn }) => {
      const totalFrames = composition.durationInFrames;
      if (renderedFrames % 50 === 0 || renderedFrames === totalFrames) {
        const renderPercent = Math.round((renderedFrames / totalFrames) * 100);
        const encodeProgress = ((encodedFrames / totalFrames) * 100).toFixed(0);
        console.log(`[Remotion] ⏩ Render: ${renderPercent}% | Encode: ${encodeProgress}%`);
        if (onProgressCallback) {
          onProgressCallback(renderPercent);
        }
      }
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Remotion] ✅ Render complete in ${totalTime}s`);
}
