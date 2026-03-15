"use client";

import { useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { DirectorChat } from "./DirectorChat";
import { NarrativeCanvas } from "./NarrativeCanvas";
import { updateNarrativeField, generateSmartTitleAction } from "@/app/actions/marketing";
import { Activity, Sparkles, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { MediaScreen } from "@/components/screens/MediaScreen";
import { WarRoomLayout } from "@/components/layout/WarRoomLayout";
import { useDocument, useCollection } from "@/hooks/use-firestore";
import { toast } from "sonner";

interface NarrativeOverviewScreenProps {
  narrativeId: string;
}

export function NarrativeOverviewScreen({ narrativeId: propId }: NarrativeOverviewScreenProps) {
  const { id: paramsId } = useParams() as { id: string };
  const narrativeId = propId || paramsId;
  
  const { user, isLoading: isAuthLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const isMediaView = searchParams.get("type") === "media";

  const { data: narrative, isLoading: isLoadingNarrative } = useDocument('narratives', narrativeId);
  const { data: videoPlans } = useCollection(
    'videoPlans',
    {
      where: [
        { field: 'narrativeId', operator: '==', value: narrativeId },
        { field: 'userId', operator: '==', value: user?.id || 'guest' }
      ],
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
      limit: 12
    }
  );

  if (isAuthLoading || isLoadingNarrative) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!narrative) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background text-foreground">
        <h1 className="text-2xl font-black mb-2 text-center italic uppercase leading-tight tracking-[0.2em] opacity-30">Narrative Not Found</h1>
        <Button onClick={() => router.push('/dashboard')} variant="ghost" className="text-red-500 font-bold hover:bg-red-500/10 uppercase tracking-widest text-[10px]">
          Return to Hub
        </Button>
      </div>
    );
  }

  const handleGenerateSmartTitle = async () => {
    setIsGeneratingTitle(true);
    try {
      await generateSmartTitleAction(narrativeId, user.id);
      toast.success("Strategic title distilled.");
    } catch (error) {
      console.error("Failed to generate smart title:", error);
      toast.error("Failed to distill title.");
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    try {
      await updateNarrativeField(narrativeId, field, value, user.id);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
      toast.error(`Update failed: ${field}`);
    }
  };

  const handleTitleClick = () => {
    setTempTitle(narrative?.title || "");
    setIsEditingTitle(true);
  };

  const handleTitleSubmit = async () => {
    if (!tempTitle.trim() || tempTitle === narrative?.title) {
      setIsEditingTitle(false);
      return;
    }
    
    // Optimistic update
    const promise = handleUpdateField('title', tempTitle);
    setIsEditingTitle(false);
    
    toast.promise(promise, {
      loading: 'Saving title...',
      success: 'Title updated.',
      error: 'Failed to update title.'
    });
  };

  const handleTitleCancel = () => {
    setIsEditingTitle(false);
  };

  return (
    <AppLayout 
      narrativeId={narrativeId} 
      noPadding 
      headerTitle={
        <div className="flex items-center gap-3">
           <div className="size-6 rounded bg-red-600/20 text-red-500 flex items-center justify-center text-[10px] font-black uppercase">
              {narrative?.title?.charAt(0)}
           </div>
            <div className="flex flex-col min-w-0 flex-1">
               {isEditingTitle ? (
                 <input
                   autoFocus
                   type="text"
                   value={tempTitle}
                   onChange={(e) => setTempTitle(e.target.value)}
                   onBlur={handleTitleSubmit}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') handleTitleSubmit();
                     if (e.key === 'Escape') handleTitleCancel();
                   }}
                   className="bg-white/5 border border-blue-500/50 rounded px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wider outline-none w-full max-w-[300px]"
                 />
               ) : (
                 <span 
                   onClick={handleTitleClick}
                   className="text-[10px] font-black text-white uppercase tracking-wider truncate max-w-[200px] cursor-pointer hover:text-blue-400 transition-colors group flex items-center gap-2"
                 >
                   {narrative?.title}
                   <span className="opacity-0 group-hover:opacity-100 material-symbols-outlined text-[10px]">edit</span>
                 </span>
               )}
               <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active War Room</span>
            </div>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-2">
           <Button
             variant="ghost"
             size="sm"
             onClick={handleGenerateSmartTitle}
             disabled={isGeneratingTitle}
             className="h-7 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 gap-1.5"
           >
             {isGeneratingTitle ? <Activity className="size-3 animate-spin" /> : <Sparkles className="size-3 text-red-500" />}
             Analysis
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => router.push(`/narrative/${narrativeId}${isMediaView ? '' : '?type=media'}`)}
             className="h-7 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 gap-1.5"
           >
             <LayoutGrid className="size-3 text-blue-500" />
             {isMediaView ? "Strategic" : "Assets"}
           </Button>
           <div className="h-4 w-px bg-white/10 mx-1" />
           <button 
             onClick={() => router.push(`/narrative/${narrativeId}/drafts`)}
             className="h-8 px-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-red-600/50 transition-all flex items-center gap-2"
           >
              <span className="material-symbols-outlined text-sm">movie</span>
              Scripts
           </button>
        </div>
      }
    >
      {isMediaView ? (
        <MediaScreen isIntegrated={true} overrideNarrativeId={narrativeId} />
      ) : (
        <WarRoomLayout
          leftPane={<DirectorChat narrativeId={narrativeId} inline className="h-full" />}
          rightPane={
            <NarrativeCanvas 
              narrative={narrative} 
              videoPlans={videoPlans || []}
              isGeneratingTitle={isGeneratingTitle}
              onGenerateSmartTitle={handleGenerateSmartTitle}
              onUpdateField={handleUpdateField}
            />
          }
        />
      )}
    </AppLayout>
  );
}
