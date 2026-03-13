"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Play, Download, ExternalLink, Calendar, Search, Filter, FileText, ArrowUpDown, Clock, Type } from "lucide-react";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { VideoPlan } from "@/lib/types";

export function MediaScreen() {
  const { user } = useAuth();
  const [formatFilter, setFormatFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // 'all', 'projects', 'series'
  const [selectedSeriesId, setSelectedSeriesId] = useState("all");
  const [selectedNarrativeId, setSelectedNarrativeId] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest', 'oldest', 'title'
  const [searchTerm, setSearchTerm] = useState("");
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);

  const query = useMemo(
    () => user ? {
      videoPlans: {
        $: {
          where: { userId: user.id },
          order: { createdAt: "desc" },
          limit: 100,
        },
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
  const allSeries = ((data as any)?.series || []) as any[];
  const allNarratives = ((data as any)?.narratives || []) as any[];

  const formats = Array.from(new Set(allPlans.map(p => p.outputFormat || p.type))).filter(Boolean);

  const filteredPlans = useMemo(() => {
    let result = allPlans.filter(p => {
      // Format Filter
      if (formatFilter !== "all" && (p.outputFormat || p.type) !== formatFilter) return false;

      // Type Filter (detect series by title pattern)
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
    result.sort((a, b) => {
      if (sortOrder === "newest") return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOrder === "oldest") return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortOrder === "title") return (a.title || "").localeCompare(b.title || "");
      return 0;
    });

    return result;
  }, [allPlans, formatFilter, typeFilter, selectedSeriesId, selectedNarrativeId, searchTerm, sortOrder, allSeries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#020205]">
        <div className="size-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020205] text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col gap-10 pb-8 border-b border-white/5">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4">
                 <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 rounded-full px-4 py-1.5 border border-purple-500/20">
                   <Play className="size-3.5 fill-current" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Global Archives</span>
                 </div>
                 <h1 className="text-5xl font-black tracking-tight italic">Media Library</h1>
                 <p className="text-slate-500 text-lg max-w-2xl font-medium">
                   Your tactical arsenal. Every video, carousel, and generated masterpiece, ready for the world.
                 </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                 <div className="relative w-full md:w-64 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                      placeholder="Search projects..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-12 w-full bg-white/5 border-white/10 rounded-2xl pl-11 text-xs font-bold focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all"
                    />
                 </div>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Select value={typeFilter} onValueChange={(val) => {
                  setTypeFilter(val);
                  setSelectedSeriesId("all");
                  setSelectedNarrativeId("all");
                }}>
                  <SelectTrigger className="w-[140px] h-11 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors">
                     <div className="flex items-center gap-2">
                       <Type className="size-3.5 text-slate-500" />
                       <SelectValue placeholder="Type" />
                     </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Content</SelectItem>
                    <SelectItem value="projects">Single Projects</SelectItem>
                    <SelectItem value="series">Series Episodes</SelectItem>
                  </SelectContent>
                </Select>

                {/* Granular Sub-Filters */}
                {typeFilter === "series" && allSeries.length > 0 && (
                  <Select value={selectedSeriesId} onValueChange={setSelectedSeriesId}>
                    <SelectTrigger className="w-[180px] h-11 bg-blue-500/10 border-blue-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500/20 transition-colors animate-in fade-in slide-in-from-left-2 transition-all">
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
                    <SelectTrigger className="w-[180px] h-11 bg-purple-500/10 border-purple-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-500/20 transition-colors animate-in fade-in slide-in-from-left-2 transition-all">
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

              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-2">
                     <Filter className="size-3.5 text-slate-500" />
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
                <SelectTrigger className="w-[140px] h-11 bg-white/5 border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-colors ml-auto">
                   <div className="flex items-center gap-2">
                     <ArrowUpDown className="size-3.5 text-slate-500" />
                     <SelectValue placeholder="Sort" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title">By Title</SelectItem>
                </SelectContent>
              </Select>
           </div>
        </div>

        {/* Content Grid */}
        {allPlans.length === 0 ? (
          <div className="py-24 text-center space-y-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
             <div className="size-24 rounded-full bg-white/5 flex items-center justify-center mx-auto">
               <Play className="size-10 text-slate-700" />
             </div>
             <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-400 uppercase italic tracking-tighter">Archive is empty</h3>
               <p className="text-slate-600 font-medium text-sm">Deploy your first project to start filling your library.</p>
             </div>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="py-24 text-center space-y-4 bg-white/[0.01] border border-white/5 rounded-[3rem]">
             <Search className="size-10 text-slate-700 mx-auto" />
             <div className="space-y-1">
               <h3 className="text-xl font-bold text-slate-400">No matches found</h3>
               <p className="text-slate-600 text-xs">Try adjusting your filters or search term.</p>
             </div>
             <Button 
               variant="link" 
               className="text-blue-500 font-bold text-xs"
               onClick={() => {
                 setSearchTerm("");
                 setFormatFilter("all");
                 setTypeFilter("all");
                 setSelectedSeriesId("all");
                 setSelectedNarrativeId("all");
               }}
             >
               Clear all filters
             </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPlans.map((plan) => (
              <Card key={plan.id} className="bg-[#08080c] border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-blue-500/20 transition-all shadow-2xl hover:shadow-blue-500/5">
                 <div className="aspect-video relative overflow-hidden bg-slate-900">
                    {plan.thumbnailUrl ? (
                      <img src={plan.thumbnailUrl} className="size-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-100" />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
                         <Play className="size-12 text-slate-800" />
                      </div>
                    )}
                    
                    <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black to-transparent">
                       <div className="flex items-center gap-2 mb-2">
                         <Badge className="bg-blue-600/90 text-white border-none text-[8px] font-black uppercase tracking-widest px-3 py-1">
                           {plan.outputFormat || plan.type}
                         </Badge>
                         {plan.title?.includes(" - Episode ") && (
                            <Badge className="bg-amber-600/90 text-white border-none text-[8px] font-black uppercase tracking-widest px-3 py-1">
                              Series
                            </Badge>
                         )}
                       </div>
                       <h3 className="text-xl font-black text-white italic truncate leading-tight tracking-tight">
                         {plan.title || "Untitled Project"}
                       </h3>
                    </div>

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                       <Button 
                         onClick={() => setPreviewPlan(plan)}
                         className="size-14 rounded-full bg-white text-black hover:bg-blue-500 hover:text-white transition-all scale-90 group-hover:scale-100"
                        >
                          <Play className="size-6 fill-current" />
                       </Button>
                    </div>
                 </div>

                 <CardContent className="p-8 space-y-6">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-600">
                       <div className="flex items-center gap-2">
                         <Calendar className="size-3.5" />
                          {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : "No Date"}
                       </div>
                       {plan.duration && (
                         <div className="flex items-center gap-2">
                           <Clock className="size-3.5" />
                           {plan.duration}s
                         </div>
                       )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <Button 
                         onClick={() => setPreviewPlan(plan)}
                         variant="outline" 
                         className="border-white/10 text-white hover:bg-white/5 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] gap-2"
                        >
                          <ExternalLink className="size-3.5" />
                          View
                       </Button>
                       <Button 
                         variant="outline" 
                         className="border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] gap-2"
                         disabled={!plan.videoUrl}
                         onClick={() => plan.videoUrl && window.open(plan.videoUrl, '_blank')}
                        >
                          <Download className="size-3.5" />
                          Save
                       </Button>
                    </div>
                 </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PreviewDialog 
        isOpen={!!previewPlan}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}
