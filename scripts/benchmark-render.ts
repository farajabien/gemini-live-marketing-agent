import { renderVideoWithFFmpeg } from "../lib/ffmpeg/renderer";
import { VideoPlan, Scene } from "../lib/types";
import { join } from "path";
import { tmpdir } from "os";

async function runBenchmark() {
  const plan: VideoPlan = {
    title: "Benchmark Video",
    tone: "professional",
    type: "video",
    scenes: [
      {
        id: "1",
        duration: 3,
        voiceover: "The first scene of our optimized render pipeline.",
        visualPrompt: "A beautiful sunrise",
        imageUrl: "https://picsum.photos/1080/1920?random=1",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
      {
        id: "2",
        duration: 3,
        voiceover: "Notice how the assets are downloaded in parallel now.",
        visualPrompt: "Busy city street",
        imageUrl: "https://picsum.photos/1080/1920?random=2",
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Duplicate to test caching
      },
      {
        id: "3",
        duration: 3,
        voiceover: "And the scene rendering is parallelized too.",
        visualPrompt: "Abstract blue background",
        imageUrl: "https://picsum.photos/1080/1920?random=1", // Duplicate image
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      }
    ]
  };

  const outputPath = join(tmpdir(), `benchmark-${Date.now()}.mp4`);
  
  console.log("Starting benchmark render...");
  const start = Date.now();
  
  await renderVideoWithFFmpeg(plan, outputPath, {
    format: "9:16",
    resolution: "1080p",
    fps: 30,
    videoBitrate: "3M",
    audioBitrate: "192k",
    forceRerender: false,
    enableCache: true,
    useGPU: true,
  }, (progress) => {
    console.log(`[Progress] Phase: ${progress.phase}, Complete: ${progress.completedScenes}/${progress.totalScenes}`);
  });
  
  const end = Date.now();
  console.log(`\nBenchmark completed in ${((end - start) / 1000).toFixed(2)}s`);
  console.log(`Output saved to: ${outputPath}`);
}

runBenchmark().catch(console.error);
