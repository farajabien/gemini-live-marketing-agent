"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSearchParams } from "next/navigation";
import { firebaseDb as db } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Search, Filter, ArrowUpDown, Type, Activity, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { StudioCard } from "@/components/dashboard/StudioCard";
import { VideoPlan } from "@/lib/types";
import Link from "next/link";

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

  const [formatFilter, setFormatFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState(
    paramSeriesId ? "series" : paramNarrativeId ? "projects" : "all"
  ); 
  const [selectedSeriesId, setSelectedSeriesId] = useState(paramSeriesId || "all");
  const [selectedNarrativeId, setSelectedNarrativeId] = useState(paramNarrativeId || "all");
  const [sortOrder, setSortOrder] = useState("newest"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);

  // Sync filters if params change (useful for sidebar navigation)
  useEffect(() => {
    if (paramSeriesId) {
      setTypeFilter("series");
      setSelectedSeriesId(paramSeriesId);
    } else if (paramNarrativeId) {
      setTypeFilter("projects");
      setSelectedNarrativeId(paramNarrativeId);
    }
  }, [paramSeriesId, paramNarrativeId]);

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

  const lastNarrative = allNarratives[0];

  const formats = Array.from(new Set(allPlans.map(p => p.outputFormat || p.type))).filter(Boolean);

  const filteredPlans = useMemo(() => {
    let result = allPlans.filter(p => {
      // Hide active plans from the main grid to avoid duplication
      if (['pending', 'generating', 'generating_audio', 'rendering'].includes(p.status || '')) return false;

      // Format Filter
      if (formatFilter !== "all" && (p.outputFormat || p.type) !== formatFilter) return false;

      // Type Filter
      const isSeries = p.title?.includes(" - Episode ");
      if (typeFilter === "projects" && isSeries) return false;
      if (typeFilter === "series" && !isSeries) return false;

      // Granular Sub-filters
      if (typeFilter === "series" && selectedSeriesId !== "all") {
        const seriesObj = allSeries.find(s => s.id === selectedSeriesId);
        if (seriesObj && !p.title?.includes(seriesObj.title)) return false;
      }
      if (typeFilter === "projects" && selectedNarrativeId !== "all") {
        if (p.narrativeId !== selectedNarrativeId) return false;
      }

      // Search Filter
      if (searchTerm && !p.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      return true;
    });

    // Sort Logic
    result.sort((a: any, b: any) => {
      const isEpisodeA = a.title?.includes(" - Episode ");
      const isEpisodeB = b.title?.includes(" - Episode ");

      if (isEpisodeA && isEpisodeB) {
        const getSeriesTitle = (title: string = "") => title.split(" - Episode")[0];
        const titleA = getSeriesTitle(a.title);
        const titleB = getSeriesTitle(b.title);
        
        if (titleA !== titleB) {
          return titleA.localeCompare(titleB);
        }

        const getEpisodeNumber = (title: string = "") => {
          const match = title.match(/Episode (\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        return getEpisodeNumber(a.title) - getEpisodeNumber(b.title);
      }

      // If one is an episode and the other isn't, maintain chronological order or put projects first?
      // Let's stick to chronological order for the mix
      if (sortOrder === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOrder === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      return 0;
    });

    return result;
  }, [allPlans, formatFilter, typeFilter, selectedSeriesId, selectedNarrativeId, searchTerm, sortOrder, allSeries]);

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
      "min-h-screen bg-black text-white font-sans selection:bg-blue-500/30",
      isIntegrated && "min-h-0 bg-transparent flex-1 overflow-y-auto"
    )}>
      <div className={cn(
        "w-full px-4 sm:px-6 lg:px-12 py-12 space-y-12",
        isIntegrated && "px-8 py-8"
      )}>
       <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                 <div className="relative w-full md:w-72 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      placeholder="Filter production assets..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-12 w-full bg-white/[0.02] border-white/10 rounded-[1.25rem] pl-11 text-xs font-bold focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all"
                    />
                 </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={typeFilter} onValueChange={(val) => {
                  setTypeFilter(val);
                  setSelectedSeriesId("all");
                  setSelectedNarrativeId("all");
                }}>
                  <SelectTrigger className="w-[150px] h-11 bg-white/[0.02] border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors">
                     <div className="flex items-center gap-2">
                       <Type className="size-3.5 text-slate-600" />
                       <SelectValue placeholder="Content Type" />
                     </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assets</SelectItem>
                    <SelectItem value="projects">Single Projects</SelectItem>
                    <SelectItem value="series">Series Episodes</SelectItem>
                  </SelectContent>
                </Select>

                {typeFilter === "series" && allSeries.length > 0 && (
                  <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
                    <SelectTrigger className="w-[200px] h-11 bg-blue-500/10 border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500/20 transition-colors">
                       <SelectValue placeholder="All Series" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Series</SelectItem>
                      {allSeries.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {typeFilter === "projects" && allNarratives.length > 0 && (
                  <Select value={selectedNarrativeId} onValueChange={setSelectedNarrativeId}>
                    <SelectTrigger className="w-[200px] h-11 bg-purple-500/10 border-purple-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-500/20 transition-colors">
                       <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {allNarratives.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="h-4 w-px bg-white/10 hidden lg:block mx-2" />

              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-[150px] h-11 bg-white/[0.02] border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-2">
                     <Filter className="size-3.5 text-slate-600" />
                     <SelectValue placeholder="Format" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Formats</SelectItem>
                  {formats.map(f => (
                    <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[150px] h-11 bg-white/[0.02] border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors ml-auto">
                   <div className="flex items-center gap-2">
                     <ArrowUpDown className="size-3.5 text-slate-600" />
                     <SelectValue placeholder="Sort Order" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
              </Select>
           </div>
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

        {/* Content Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
             <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Archive Grid</span>
             <div className="flex-1 h-px bg-white/[0.03]" />
          </div>

          {allPlans.length === 0 ? (
            <div className="py-24 text-center space-y-6 bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem]">
               <div className="size-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto opacity-20">
                 <Play className="size-8" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter opacity-30">Studio empty</h3>
                 <p className="text-slate-600 font-medium text-xs">Trigger the War Room to start producing assets.</p>
               </div>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="py-20 text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[3rem]">
               <Search className="size-10 text-slate-800 mx-auto" />
               <div className="space-y-1">
                 <h3 className="text-lg font-bold text-slate-500">No assets match your filters</h3>
                 <Button 
                   variant="link" 
                   className="text-blue-500 font-bold text-[10px] uppercase tracking-widest"
                   onClick={() => {
                     setSearchTerm("");
                     setFormatFilter("all");
                     setTypeFilter("all");
                   }}
                 >
                   Reset Search
                 </Button>
               </div>
            </div>
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
      </div>

      <PreviewDialog 
        isOpen={!!previewPlan}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}
