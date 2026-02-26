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

export async function renderRemotionVideo(plan: VideoPlan, outputPath: string) {
  // Use dynamic imports to prevent Next.js from bundling Remotion packages
  // This is required because @remotion/bundler includes Webpack, and Next.js
  // cannot bundle Webpack with Webpack (creates React.createContext errors)
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const entryPoint = path.resolve(process.cwd(), "remotion/index.ts");
  const remotionDir = path.resolve(process.cwd(), "remotion");

  // Check if bundle is cached and still valid
  const remotionFilesTimestamp = await getRemotionFilesModifiedTime(remotionDir);
  // FORCE REBUILD: Invalidating cache to ensure APP_ID injection
  const bundleIsValid = false; 
  /*
  const bundleIsValid = cachedBundleLocation &&
                        existsSync(cachedBundleLocation) &&
                        remotionFilesTimestamp <= cachedBundleTimestamp;
  */

  let bundleLocation: string;

  if (bundleIsValid && cachedBundleLocation) {
    console.log("[Remotion] ♻️  Reusing cached bundle (skip 10s rebuild)");
    bundleLocation = cachedBundleLocation;
  } else {
    const bundleStartTime = Date.now();
    console.log("[Remotion] 🎬 Starting bundle step (first time or code changed)...");
    bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => {
        // Inject environment variables into the bundle
        config.plugins = [
          ...(config.plugins || []),
          new (require("webpack").DefinePlugin)({
            "process.env.NEXT_PUBLIC_INSTANT_APP_ID": JSON.stringify(process.env.NEXT_PUBLIC_INSTANT_APP_ID),
            "process.env.NEXT_PUBLIC_APP_URL": JSON.stringify(process.env.NEXT_PUBLIC_APP_URL),
          }),
        ];
        return {
          ...config,
          cache: { type: 'filesystem' },
        };
      },
    });

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
  const optimalConcurrency = Math.max(1, Math.floor(cpuCount / 2));
  
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
      gl: "angle",
      headless: true,
    },
    videoBitrate: "2.5M", // Slightly lower for even faster muxing
    enforceAudioTrack: true,
    ffmpegOverride: ({ args }) => {
      // Use superfast/ultrafast and tune for zero latency
      return [
        ...args,
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', '30', // Faster encoding with acceptable quality loss for preview
        '-threads', '0',
      ];
    },
    onProgress: ({ renderedFrames, encodedFrames, encodedDoneIn, renderedDoneIn }) => {
      const totalFrames = composition.durationInFrames;
      if (renderedFrames % 50 === 0 || renderedFrames === totalFrames) {
        const renderProgress = ((renderedFrames / totalFrames) * 100).toFixed(0);
        const encodeProgress = ((encodedFrames / totalFrames) * 100).toFixed(0);
        console.log(`[Remotion] ⏩ Render: ${renderProgress}% | Encode: ${encodeProgress}%`);
      }
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Remotion] ✅ Render complete in ${totalTime}s`);
}
