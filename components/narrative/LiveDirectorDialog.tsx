"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DirectorChat } from "./DirectorChat";

interface LiveDirectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  narrativeId: string;
  seriesId?: string;
  systemInstruction?: string;
}

export function LiveDirectorDialog({ isOpen, onClose, narrativeId, seriesId, systemInstruction }: LiveDirectorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-[#020205] border-white/5 p-0 overflow-hidden rounded-[2rem] shadow-2xl shadow-blue-500/20">
        <DialogTitle className="sr-only">Director Intelligence</DialogTitle>
        <DialogDescription className="sr-only">Live strategic coordination and content generation with the Director AI.</DialogDescription>
        <div className="h-[650px]">
          <DirectorChat 
            narrativeId={narrativeId} 
            seriesId={seriesId} 
            onClose={onClose} 
            inline={false} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
