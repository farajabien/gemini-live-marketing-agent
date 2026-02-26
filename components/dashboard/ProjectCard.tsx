"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/lib/instant-client";
import { tx } from "@instantdb/react";
import type { VideoPlan } from "@/lib/types";
import Image from "next/image";

interface ProjectCardProps {
    plan: VideoPlan;
    onPreview: (plan: VideoPlan) => void;
}

export function ProjectCard({ plan, onPreview }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    
    setIsDeleting(true);
    try {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact([tx.videoPlans[plan.id!].delete()]);
    } catch (err) {
        console.error("Delete failed:", err);
        setIsDeleting(false);
    }
  };

  return (
    <div 
      onClick={() => onPreview(plan)}
      className="group relative bg-white dark:bg-[#191e33] rounded-2xl border border-slate-200 dark:border-[#232948] overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
    >
      {/* Thumbnail Preview Area */}
      <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-black/50 relative overflow-hidden">
          {(() => {
              const rawUrl = plan.thumbnailUrl || plan.scenes?.[0]?.imageUrl;
              if (!rawUrl) return (
                  <div className="flex items-center justify-center w-full h-full text-slate-300">
                       <span className="material-symbols-outlined text-4xl">image</span>
                  </div>
              );
              
              // Determine if it's a relative storage path or absolute URL
              const finalUrl = (() => {
                  if (rawUrl.startsWith('data:')) return rawUrl;
                  if (rawUrl.includes("giphy.com")) return rawUrl; // Bypass proxy for Giphy
                  
                  const isStoragePath = !rawUrl.startsWith('http');
                  return isStoragePath 
                      ? `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`
                      : `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
              })();
              
              if (rawUrl.includes(".mp4") || rawUrl.includes("giphy")) {
                  return (
                      <video 
                        src={finalUrl} 
                        muted 
                        loop 
                        playsInline 
                        autoPlay 
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      />
                  );
              }

              return (
                  <Image 
                      src={finalUrl} 
                      alt={plan.title}
                      unoptimized
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      loading="lazy"
                      onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                              const placeholder = document.createElement('div');
                              placeholder.className = "flex items-center justify-center w-full h-full text-slate-300";
                              placeholder.innerHTML = '<span class="material-symbols-outlined text-4xl">broken_image</span>';
                              parent.appendChild(placeholder);
                          }
                      }}
                      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
              );
          })()}
          
          {/* Badge */}
          <div className="absolute top-3 left-3">
               <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  plan.type === 'carousel' 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
               }`}>
                  {plan.type}
               </span>
          </div>

          {/* Menu Button (Three Dots) - Only visible on hover or if menu open */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
             <button
                onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                }}
                className="h-8 w-8 bg-white dark:bg-[#191e33] rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#232948] transition-colors"
             >
                <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-sm">more_horiz</span>
             </button>

             {/* Dropdown Menu */}
             {showMenu && (
                 <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-[#191e33] rounded-lg shadow-xl border border-slate-200 dark:border-[#232948] overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(plan);
                            setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2"
                     >
                        <span className="material-symbols-outlined text-sm">play_circle</span> Play
                     </button>
                      <button 
                         onClick={handleDelete}
                         disabled={isDeleting}
                         className="w-full px-4 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                         <span className="material-symbols-outlined text-sm">delete</span> Delete
                      </button>
                       <button 
                         onClick={(e) => {
                             e.stopPropagation();
                             const newTitle = prompt("Enter new title:", plan.title);
                             if (newTitle && newTitle !== plan.title) {
                                 type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
                                 (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ title: newTitle })]);
                             }
                             setShowMenu(false);
                         }}
                         className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2"
                      >
                         <span className="material-symbols-outlined text-sm">edit</span> Rename
                      </button>

                       <button 
                         onClick={(e) => {
                             e.stopPropagation();
                             window.location.href = `/post-assistant/${plan.id}`;
                             setShowMenu(false);
                         }}
                         className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2 text-blue-500"
                      >
                         <span className="material-symbols-outlined text-sm">magic_button</span> Post Assistant
                      </button>

                       <button 
                         onClick={(e) => {
                             e.stopPropagation();
                             const newPostedAt = plan.postedAt ? undefined : Date.now();
                             type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
                             (db as DbWithTransact).transact([tx.videoPlans[plan.id!].update({ postedAt: newPostedAt })]);
                             setShowMenu(false);
                         }}
                         className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2"
                      >
                         <span className={`material-symbols-outlined text-sm ${plan.postedAt ? 'text-green-500' : ''}`}>
                            {plan.postedAt ? 'check_circle' : 'publish'}
                         </span> 
                         {plan.postedAt ? 'Unmark Posted' : 'Mark as Posted'}
                      </button>

                       <button 
                         onClick={(e) => {
                             e.stopPropagation();
                             onPreview(plan); // Opens preview where download is available
                             setShowMenu(false);
                         }}
                         className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2"
                      >
                         <span className="material-symbols-outlined text-sm">download</span> Download
                      </button>
                 </div>
             )}
          </div>
          
          {/* Posted Badge */}
          {plan.postedAt && (
             <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-green-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20 animate-in zoom-in-95 duration-300">
                <span className="material-symbols-outlined text-[10px]">check_circle</span>
                Posted
             </div>
          )}
          
          {/* Backdrop to close menu */}
          {showMenu && (
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}></div>
          )}
      </div>

      {/* Content */}
      <div className="p-5">
          <h3 className="font-bold text-lg mb-1 truncate leading-tight group-hover:text-[#1337ec] transition-colors">{plan.title}</h3>
          <p className="text-xs text-slate-400 font-medium mb-3">{plan.createdAt ? formatDistanceToNow(plan.createdAt) : 'Unknown'} ago</p>

          {/* Content Tags */}
          {(plan as any).contentTags && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[9px] font-bold uppercase tracking-wider">
                {(plan as any).contentTags.primaryAngle}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded text-[9px] font-medium">
                {(plan as any).contentTags.hookType}
              </span>
            </div>
          )}

          {/* Metrics (if posted) */}
          {(plan as any).metrics?.posted && (plan as any).metrics?.metrics24h && (
            <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800/30">
              <div className="text-[9px] uppercase tracking-widest font-black text-green-700 dark:text-green-400 mb-1">24h Performance</div>
              <div className="flex gap-3 text-[10px]">
                <span className="text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">visibility</span>
                  {((plan as any).metrics.metrics24h.views || 0).toLocaleString()}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">favorite</span>
                  {((plan as any).metrics.metrics24h.likes || 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
               <span className="px-2 py-1 bg-slate-100 dark:bg-[#232948] rounded">
                   {plan.scenes?.length || 0} Scenes
               </span>
               {plan.type === 'video' && plan.voiceId && (
                   <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-[#232948] rounded">
                      <span className="material-symbols-outlined text-[10px]">graphic_eq</span>
                      Audio
                   </span>
               )}
          </div>
      </div>
    </div>
  );
}
