"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import { firebaseDb as db } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Search, Activity, Loader2, LayoutGrid, Layers, FolderHeart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudioCard } from "@/components/dashboard/StudioCard";
import { VideoPlan } from "@/lib/types";
import { downloadPlanAssets } from "@/lib/download-utils";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "../ui/input";

interface MediaScreenProps {
  overrideNarrativeId?: string;
  overrideSeriesId?: string;
  isIntegrated?: boolean;
}

export function MediaScreen({ 
  overrideNarrativeId, 
  overrideSeriesId, 
  isIntegrated 
}: MediaScreenProps = {}) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Initialize filters from props or search params
  const paramNarrativeId = overrideNarrativeId || searchParams.get("narrativeId");
  const paramSeriesId = overrideSeriesId || searchParams.get("seriesId");

  const [selectedTab, setSelectedTab] = useState(
    paramSeriesId ? "series" : paramNarrativeId ? "projects" : "all"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState<Record<string, boolean>>({});
  const { refreshToken } = useAuth();

  const query = useMemo(
    () => user ? {
      videoPlans: {
        $: {
          where: { userId: user.id },
          order: { createdAt: "desc" },
          limit: 100,
        },
      },
      activePlans: {
        $: {
          collection: 'videoPlans',
          where: { 
            userId: user.id, 
            status: { in: ['pending', 'generating', 'generating_audio', 'rendering'] } 
          },
          order: { createdAt: 'desc' },
          limit: 10
        }
      },
      series: {
        $: { 
          where: { userId: user.id },
          order: { createdAt: "desc" }
        }
      },
      narratives: {
        $: { 
          where: { userId: user.id },
          order: { createdAt: "desc" }
        }
      }
    } : null,
    [user?.id]
  );

  const { data, isLoading } = (db as any).useQuery(query);
  const allPlans = ((data as any)?.videoPlans || []) as VideoPlan[];
  const activePlans = ((data as any)?.activePlans || []) as VideoPlan[];
  const allSeries = ((data as any)?.series || []) as any[];
  const allNarratives = ((data as any)?.narratives || []) as any[];

  // Robust identification of parent series/narrative
  const getParentInfo = (plan: VideoPlan): { sId: string; nId: string } => {
    const sId = plan.seriesId || (plan as any).series;
    const nId = plan.narrativeId;
    
    // If we have a series ID, prioritize it
    if (sId && sId !== 'orphaned') return { sId: sId as string, nId: (nId || 'orphaned') as string };
    
    // If we have a narrative ID, check if it belongs to a series
    if (nId) {
      const parentSeries = allSeries.find(s => s.id === nId || s.seriesNarrativeId === nId);
      if (parentSeries) return { sId: parentSeries.id as string, nId: nId as string };
    }
    
    return { sId: (sId || 'orphaned') as string, nId: (nId || 'orphaned') as string };
  };

  const filteredPlans = useMemo(() => {
    return allPlans.filter(p => {
      // 1. Exclude active productions from main grid
      if (['pending', 'generating', 'generating_audio', 'rendering'].includes(p.status || '')) return false;
      
      const { sId, nId } = getParentInfo(p);

      // 2. Filter by Series ID if provided (Integrated Mode)
      if (paramSeriesId && sId !== paramSeriesId) return false;
      
      // 3. Filter by Narrative ID if provided (Integrated Mode)
      if (paramNarrativeId && nId !== paramNarrativeId) return false;

      // 4. Search Filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = p.title?.toLowerCase().includes(term);
        
        // Also check parent titles
        const seriesTitle = allSeries.find(s => s.id === sId)?.title?.toLowerCase();
        const narrativeTitle = allNarratives.find(n => n.id === nId)?.title?.toLowerCase();
        
        if (!matchesTitle && !seriesTitle?.includes(term) && !narrativeTitle?.includes(term)) return false;
      }

      return true;
    });
  }, [allPlans, searchTerm, paramSeriesId, paramNarrativeId, allSeries, allNarratives]);

  const groupedBySeries = useMemo(() => {
    const groups: Record<string, VideoPlan[]> = {};
    filteredPlans.forEach(plan => {
      const { sId } = getParentInfo(plan);
      if (!groups[sId]) groups[sId] = [];
      groups[sId].push(plan);
    });
    return groups;
  }, [filteredPlans, allSeries]);

  const groupedByProject = useMemo(() => {
    const groups: Record<string, VideoPlan[]> = {};
    filteredPlans.forEach(plan => {
      const { nId } = getParentInfo(plan);
      if (!groups[nId]) groups[nId] = [];
      groups[nId].push(plan);
    });
    return groups;
  }, [filteredPlans, allSeries]);

  const handleDownloadAll = async (seriesId: string, plans: VideoPlan[]) => {
    if (isDownloadingAll[seriesId]) return;
    
    setIsDownloadingAll(prev => ({ ...prev, [seriesId]: true }));
    try {
      const completedPlans = plans.filter(p => p.status === 'completed' && p.videoUrl);
      
      for (let i = 0; i < completedPlans.length; i++) {
        const plan = completedPlans[i];
        // Sequential download with small delay to avoid browser blocking
        await downloadPlanAssets(plan, null, refreshToken);
        if (i < completedPlans.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } catch (err) {
      console.error("Bulk download failed:", err);
    } finally {
      setIsDownloadingAll(prev => ({ ...prev, [seriesId]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <Loader2 className="size-8 text-blue-500 animate-spin mb-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Syncing Media State...</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#020205] text-white font-sans selection:bg-blue-500/30",
      isIntegrated && "min-h-0 bg-transparent flex-1 overflow-y-auto"
    )}>
      {/* Background Aura */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className={cn(
        "relative z-10 w-full px-4 sm:px-6 lg:px-12 py-12 space-y-12",
        isIntegrated && "px-8 py-8"
      )}>
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-1">
             <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white">Media Archive</h1>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Universal Intelligence Repository</p>
           </div>

           <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
              <Input 
                placeholder="Search archive..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 w-full bg-white/[0.02] border-white/10 rounded-2xl pl-11 text-xs font-bold focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all"
              />
           </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full space-y-12">
          <TabsList className="bg-white/[0.02] border border-white/5 p-1 rounded-2xl h-14 w-full md:w-fit">
            <TabsTrigger value="all" className="rounded-xl px-8 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest gap-2">
              <LayoutGrid className="size-3.5" /> All Assets
            </TabsTrigger>
            <TabsTrigger value="series" className="rounded-xl px-8 data-[state=active]:bg-amber-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest gap-2">
              <Layers className="size-3.5" /> Series Archive
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-8 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest gap-2">
              <FolderHeart className="size-3.5" /> Project Gallery
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-12 outline-none">
            {/* Active Productions Section */}
            {activePlans.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20">
                      <Activity className="size-3 text-blue-500 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Active Productions</span>
                   </div>
                   <div className="flex-1 h-px bg-blue-600/10" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {activePlans.map((plan) => (
                     <StudioCard
                       key={plan.id}
                       variant="media"
                       data={plan}
                       onPreview={setPreviewPlan}
                     />
                   ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Archive Grid</span>
                 <div className="flex-1 h-px bg-white/[0.03]" />
              </div>

              {filteredPlans.length === 0 ? (
                <EmptyArchive onReset={() => setSearchTerm("")} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredPlans.map((plan) => (
                    <StudioCard
                      key={plan.id}
                      variant="media"
                      data={plan}
                      onPreview={setPreviewPlan}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="series" className="space-y-12 outline-none">
             {Object.keys(groupedBySeries).filter(id => id !== 'orphaned').length === 0 ? (
               <EmptyArchive title="No series found" sub="Start a serial narrative to populate this archive." onReset={() => setSearchTerm("")} />
             ) : (
               <div className="space-y-16">
                 {Object.entries(groupedBySeries).filter(([id]) => id !== 'orphaned').map(([sId, plans]) => {
                   const series = allSeries.find(s => s.id === sId) || { title: "Archived Series" };
                   return (
                     <div key={sId} className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                           <div className="space-y-2">
                             <div className="flex items-center gap-3">
                               <div className="size-10 rounded-xl bg-amber-600/10 border border-amber-600/20 flex items-center justify-center text-amber-500">
                                 <Layers className="size-5" />
                               </div>
                               <h2 className="text-2xl font-black italic uppercase tracking-tighter">{series.title}</h2>
                             </div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-550 pl-1">{plans.length} EPISODES GENERATED</p>
                           </div>
                           <div className="flex items-center gap-3">
                             <Button 
                               onClick={() => handleDownloadAll(sId, plans)}
                               disabled={isDownloadingAll[sId] || plans.filter(p => p.status === 'completed').length === 0}
                               variant="outline" 
                               className="h-10 border-blue-500/20 bg-blue-500/5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500/10 text-blue-400 gap-2"
                             >
                               {isDownloadingAll[sId] ? (
                                 <>
                                   <Loader2 className="size-3.5 animate-spin" />
                                   Downloading...
                                 </>
                               ) : (
                                 <>
                                   <Download className="size-3.5" />
                                   Download All Episodes
                                 </>
                               )}
                             </Button>
                             <Link href={`/series/${sId}`}>
                               <Button variant="outline" className="h-10 border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10">
                                 Open Series Console
                               </Button>
                             </Link>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                          {plans.map((plan) => (
                            <StudioCard
                              key={plan.id}
                              variant="media"
                              data={plan}
                              onPreview={setPreviewPlan}
                            />
                          ))}
                        </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </TabsContent>

          <TabsContent value="projects" className="space-y-12 outline-none">
             {Object.keys(groupedByProject).filter(id => id !== 'orphaned').length === 0 ? (
               <EmptyArchive title="No project assets found" sub="Create marketing videos within your project war rooms." onReset={() => setSearchTerm("")} />
             ) : (
               <div className="space-y-16">
                 {Object.entries(groupedByProject).filter(([id]) => id !== 'orphaned').map(([nId, plans]) => {
                   const narrative = allNarratives.find(n => n.id === nId) || { title: "Studio Project" };
                   return (
                     <div key={nId} className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                           <div className="space-y-2">
                             <div className="flex items-center gap-3">
                               <div className="size-10 rounded-xl bg-purple-600/10 border border-purple-600/20 flex items-center justify-center text-purple-500">
                                 <FolderHeart className="size-5" />
                               </div>
                               <h2 className="text-2xl font-black italic uppercase tracking-tighter">{narrative.title}</h2>
                             </div>
                             <p className="text-[10px] font-black uppercase tracking-widest text-slate-550 pl-1">{plans.length} ASSETS CREATED</p>
                           </div>
                           <Link href={`/narrative/${nId}`}>
                             <Button variant="outline" className="h-10 border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10">
                               Go to War Room
                             </Button>
                           </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                          {plans.map((plan) => (
                            <StudioCard
                              key={plan.id}
                              variant="media"
                              data={plan}
                              onPreview={setPreviewPlan}
                            />
                          ))}
                        </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </TabsContent>
        </Tabs>
      </div>

      <PreviewDialog 
        isOpen={!!previewPlan}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}

function EmptyArchive({ title = "Studio empty", sub = "Trigger the War Room to start producing assets.", onReset }: { title?: string, sub?: string, onReset: () => void }) {
  return (
    <div className="py-24 text-center space-y-6 bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem]">
       <div className="size-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto opacity-20">
         <Play className="size-8" />
       </div>
       <div className="space-y-2">
         <h3 className="text-xl font-black text-white uppercase italic tracking-tighter opacity-30">{title}</h3>
         <p className="text-slate-600 font-medium text-xs mb-4">{sub}</p>
         <Button 
            variant="link" 
            className="text-blue-500 font-bold text-[10px] uppercase tracking-widest"
            onClick={onReset}
          >
            Clear Filters
          </Button>
       </div>
    </div>
  );
}
