"use client";

import { Episode } from "@/lib/types";
import { useState } from "react";

interface EpisodeCardProps {
  episode: Episode;
  onEditScript: (episode: Episode) => void;
  onGenerateVideo: (episode: Episode) => void;
}

export function EpisodeCard({ episode, onEditScript, onGenerateVideo }: EpisodeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "complete": return { 
        color: "text-green-500", 
        bgColor: "bg-green-500/10", 
        borderColor: "border-green-500/20", 
        icon: "check_circle", 
        label: "Ready to Air" 
      };
      case "generating": return { 
        color: "text-blue-500", 
        bgColor: "bg-blue-500/10", 
        borderColor: "border-blue-500/20", 
        icon: "video_settings", 
        label: "Compiling..." 
      };
      case "script_ready": return { 
        color: "text-purple-500", 
        bgColor: "bg-purple-500/10", 
        borderColor: "border-purple-500/20", 
        icon: "article", 
        label: "Script Approved" 
      };
      case "failed": return { 
        color: "text-red-500", 
        bgColor: "bg-red-500/10", 
        borderColor: "border-red-500/20", 
        icon: "error", 
        label: "Failed" 
      };
      default: return { 
        color: "text-slate-500", 
        bgColor: "bg-slate-500/10", 
        borderColor: "border-slate-500/20", 
        icon: "draft", 
        label: status.replace("_", " ") 
      };
    }
  };

  const statusInfo = getStatusInfo(episode.status);

  return (
    <div className={`group bg-white dark:bg-[#101322] border transition-all duration-300 ${isExpanded ? 'rounded-[2.5rem] border-blue-600/30 shadow-2xl ring-1 ring-blue-600/10' : 'rounded-2xl border-slate-200 dark:border-white/5 shadow-sm hover:border-slate-300 dark:hover:border-white/20'}`}>
      
      {/* ACCORDION HEADER */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-black transition-colors ${isExpanded ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:text-white'}`}>
                {episode.episodeNumber}
            </div>
            <div className="flex flex-col">
                <h3 className={`text-base font-black tracking-tight transition-colors ${isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white line-clamp-1'}`}>
                    {episode.title}
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[10px] ${statusInfo.color}`}>{statusInfo.icon}</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {/* Quick Action Button (only shown when collapsed or not generating) */}
            {!isExpanded && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateVideo(episode);
                  }}
                  disabled={episode.status === "generating"}
                  className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md shadow-blue-500/20"
                >
                   <span className="material-symbols-outlined text-sm">{episode.status === "complete" ? "play_arrow" : "auto_awesome"}</span>
                </button>
            )}
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-blue-600/10 text-blue-500' : 'group-hover:bg-slate-100 dark:group-hover:bg-white/5 group-hover:text-white'}`}>
                <span className="material-symbols-outlined text-lg">expand_more</span>
            </div>
        </div>
      </div>

      {/* ACCORDION CONTENT */}
      {isExpanded && (
        <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
           <div className="pt-4 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
             
              {/* Thumbnail Area */}
              <div className="md:col-span-4 lg:col-span-5">
                 <div className="relative aspect-[9/16] md:aspect-video rounded-3xl bg-slate-100 dark:bg-[#0d101b] border border-slate-200 dark:border-white/5 overflow-hidden group/thumb">
                    {episode.thumbnailUrl ? (
                      <img 
                        src={episode.thumbnailUrl} 
                        alt={episode.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover/thumb:scale-110"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-20 group-hover/thumb:opacity-40 transition-opacity">
                         <span className="material-symbols-outlined text-6xl">videocam_off</span>
                         <p className="text-[10px] font-black uppercase tracking-widest leading-none">Awaiting Render</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-end p-4">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Digital Board 0{episode.episodeNumber}</span>
                    </div>
                 </div>
              </div>

              {/* Data & Actions */}
              <div className="md:col-span-8 lg:col-span-7 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                        {episode.duration ? `${episode.duration}s` : "60-90s"} Runtime
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">segment</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                        {episode.visualPrompts?.length || 0} Story Scenes
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 dark:bg-[#0d101b]/50 rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 mb-8 relative">
                    <div className="absolute top-4 right-6">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-50 italic">Dialogue Draft</span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed font-serif italic text-balance">
                      &quot;{episode.script}&quot;
                    </p>
                  </div>

                  {/* Multi-Button Tray */}
                  <div className="flex flex-wrap gap-3 mt-auto">
                    <button 
                      onClick={() => onEditScript(episode)}
                      className="h-12 px-6 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3 border border-slate-200 dark:border-white/10 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-base">edit_note</span>
                      Edit Continuity
                    </button>
                    <button 
                      onClick={() => onGenerateVideo(episode)}
                      disabled={episode.status === "generating"}
                      className={`flex-1 min-w-[160px] h-12 ${episode.status === "complete" ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-blue-600 shadow-blue-500/20 text-white"} rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                    >
                      {episode.status === "generating" ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Assembling assets...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">
                            {episode.status === "complete" ? "replay" : "movie_edit"}
                          </span>
                          {episode.status === "complete" ? "Regenerate Episode" : "Compile Video"}
                        </>
                      )}
                    </button>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
