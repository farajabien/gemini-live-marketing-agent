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
      { id: "1", duration: 3, voiceover: "Scene 1", visualPrompt: "Sunrise", imageUrl: "https://picsum.photos/1080/1920?random=1", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "2", duration: 3, voiceover: "Scene 2", visualPrompt: "City", imageUrl: "https://picsum.photos/1080/1920?random=2", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "3", duration: 3, voiceover: "Scene 3", visualPrompt: "Ocean", imageUrl: "https://picsum.photos/1080/1920?random=3", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "4", duration: 3, voiceover: "Scene 4", visualPrompt: "Mountains", imageUrl: "https://picsum.photos/1080/1920?random=4", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "5", duration: 3, voiceover: "Scene 5", visualPrompt: "Forest", imageUrl: "https://picsum.photos/1080/1920?random=5", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "6", duration: 3, voiceover: "Scene 6", visualPrompt: "Space", imageUrl: "https://picsum.photos/1080/1920?random=3", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "7", duration: 3, voiceover: "Scene 7", visualPrompt: "Cyberpunk", imageUrl: "https://picsum.photos/1080/1920?random=7", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "8", duration: 3, voiceover: "Scene 8", visualPrompt: "Nature", imageUrl: "https://picsum.photos/1080/1920?random=8", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "9", duration: 3, voiceover: "Scene 9", visualPrompt: "Abstract", imageUrl: "https://picsum.photos/1080/1920?random=9", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
      { id: "10", duration: 3, voiceover: "Scene 10", visualPrompt: "Final", imageUrl: "https://picsum.photos/1080/1920?random=1", audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
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
