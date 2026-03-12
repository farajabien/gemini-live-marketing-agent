import path from "path";
import os from "os";
import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import { VideoPlan } from "../lib/types";
import { getRenderPreset, type RenderPresetName, type RenderPreset } from "./render-presets";

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

export interface RemotionRenderOptions {
  preset?: RenderPresetName;
  onProgressCallback?: (percent: number) => void;
}

export async function renderRemotionVideo(
  plan: VideoPlan,
  outputPath: string,
  onProgressOrOpts?: ((percent: number) => void) | RemotionRenderOptions
) {
  const opts: RemotionRenderOptions =
    typeof onProgressOrOpts === "function"
      ? { onProgressCallback: onProgressOrOpts }
      : onProgressOrOpts ?? {};
  const preset = getRenderPreset(opts.preset);
  const onProgressCallback = opts.onProgressCallback;
  console.log(`[Remotion] Using preset "${preset.name}" (${preset.width}x${preset.height} @ ${preset.fps}fps, CRF ${preset.crf})`);

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
  const concurrencyCap = 2;
  const optimalConcurrency = Math.max(1, Math.min(concurrencyCap, Math.floor(cpuCount * preset.concurrencyMultiplier)));
  console.log(`[Remotion] Concurrency: ${optimalConcurrency} workers (${cpuCount} cores, cap ${concurrencyCap})`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: { plan },
    timeoutInMilliseconds: 600000,
    concurrency: optimalConcurrency,
    chromiumOptions: {
      disableWebSecurity: true,
      gl: "swangle",
      headless: true,
    },
    videoBitrate: preset.videoBitrate,
    enforceAudioTrack: true,
    ffmpegOverride: ({ args }) => {
      return [
        ...args,
        '-preset', preset.ffmpegPreset,
        '-tune', 'zerolatency',
        '-crf', String(preset.crf),
        '-threads', '0',
        '-movflags', '+faststart',
      ];
    },
    onProgress: ({ renderedFrames, encodedFrames }) => {
      const totalFrames = composition.durationInFrames;
      if (renderedFrames % 50 === 0 || renderedFrames === totalFrames) {
        const renderPercent = Math.round((renderedFrames / totalFrames) * 100);
        const encodeProgress = ((encodedFrames / totalFrames) * 100).toFixed(0);
        console.log(`[Remotion] Render: ${renderPercent}% | Encode: ${encodeProgress}%`);
        if (onProgressCallback) {
          onProgressCallback(renderPercent);
        }
      }
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Remotion] ✅ Render complete in ${totalTime}s`);
}
