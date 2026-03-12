import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Video,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "800"],
  subsets: ["latin"],
});

interface TextMotionSceneProps {
  text: string;
  videoUrl: string | null;
  isCurrentScene?: boolean;
}

export const TextMotionScene: React.FC<TextMotionSceneProps> = ({
  text,
  videoUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Background Animation (Subtle Zoom)
  const scale = interpolate(frame, [0, 120], [1, 1.05], {
    extrapolateRight: "clamp",
  });

  // Text Animation (Staggered Fade & Slide)
  const lines = text.split("\n");

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background Layer */}
      {videoUrl ? (
        <AbsoluteFill style={{ transform: `scale(${scale})` }}>
          <Video
            src={videoUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.6, // Dimmed for text readability
            }}
            loop
            muted
            delayRenderTimeoutInMilliseconds={300000}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.4)", // Overlay
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{ background: "linear-gradient(to bottom, #1a1a2e, #16213e)" }}
        />
      )}

      {/* Text Layer */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
          fontFamily,
          textAlign: "center",
        }}
      >
        {lines.map((line, i) => {
          const delay = i * 15; // 0.5s stagger

          const opacity = spring({
            frame: frame - delay,
            fps,
            config: { damping: 200 },
          });

          const translateY = interpolate(
            spring({ frame: frame - delay, fps, config: { damping: 10 } }),
            [0, 1],
            [30, 0],
          );

          return (
            <h1
              key={i}
              style={{
                color: "white",
                fontSize: 50 + (lines.length > 2 ? 0 : 20), // Adjust size based on density
                fontWeight: 800,
                lineHeight: 1.3,
                margin: "10px 0",
                opacity,
                transform: `translateY(${translateY}px)`,
                textShadow: "0 2px 10px rgba(0,0,0,0.5)",
              }}
            >
              {line}
            </h1>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
