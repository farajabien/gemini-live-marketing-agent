/**
 * Render Presets
 *
 * Configurable quality/speed trade-offs for both Remotion and FFmpeg renderers.
 * The "social" preset is the default — optimised for mobile-first vertical
 * content where 720p is indistinguishable from 1080p on phone screens.
 */

export type RenderPresetName = "fast_preview" | "social" | "hd";

export interface RenderPreset {
  name: RenderPresetName;
  label: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  crf: number;
  ffmpegPreset: string;
  concurrencyMultiplier: number;
}

const PRESETS: Record<RenderPresetName, RenderPreset> = {
  fast_preview: {
    name: "fast_preview",
    label: "Fast Preview",
    width: 540,
    height: 960,
    fps: 15,
    videoBitrate: "1.5M",
    audioBitrate: "128k",
    crf: 32,
    ffmpegPreset: "ultrafast",
    concurrencyMultiplier: 1.5,
  },
  social: {
    name: "social",
    label: "Social (Default)",
    width: 720,
    height: 1280,
    fps: 30,
    videoBitrate: "2.5M",
    audioBitrate: "192k",
    crf: 24,
    ffmpegPreset: "veryfast",
    concurrencyMultiplier: 0.5,
  },
  hd: {
    name: "hd",
    label: "HD",
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: "4M",
    audioBitrate: "192k",
    crf: 21,
    ffmpegPreset: "medium",
    concurrencyMultiplier: 0.25,
  },
};

export function getRenderPreset(name?: RenderPresetName | string): RenderPreset {
  if (name && name in PRESETS) return PRESETS[name as RenderPresetName];
  const envPreset = process.env.DEFAULT_RENDER_PRESET as RenderPresetName | undefined;
  if (envPreset && envPreset in PRESETS) return PRESETS[envPreset];
  return PRESETS.social;
}

export function getOptimalConcurrency(preset: RenderPreset, cpuCount = 4): number {
  return Math.max(1, Math.min(4, Math.floor(cpuCount * preset.concurrencyMultiplier)));
}

export { PRESETS as RENDER_PRESETS };
