"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Brain, Sparkles, Activity, Loader2, Play, Zap, X, ChevronRight, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCollection, useDocument } from "@/hooks/use-firestore";
import { useAuth } from "@/hooks/use-auth";
import { useGenerateStore } from "@/hooks/use-generate-store";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageBlueprint } from "./chat/MessageBlueprint";
import { generateSeasonPlotAction } from "@/app/actions/marketing";

interface DirectorChatProps {
  narrativeId: string;
  seriesId?: string;
  onClose?: () => void;
  inline?: boolean;
  className?: string;
}

export function DirectorChat({ narrativeId, seriesId, onClose, inline = false, className }: DirectorChatProps) {
  const { user, refreshToken } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [thinkingSteps, setThinkingSteps] = useState<any[]>([]);
  const [input, setInput] = useState("");


  // Firestore Data
  const collectionName = seriesId ? 'seriesNarratives' : 'narratives';
  const { data: narrative } = useDocument(collectionName, narrativeId);
  const { data: persistentMessages, isLoading: isLoadingHistory } = useCollection(
    `${collectionName}/${narrativeId}/chat_messages`,
    { orderBy: [{ field: 'createdAt', direction: 'asc' }] }
  );

  // Vercel AI SDK Hook (Adapting to v6 API)
  const { 
    messages, 
    status,
    sendMessage 
  } = useChat({
    id: narrativeId,
    transport: new DefaultChatTransport({
      api: `/api/narrative/${narrativeId}/chat`,
      headers: {
        Authorization: `Bearer ${refreshToken}`,
      },
    }),
    onData: (data: any) => {
      if ((data as any).type === 'thinking') {
        setThinkingSteps(prev => [...prev, data]);
      }
    },
    onFinish: (options: any) => {
      const message = options.message;
      // Find thinking parts if any
      const thinkingParts = message.parts.filter((p: any) => p.type === 'reasoning' || (p.type === 'data' && (p.data as any)?.type === 'thinking'));
      
      // Extract blueprint metadata if present
      const metadata = (message as any).metadata as any;
      if (metadata?.blueprint) {
        setActivePlan(metadata.blueprint);
      }
      
      // Keep thinking steps until next message starts
      // Or we can clear them if we want fresh ones each time
    },
    onError: (err) => {
      toast.error("Director connection lost. Retrying...");
      console.error(err);
    }
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (status === 'submitted') {
      setThinkingSteps([]); // Reset thinking steps when new message submitted
    }
  }, [status]);

  // Sync persistent messages to chat state on load
  useEffect(() => {
    if (persistentMessages && persistentMessages.length > 0 && messages.length === 0) {
      // This part needs to be adapted if useChat doesn't expose setMessages directly
      // For now, we'll assume `messages` is the source of truth after initial load
      // and new messages are added via sendMessage.
      // If initial messages need to be loaded into the useChat state, a custom transport
      // or initialMessages prop would be needed.
    }
  }, [persistentMessages, messages]);

  // Audio Logic
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.split('```json')[0].trim());
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Premium') || v.name.includes('Enhanced')));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading, thinkingSteps]);

  const connect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      toast.success("Director connected!");
    }, 1000);
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      if (!isConnected) setIsConnected(true);
      const currentInput = input;
      setInput("");
      try {
        await sendMessage({ text: currentInput });
      } catch (err) {
        setInput(currentInput); 
        toast.error("Failed to send message.");
      }
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const brainHealth = useMemo(() => {
    if (!narrative) return 0;
    const fields = ['genre', 'worldSetting', 'conflictType', 'protagonistArchetype', 'centralTheme', 'narrativeTone', 'visualStyle', 'episodeHooks'];
    const filled = fields.filter(f => narrative[f] && (narrative[f] as string).length > 5).length;
    return (filled / fields.length) * 100;
  }, [narrative]);

  const canGeneratePlot = (brainHealth >= 30 || narrative?.logline) && !narrative?.megaPrompt && seriesId;

  const handleGenerateSeasonPlot = async () => {
    if (!narrativeId) return;
    const promise = generateSeasonPlotAction(narrativeId, 3);
    toast.promise(promise, {
      loading: "Architecting Master Season Plot...",
      success: "Season Plot synchronized with Production Console.",
      error: "Failed to generate season plot."
    });
    try {
      await promise;
    } catch (e) {}
  };

  return (
    <div className={cn(
      "relative flex flex-col h-full overflow-hidden bg-background border-l border-border",
      className
    )}>
      {/* Premium Header */}
      <div className="relative px-6 py-4 border-b border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("size-10 rounded-2xl flex items-center justify-center transition-all duration-500", isConnected ? "bg-blue-600/20 shadow-lg" : "bg-white/[0.02]")}>
            <Brain className={cn("size-5", isConnected ? "text-blue-400" : "text-slate-700")} />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground tracking-tight uppercase italic leading-none mb-0.5">Director Intelligence</h2>
            <div className="flex items-center gap-1.5 leading-none">
              <div className={cn("size-1.5 rounded-full", isConnected ? "bg-green-500 animate-pulse" : "bg-red-500")} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{isConnected ? "Live Strategy" : "Standby"}</span>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <Button onClick={connect} disabled={isConnecting} className="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 h-8 text-[9px] font-black uppercase gap-2">
            {isConnecting ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3 fill-current" />}
            Wake Up
          </Button>
        ) : (
          <Button onClick={() => setShowSummary(!showSummary)} variant="ghost" className={cn("h-8 rounded-xl text-[9px] font-black uppercase transition-all gap-1.5", showSummary ? "bg-blue-500/10 text-blue-400" : "text-slate-500")}>
            <Activity className="size-4" />
            Strategic Pulse
          </Button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative px-6 py-8">
        <div ref={scrollRef} className="space-y-8 pb-12">
           {messages.length === 0 && !isLoadingHistory && (
             <div className="flex flex-col items-center justify-center pt-12 space-y-6 text-center animate-in fade-in zoom-in-95">
                <div className="size-20 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                  <Brain className="size-10 text-blue-500" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-2xl font-black text-white italic leading-none">Establish Control.</h3>
                  <p className="text-[12px] text-slate-500 font-medium">Talk to the Director to extract your core brand pillars and generate high-impact media.</p>
                </div>
             </div>
           )}

           {messages.map((m: UIMessage, i) => {
             // Extract text content from parts in v6
             const textContent = m.parts 
              ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
              : (m as any).content || "";
             
             return (
               <div key={m.id || i} className={cn("flex flex-col space-y-2 max-w-[90%] animate-in fade-in slide-in-from-bottom-2", m.role === 'user' ? "ml-auto items-end" : "mr-auto")}>
                 <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 px-1">{m.role === 'user' ? 'Strategy Lead' : 'Director'}</span>
                 <div className={cn(
                   "px-5 py-3.5 rounded-[1.5rem] text-[13px] leading-relaxed",
                   m.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-secondary/40 border border-border text-foreground/80 rounded-tl-none"
                 )}>
                   {textContent.split('```json')[0].trim()}
                 </div>
                 
                 {/* Metadata / Blueprints */}
                 {m.role === 'assistant' && (m.metadata as any)?.blueprint && (
                   <MessageBlueprint 
                     message={m as any} 
                     onProduceVideo={(script) => useGenerateStore.getState().openGenerator({ script, narrativeId })}
                   />
                 )}
               </div>
             );
           })}

              {/* Thinking Steps (Global for current interaction) */}
              {isLoading && thinkingSteps.length > 0 && (
                <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg border border-white/10 animate-pulse">
                  {thinkingSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-blue-300/80 italic font-light">
                      <div className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                      <span>{step.status || step.step}</span>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-6 bg-gradient-to-t from-background to-transparent space-y-4">
        <form onSubmit={onFormSubmit} className="relative">
          <input 
            value={input}
            onChange={onInputChange}
            placeholder="Direct the intelligence..."
            className="w-full bg-secondary/50 border border-border focus:border-blue-500/40 focus:bg-secondary rounded-2xl px-6 py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all pr-12"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 size-10 rounded-xl bg-blue-600 flex items-center justify-center text-white disabled:opacity-20 transition-all hover:scale-105"
          >
            <ChevronRight className="size-5" />
          </button>
        </form>

        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-600">
          <div className="flex gap-4">
            <button type="button" onClick={() => sendMessage({ text: "Generate a strategic angle." })} className="hover:text-blue-500 transition-colors flex items-center gap-2">
              <PlayCircle className="size-3" />
              Generate Angle
            </button>
            {canGeneratePlot ? (
              <button 
                type="button" 
                onClick={handleGenerateSeasonPlot}
                className="text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-2 animate-pulse bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 shadow-lg shadow-amber-500/10"
              >
                <Sparkles className="size-3 fill-current" />
                <span className="text-[10px] font-black italic">Generate Master Plot</span>
              </button>
            ) : (
              <button type="button" className="hover:text-amber-500 transition-colors flex items-center gap-2">
                <Brain className="size-3" />
                Extraction Profile
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-10">
             <Activity className="size-3" />
             AI v6 ENGINE
          </div>
        </div>
      </div>
    </div>
  );
}
