import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toBlob } from "html-to-image";
import type { Scene, VideoPlan } from "@/lib/types";

function decodeDataUri(dataUri: string): Blob | null {
  const parts = dataUri.split(",");
  const base64Data = parts[1];
  if (!base64Data) return null;
  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: "audio/mpeg" });
  } catch (err) {
    console.error("Failed to decode data URI", err);
    return null;
  }
}

// import { db, APP_ID } from "@/lib/instant-client"; // Clean up unused imports later if needed

async function fetchStorageBlob(path: string): Promise<Blob | null> {
  try {
    const isFullUrl = path.startsWith("http");
    const param = isFullUrl ? "url" : "path";
    
    // Use the streaming proxy which handles redirects and CORS
    const resp = await fetch(`/api/proxy-image?${param}=${encodeURIComponent(path)}`);

    if (resp.ok) return resp.blob();
    console.error(`Storage fetch failed for ${path}:`, resp.status);
    return null;
  } catch (err) {
    console.error("Storage fetch errored", err);
    return null;
  }
}

export async function downloadPlanAssets(plan: VideoPlan, carouselElement: HTMLElement | null, authToken?: string | null) {
  const isCarousel = plan.type === "carousel";

  try {
    // For video plans, try to generate full MP4 (even if silent)
    if (!isCarousel && plan.id) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch("/api/generate-video", {
          method: "POST",
          headers,
          body: JSON.stringify({ planId: plan.id }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Video generation failed");
        }

        const blob = await response.blob();
        saveAs(blob, `ideatovideo-${plan.title.substring(0, 20).replace(/[^a-z0-9]/gi, "-")}.mp4`);
        return;
      } catch (videoError) {
        console.error("Video generation failed, falling back to ZIP:", videoError);
        // Fall through to ZIP generation
      }
    }

    // Fallback: Generate ZIP with assets
    if (!carouselElement) {
      throw new Error("Renderer not ready. Please wait for the preview to load.");
    }

    const zip = new JSZip();
    const slides = Array.from(carouselElement.children) as HTMLElement[];

    if (slides.length === 0) {
      throw new Error("No slides found. Please wait for content to generate.");
    }

    // Wait for all images in slides to load before capturing
    console.log(`Waiting for images to load in ${slides.length} slides...`);
    const imageLoadPromises = slides.map((slide, slideIndex) => {
      const images = slide.querySelectorAll('img');
      return Promise.all(
        Array.from(images).map((img, imgIndex) => {
          if (img.complete && img.naturalHeight > 0) return Promise.resolve();
          
          return new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => {
              console.error(`Image load failed for slide ${slideIndex + 1}, img ${imgIndex}: ${img.src}`);
              // Don't reject - just log and continue
              resolve();
            };
            
            // 30s timeout - if an image takes longer, skip it and continue
            setTimeout(() => {
              console.warn(`Image load timeout for slide ${slideIndex + 1}: ${img.src}`);
              resolve(); // Don't block the entire download
            }, 30000); // Reduced from 90s
          });
        })
      );
    });
    
    await Promise.all(imageLoadPromises);
    console.log(`✓ All available images loaded`);

    // Capture slides to blobs
    console.log(`Capturing ${slides.length} slides...`);
    const slideBlobs = await Promise.all(
      slides.map(async (slide, index) => {
        const blob = await toBlob(slide, {
          cacheBust: true,
          pixelRatio: 2,
          fontEmbedCSS: "",
        });
        if (!blob) {
          throw new Error(`Failed to capture slide ${index + 1}`);
        }
        zip.file(`scene-${index + 1}.png`, blob);
        console.log(`✓ Captured slide ${index + 1}/${slides.length}`);
        return blob;
      })
    );
    await Promise.all(slideBlobs);

    // Download raw images (without text overlays) from InstantDB storage
    console.log(`Downloading ${plan.scenes.length} raw images...`);
    const rawImagePromises = plan.scenes.map(async (scene: Scene, i: number) => {
      if (!scene.imageUrl) {
        console.warn(`Scene ${i + 1} has no imageUrl, skipping raw image`);
        return;
      }

      try {
        // Fetch raw image from storage
        const imageBlob = await fetchStorageBlob(scene.imageUrl);
        if (imageBlob) {
          zip.file(`raw-images/scene-${i + 1}.png`, imageBlob);
          console.log(`✓ Downloaded raw image ${i + 1}/${plan.scenes.length}`);
        }
      } catch (err) {
        console.error(`Failed to download raw image for scene ${i + 1}:`, err);
      }
    });
    await Promise.all(rawImagePromises);

    // Add captions as JSON for easy import into video editors / social platforms
    const captions = plan.scenes.map((scene: Scene, i: number) => ({
      sceneNumber: i + 1,
      title: scene.textOverlay || "",
      voiceover: scene.voiceover || "",
      visualPrompt: scene.visualPrompt || "",
      duration: scene.duration || 0,
    }));
    zip.file("captions.json", JSON.stringify(captions, null, 2));

    const scriptContent = plan.scenes
      .map((scene: Scene, i: number) => `Scene ${i + 1}:\nVisual: ${scene.visualPrompt}\nAudio: ${scene.voiceover}\n`)
      .join("\n---\n");
    zip.file("script.txt", scriptContent);

    if (!isCarousel) {
      const audioPromises = plan.scenes.map(async (scene: Scene, i: number) => {
        if (!scene.audioUrl) return;

        let audioBlob: Blob | null = null;
        if (scene.audioUrl.startsWith("data:")) {
          audioBlob = decodeDataUri(scene.audioUrl);
        } else {
          audioBlob = await fetchStorageBlob(scene.audioUrl);
        }

        if (audioBlob) {
          zip.file(`audio-${i + 1}.mp3`, audioBlob);
        }
      });
      await Promise.all(audioPromises);
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `ideatovideo-${plan.type}-${plan.title.substring(0, 20).replace(/[^a-z0-9]/gi, "-")}.zip`);
  } catch (err) {
    // Enhanced error logging
    console.error("Download failed:", err);
    console.error("Error stack:", err instanceof Error ? err.stack : 'No stack');
    console.error("Error type:", Object.prototype.toString.call(err));
    
    const message = err instanceof Error ? err.message : 
      (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err));
    
    throw new Error(`Failed to download: ${message}`);
  }
}
