"use client";

import { Episode } from "@/lib/types";

export interface EpisodeProgress {
  episodeId: string;
  title: string;
  episodeNumber: number;
  phase: 'visuals' | 'audio' | 'rendering' | 'complete';
  visualsDone: number;
  audioDone: number;
  totalScenes: number;
}

const PHASE_LABELS: Record<EpisodeProgress['phase'], string> = {
  visuals: "Step 1/3 — Generating Visuals",
  audio: "Step 2/3 — Synthesizing Audio",
  rendering: "Step 3/3 — Compiling Video",
  complete: "Complete",
};

const PHASE_ESTIMATES: Record<EpisodeProgress['phase'], string> = {
  visuals: "~1-2 min",
  audio: "~30s",
  rendering: "~3-5 min",
  complete: "",
};

const PHASE_ORDER: EpisodeProgress['phase'][] = ['visuals', 'audio', 'rendering', 'complete'];

interface ProductionOverlayProps {
  episodes: Episode[];
  progress: Record<string, EpisodeProgress>;
  onRetry?: (episode: Episode) => void;
}

export function ProductionOverlay({ episodes, progress, onRetry }: ProductionOverlayProps) {
  if (episodes.length === 0) return null;

  const hasAnyFailed = episodes.some(e => e.status === 'failed');
  const generatingEps = episodes.filter(e => e.status === 'generating');
  const failedEps = episodes.filter(e => e.status === 'failed');

  // Overall progress across all episodes
  const totalItems = generatingEps.length * 3; // visuals + audio + render per episode
  const doneItems = generatingEps.reduce((sum, ep) => {
    const p = progress[ep.id];
    if (!p) return sum;
    const phaseIdx = PHASE_ORDER.indexOf(p.phase);
    return sum + phaseIdx;
  }, 0);
  const overallPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 pointer-events-none">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-700 pointer-events-auto" />
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full p-10 rounded-[3.5rem] bg-[#080911]/90 border border-white/10 shadow-2xl backdrop-blur-3xl animate-in zoom-in-95 fade-in duration-500 pointer-events-auto">
        
        {/* Animated background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none rounded-[3.5rem] overflow-hidden">
          <div className="absolute inset-[-100%] bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.2),transparent_50%)] animate-pulse" />
        </div>

        {/* Header icon */}
        <div className="relative mb-8">
          {hasAnyFailed ? (
            <div className="h-16 w-16 rounded-full border-2 border-red-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-red-500 animate-pulse">warning</span>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full border-2 border-blue-500/20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-t-2 border-blue-600 animate-spin" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-2 rounded-full border-b-2 border-purple-600 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              <span className="material-symbols-outlined text-2xl text-blue-500">movie_edit</span>
            </div>
          )}
          <div className={`absolute -inset-4 rounded-full ${hasAnyFailed ? 'bg-red-600/10' : 'bg-blue-600/10'} blur-xl animate-pulse`} />
        </div>

        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-500 mb-2">
          Series Generation
        </span>
        <h2 className="text-xl font-black tracking-tight text-white mb-6">
          {generatingEps.length > 0
            ? `Generating ${generatingEps.length} Episode${generatingEps.length > 1 ? 's' : ''}`
            : 'Generation Halted'}
        </h2>

        {/* Per-episode progress rows */}
        <div className="w-full space-y-3 mb-8">
          {episodes.map(ep => {
            const p = progress[ep.id];
            const isFailed = ep.status === 'failed';
            const phaseIdx = p ? PHASE_ORDER.indexOf(p.phase) : 0;
            const sceneProg = p
              ? p.phase === 'visuals'
                ? `${p.visualsDone}/${p.totalScenes} scenes`
                : p.phase === 'audio'
                  ? `${p.audioDone}/${p.totalScenes} tracks`
                  : ''
              : '';

            return (
              <div key={ep.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 border border-white/5">
                <span className="text-[10px] font-black text-slate-500 w-6 shrink-0">
                  E{ep.episodeNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white truncate">{ep.title}</span>
                    {isFailed ? (
                      <button
                        onClick={() => onRetry?.(ep)}
                        className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors ml-2 shrink-0"
                      >
                        Retry
                      </button>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 ml-2 shrink-0">
                        {p ? PHASE_LABELS[p.phase] : 'Queued'}
                        {sceneProg && <span className="text-slate-500 ml-1">({sceneProg})</span>}
                        {p && PHASE_ESTIMATES[p.phase] && (
                          <span className="text-slate-600 ml-1">{PHASE_ESTIMATES[p.phase]}</span>
                        )}
                      </span>
                    )}
                  </div>
                  {/* Mini progress bar */}
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isFailed
                          ? 'bg-red-500'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600'
                      }`}
                      style={{ width: isFailed ? '100%' : `${(phaseIdx / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Safe to leave message */}
        {generatingEps.length > 0 && failedEps.length === 0 && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-emerald-400/80 font-bold mb-4">
            <span className="material-symbols-outlined text-xs">cloud_done</span>
            Safe to leave — generation continues in the background
          </div>
        )}

        {failedEps.length > 0 && (
          <p className="text-slate-500 text-[10px] font-medium mb-4">
            Rate limit hit. Retry failed episodes above or wait a few minutes.
          </p>
        )}

        {/* Overall progress bar */}
        {generatingEps.length > 0 && (
          <div className="w-full px-2">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Overall</span>
              <span className="text-[9px] font-black text-blue-400">{overallPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
