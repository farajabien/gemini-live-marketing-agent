import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Series } from "@/lib/types";
import { db } from "@/lib/instant-client";
import { tx } from "@instantdb/react";
import Link from "next/link";

interface SeriesCardProps {
  series: Series;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this series?")) return;
    
    setIsDeleting(true);
    try {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact([tx.series[series.id].delete()]);
    } catch (err) {
        console.error("Delete failed:", err);
        setIsDeleting(false);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newTitle = prompt("Enter new title:", series.title);
    if (newTitle && newTitle !== series.title) {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        (db as DbWithTransact).transact([tx.series[series.id].update({ title: newTitle })]);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative group">
      <Link 
        href={`/series/${series.id}`}
        className="block bg-white dark:bg-[#191e33] rounded-2xl border border-slate-200 dark:border-[#232948] overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      >
        {/* Thumbnail Area - Stacked Effect */}
        <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-black/50 relative overflow-hidden flex items-center justify-center">
            {/* Decorative Stack of "Episodes" */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-2/3 aspect-[9/16] bg-slate-200 dark:bg-[#232948] rounded shadow-lg translate-x-4 -rotate-6 opacity-30"></div>
              <div className="absolute w-2/3 aspect-[9/16] bg-slate-300 dark:bg-[#2a3055] rounded shadow-lg -translate-x-4 rotate-6 opacity-60"></div>
              <div className="absolute w-2/3 aspect-[9/16] bg-gradient-to-br from-blue-600 to-purple-600 rounded shadow-2xl flex flex-col items-center justify-center text-white p-4 text-center">
                  <span className="material-symbols-outlined text-4xl mb-2">auto_stories</span>
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Serial Narrative</span>
              </div>
            </div>
            
            {/* Badge */}
            <div className="absolute top-3 left-3">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
                    Series
                </span>
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${
                    series.status === 'complete' ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'
                } border border-current opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {series.status}
                </span>

                {/* Actions Menu */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="h-8 w-8 bg-white dark:bg-[#191e33] rounded-full shadow-md flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#232948] transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-sm">more_horiz</span>
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-[#191e33] rounded-lg shadow-xl border border-slate-200 dark:border-[#232948] overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <button 
                                onClick={handleRename}
                                className="w-full px-4 py-3 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#232948] flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">edit</span> Rename
                            </button>
                            <button 
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="w-full px-4 py-3 text-left text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-5">
            <h3 className="font-bold text-lg mb-1 truncate leading-tight group-hover:text-[#1337ec] transition-colors">{series.title}</h3>
            <p className="text-xs text-slate-400 font-medium mb-3">{series.createdAt ? formatDistanceToNow(series.createdAt) : 'Unknown'} ago</p>
            
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 bg-slate-100 dark:bg-[#232948] rounded flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">layers</span>
                    {series.episodeCount} Episodes
                </span>
                <span className="px-2 py-1 bg-slate-100 dark:bg-[#232948] rounded flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">style</span>
                    Consistent
                </span>
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
