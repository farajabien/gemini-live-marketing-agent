import path from "path";
import {
  AbsoluteFill,
  Img,
  Video,
  Audio,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Series,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SceneSchema } from "./Schema";
import { z } from "zod";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});

// Watermark configuration (can be passed as prop in future)
const WATERMARK_CONFIG = {
  enabled: true,
  opacity: 0.85,
  size: 120, // pixels
  padding: 24,
  position: "bottom-right" as const,
};

type Scene = z.infer<typeof SceneSchema>;

import { TextMotionScene } from "./TextMotionScene";
import { MagazineScene } from "./MagazineScene";

// ... (other imports)

export const SceneComponent: React.FC<{
  scene: Scene;
  visualMode?: string;
  assetServerBaseUrl?: string;
}> = ({ scene, visualMode, assetServerBaseUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Simple Ken Burns effect (only for static images)
  const durationInFrames = scene.duration * fps;
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateRight: "clamp",
  });

  // Text animation: fade in (15 frames), fade out (15 frames before end)
  const opacity = interpolate(
    frame,
    [0, 15, Math.max(16, durationInFrames - 15), durationInFrames],
    [0, 1, 1, 0],
  );

  // NEW: Sub-scene rendering component
  const SubSceneVisual: React.FC<{ imageUrl: string; duration: number }> = ({
    imageUrl,
    duration,
  }) => {
    const subFrame = useCurrentFrame();
    const subDurationInFrames = duration * fps;

    // Ken Burns effect for this sub-scene
    const subScale = interpolate(subFrame, [0, subDurationInFrames], [1, 1.1], {
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill style={{ transform: `scale(${subScale})` }}>
        <Img
          src={getDirectStorageUrl(imageUrl)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          delayRenderTimeoutInMilliseconds={300000}
        />
      </AbsoluteFill>
    );
  };

  const getDirectStorageUrl = (url: string) => {
    // 1. Return absolute remote URLs and data URIs as-is
    if (url.startsWith("http") || url.startsWith("data:")) return url;

    // 2. For local absolute paths (/tmp, /var, etc), use asset server if available (bypasses Next.js proxy)
    if (
      url.startsWith("/tmp/") ||
      url.startsWith("/var/") || // macOS temp folders
      url.startsWith("file:") ||
      url.startsWith("/users/") // local user home
    ) {
      if (assetServerBaseUrl) {
        const filename = url.split("/").pop() || url.replace(/^.*[/\\]/, "");
        const baseUrl = assetServerBaseUrl.replace(/\/+$/, ""); // Remove trailing slashes
        return `${baseUrl}/${filename}`;
      }
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return `${baseUrl}/api/proxy-image?path=${encodeURIComponent(url)}`;
    }

    // 3. If it's a relative path (starts with / but NOT /tmp or /var),
    // it's likely a static asset in the public folder. Return as-is.
    if (url.startsWith("/")) return url;

    // 4. Default: It's a Firebase Storage path, wrap it in proxy-image
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/api/proxy-image?path=${encodeURIComponent(url)}`;
  };

  // --- NEW: Text Motion & GIF+Voice Mode ---
  if (visualMode === "magazine") {
    return (
      <AbsoluteFill>
        <MagazineScene
          text={scene.voiceover || scene.textOverlay || ""}
          imageUrl={scene.imageUrl ? getDirectStorageUrl(scene.imageUrl) : null}
          videoUrl={
            scene.videoClipUrl ? getDirectStorageUrl(scene.videoClipUrl) : null
          }
        />
        {/* Render audio if available */}
        {scene.audioUrl && (
          <Audio
            src={getDirectStorageUrl(scene.audioUrl)}
            volume={1.0}
            delayRenderTimeoutInMilliseconds={300000}
          />
        )}
      </AbsoluteFill>
    );
  }

  if (visualMode === "text_motion" || visualMode === "gif_voice") {
    return (
      <AbsoluteFill>
        <TextMotionScene
          text={scene.voiceover || scene.textOverlay || ""}
          videoUrl={scene.imageUrl ? getDirectStorageUrl(scene.imageUrl) : null}
        />
        {/* Render audio if available (enabled for gif_voice) */}
        {scene.audioUrl && (
          <Audio
            src={getDirectStorageUrl(scene.audioUrl)}
            volume={1.0}
            delayRenderTimeoutInMilliseconds={300000}
          />
        )}
      </AbsoluteFill>
    );
  }

  // Check if scene has sub-scenes for multi-visual sequence
  const hasSubScenes = scene.subScenes && scene.subScenes.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Background Image / Video Clip */}
      {hasSubScenes ? (
        // NEW: Render sub-scene sequence with rapid visual cuts
        <Series>
          {scene.subScenes!.map((subScene, index) => {
            const subDurationInFrames = Math.round(subScene.duration * fps);
            return (
              <Series.Sequence
                key={subScene.id || `sub-${index}`}
                durationInFrames={subDurationInFrames}
              >
                <SubSceneVisual
                  imageUrl={subScene.imageUrl || ""}
                  duration={subScene.duration}
                />
              </Series.Sequence>
            );
          })}
        </Series>
      ) : (
        // Legacy: Single image/video for entire scene
        <AbsoluteFill
          style={{
            transform: scene.videoClipUrl ? undefined : `scale(${scale})`,
          }}
        >
          {scene.videoClipUrl ? (
            <Video
              src={getDirectStorageUrl(scene.videoClipUrl)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              delayRenderTimeoutInMilliseconds={300000}
            />
          ) : scene.imageUrl ? (
            <Img
              src={getDirectStorageUrl(scene.imageUrl)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              delayRenderTimeoutInMilliseconds={300000}
            />
          ) : null}
        </AbsoluteFill>
      )}

      {/* Dark Overlay for text legibility */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 40%)",
        }}
      />

      {/* Text Overlay - DISABLED: Visuals + audio are sufficient, captions can be added later */}
      {/*
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 50,
          right: 50,
          opacity,
          color: "white",
          fontSize: 64,
          fontWeight: "bold",
          textAlign: "center",
          textShadow: "0 4px 12px rgba(0,0,0,0.5)",
          fontFamily,
        }}
      >
        {scene.textOverlay || scene.voiceover}
      </div>
      */}

      {/* Watermark Overlay */}
      {WATERMARK_CONFIG.enabled && (
        <div
          style={{
            position: "absolute",
            bottom: WATERMARK_CONFIG.padding,
            right: WATERMARK_CONFIG.padding,
            opacity: WATERMARK_CONFIG.opacity,
          }}
        >
          <Img
            src={staticFile("logos/ideatovideo-icon.png")}
            style={{
              width: WATERMARK_CONFIG.size,
              height: WATERMARK_CONFIG.size,
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {/* Audio Playback - Continuous across all sub-scenes */}
      {scene.audioUrl && (
        <Audio
          src={getDirectStorageUrl(scene.audioUrl)}
          volume={1.0}
          delayRenderTimeoutInMilliseconds={300000}
        />
      )}
    </AbsoluteFill>
  );
};
