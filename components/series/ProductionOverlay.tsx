"use client";

import { useEffect, useState } from "react";
import { Episode } from "@/lib/types";

interface ProductionOverlayProps {
  episode: Episode | null;
  onRetry?: () => void;
}

const PRODUCTION_PHASES = [
  "Analyzing Narrative Beats",
  "Synthesizing Continuity",
  "Orchestrating Visual Assets",
  "Generating Storyboard Frames",
  "Rendering Cinematic Sequences",
  "Preparing Final Production",
];

export function ProductionOverlay({ episode, onRetry }: ProductionOverlayProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!episode || episode.status === 'failed') return;
    
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % PRODUCTION_PHASES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [episode]);

  if (!episode) return null;

  const isFailed = episode.status === 'failed';

  // Handle manual removal of failed status to close overlay
  const handleClose = () => {
    // We transactionally move it back to draft or script_ready so it can be retried
    // but for the UI to close immediately we just rely on the parent's find() logic
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 pointer-events-none">
      {/* Immersive Backdrop - now localized */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-700 pointer-events-auto" />
      
      {/* Content Container - Centered Console Card */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full p-12 rounded-[3.5rem] bg-[#080911]/90 border border-white/10 shadow-2xl backdrop-blur-3xl animate-in zoom-in-95 fade-in duration-500 pointer-events-auto">
        
        {/* Animated Gradient Grids (Localized to Card) */}
        <div className="absolute inset-0 opacity-10 pointer-events-none rounded-[3.5rem] overflow-hidden">
          <div className="absolute inset-[-100%] bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.2),transparent_50%)] animate-pulse" />
        </div>

        {/* Cinematic Loader or Error Icon */}
        <div className="relative mb-10">
            {isFailed ? (
              <div className="h-20 w-20 rounded-full border-2 border-red-500/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-red-500 animate-pulse">warning</span>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-full border-2 border-blue-500/20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-t-2 border-blue-600 animate-spin" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-2 rounded-full border-b-2 border-purple-600 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                  <span className="material-symbols-outlined text-3xl text-blue-500 animate-pulse">movie_edit</span>
              </div>
            )}
            <div className={`absolute -inset-4 rounded-full ${isFailed ? 'bg-red-600/10' : 'bg-blue-600/10'} blur-xl animate-pulse`} />
        </div>

        {/* Dynamic Status */}
        <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
                <span className={`text-[9px] font-black uppercase tracking-[0.4em] ${isFailed ? 'text-red-500' : 'text-blue-500 animate-pulse'}`}>
                    {isFailed ? 'Production Halted' : 'Production Console'}
                </span>
                <h2 className="text-3xl font-black tracking-tighter text-white">
                    {episode.title}
                </h2>
            </div>

            <div className="flex flex-col items-center gap-6 pt-6">
                <div className={`px-6 py-3 rounded-full bg-white/5 border ${isFailed ? 'border-red-500/20' : 'border-white/10'} flex items-center gap-3`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${isFailed ? 'bg-red-500' : 'bg-blue-500 animate-ping'}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${isFailed ? 'text-red-400' : 'text-slate-300'}`}>
                        {isFailed ? 'Gemini Quota Exhausted' : PRODUCTION_PHASES[phaseIndex]}
                    </span>
                </div>
                
                <p className="text-slate-500 text-[10px] font-medium max-w-xs leading-relaxed">
                    {isFailed 
                      ? "You've hit the Gemini TTS rate limit. Please retry this episode in a few minutes once the quota window resets."
                      : "Crafting cinematic visuals from your narrative..."}
                </p>

                {isFailed && (
                  <button 
                    onClick={onRetry}
                    className="mt-4 px-8 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all pointer-events-auto"
                  >
                    Close console
                  </button>
                )}
            </div>
        </div>

        {/* Progress indicator localized to card bottom */}
        {!isFailed && (
          <div className="absolute bottom-0 left-0 w-full px-12 pb-8">
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                      style={{ width: `${((phaseIndex + 1) / PRODUCTION_PHASES.length) * 100}%` }}
                  />
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
