"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Volume2, Activity, Sparkles } from "lucide-react";
import { LiveDirectorDialog } from "./LiveDirectorDialog";
import { getDirectorPromptAction } from "@/app/actions/marketing";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface LiveDirectorFABProps {
  narrativeId?: string;
  seriesId?: string;
}

export function LiveDirectorFAB({ narrativeId, seriesId }: LiveDirectorFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState<string>("");
  const pathname = usePathname();

  // Logic to determine if we should show the FAB
  // Usually on Narrative or Series pages
  const isNarrativePage = pathname.includes("/narrative/");
  const isSeriesPage = pathname.includes("/series/");
  
  const activeId = narrativeId || seriesId;
  const contextType = isSeriesPage ? 'series' : 'narrative';

  useEffect(() => {
    if (activeId && isOpen) {
      getDirectorPromptAction(contextType as any, activeId).then(setPrompt);
    }
  }, [activeId, contextType, isOpen]);

  if (!activeId || (!isNarrativePage && !isSeriesPage)) return null;

  return (
    <>
      <div className="fixed bottom-24 right-6 z-40 group">
        <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all animate-pulse" />
        <Button
          onClick={() => setIsOpen(true)}
          data-director-fab
          className={cn(
            "relative size-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-white/10",
            isOpen && "scale-0 opacity-0"
          )}
        >
          <Volume2 className="size-6" />
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-3 bg-blue-500" />
          </span>
          
          <div className="absolute right-full mr-4 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 pointer-events-none whitespace-nowrap">
             <div className="flex items-center gap-2">
                <Brain className="size-3 text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Talk to Director</span>
             </div>
          </div>
        </Button>
      </div>

      <LiveDirectorDialog 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        narrativeId={narrativeId || ""} // In our current backend, it expects narrativeId for extraction
        seriesId={seriesId}
        systemInstruction={prompt}
      />
    </>
  );
}
