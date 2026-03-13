"use client";

import { ContentPiece, ContentStatus, VideoPlan, VideoPlanStatus, ACTIVE_GENERATION_STATUSES } from "@/lib/types";
import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ContentCardProps {
  piece: ContentPiece;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (contentId: string, status: ContentStatus) => Promise<void>;
  onCopy: (body: string) => void;
  onCreateVideo: (body: string, draftId: string) => void;
  onCreateCarousel: (body: string, draftId: string) => void;
  onSave?: (contentId: string, newBody: string) => Promise<void>;
  onDelete?: (contentId: string) => Promise<void>;
  livePlanMap?: Map<string, VideoPlan>;
}

function statusLabel(status: string): string {
  switch (status) {
    case "generating": return "Generating";
    case "generating_audio": return "Audio";
    case "rendering": return "Rendering";
    case "pending": return "Starting";
    default: return "Processing";
  }
}

export function ContentCard({
  piece,
  expanded,
  onToggle,
  onUpdateStatus,
  onCopy,
  onCreateVideo,
  onCreateCarousel,
  onSave,
  onDelete,
  livePlanMap,
}: ContentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(piece.editedBody || piece.body);
  const [isSaving, setIsSaving] = useState(false);

  const displayBody = piece.editedBody || piece.body;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
        await onSave(piece.id, editText);
        setIsEditing(false);
    } catch (e) {
        console.error("Failed to save", e);
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm("Are you sure you want to delete this content piece? This action cannot be undone.")) return;

    setIsSaving(true);
    try {
        await onDelete(piece.id);
    } catch (e) {
        console.error("Failed to delete", e);
        setIsSaving(false);
    }
  };

  const hasBeenGenerated = piece.generatedPlans && piece.generatedPlans.length > 0;
  const isCarousel = piece.format.toLowerCase().includes("carousel");
  const isVideo = piece.format.toLowerCase().includes("video") || piece.format === "short-video" || piece.format === "long-video";
  const isTextOnly = !isCarousel && !isVideo;

  // Determine if any linked plans are actively generating (real-time via livePlanMap)
  const activeGeneratingPlan = useMemo(() => {
    if (!livePlanMap || !piece.generatedPlans || piece.generatedPlans.length === 0) return null;
    for (const gp of piece.generatedPlans) {
      const live = livePlanMap.get(gp.id!);
      if (live && ACTIVE_GENERATION_STATUSES.includes(live.status as VideoPlanStatus)) {
        return live;
      }
    }
    return null;
  }, [livePlanMap, piece.generatedPlans]);

  const isActivelyGenerating = !!activeGeneratingPlan;

  return (
    <div className={cn(
      "bg-white dark:bg-[#101322] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden transition-all shadow-sm hover:shadow-md",
      isActivelyGenerating && "border-amber-500/20",
      hasBeenGenerated && !isActivelyGenerating && "opacity-80 grayscale-[0.2] border-green-500/10"
    )}>
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-6 flex items-start justify-between gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              {piece.format}
            </span>
            {piece.angle && (
              <span className="text-xs text-slate-400 truncate max-w-[150px]">• {piece.angle}</span>
            )}
            {piece.status === "edited" && (
                <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Edited</span>
            )}
            {hasBeenGenerated && (
              <div className="ml-auto flex items-center gap-2">
                {isActivelyGenerating && (
                  <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20 animate-pulse">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-amber-400" />
                    </span>
                    {statusLabel(activeGeneratingPlan!.status || '')}
                  </div>
                )}
                {!isActivelyGenerating && (
                  <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                    Generated
                  </div>
                )}
              </div>
            )}
          </div>
          <h3 className="font-bold text-base mb-1">{piece.title}</h3>
          {!expanded && piece.hook && (
            <p className="text-sm text-slate-500 truncate">{piece.hook}</p>
          )}
        </div>
        <span
          className={`material-symbols-outlined text-slate-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-6 pb-6">
          {isEditing ? (
              <div className="mb-4">
                  <textarea
                    className="w-full min-h-[200px] p-4 bg-slate-50 dark:bg-[#0d101b] rounded-xl border border-blue-500/30 focus:border-blue-500 outline-none text-sm leading-relaxed text-slate-900 dark:text-slate-100 resize-y"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-2 justify-end">
                      <button
                        onClick={() => {
                            setIsEditing(false);
                            setEditText(displayBody);
                        }}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        disabled={isSaving}
                      >
                          Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-50"
                      >
                          {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                  </div>
              </div>
          ) : (
            <div className="p-5 bg-slate-50 dark:bg-[#0d101b] rounded-xl mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {displayBody}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-2 flex-wrap">
                <button
                onClick={() => onCopy(displayBody)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copy
                </button>

                {onSave && (
                    <button
                        onClick={() => {
                            setEditText(displayBody);
                            setIsEditing(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Edit
                    </button>
                )}

                {piece.status === "suggested" || piece.status === "edited" ? (
                <>
                    <button
                    onClick={() => onUpdateStatus(piece.id, "approved")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-bold hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                    >
                    <span className="material-symbols-outlined text-base">check</span>
                    Approve
                    </button>
                    <button
                    onClick={() => onUpdateStatus(piece.id, "rejected")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                    >
                    <span className="material-symbols-outlined text-base">close</span>
                    Reject
                    </button>
                    {onDelete && (
                        <button
                        onClick={handleDelete}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600/10 text-red-500 text-sm font-bold hover:bg-red-600/20 transition-colors ml-auto"
                        >
                        <span className="material-symbols-outlined text-base">delete</span>
                        Delete
                        </button>
                    )}
                </>
                ) : null}

                {piece.status === "approved" && isVideo && !hasBeenGenerated && (
                <button
                    onClick={() => onCreateVideo(displayBody, piece.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                    <span className="material-symbols-outlined text-base">movie_creation</span>
                    Create Video
                </button>
                )}

                {piece.status === "approved" && isCarousel && !hasBeenGenerated && (
                <button
                    onClick={() => onCreateCarousel(displayBody, piece.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
                >
                    <span className="material-symbols-outlined text-base">view_carousel</span>
                    Create Carousel
                </button>
                )}

                {piece.status === "approved" && hasBeenGenerated && (
                  isActivelyGenerating ? (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-bold animate-pulse">
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full size-2 bg-amber-400" />
                        </span>
                        {statusLabel(activeGeneratingPlan!.status || '')}...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        Already Generated
                    </span>
                  )
                )}

                {(piece.status === "approved" || piece.status === "published") &&
                isTextOnly && (
                <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-bold">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Approved
                </span>
                )}
            </div>
          )}

          {/* Generated Plans Section */}
          {piece.generatedPlans && piece.generatedPlans.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Generated Content</h4>
              <div className="flex flex-col gap-2">
                {piece.generatedPlans.map(gp => {
                  const livePlan = livePlanMap?.get(gp.id!) || gp;
                  const isActive = ACTIVE_GENERATION_STATUSES.includes(livePlan.status as VideoPlanStatus);
                  return (
                    <Link
                      key={gp.id}
                      href={isActive ? `/success?planId=${gp.id}&type=${livePlan.type || 'video'}` : `/generate/${gp.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-white/10"
                    >
                      <div className={cn(
                        "h-10 w-10 flex-shrink-0 rounded-lg flex items-center justify-center",
                        isActive
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      )}>
                        <span className="material-symbols-outlined text-xl">
                          {livePlan.type === 'carousel' ? 'view_carousel' : 'movie'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {livePlan.title || "Untitled Video"}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          {isActive ? (
                            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                              {statusLabel(livePlan.status || '')}...
                            </span>
                          ) : (
                            <span className="capitalize">{livePlan.status}</span>
                          )}
                          <span>&bull;</span>
                          <span className="uppercase">{livePlan.type}</span>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-sm">
                        chevron_right
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
