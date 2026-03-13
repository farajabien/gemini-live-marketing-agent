"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Download, ExternalLink, Calendar, Search, Filter, FileText } from "lucide-react";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { VideoPlan } from "@/lib/types";

export function MediaScreen() {
  const { user } = useAuth();
  const [formatFilter, setFormatFilter] = useState("all");
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);

  const query = useMemo(
    () => user ? {
      videoPlans: {
        $: {
          where: { userId: user.id },
          order: { createdAt: "desc" },
          limit: 100,
        },
      }
    } : null,
    [user?.id]
  );

  const { data, isLoading } = (db as any).useQuery(query);
  const allPlans = ((data as any)?.videoPlans || []) as VideoPlan[];

  const formats = Array.from(new Set(allPlans.map(p => p.outputFormat || p.type))).filter(Boolean);

  const filteredPlans = allPlans.filter(p => {
    if (formatFilter === "all") return true;
    return (p.outputFormat || p.type) === formatFilter;
  });

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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/5">
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

           <div className="flex items-center gap-3">
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="w-[180px] h-12 bg-white/5 border-white/10 text-xs font-bold rounded-2xl">
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
           </div>
        </div>

        {/* Content Grid */}
        {filteredPlans.length === 0 ? (
          <div className="py-24 text-center space-y-6 bg-white/[0.02] border border-dashed border-white/10 rounded-[3rem]">
             <div className="size-24 rounded-full bg-white/5 flex items-center justify-center mx-auto">
               <Play className="size-10 text-slate-700" />
             </div>
             <div className="space-y-2">
               <h3 className="text-2xl font-black text-slate-400 uppercase italic tracking-tighter">Archive is empty</h3>
               <p className="text-slate-600 font-medium text-sm">Deploy your first project to start filling your library.</p>
             </div>
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
                       <Badge className="bg-blue-600/90 text-white border-none text-[8px] font-black uppercase tracking-widest px-3 py-1 mb-2">
                         {plan.outputFormat || plan.type}
                       </Badge>
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
