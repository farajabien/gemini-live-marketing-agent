import type { Scene } from "./types";
import { getAppUrl } from "./app-url";

export interface AssetVerificationResult {
  allReady: boolean;
  failedAssets: string[];
  details: Array<{
    type: "image" | "audio" | "video";
    url: string;
    accessible: boolean;
    error?: string;
  }>;
}

/**
 * Verifies that all scene assets (images, videos, audio) are accessible
 * via the proxy-image route before starting video rendering.
 *
 * This prevents 404 errors during Remotion rendering by ensuring
 * assets have propagated to storage/CDN.
 */
export async function verifySceneAssets(
  scenes: Scene[],
  baseUrl: string = getAppUrl(),
): Promise<AssetVerificationResult> {
  const verificationPromises: Promise<{
    type: "image" | "audio" | "video";
    url: string;
    accessible: boolean;
    error?: string;
  }>[] = [];

  for (const scene of scenes) {
    // Verify image
    if (scene.imageUrl) {
      verificationPromises.push(
        verifyAsset(scene.imageUrl, "image", baseUrl)
      );
    }

    // Verify video clip
    if (scene.videoClipUrl) {
      verificationPromises.push(
        verifyAsset(scene.videoClipUrl, "video", baseUrl)
      );
    }

    // Verify audio (skip data URIs)
    if (scene.audioUrl && !scene.audioUrl.startsWith("data:")) {
      verificationPromises.push(
        verifyAsset(scene.audioUrl, "audio", baseUrl)
      );
    }
  }

  const results = await Promise.all(verificationPromises);

  const failedAssets = results
    .filter((r) => !r.accessible)
    .map((r) => r.url);

  return {
    allReady: failedAssets.length === 0,
    failedAssets,
    details: results,
  };
}

/**
 * Verify a single asset is accessible via the proxy-image route
 */
async function verifyAsset(
  assetPath: string,
  type: "image" | "audio" | "video",
  baseUrl: string
): Promise<{
  type: "image" | "audio" | "video";
  url: string;
  accessible: boolean;
  error?: string;
}> {
  // Skip absolute URLs and data URIs
  if (assetPath.startsWith("http") || assetPath.startsWith("data:")) {
    return {
      type,
      url: assetPath,
      accessible: true,
    };
  }

  const proxyUrl = `${baseUrl}/api/proxy-image?path=${encodeURIComponent(assetPath)}`;

  try {
    const response = await fetch(proxyUrl, {
      method: "HEAD", // Use HEAD to avoid downloading the full asset
    });

    if (response.ok) {
      return {
        type,
        url: assetPath,
        accessible: true,
      };
    } else {
      return {
        type,
        url: assetPath,
        accessible: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    return {
      type,
      url: assetPath,
      accessible: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
