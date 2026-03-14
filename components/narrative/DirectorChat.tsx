"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Brain, Sparkles, Activity, Loader2, MessageSquare, ChevronRight, X, ChevronUp, ChevronDown, CheckCircle2, ArrowRight, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCollection, useDocument } from "@/hooks/use-firestore";
import { useAuth } from "@/hooks/use-auth";
import { useGenerateStore } from "@/hooks/use-generate-store";

interface DirectorChatProps {
  narrativeId: string;
  seriesId?: string;
  onClose?: () => void;
  inline?: boolean;
  className?: string;
}

const COMMANDS = [
  { 
    id: "generate", 
    label: "/generate", 
    description: "Initialize verbatim video production", 
    icon: Sparkles,
    color: "text-blue-400"
  },
  { 
    id: "media", 
    label: "/media", 
    description: "Open the Media Library archive", 
    icon: Play,
    color: "text-emerald-400"
  },
  { 
    id: "status", 
    label: "/status", 
    description: "Check active production pulse", 
    icon: Activity,
    color: "text-amber-400"
  },
  { 
    id: "voice", 
    label: "/voice", 
    description: "Configure market voice profile", 
    icon: Brain,
    color: "text-purple-400"
  },
  { 
    id: "intel", 
    label: "/intel", 
    description: "Deep dive into narrative intelligence", 
    icon: Activity,
    color: "text-red-400"
  },
  { 
    id: "audience", 
    label: "/audience", 
    description: "Analyze current target audience", 
    icon: Sparkles,
    color: "text-indigo-400"
  }
];

export function DirectorChat({ narrativeId, seriesId, onClose, inline = false, className }: DirectorChatProps) {
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
  
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  
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
    
    // Command Execution Check
    if (text.startsWith("/")) {
      const command = COMMANDS.find(c => text.toLowerCase().startsWith(c.label.toLowerCase()));
      if (command) {
        executeCommand(command.id);
        setInputText("");
        return;
      }
    }

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
      clearInterval(thinkingInterval);
    }
  };

  const executeCommand = (commandId: string) => {
    setShowCommands(false);
    switch (commandId) {
      case "generate":
        useGenerateStore.getState().openGenerator({ narrativeId, seriesId });
        break;
      case "media":
        window.location.href = "/media";
        break;
      case "status":
        handleSendText("What is the current status of all my active video productions?");
        break;
      case "voice":
        handleSendText("I want to refine my brand's strategic voice profile.");
        break;
      default:
        toast.error("Unknown command");
    }
  };

  const filteredCommands = COMMANDS.filter(c => 
    c.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    
    if (val.endsWith("/")) {
      setShowCommands(true);
      setCommandQuery("");
      setSelectedIndex(0);
    } else if (val.includes("/")) {
      const parts = val.split("/");
      const query = parts[parts.length - 1];
      setShowCommands(true);
      setCommandQuery(query);
    } else {
      setShowCommands(false);
    }
  };

  const toggleCommands = () => {
    setShowCommands(!showCommands);
    if (!showCommands) {
      setCommandQuery("");
      setSelectedIndex(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommands) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter" && filteredCommands.length > 0) {
        e.preventDefault();
        executeCommand(filteredCommands[selectedIndex].id);
        setInputText("");
      } else if (e.key === "Escape") {
        setShowCommands(false);
      }
    } else if (e.key === "Enter") {
      handleSendText();
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
    <div className={cn(
      "relative flex flex-col h-full overflow-hidden bg-[#020205]",
      !inline && "rounded-[2rem] shadow-2xl shadow-blue-500/20 border border-white/5",
      inline && "max-h-[86vh]",
      className
    )}>
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

        <div className="flex items-center gap-4">
          {!isConnected && !isConnecting && (
            <Button 
              onClick={connect}
              className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/40 animate-in fade-in zoom-in-95 duration-500"
            >
              Wake Up
            </Button>
          )}

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

          <div className="flex items-center gap-2">
            {onClose && (
              <Button onClick={onClose} variant="ghost" size="icon" className="size-8 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">
                <X className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
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
                    I&apos;m your Director. We&apos;re going to build your brand brain organically through conversation. 
                    
                  </p>
                  {!isConnected && !isConnecting && (
                    <Button 
                      onClick={connect}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-[10px] gap-3 shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Mic className="size-4" />
                      Wake Up Director
                    </Button>
                  )}
                </div>
              </div>
          ) : null}

          {messages.map((m: any, i: number) => {
            const isDirector = m.role !== 'user';
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

                {onClose && (
                  <Button 
                    variant="ghost" 
                    onClick={onClose}
                    className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300"
                  >
                    Close Session
                  </Button>
                )}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Interaction Bar (Compact) */}
      <div className="p-6 pt-2 bg-gradient-to-t from-black to-transparent space-y-4">
        {/* Floating Quick Actions (Scrollable row) */}
        {isConnected && (
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
        )}

        <div className="relative group">
          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 w-full mb-3 p-2 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 backdrop-blur-3xl z-30">
              <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Director Commands</span>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-slate-600">Select</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono text-slate-400">ENTER</kbd>
                </div>
              </div>
              {filteredCommands.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    executeCommand(cmd.id);
                    setInputText("");
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group/cmd",
                    idx === selectedIndex ? "bg-white/5 border border-white/5" : "border border-transparent"
                  )}
                >
                  <div className={cn(
                    "size-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center transition-colors shadow-sm",
                    idx === selectedIndex ? "bg-white/10 text-white" : "text-slate-600 group-hover/cmd:text-white"
                  )}>
                    <cmd.icon className={cn("size-4", idx === selectedIndex ? cmd.color : "text-slate-600")} />
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest transition-colors",
                      idx === selectedIndex ? "text-white" : "text-slate-400 group-hover/cmd:text-white"
                    )}>
                      {cmd.label}
                    </span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{cmd.description}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <input 
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!isConnected && !isConnecting}
            placeholder={!isConnected ? "Wake up the Director to chat..." : "Type your direction or / for commands..."}
            className={cn(
              "w-full bg-white/[0.04] border border-white/5 focus:border-blue-500/40 focus:bg-white/[0.06] rounded-2xl px-5 py-3.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all pr-32",
              !isConnected && "cursor-not-allowed opacity-50"
            )}
          />
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <Button 
              onClick={toggleCommands}
              variant="ghost"
              disabled={!isConnected && !isConnecting}
              className={cn(
                "size-10 rounded-xl p-0 flex items-center justify-center transition-all",
                showCommands ? "text-blue-400 bg-blue-500/10" : "text-slate-500 hover:text-white"
              )}
            >
              <span className="text-base font-black">/</span>
            </Button>
            <Button 
              onClick={toggleListening}
              variant="ghost"
              disabled={!isConnected && !isConnecting}
              className={cn(
                "size-10 rounded-xl p-0 flex items-center justify-center transition-all",
                isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-slate-500 hover:text-white"
              )}
            >
              <Mic className="size-4" />
            </Button>
            <Button 
              onClick={() => handleSendText()}
              disabled={!inputText.trim() || isConnecting || !isConnected}
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
          {isConnected && (
            <button 
              onClick={disconnect}
              className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-500 transition-colors"
            >
              End Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
