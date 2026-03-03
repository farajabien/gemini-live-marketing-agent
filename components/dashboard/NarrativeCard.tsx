"use client";

import { useState } from "react";
import { db } from "@/lib/instant-client";
import { tx } from "@/lib/firebase-tx";
import Link from "next/link";
import { Edit, MoreHorizontal, FileText, CheckCircle2, PlayCircle, ChevronRight, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FounderNarrative, SeriesNarrative } from "@/lib/types";

interface NarrativeCardProps {
    narrative: any; // Using any to handle both FounderNarrative and SeriesNarrative
    queuedCount?: number;
    approvedCount?: number;
    mediaCount?: number;
    isSeriesNarrative?: boolean;
}

export function NarrativeCard({ 
  narrative, 
  queuedCount = 0, 
  approvedCount = 0,
  mediaCount = 0,
  isSeriesNarrative = false
}: NarrativeCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this narrative? This will also remove all associated content pieces, video plans, and strategic goals. This action cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        const table = isSeriesNarrative ? tx.seriesNarratives : tx.narratives;
        await (db as DbWithTransact).transact([table[narrative.id].delete()]);
    } catch (err) {
        console.error("Delete failed:", err);
        setIsDeleting(false);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newTitle = prompt("Enter new title:", narrative.title);
    if (newTitle && newTitle !== narrative.title) {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        const table = isSeriesNarrative ? tx.seriesNarratives : tx.narratives;
        (db as DbWithTransact).transact([table[narrative.id].update({ title: newTitle })]);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative group">
        <Link
            href={
                narrative.status === 'wizard' 
                    ? (isSeriesNarrative ? `/series-narrative?resume=${narrative.id}` : `/narrative/new?resume=${narrative.id}`)
                    : (isSeriesNarrative ? `/series-narrative/${narrative.id}` : `/narrative/${narrative.id}`)
            }
            className={cn(
                "block p-7 rounded-[2rem] bg-white dark:bg-[#0c0d15] border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 hover:bg-slate-50 dark:hover:bg-[#11121d] relative overflow-hidden",
                isSeriesNarrative && "border-purple-500/20"
            )}
        >
            {/* Glossy Backdrop Effect */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -mr-10 -mt-10 group-hover:opacity-80 transition-all duration-700",
                isSeriesNarrative ? "bg-purple-600/10 group-hover:bg-purple-600/20" : "bg-blue-600/5 group-hover:bg-blue-600/10"
            )} />
            
            <div className="flex items-start justify-between mb-8 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                        isSeriesNarrative 
                            ? "bg-gradient-to-br from-purple-600/20 to-pink-600/20 text-purple-500 border-purple-500/10 group-hover:text-purple-400" 
                            : "bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-blue-500 border-blue-500/10 group-hover:text-blue-400"
                    )}>
                        {isSeriesNarrative ? <PlayCircle size={22} /> : <FileText size={22} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${
                                narrative.status === "active" 
                                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" 
                                    : narrative.status === "wizard"
                                    ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                                    : "text-slate-400 bg-slate-500/10 border-slate-500/20"
                            }`}>
                                {isSeriesNarrative ? "Series Architecture" : (narrative.status === "wizard" ? "Drafting" : narrative.status)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Menu Button */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                    >
                        <MoreHorizontal size={20} />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#191e33] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right p-1.5">
                            <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRename(e);
                                }}
                                className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-3 rounded-xl transition-colors uppercase tracking-widest"
                            >
                                <Pencil size={14} className="text-blue-500" /> Rename
                            </button>
                            <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDelete(e);
                                }}
                                disabled={isDeleting}
                                className="w-full px-4 py-3 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 rounded-xl transition-colors uppercase tracking-widest"
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                <h3 className="text-xl font-black leading-tight tracking-tight group-hover:text-blue-400 transition-colors">
                    {narrative.title}
                </h3>
                {(narrative.oneLiner || narrative.genre) && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                        {isSeriesNarrative ? `${narrative.genre} • ${narrative.narrativeTone}` : narrative.oneLiner}
                    </p>
                )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    {queuedCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/5 text-blue-500 text-[10px] font-black tracking-widest uppercase border border-blue-500/10">
                            <Edit size={12} />
                            {queuedCount} Drafts
                        </div>
                    )}
                    {approvedCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/5 text-emerald-500 text-[10px] font-black tracking-widest uppercase border border-emerald-500/10">
                            <CheckCircle2 size={12} />
                            {approvedCount} Approved
                        </div>
                    )}
                    {mediaCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/5 text-purple-500 text-[10px] font-black tracking-widest uppercase border border-purple-500/10">
                            <PlayCircle size={12} />
                            {mediaCount} Media
                        </div>
                    )}
                </div>

                <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                    <ChevronRight size={16} />
                </div>
            </div>
        </Link>

        {/* Backdrop for closing menu */}
        {showMenu && (
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
        )}
    </div>
  );
}
