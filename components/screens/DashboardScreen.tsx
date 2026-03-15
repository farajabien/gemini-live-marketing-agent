"use client";

import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudioCard } from "@/components/dashboard/StudioCard";
import { initializeDraftNarrative, initializeDraftSeriesAction } from "@/app/actions/marketing";
import { toast } from "sonner";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { ContentCard } from "@/components/narrative/ContentCard";
import { useGenerateStore } from "@/hooks/use-generate-store";
import type { VideoPlan, Series, FounderNarrative, ContentPiece, ContentStatus } from "@/lib/types";
import { Plus } from "lucide-react";

export function DashboardScreen() {
  const router = useRouter();
  const { user, isInitialLoading, refreshToken } = useAuth();
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [isCreatingInDashboard, setIsCreatingInDashboard] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"all" | "video" | "carousel">("all");
  const [contentSourceFilter, setContentSourceFilter] = useState<"all" | "narrative" | "direct">("all");
  const [narrativeOriginFilter, setNarrativeOriginFilter] = useState<string>("all");
  const [postingStatusFilter, setPostingStatusFilter] = useState<"all" | "posted" | "unposted">("all");

  const [contentFormatFilter, setContentFormatFilter] = useState<string>("all");
  const [mediaFormatFilter, setMediaFormatFilter] = useState<string>("all");
  // Media tab: "all" | "projects" | "series" - strict separation per plan
  const [mediaContextFilter, setMediaContextFilter] = useState<"all" | "projects" | "series">("all");

  const { data, isLoading: isPlansLoading } = (db as any).useQuery(
    useMemo(
      () =>
        user
          ? {
              videoPlans: {
                $: {
                  where: { userId: user.id },
                  order: { createdAt: "desc" },
                  limit: 50,
                },
              },
              narratives: {
                $: {
                  where: { userId: user.id },
                  order: { createdAt: "desc" },
                  limit: 50,
                },
              },
              series: {
                $: {
                  where: { userId: user.id },
                  order: { createdAt: "desc" },
                  limit: 50,
                },
              },
            }
          : null,
      [user?.id]
    )
  );

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Checking your account...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (isPlansLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading your studio...</p>
      </div>
    );
  }

  const allPlans = ((data as any)?.videoPlans || []) as VideoPlan[];
  const allNarratives = ((data as any)?.narratives || []) as FounderNarrative[];
  const allSeries = ((data as any)?.series || []) as Series[];

  // Compute dynamic format counts for Media
  const availableMediaFormats = new Set<string>();
  allPlans.forEach(p => {
    if (p.outputFormat) availableMediaFormats.add(p.outputFormat);
    else availableMediaFormats.add(p.type);
  });
  const mediaFormatsList = Array.from(availableMediaFormats).filter(Boolean);
  
  const mediaFormatCounts = mediaFormatsList.reduce((acc, format) => {
    acc[format] = allPlans.filter(p => p.outputFormat === format || (!p.outputFormat && p.type === format)).length;
    return acc;
  }, {} as Record<string, number>);

  const getFilteredPlans = () => {
    return allPlans.filter((p) => {
      // Media Format filter
      if (mediaFormatFilter !== "all") {
        const pFormat = p.outputFormat || p.type;
        if (pFormat !== mediaFormatFilter) return false;
      }

      // Advanced filter: Media type
      if (mediaTypeFilter !== "all" && p.type !== mediaTypeFilter) return false;
      // Filter by Project or Series context
      if (mediaContextFilter === "projects" && !p.narrativeId) return false;
      if (mediaContextFilter === "series" && !p.seriesId) return false;

      // Filter by specific Project
      if (narrativeOriginFilter !== "all" && p.narrativeId !== narrativeOriginFilter) return false;
      
      // Filter by specific Series
      // (Assuming p.seriesId exists or we eventually enrich it)
      // if (seriesOriginFilter !== "all" && p.seriesId !== seriesOriginFilter) return false;

      // Advanced filter: Posting status
      if (postingStatusFilter === "posted" && !p.postedAt) return false;
      if (postingStatusFilter === "unposted" && p.postedAt) return false;
      return true;
    });
  };

  const getCombinedProjects = () => {
    return getFilteredPlans().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const handleCopyPost = (body: string) => {
    navigator.clipboard.writeText(body);
  };

  const hasActiveFilters =
    mediaTypeFilter !== "all" || 
    contentSourceFilter !== "all" || 
    narrativeOriginFilter !== "all" || 
    postingStatusFilter !== "all";

  const EmptyState = ({
    icon,
    title,
    description,
    action,
  }: {
    icon: string;
    title: string;
    description: string;
    action?: React.ReactNode;
  }) => (
    <Card className="bg-card border-dashed border-border transition-colors">
      <CardContent className="flex flex-col items-center justify-center py-20">
        <div className="h-20 w-20 bg-secondary rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-3xl text-muted-foreground">
            {icon}
          </span>
        </div>
        <h3 className="text-xl font-black mb-2 text-foreground">{title}</h3>
        <p className="text-muted-foreground text-sm max-w-xs mb-8 font-medium text-center">
          {description}
        </p>
        {action}
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full font-sans text-foreground">
      <div className="w-full">
        <div className="w-full px-4 sm:px-6 py-6 lg:py-8 space-y-6">
          {/* Project / Narrative selector — shown once the user has more than one project */}
          {allNarratives.length > 1 && (
            <div className="mb-4">
              <Select value={narrativeOriginFilter} onValueChange={setNarrativeOriginFilter}>
                <SelectTrigger className="w-full max-w-xs h-10 bg-white/5 border-white/10 text-xs font-bold rounded-full">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {allNarratives.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.title || n.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Main Tabs */}
          <Tabs defaultValue="brand" className="w-full">
            <TabsList className="bg-secondary/50 border border-border mb-6 h-12 p-1.5 rounded-2xl gap-2">
              <TabsTrigger
                value="brand"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
              >
                <span className="material-symbols-outlined text-lg mr-2">token</span>
                Projects
                <Badge variant="secondary" className="ml-2 text-[9px] bg-red-500/10 text-red-500 border-none px-2">{allNarratives.length}</Badge>
              </TabsTrigger>

              <TabsTrigger
                value="series"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
              >
                <span className="material-symbols-outlined text-lg mr-2">auto_stories</span>
                Series
                <Badge variant="secondary" className="ml-2 text-[9px] bg-blue-500/10 text-blue-500 border-none px-2">{allSeries.length}</Badge>
              </TabsTrigger>

              <TabsTrigger
                value="media"
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
              >
                <span className="material-symbols-outlined text-lg mr-2">play_circle</span>
                Media Library
                <Badge variant="secondary" className="ml-2 text-[9px] bg-purple-500/10 text-purple-500 border-none px-2">{allPlans.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              {allNarratives.length === 0 ? (
                <EmptyState
                  icon="token"
                  title="Define your brand positioning"
                  description="Drop into the War Room. Talk to the Director to extract your core brand pillars."
                  action={
                    <Button
                      onClick={async () => {
                        setIsCreatingInDashboard(true);
                        try {
                          const { narrativeId } = await initializeDraftNarrative(user.id);
                          router.push(`/narrative/${narrativeId}`);
                        } catch (e) {
                          toast.error("Failed to start strategy");
                        } finally {
                          setIsCreatingInDashboard(false);
                        }
                      }}
                      disabled={isCreatingInDashboard}
                      className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 rounded-full px-8 h-11"
                    >
                      {isCreatingInDashboard ? "Creating..." : "Create Strategy"}
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <>
                    <button
                      onClick={async () => {
                        setIsCreatingInDashboard(true);
                        try {
                          const { narrativeId } = await initializeDraftNarrative(user.id);
                          router.push(`/narrative/${narrativeId}`);
                        } catch (e) {
                          toast.error("Failed to start strategy");
                        } finally {
                          setIsCreatingInDashboard(false);
                        }
                      }}
                      disabled={isCreatingInDashboard}
                      className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/5 hover:border-red-600/50 group h-full min-h-[200px]"
                    >
                      <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-red-600/20 group-hover:text-red-500 transition-colors">
                        <Plus className="size-6 text-white/20 group-hover:text-red-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">New Strategy</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-1">Engineer a brand</p>
                      </div>
                    </button>
                    {allNarratives.map((narrative) => (
                      <StudioCard
                        key={narrative.id}
                        variant="project"
                        data={narrative}
                      />
                    ))}
                  </>
                </div>
              )}
            </TabsContent>

            <TabsContent value="series" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              {allSeries.length === 0 ? (
                <EmptyState
                  icon="auto_stories"
                  title="Your storylines start here"
                  description="Talk to the Director to engineer your episodic content series from scratch."
                  action={
                    <Button
                      onClick={async () => {
                        setIsCreatingSeries(true);
                        try {
                          const { seriesId } = await initializeDraftSeriesAction(user.id);
                          router.push(`/series/${seriesId}`);
                        } catch (e) {
                          toast.error("Failed to start series");
                          setIsCreatingSeries(false);
                        }
                      }}
                      disabled={isCreatingSeries}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 rounded-full px-8 h-11"
                    >
                      {isCreatingSeries ? "Creating..." : "Create Series"}
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <>
                    <button
                      onClick={async () => {
                        setIsCreatingSeries(true);
                        try {
                          const { seriesId } = await initializeDraftSeriesAction(user.id);
                          router.push(`/series/${seriesId}`);
                        } catch (e) {
                          toast.error("Failed to start series");
                          setIsCreatingSeries(false);
                        }
                      }}
                      disabled={isCreatingSeries}
                      className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/5 hover:border-blue-600/50 group h-full min-h-[200px]"
                    >
                      <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-blue-600/20 group-hover:text-blue-500 transition-colors">
                        <Plus className="size-6 text-white/20 group-hover:text-blue-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">New Series</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mt-1">Design a storyline</p>
                      </div>
                    </button>
                    {allSeries.map((s) => (
                      <StudioCard
                        key={s.id}
                        variant="series"
                        data={s}
                      />
                    ))}
                  </>
                </div>
              )}
            </TabsContent>

            {/* 3. MEDIA TAB */}
            <TabsContent value="media" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              <div className="flex items-center justify-end mb-8 gap-3 flex-wrap">
              
              {/* Context Selector: Project vs Series */}
              <Select value={mediaContextFilter} onValueChange={(val: any) => setMediaContextFilter(val)}>
                <SelectTrigger className="w-[160px] h-10 bg-white/5 border-white/10 text-xs font-bold rounded-full">
                  <SelectValue placeholder="Context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contexts</SelectItem>
                  <SelectItem value="projects">Individual Projects</SelectItem>
                  <SelectItem value="series">Series Episodes</SelectItem>
                </SelectContent>
              </Select>

              {mediaFormatsList.length > 0 && (
                <Select value={mediaFormatFilter} onValueChange={setMediaFormatFilter}>
                  <SelectTrigger className="w-[200px] h-10 bg-white/5 border-white/10 text-xs font-bold rounded-full">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-slate-400">filter_list</span>
                      <SelectValue placeholder="Format" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center justify-between w-full pr-2">
                        <span>All Formats</span>
                        <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {allPlans.length}
                        </span>
                      </div>
                    </SelectItem>
                    {mediaFormatsList.map((format) => (
                      <SelectItem key={format} value={format}>
                        <div className="flex items-center justify-between w-full pr-2">
                          <span className="capitalize">{format.replace('-', ' ')}</span>
                          <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {mediaFormatCounts[format]}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              </div>

              <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              {getCombinedProjects().length === 0 ? (
                <EmptyState
                  icon="inventory_2"
                  title="No projects yet"
                  description="Use the tools above to create videos and series."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {getCombinedProjects().map((project) => (
                      <StudioCard
                        key={project.id}
                        variant="media"
                        data={project}
                        onPreview={setPreviewPlan}
                      />
                    )
                  )}
                </div>
              )}
              </div>
            </TabsContent>
          </Tabs>

          <PreviewDialog
            isOpen={!!previewPlan}
            plan={previewPlan}
            onClose={() => setPreviewPlan(null)}
          />
        </div>
      </div>
    </div>
  );
}
