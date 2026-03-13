"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Brain, Sparkles, Activity, Loader2, MessageSquare, ChevronRight, X, ChevronUp, ChevronDown, CheckCircle2, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCollection, useDocument } from "@/hooks/use-firestore";
import { useAuth } from "@/hooks/use-auth";
import { useGenerateStore } from "@/hooks/use-generate-store";

interface LiveDirectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  narrativeId: string;
  seriesId?: string;
  systemInstruction?: string;
}

export function LiveDirectorDialog({ isOpen, onClose, narrativeId, seriesId, systemInstruction }: LiveDirectorDialogProps) {
  const { user, getFreshToken } = useAuth();
  const [lastInsight, setLastInsight] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [thinkingStatus, setThinkingStatus] = useState<string>("");
  const [showThoughts, setShowThoughts] = useState<Record<string, boolean>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch current narrative for context
  const { data: narrative, isLoading: isLoadingNarrative } = useDocument('narratives', narrativeId);

  // Subscribe to persistent chat history
  const { data: persistentMessages, isLoading: isLoadingHistory } = useCollection(
    `narratives/${narrativeId}/chat_messages`,
    {
      orderBy: [{ field: 'createdAt', direction: 'asc' }]
    }
  );

  const messages = persistentMessages || [];

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages, isThinking, thinkingStatus]);

  // Onboarding Setup
  useEffect(() => {
    if (!isLoadingHistory && messages.length === 0 && narrative) {
      setDynamicSuggestions([
        "I'm ready to start",
        "How does this work?",
        "Help me define my audience"
      ]);
    }
  }, [isLoadingHistory, messages.length, narrative?.id]);
  
  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Pick a high-quality voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Premium') || v.name.includes('Enhanced') || v.name.includes('Google')));
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.pitch = 1.0;
    utterance.rate = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    voiceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendText = async (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text) return;
    
    setInputText("");
    setIsThinking(true);
    setThinkingStatus("Opening Internal War Room...");
    
    // Simulate multi-step thinking feedback
    const thinkingInterval = setInterval(() => {
      const statuses = [
        "Consulting Senior Strategists...",
        "The Disruptor is searching for villain gaps...",
        "The Architect is mapping scalability...",
        "Synthesizing strategic response..."
      ];
      setThinkingStatus(prev => {
        const idx = statuses.indexOf(prev);
        return statuses[(idx + 1) % statuses.length];
      });
    }, 2000);
    
    try {
      const token = getFreshToken ? await getFreshToken() : null;
      if (!token) throw new Error("Could not acquire authentication token.");

      const res = await fetch(`/api/narrative/${narrativeId}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ message: text })
      });
      
      clearInterval(thinkingInterval);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Update dynamic suggestions
      if (data.suggestions) {
        setDynamicSuggestions(data.suggestions);
      }
      
      // AI Response processing
      if (data.text) {
        setThinkingStatus("Strategy Distilled.");
        setTimeout(() => setThinkingStatus(""), 2000);
        speakText(data.text);
      }
    } catch (err: any) {
      console.error("Chat Error:", err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsThinking(false);
      setIsConnecting(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      setInputText(fullTranscript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const connect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnected(true);
      setIsConnecting(false);
      toast.success("Director connected!");
      speakText("I'm here. Let's talk strategy.");
    }, 1000);
  };

  const disconnect = () => {
    setIsConnected(false);
    window.speechSynthesis?.cancel();
    toast.info("Session ended.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-[#020205] border-white/5 p-0 overflow-hidden rounded-[2rem] shadow-2xl shadow-blue-500/20">
        <DialogTitle className="sr-only">Director Intelligence</DialogTitle>
        <DialogDescription className="sr-only">Live strategic coordination and content generation with the Director AI.</DialogDescription>
        <div className="relative flex flex-col h-[650px]">
          {/* Subtle Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
          
          {/* Compact Premium Header */}
          <div className="relative px-6 py-4 border-b border-white/[0.03] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "size-10 rounded-2xl flex items-center justify-center transition-all duration-500",
                isConnected ? "bg-blue-600/20 shadow-[0_0_20px_rgba(37,99,235,0.2)]" : "bg-white/[0.02]"
              )}>
                 <Brain className={cn("size-5", isConnected ? "text-blue-400" : "text-slate-700")} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-white tracking-tight leading-none mb-1">Director Intelligence</h2>
                <div className="flex items-center gap-1.5 leading-none">
                  <div className={cn(
                    "size-1.5 rounded-full animate-pulse",
                    isConnected ? "bg-green-500" : "bg-red-500"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    {isConnected ? "Active Session" : isConnecting ? "Waking up..." : "Standby"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mr-8">
              {narrative?.narrativeStrength && (
                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Narrative Strength</span>
                    <span className="text-[10px] font-black text-blue-400">{Math.round(narrative.narrativeStrength.overallScore)}%</span>
                  </div>
                  <div className="w-24 h-1 bg-white/[0.05] rounded-full overflow-hidden border border-white/[0.03]">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                      style={{ width: `${narrative.narrativeStrength.overallScore}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {isConnected && (
                  <Button 
                    onClick={() => setShowSummary(!showSummary)}
                    variant="ghost"
                    className={cn(
                      "h-8 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all gap-1.5",
                      showSummary ? "bg-blue-500/10 text-blue-400" : "text-slate-500 hover:text-white"
                    )}
                  >
                    <Activity className="size-3.5" />
                    Pulse
                  </Button>
                )}
                <Button onClick={onClose} variant="ghost" size="icon" className="size-8 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-0 flex flex-col relative">
            {/* Intel Sidebar-like Overlay (Compact) */}
            {showSummary && (
               <div className="absolute top-0 inset-x-0 z-10 px-6 py-3 bg-blue-600/10 backdrop-blur-md border-b border-blue-500/10 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <Activity className="size-3 text-blue-400 shrink-0" />
                    <p className="text-[10px] text-blue-200/80 leading-snug italic line-clamp-2">
                       {lastInsight || "Director is distilling strategic patterns from our talk..."}
                    </p>
                  </div>
               </div>
            )}

            {isConnected ? (
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-6 custom-scrollbar">
                {isLoadingHistory ? (
                   <div className="flex flex-col items-center justify-center h-full opacity-20 py-12">
                     <Loader2 className="size-8 mb-4 animate-spin" />
                   </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 pt-12 pb-8 animate-in fade-in zoom-in-95 duration-700">
                      <div className="size-24 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto relative">
                        <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-ping opacity-20" />
                        <Brain className="size-12 text-blue-500" />
                      </div>
                      <div className="space-y-3 max-w-sm mx-auto">
                        <h2 className="text-3xl font-black text-white italic tracking-tight leading-none">Strategic Onboarding.</h2>
                        <p className="text-sm text-slate-400 leading-relaxed font-medium">
                          I'm your Director. We're going to build your brand brain organically through conversation. 
                          No forms, no wizards—just strategy.
                        </p>
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em] pt-4">
                          Ready to define your mission?
                        </p>
                      </div>
                    </div>
                ) : null}

                {messages.map((m: any, i: number) => {
                  const isDirector = m.role !== 'user';
                  // Final safety check to strip protocol JSON if it leaked into Firestore
                  const cleanText = m.text?.split('```json')[0].trim() || m.text;
                  
                  return (
                    <div key={i} className={cn(
                      "flex flex-col max-w-[95%] animate-in fade-in slide-in-from-bottom-2 duration-300 w-full",
                      !isDirector ? "ml-auto items-end" : "mr-auto items-start"
                    )}>
                       <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 mb-1 px-1 opacity-40">
                         {!isDirector ? (user?.email?.split('@')[0] || 'User') : 'Director Intelligence'}
                       </span>

                       <div className={cn(
                         "px-5 py-3.5 rounded-[1.4rem] text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-sm w-full",
                         !isDirector 
                           ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/20" 
                           : "bg-white/[0.05] border border-white/[0.03] text-slate-200 rounded-tl-none ring-1 ring-white/5"
                       )}>
                         {cleanText}
                       </div>

                       {isDirector && (m.warRoomDialogue || m.thoughtProcess || m.blueprint) && (
                          <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 w-full max-w-full overflow-hidden">
                             {/* Strategic Blueprint Loop */}
                             {m.blueprint && Object.keys(m.blueprint).length > 0 && (
                                <div className="grid grid-cols-2 gap-2 w-full max-w-full">
                                   {Object.entries(m.blueprint).map(([key, value]: [string, any], idx) => (
                                     <div key={idx} className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex flex-col gap-1 transition-all hover:bg-white/[0.05] hover:border-blue-500/20 group/card min-w-0 overflow-hidden text-left">
                                        <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 group-hover/card:text-blue-400 transition-colors truncate">
                                           {key.replace(/_/g, ' ')}
                                        </span>
                                        <p className="text-[10px] text-slate-300 leading-tight font-medium break-words">
                                           {value}
                                        </p>
                                     </div>
                                   ))}
                                   
                                   <div className="col-span-2 flex items-center justify-between gap-2 mt-1 w-full overflow-hidden">
                                     <button 
                                       onClick={() => setShowThoughts(prev => ({ ...prev, [m.id || i]: !prev[m.id || i] }))}
                                       className="text-[8px] font-black uppercase tracking-widest text-blue-500/60 hover:text-blue-400 transition-colors py-2 px-3 flex items-center gap-2 min-w-0"
                                     >
                                       {showThoughts[m.id || i] ? <ChevronUp className="size-3 shrink-0" /> : <ChevronDown className="size-3 shrink-0" />}
                                       <span className="truncate">{showThoughts[m.id || i] ? "Hide Deep Analysis" : "Inspect Deep Analysis"}</span>
                                     </button>

                                     <button 
                                       onClick={() => {
                                         const el = document.getElementById(`raw-data-${i}`);
                                         if (el) el.classList.toggle('hidden');
                                       }}
                                       className="text-[8px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors py-2 px-3 shrink-0"
                                     >
                                       Raw Protocol
                                     </button>
                                   </div>

                                   <div id={`raw-data-${i}`} className="col-span-2 hidden animate-in zoom-in-95 duration-200 mt-2 w-full max-w-full overflow-hidden">
                                      <pre className="p-4 bg-black/60 rounded-2xl font-mono text-[9px] text-blue-400/70 overflow-x-auto border border-blue-500/10 shadow-2xl whitespace-pre-wrap break-all">
                                         {JSON.stringify(m, null, 2)}
                                      </pre>
                                   </div>

                                   {/* If blueprint contains a script, show a high-action generation button */}
                                   {(m.blueprint?.script || m.blueprint?.video_script) && (
                                      <div className="col-span-2 mt-2 animate-in fade-in slide-in-from-left-4 duration-500">
                                         <Button 
                                           onClick={() => {
                                             useGenerateStore.getState().openGenerator({
                                               script: m.blueprint.script || m.blueprint.video_script,
                                               mode: "verbatim",
                                               format: "video",
                                               narrativeId: narrativeId,
                                               seriesId: seriesId
                                             });
                                           }}
                                           className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2 shadow-xl shadow-blue-900/40"
                                         >
                                           <Play className="size-4 fill-current" />
                                           Produce This Video Now
                                         </Button>
                                      </div>
                                   )}
                                </div>
                             )}

                             {/* War Room Dialogue (Toggled) */}
                             {m.warRoomDialogue && showThoughts[m.id || i] && (
                                <div className="px-5 py-4 bg-blue-500/10 border border-blue-500/20 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-500 w-full overflow-hidden text-left">
                                   <div className="flex items-center gap-3 mb-3 opacity-80">
                                      <Activity className="size-4 text-blue-400" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Strategy War Room Debate</span>
                                   </div>
                                   <div className="font-mono text-[11px] text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap break-words w-full overflow-hidden">
                                      {m.warRoomDialogue.split('\n').map((line: string, idx: number) => {
                                        const isDisruptor = line.toLowerCase().includes('disruptor');
                                        const isArchitect = line.toLowerCase().includes('architect');
                                        
                                        return (
                                          <div key={idx} className={cn(
                                            "pl-4 border-l-4 transition-all duration-300 w-full break-words break-all text-left",
                                            isDisruptor ? "border-red-500/40 text-red-100/70" : 
                                            isArchitect ? "border-emerald-500/40 text-emerald-100/70" : 
                                            "border-white/10 opacity-60"
                                          )}>
                                            {line.replace(/\*\*/g, '')}
                                          </div>
                                        );
                                      })}
                                   </div>
                                </div>
                             )}
                          </div>
                       )}
                    </div>
                  );
                })}

                {isSpeaking && (
                   <div className="flex gap-1 items-center h-4 py-2 px-1">
                     {[...Array(3)].map((_, i) => (
                       <div key={i} className="w-1 bg-blue-500 rounded-full animate-bounce h-2" style={{ animationDelay: `${i * 100}ms` }} />
                     ))}
                   </div>
                )}
                
                {(isThinking || thinkingStatus) && (
                  <div className="flex items-center gap-2 px-2 animate-in fade-in slide-in-from-left-2 duration-300">
                     <div className="flex gap-0.5">
                       <div className="size-1 bg-blue-500 rounded-full animate-pulse" />
                       <div className="size-1 bg-blue-500 rounded-full animate-pulse delay-75" />
                       <div className="size-1 bg-blue-500 rounded-full animate-pulse delay-150" />
                     </div>
                     <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                       {thinkingStatus || "Director Thinking"}
                     </span>
                  </div>
                )}

                {isConnected && (
                  <div className="flex items-center gap-3 py-2 px-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
                     {narrative?.narrativeStrength?.overallScore >= 80 ? (
                       <Button 
                         onClick={() => handleSendText("Suggest a tactical video angle for my current narrative.")}
                         className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest h-10 rounded-2xl px-6 gap-2 shadow-lg shadow-blue-900/40"
                       >
                         <Play className="size-3.5 fill-current" />
                         Generate New Angle
                       </Button>
                     ) : (
                       <Button 
                         onClick={() => handleSendText("Deduce my brand strategy now.")}
                         variant="outline"
                         className="border-white/10 bg-white/5 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest h-10 rounded-2xl px-6 gap-2"
                       >
                         <Sparkles className="size-3.5 text-blue-400" />
                         Deduce Narrative Logic
                       </Button>
                     )}
                     
                     <div className="flex-1" />

                     <Button 
                       variant="ghost" 
                       onClick={() => {
                          const fabToggle = document.querySelector('[data-director-fab]') as HTMLButtonElement;
                          if (fabToggle) fabToggle.click(); // This closes the dialog if it's the same button, or we just call onClose
                          onClose();
                       }}
                       className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300"
                     >
                       Close Session
                     </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                 <div className="relative size-24">
                   <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-2xl animate-pulse" />
                   <div className="relative size-full rounded-3xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                     <Brain className="size-10 text-slate-800" />
                   </div>
                 </div>
                 <div className="text-center space-y-2">
                   <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">Ignite the Matrix</h3>
                   <p className="text-[11px] text-slate-500 leading-relaxed font-medium text-center max-w-[280px]">
                      Awaken the Director Intelligence to stress-test your narrative strategy and uncover hidden tactical angles.
                   </p>
                 </div>
                 <Button 
                   onClick={connect} 
                   disabled={isConnecting}
                   className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[10px] gap-3 shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                 >
                   {isConnecting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                   Start Brainstorming
                 </Button>
              </div>
            )}
          </div>

          {/* Bottom Interaction Bar (Compact) */}
          {isConnected && (
            <div className="p-6 pt-2 bg-gradient-to-t from-black to-transparent space-y-4">
              {/* Floating Quick Actions (Scrollable row) */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {(dynamicSuggestions.length > 0 ? dynamicSuggestions : [
                    "Explore the Villain",
                    "How can we scale this?",
                    "What's the core transformation?",
                    "Identify the Hero"
                  ]).map((suggestion, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        handleSendText(suggestion);
                        setDynamicSuggestions([]); // Clear until next response
                      }}
                      className="whitespace-nowrap px-3 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-xl text-[9px] font-bold text-slate-400 hover:bg-blue-600/10 hover:text-blue-400 hover:border-blue-500/20 transition-all uppercase tracking-widest"
                    >
                      {suggestion}
                    </button>
                  ))}
              </div>

              <div className="relative group">
                <input 
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                  placeholder="Type your direction..."
                  className="w-full bg-white/[0.04] border border-white/5 focus:border-blue-500/40 focus:bg-white/[0.06] rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all pr-24"
                />
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  <Button 
                    onClick={toggleListening}
                    variant="ghost"
                    className={cn(
                      "size-10 rounded-xl p-0 flex items-center justify-center transition-all",
                      isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-slate-500 hover:text-white"
                    )}
                  >
                    <Mic className="size-4" />
                  </Button>
                  <Button 
                    onClick={() => handleSendText()}
                    disabled={!inputText.trim() || isConnecting}
                    className="size-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-0 flex items-center justify-center transition-all disabled:opacity-30"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   {isSyncing && (
                     <div className="flex items-center gap-2 text-blue-500 animate-pulse">
                        <Activity className="size-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Distilling Intelligence</span>
                     </div>
                   )}
                </div>
                <button 
                  onClick={disconnect}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-500 transition-colors"
                >
                  End Session
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
