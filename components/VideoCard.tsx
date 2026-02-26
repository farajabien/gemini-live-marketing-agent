"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  src?: string;
  thumbnail: string;
  title: string;
  subtitle?: string;
  aspectRatio?: "video" | "portrait" | "square";
  className?: string;
}

export function VideoCard({
  src,
  thumbnail,
  title,
  subtitle,
  aspectRatio = "video",
  className,
}: VideoCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isHovering && src) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isHovering, src]);

  const aspectClass = {
    video: "aspect-video",
    portrait: "aspect-[9/16]",
    square: "aspect-square",
  }[aspectRatio];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[2.5rem] bg-black border border-white/5 transition-all duration-700 hover:border-red-500/40 hover:shadow-[0_0_50px_rgba(220,38,38,0.15)]",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className={cn("relative w-full h-full", aspectClass)}>
        {/* Shimmer Loader */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        )}

        {/* Thumbnail */}
        <Image
          src={thumbnail}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onLoad={() => setIsLoading(false)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-all duration-1000",
            isPlaying ? "opacity-0 scale-110" : "opacity-100 scale-100",
            isHovering && !isPlaying && "scale-105"
          )}
        />

        {/* Video Overlay */}
        {src && (
          <video
            ref={videoRef}
            src={src}
            loop
            muted
            playsInline
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-all duration-1000",
              isPlaying ? "opacity-100 scale-100" : "opacity-0 scale-110"
            )}
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-[#050510]/20 to-transparent opacity-80 pointer-events-none group-hover:opacity-90 transition-opacity duration-500" />

        {/* Content */}
        <div className="absolute bottom-8 left-8 right-8 transition-transform duration-500 group-hover:translate-y-[-4px]">
          <p className="text-white font-black text-xl leading-tight mb-2 tracking-tight group-hover:text-red-400 transition-colors duration-500">{title}</p>
          {subtitle && (
            <p className="text-[#929bc9] text-sm font-bold tracking-wide uppercase opacity-70 group-hover:opacity-100 transition-opacity duration-500">{subtitle}</p>
          )}
        </div>

        {/* Play Icon (Small) */}
        {!isPlaying && src && (
          <div className="absolute top-8 right-8 h-12 w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all duration-500 group-hover:scale-110 group-hover:bg-red-600 group-hover:border-red-500">
            <Play className="h-5 w-5 fill-current" />
          </div>
        )}
      </div>
    </div>
  );
}
