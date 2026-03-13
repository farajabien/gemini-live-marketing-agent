"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useLiveAPI } from "@/hooks/use-live-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, X, Brain, Sparkles, Activity, Loader2, MessageSquare } from "lucide-react";
import { getLiveConfigAction } from "@/app/actions/marketing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LiveDirectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  narrativeId: string;
  systemInstruction?: string;
}

export function LiveDirectorDialog({ isOpen, onClose, narrativeId, systemInstruction }: LiveDirectorDialogProps) {
  const [config, setConfig] = useState<{ apiKey: string } | null>(null);
  const [lastInsight, setLastInsight] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  
  // Fetch API key on mount
  useEffect(() => {
    getLiveConfigAction().then(setConfig);
  }, []);

  const onMessage = useCallback(async (msg: any) => {
    // Look for text in model response to distill
    const text = msg.serverContent?.modelTurn?.parts?.find((p: any) => p.text)?.text;
    if (text && text.length > 50) {
      // Trigger distillation logic via API
      try {
        setIsSyncing(true);
        const token = localStorage.getItem("auth_token") || ""; // Assuming token is here or use a hook
        await fetch(`/api/narrative/${narrativeId}/sync-brain`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ insight: text })
        });
        setLastInsight(text.substring(0, 100) + "...");
      } catch (err) {
        console.error("Sync error:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [narrativeId]);

  const {
    isConnected,
    isConnecting,
    volume,
    connect,
    disconnect,
    startAudio,
    stopAudio,
  } = useLiveAPI({
    apiKey: config?.apiKey || "",
    systemInstruction,
    onMessage,
    onConnected: () => {
      toast.success("Connection established...");
    },
    onReady: () => {
      toast.success("Director is live!");
      startAudio();
    },
    onError: (err) => {
      toast.error(`Director error: ${err.message}`);
    }
  });

  // Real volume-based speaking state
  const isSpeaking = volume > 0.05;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-slate-950 border-white/5 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl shadow-blue-500/10">
        <div className="relative p-8 flex flex-col items-center justify-center min-h-[450px]">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />
          
          <DialogHeader className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className={cn(
                "size-2 rounded-full animate-pulse",
                isConnected ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-red-500"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {isConnected ? "Live Session" : isConnecting ? "Waking up Director..." : "Narrative Intelligence"}
              </span>
            </div>
            <DialogTitle className="text-3xl font-black text-white">The Brainstorming Director</DialogTitle>
            <DialogDescription className="text-slate-400">Talk through your brand strategy. The AI will distill your ideas into your Strategic Hub.</DialogDescription>
            {config && !config.apiKey && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">⚠️ API Key Missing</p>
                <p className="text-[9px] text-red-500/80">GEMINI_API_KEY environment variable is not set.</p>
              </div>
            )}
          </DialogHeader>

          {/* Core Interaction Area */}
          <div className="relative size-48 flex items-center justify-center mb-12">
            {/* Pulsing Rings */}
            {isConnected && (
              <>
                <div className={cn(
                  "absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-ping",
                  isSpeaking ? "duration-700" : "duration-2000 opacity-0"
                )} />
                <div className={cn(
                  "absolute -inset-4 rounded-full border border-blue-500/10 transition-all duration-700",
                  isSpeaking ? "scale-110 opacity-100" : "scale-100 opacity-20"
                )} />
              </>
            )}

            <div className={cn(
              "relative size-32 rounded-full flex items-center justify-center transition-all duration-500 shadow-inner",
              isConnected 
                ? "bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-400/20 ring-4 ring-white/10" 
                : "bg-slate-900 border border-white/5"
            )}>
              {isConnecting ? (
                <Loader2 className="size-10 text-blue-500 animate-spin" />
              ) : isConnected ? (
                <Volume2 className={cn("size-12 text-white transition-transform", isSpeaking && "scale-110")} />
              ) : (
                <Brain className="size-12 text-slate-700" />
              )}
            </div>
          </div>


          {/* Audio Visualizer Level */}
          {isConnected && (
            <div className="flex gap-1 items-center mb-4 h-4">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                  style={{ 
                    height: `${Math.max(10, (volume * 100) * (1 - Math.abs(i - 3.5) / 4))}%`,
                    opacity: 0.3 + (volume * 2)
                  }}
                />
              ))}
            </div>
          )}

          {/* Insight Pulse */}
          <div className="w-full max-w-md bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition-all overflow-hidden h-16">
            {isSyncing ? (
              <div className="flex items-center gap-3 text-red-500 animate-pulse">
                <Activity className="size-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Distilling Insights...</span>
              </div>
            ) : lastInsight ? (
              <div className="flex items-center gap-3">
                <Sparkles className="size-4 text-blue-400" />
                <p className="text-[11px] text-slate-400 italic line-clamp-2 leading-relaxed">"{lastInsight}"</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-600">
                <MessageSquare className="size-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Waiting for direction...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-8">
            {!isConnected ? (
              <Button 
                onClick={connect} 
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-10 h-14 font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
              >
                {isConnecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mic className="size-4" />
                )}
                {isConnecting ? "Connecting..." : "Start Brainstorming"}
              </Button>
            ) : (
              <Button 
                onClick={disconnect}
                variant="outline"
                className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full px-8 h-12 font-black uppercase tracking-widest text-xs gap-2"
              >
                End Session
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="text-slate-500 hover:text-white rounded-full h-12 px-6 font-black uppercase tracking-widest text-xs"
            >
              Minimize
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
