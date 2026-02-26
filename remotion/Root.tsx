import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { Main } from "./Main";
import { MainSchema, MainProps } from "./Schema";

const RemotionRoot: React.FC = () => {
  const calculateMetadata: CalculateMetadataFunction<MainProps> = async ({ props }) => {
    const fps = 30;
    const totalDuration = props.plan.scenes.reduce(
      (acc: number, scene: any) => acc + (scene.duration || 5),
      0
    );
    const isCarousel = props.plan.type === "carousel";
    return {
      durationInFrames: Math.max(1, Math.round(totalDuration * fps)),
      width: 1080,
      height: isCarousel ? 1080 : 1920,
    };
  };

  return (
    <>
      <Composition
        id="Video"
        component={Main}
        durationInFrames={30 * 30} // Default 30s, overridden by calculateMetadata
        fps={30}
        width={1080}
        height={1920}
        schema={MainSchema}
        defaultProps={{
          plan: {
            title: "Test Video",
            scenes: [],
            type: "video"
          }
        }}
        calculateMetadata={calculateMetadata}
      />
    </>
  );
};

export default RemotionRoot;
