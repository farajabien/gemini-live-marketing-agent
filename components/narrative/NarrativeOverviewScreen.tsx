"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { DirectorChat } from "./DirectorChat";
import { NarrativeCanvas } from "./NarrativeCanvas";
import { updateNarrativeField, generateSmartTitleAction } from "@/app/actions/marketing";
import { Brain, Activity, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaScreen } from "@/components/screens/MediaScreen";

interface NarrativeOverviewScreenProps {
  narrativeId: string;
}

export function NarrativeOverviewScreen({ narrativeId }: NarrativeOverviewScreenProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const isMediaView = searchParams.get("type") === "media";

  const query = useMemo(
    () => user ? { 
      narratives: { $: { where: { id: narrativeId } } },
      videoPlans: { $: { where: { narrativeId: narrativeId }, order: { createdAt: "desc" }, limit: 12 } }
    } : null,
    [user?.id, narrativeId]
  );
  
  const { data, isLoading, error } = (db as any).useQuery(query);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-black">
        <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Brain className="size-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Query Error</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error.message || "Failed to load narrative data."}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 text-white hover:bg-white/5">
          Retry Connection
        </Button>
      </div>
    );
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const narrative = (data as any)?.narratives?.[0];
  const videoPlans = (data as any)?.videoPlans || [];

  if (!narrative) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black">
        <h1 className="text-2xl font-black mb-2 text-white text-center italic uppercase leading-tight tracking-[0.2em] opacity-30">Narrative Not Found</h1>
        <Button onClick={() => window.location.href = '/dashboard'} variant="ghost" className="text-blue-500 font-bold hover:bg-blue-500/10 uppercase tracking-widest text-[10px]">
          Return to Hub
        </Button>
      </div>
    );
  }

  const handleGenerateSmartTitle = async () => {
    setIsGeneratingTitle(true);
    try {
      await generateSmartTitleAction(narrativeId, user.id || (user as any).uid);
    } catch (error) {
      console.error("Failed to generate smart title:", error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    try {
      await updateNarrativeField(narrativeId, field, value, user.id);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === narrative.title) {
      setIsEditingTitle(false);
      return;
    }
    await handleUpdateField("title", editedTitle);
    setIsEditingTitle(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Dynamic Header Strip */}
      <div className="px-6 py-3 border-b border-white/[0.03] bg-black/40 backdrop-blur-md flex items-center justify-between shrink-0">
         <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-500 mb-1">Active War Room</span>
              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  className="bg-white/5 border border-blue-500/30 rounded-lg px-2 py-0.5 text-sm font-black text-white outline-none"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                />
              ) : (
                <h1 
                  className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={() => {
                    setEditedTitle(narrative.title);
                    setIsEditingTitle(true);
                  }}
                >
                  {narrative.title}
                </h1>
              )}
            </div>
            
            <div className="h-4 w-px bg-white/5 hidden sm:block" />
            
            <div className="hidden md:flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Story Hook</span>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-[300px] italic">
                {narrative.oneLiner || "Your strategic narrative foundation..."}
              </p>
            </div>
         </div>

         <div className="flex items-center gap-4">
           {isMediaView ? (
             <Button 
               variant="outline" 
               size="sm" 
               onClick={() => router.push(`/narrative/${narrativeId}`)}
               className="h-8 rounded-xl border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/10 gap-2"
             >
               <ChevronLeft className="size-3" />
               Return to Planning
             </Button>
           ) : (
             <>
               {narrative.audience && (
                  <div className="hidden lg:flex flex-col items-end">
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Targeting</span>
                    <span className="text-[10px] text-blue-400/60 font-black truncate max-w-[200px] uppercase">{narrative.audience}</span>
                  </div>
               )}
               <div className="h-8 w-px bg-white/5" />
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleGenerateSmartTitle}
                 disabled={isGeneratingTitle}
                 className="h-8 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 gap-2"
               >
                 {isGeneratingTitle ? <Activity className="size-3 animate-spin" /> : <Sparkles className="size-3 text-blue-500" />}
                 Analysis
               </Button>
             </>
           )}
         </div>
      </div>

      {/* Main Split-Screen View */}
      {isMediaView ? (
        <MediaScreen isIntegrated={true} overrideNarrativeId={narrativeId} />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Intelligence Execution (Director Chat) */}
          <div className="flex-1 min-w-0 h-full">
            <DirectorChat 
              narrativeId={narrativeId} 
              inline={true} 
            />
          </div>

          {/* Right Pane: Narrative Visualization (Canvas) */}
          <div className="w-[380px] lg:w-[450px] shrink-0 h-full border-l border-white/[0.03] hidden sm:block">
            <NarrativeCanvas 
              narrative={narrative} 
              videoPlans={videoPlans}
              isGeneratingTitle={isGeneratingTitle}
              onGenerateSmartTitle={handleGenerateSmartTitle}
              onUpdateField={handleUpdateField}
            />
          </div>
        </div>
      )}
    </div>
  );
}
