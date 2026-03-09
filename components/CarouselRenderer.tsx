import { LOGO } from "@/lib/branding";
import React, { forwardRef } from "react";
import { VideoPlan } from "@/lib/types";
import Image from "next/image";


interface CarouselRendererProps {
  plan: VideoPlan;
}

export const CarouselRenderer = forwardRef<HTMLDivElement, CarouselRendererProps>(
  ({ plan }, ref) => {
    return (
      <div ref={ref} className="fixed top-0 left-0 -z-50 pointer-events-none opacity-0">
        {/* We render ALL slides at once in a hidden container so we can capture them individually */}
        {(plan.scenes || []).map((slide, index) => (
          <div
            key={slide.id || index}
            id={`slide-${index}`}
            className="w-[1080px] h-[1350px] relative overflow-hidden bg-black text-white flex flex-col justify-between p-16"
          >
            {/* Background Image (Prioritize DALL-E/Gemini, fallback to Pollinations) */}
            <Image 
            width={100}
            height={100}
              src={(() => {
                  const rawUrl = slide.imageUrl;
                  if (!rawUrl) return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221080%22 height=%221350%22%3E%3Crect width=%221080%22 height=%221350%22 fill=%22%231e293b%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23475569%22 font-size=%2248%22%3EGenerating...%3C/text%3E%3C/svg%3E';
                  
                  // For data URIs, use directly
                  if (rawUrl.startsWith('data:')) return rawUrl;
                  
                  // For HTTP URLs, proxy them through our streaming proxy
                  if (rawUrl.startsWith('http')) return `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
                  
                  // For Firebase storage paths, use path parameter (resolved via proxy)
                  // The proxy will now stream the response, satisfying CORS
                  return `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`;
              })()}
              alt={slide.visualPrompt}
              className="absolute inset-0 w-full h-full object-cover z-0"
              crossOrigin="anonymous"
              unoptimized
            />
            
            {/* Dark Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30 z-0"></div>

            {/* Header */}
            <div className="flex justify-between items-center z-10 w-full">
              <span className="text-3xl font-bold tracking-wider opacity-90 uppercase text-white drop-shadow-md">
                {index === 0 ? "Swipe ->" : `${index + 1} / ${(plan.scenes || []).length}`}
              </span>
              <span className="px-4 py-2 bg-white/10 rounded-full text-2xl font-bold backdrop-blur-md text-white border border-white/20 flex items-center gap-2">
                <Image width={100} height={100} src={LOGO.icon} alt={LOGO.alt} className="h-7 w-7 rounded-md" style={{ height: 'auto', width: 'auto' }} />
                IdeaToVideo
              </span>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-12 z-10 w-full px-8">
              <h2
                className="text-7xl font-black leading-tight drop-shadow-2xl text-white"
                style={{ textWrap: "balance" as React.CSSProperties["textWrap"], textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
              >
                 {/* For the first slide, use Title as main text if available, otherwise voiceover */}
                 {index === 0 && plan.title ? plan.title : (slide.textOverlay || slide.voiceover)}
              </h2>
              
              {/* If first slide has separate title vs hook, show hook smaller */}
              {index === 0 && plan.title && (slide.textOverlay || slide.voiceover) && (
                 <p className="text-4xl font-bold opacity-100 leading-relaxed max-w-[900px] text-white drop-shadow-xl bg-black/30 p-4 rounded-xl backdrop-blur-sm">
                    {slide.textOverlay || slide.voiceover}
                 </p>
              )}
              
              {/* For other slides, if textOverlay is different from voiceover/caption, show it */}
              {index > 0 && slide.textOverlay && slide.textOverlay !== slide.voiceover && (
                  <p className="text-4xl font-bold opacity-100 leading-relaxed max-w-[900px] text-white drop-shadow-xl bg-black/30 p-4 rounded-xl backdrop-blur-sm">
                      {slide.voiceover}
                  </p>
              )}
            </div>
            
            {/* DELETED: Visual Concept Box */}

          </div>
        ))}
      </div>
    );
  }
);

CarouselRenderer.displayName = "CarouselRenderer";
