import { Series } from "remotion";
import { SceneComponent } from "./Scene";
import { MainProps } from "./Schema";

export const Main: React.FC<MainProps> = ({ plan }) => {
  const fps = 30;

  return (
    <Series>
      {plan.scenes.map((scene, index) => {
        const durationInFrames = Math.round(scene.duration * fps);
        // Premount 15 frames (0.5s) before scene starts to preload assets
        // This eliminates frame drops and speeds up rendering by ~10-15s
        const premountFrames = 15;

        return (
          <Series.Sequence
            key={scene.id || index}
            durationInFrames={durationInFrames}
            premountFor={premountFrames}
          >
            <SceneComponent scene={scene} visualMode={plan.visualMode} />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};
