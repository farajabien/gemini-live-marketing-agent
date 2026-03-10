"use client";

import type { VideoPlan } from "@/lib/types";
import React, { useEffect, useState, useRef } from "react";
import { useInterval } from "react-use";
import Image from "next/image";

interface VideoPreviewProps {
  plan: VideoPlan;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ plan }) => {
  const scenes = plan.scenes || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMutedByAutoplay, setIsMutedByAutoplay] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Determine if we should use auto-timer
  const hasAudio = !!scenes[currentIndex]?.audioUrl;

  // Auto-play timer (Only if NO audio for this slide)
  useInterval(
    () => {
      setCurrentIndex((prev) => (prev + 1) % (scenes.length || 1));
    },
    isPlaying && !hasAudio && scenes.length > 0 ? 4000 : null
  );

  const slide = scenes[currentIndex];

  // Handle audio playback when slide changes
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let isCancelled = false;

    // Async helper to play
    const playAudio = async () => {
      // Stop previous
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current = null;
      }

      if (slide?.audioUrl && isPlaying && !plan.videoUrl) {
        try {
          // Resolve storage path via proxy (handles Firebase Storage access)
          const audioUrl = (slide.audioUrl.startsWith("http") || slide.audioUrl.startsWith("data:"))
            ? slide.audioUrl
            : `/api/proxy-image?path=${encodeURIComponent(slide.audioUrl)}`;

          const audio = new Audio(audioUrl);
          audio.volume = 1.0;
          activeAudio = audio;

          // Sync slide duration with audio duration
          audio.onended = () => {
            if (!isCancelled) {
               setCurrentIndex((prev) => (prev + 1) % (scenes.length || 1));
            }
          };

          audioElementRef.current = audio;

          // Wrapped in a promise to handle play() rejection (AbortError or NotAllowedError)
          await audio.play();
          setIsMutedByAutoplay(false); // Success! Browsers allows audio now
        } catch (err: any) {
          if (err.name === "AbortError") return;
          if (err.name === "NotAllowedError") {
            console.warn("Autoplay blocked: user must interact first");
            setIsMutedByAutoplay(true);
            return;
          }
          console.error("Error playing audio:", err);
        }
      }
    };

    playAudio();

    return () => {
      isCancelled = true;
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      }
    };
  }, [currentIndex, slide?.audioUrl, isPlaying, scenes.length, plan.videoUrl]);

  // Cleanup audio when playing state changes
  useEffect(() => {
    if (!isPlaying && audioElementRef.current) {
      audioElementRef.current.pause();
    }
  }, [isPlaying]);

  // Sync video muted state with isPlaying toggle
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isPlaying;
    }
  }, [isPlaying]);

  if (scenes.length === 0 && !plan.videoUrl) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <p className="text-slate-500 text-sm">Loading scenes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 h-full w-full max-h-full">
      {/* Video "Frame" Container */}
      <div className="relative h-full aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800 group shrink min-h-0">
        
        {plan.videoUrl ? (
          /* Actual Video Preview */
          <video
             ref={videoRef}
             key={plan.videoUrl}
             src={`/api/proxy-image?path=${encodeURIComponent(plan.videoUrl)}`}
             autoPlay
             loop
             muted
             playsInline
             onLoadedData={() => videoRef.current?.play().catch(() => {})}
             className="absolute inset-0 w-full h-full object-cover z-0"
          />
        ) : (
          /* Slideshow Fallback */
          <div className="flex-1 relative overflow-hidden flex items-center justify-center h-full">
            {/* Play/Pause Overlay */}
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <span className="material-symbols-outlined text-white text-5xl drop-shadow-lg">
                    {isPlaying ? "pause_circle" : "play_circle"}
                </span>
            </button>

            {/* Autoplay / Unmute Overlay */}
            {isMutedByAutoplay && isPlaying && (
              <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMutedByAutoplay(false);
                    // This interaction will allow the next audio.play() to succeed
                    if (audioElementRef.current) {
                      audioElementRef.current.play().catch(err => console.error("Manual play failed:", err));
                    }
                  }}
                  className="flex flex-col items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md px-8 py-6 rounded-3xl transition-all hover:scale-105 active:scale-95 group"
                >
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-xl group-hover:shadow-white/20">
                    <span className="material-symbols-outlined text-black text-4xl">volume_up</span>
                  </div>
                  <div className="text-white">
                    <p className="font-black uppercase tracking-widest text-xs">Tap to Unmute</p>
                    <p className="text-[10px] opacity-70 mt-0.5">Start listening</p>
                  </div>
                </button>
              </div>
            )}

            {/* Rendering Overlay */}
            {plan.status === 'rendering' && (
               <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                   <span className="material-symbols-outlined text-white animate-spin text-4xl mb-3">refresh</span>
                   <p className="text-white font-bold text-sm">Rendering High Quality Preview...</p>
                   <p className="text-white/60 text-[10px] mt-1 italic">This takes a few seconds but ensures perfect smoothness</p>
               </div>
            )}

            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-800 z-30 flex gap-0.5">
                {scenes.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-full flex-1 transition-colors duration-300 ${
                            idx === currentIndex ? "bg-white" : idx < currentIndex ? "bg-white/50" : "bg-white/10"
                        }`} 
                    />
                ))}
            </div>

            {/* Preload next image in a hidden div if it exists */}
            {/* Preload next image in a hidden div if it exists AND is not a video */}
            {(() => {
                const next = scenes[currentIndex + 1];
                if (!next?.imageUrl) return null;
                
                const rawUrl = next.imageUrl;
                const isVideo = rawUrl.includes(".mp4") || rawUrl.includes("giphy.com");
                if (isVideo) return null; // Don't preload videos with Next.js Image

                const isStoragePath = !rawUrl.startsWith('http') && !rawUrl.startsWith('data:');
                const src = isStoragePath 
                  ? `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`
                  : (rawUrl.startsWith('data:') ? rawUrl : `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`);

                return (
                    <Image
                        width={100}
                        height={100} 
                        src={src}
                        className="hidden"
                        alt="preload"
                        unoptimized
                    />
                );
            })()}

            {slide.imageUrl ? (
              (() => {
                const rawUrl = slide.imageUrl!;
                const isVideo = rawUrl.includes(".mp4") || rawUrl.includes("giphy");
                
                const src = (() => {
                    if (rawUrl.startsWith('data:')) return rawUrl;
                    if (rawUrl.includes("giphy.com")) return rawUrl; // Bypass proxy for Giphy
                    
                    const isStoragePath = !rawUrl.startsWith('http');
                    return isStoragePath 
                        ? `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`
                        : `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
                })();

                if (isVideo) {
                    return (
                        <video
                            key={currentIndex} // Reset on slide change
                            src={src}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover z-0 opacity-60" // Dimmed like TextMotionScene
                        />
                    );
                }

                return (
                  <Image
                    width={1080}
                    height={1920} 
                    key={currentIndex}
                    src={src}
                    alt={`Scene ${currentIndex + 1}`}
                    className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-[12000ms] ease-out scale-110"
                    unoptimized
                  />
                );
              })()
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-0">
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <span className="material-symbols-outlined text-slate-700 animate-pulse text-6xl">image</span>
                  <p className="text-slate-500 text-sm font-medium">Generating Visuals...</p>
                </div>
              </div>
            )}
            
            {/* Dark Overlay - Stronger at bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

            {/* Text Content */}
            <div className="absolute bottom-0 left-0 w-full p-6 z-20 flex flex-col gap-3">
                <h3 className="text-white font-bold text-xl leading-snug drop-shadow-md line-clamp-4">
                    {slide.textOverlay || slide.voiceover}
                </h3>
            </div>
          </div>
        )}
      </div>

      {/* External Controls / Info - simplified */}
      <div className="flex justify-between w-full text-xs text-slate-500 font-mono px-2">
        <span>{plan.videoUrl ? "HQ Preview Mode" : `${plan.type === 'carousel' ? 'Slide' : 'Scene'} ${currentIndex + 1}/${scenes.length}`}</span>
        <div className="flex items-center gap-2">
          {plan.type !== 'carousel' && (
            <>
              {isPlaying ? (
                <button onClick={() => setIsPlaying(false)} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xs">volume_up</span> Audio On
                </button>
              ) : (
                <button onClick={() => setIsPlaying(true)} className="flex items-center gap-1 text-slate-600 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-xs">volume_off</span> Muted
                </button>
              )}
            </>
          )}
          <span>{plan.type === 'carousel' ? (isPlaying ? "Auto-playing" : "Paused") : (plan.videoUrl ? "MP4" : (isPlaying ? "Playing..." : "Paused"))}</span>
        </div>
      </div>
    </div>
  );
};
