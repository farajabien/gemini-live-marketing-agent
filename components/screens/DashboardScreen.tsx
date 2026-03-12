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
import { NarrativeCard } from "@/components/dashboard/NarrativeCard";
import { SeriesCard } from "@/components/dashboard/SeriesCard";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { ContentCard } from "@/components/narrative/ContentCard";
import { useGenerateStore } from "@/hooks/use-generate-store";
import type { VideoPlan, Series, FounderNarrative, ContentPiece, ContentStatus } from "@/lib/types";

export function DashboardScreen() {
  const router = useRouter();
  const { user, isInitialLoading, refreshToken } = useAuth();
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

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
              series: {
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
              contentPieces: {
                $: {
                  where: { userId: user.id },
                  order: { createdAt: "desc" },
                  limit: 100,
                },
              },
            }
          : null,
      [user?.id]
    )
  );

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#080911] flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-slate-500 animate-pulse">Checking your account...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (isPlansLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#080911] flex items-center justify-center flex-col gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-slate-500 animate-pulse">Loading your studio...</p>
      </div>
    );
  }

  const allPlans = ((data as any)?.videoPlans || []) as VideoPlan[];
  const allSeries = ((data as any)?.series || []) as Series[];
  const allNarratives = ((data as any)?.narratives || []) as FounderNarrative[];
  const allContentPieces = ((data as any)?.contentPieces || []) as ContentPiece[];

  const queuedContent = allContentPieces.filter(
    (p) => p.status === "suggested" || p.status === "edited"
  );
  const approvedContent = allContentPieces.filter(
    (p) => p.status === "approved" || p.status === "published"
  );

  // Compute dynamic format counts for Content (Drafts)
  const availableContentFormats = Array.from(new Set(allContentPieces.map(c => c.format))).filter(Boolean) as string[];
  const contentFormatCounts = availableContentFormats.reduce((acc, format) => {
    acc[format] = allContentPieces.filter(c => c.format === format).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredQueueContent = queuedContent.filter(
    (c) => (contentFormatFilter === "all" || c.format === contentFormatFilter) &&
            (narrativeOriginFilter === "all" || c.narrativeId === narrativeOriginFilter)
  );
  const filteredApprovedContent = approvedContent.filter(
    (c) => (contentFormatFilter === "all" || c.format === contentFormatFilter) &&
            (narrativeOriginFilter === "all" || c.narrativeId === narrativeOriginFilter)
  );

  // Compute dynamic format counts for Media
  const videoCount = allPlans.filter((p) => p.type === "video").length;
  const carouselCount = allPlans.filter((p) => p.type === "carousel").length;
  const seriesCount = allSeries.length;

  const availableMediaFormats = new Set<string>();
  if (allSeries.length > 0) availableMediaFormats.add("series");
  allPlans.forEach(p => {
    if (p.outputFormat) availableMediaFormats.add(p.outputFormat);
    else availableMediaFormats.add(p.type);
  });
  const mediaFormatsList = Array.from(availableMediaFormats).filter(Boolean);
  
  const mediaFormatCounts = mediaFormatsList.reduce((acc, format) => {
    if (format === "series") {
      acc[format] = allSeries.length;
    } else {
      acc[format] = allPlans.filter(p => p.outputFormat === format || (!p.outputFormat && p.type === format)).length;
    }
    return acc;
  }, {} as Record<string, number>);

  const getFilteredPlans = () => {
    return allPlans.filter((p) => {
      // Media Format filter
      if (mediaFormatFilter !== "all" && mediaFormatFilter !== "series") {
        const pFormat = p.outputFormat || p.type;
        if (pFormat !== mediaFormatFilter) return false;
      }
      if (mediaFormatFilter === "series") return false;

      // Advanced filter: Media type
      if (mediaTypeFilter !== "all" && p.type !== mediaTypeFilter) return false;
      // Advanced filter: Content source
      if (contentSourceFilter === "narrative" && !p.narrativeId) return false;
      if (contentSourceFilter === "direct" && p.narrativeId) return false;
      // Advanced filter: Narrative origin
      if (narrativeOriginFilter !== "all" && p.narrativeId !== narrativeOriginFilter) return false;
      // Advanced filter: Posting status
      if (postingStatusFilter === "posted" && !p.postedAt) return false;
      if (postingStatusFilter === "unposted" && p.postedAt) return false;
      return true;
    });
  };

  const getCombinedProjects = () => {
    // Strict separation: Projects = VideoPlans only, Series = Series only (per plan)
    const showProjects = mediaContextFilter === "all" || mediaContextFilter === "projects";
    const showSeries = mediaContextFilter === "all" || mediaContextFilter === "series";

    const filteredPlans = showProjects ? getFilteredPlans() : [];
    const displaySeries = showSeries
      ? (mediaFormatFilter === "all" || mediaFormatFilter === "series" ? allSeries : [])
      : [];

    // When showing only Projects, filter out series from mediaFormatFilter
    const plans = filteredPlans.map((p) => ({ ...p, _kind: "plan" as const }));
    const seriesItems = displaySeries.map((s) => ({ ...s, _kind: "series" as const }));

    return [...plans, ...seriesItems].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const handleUpdateStatus = async (contentId: string, status: ContentStatus) => {
    if (!refreshToken) return;
    try {
      const response = await fetch(`/api/narrative/content/${contentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
    } catch (err: any) {
      console.error("Failed to update status:", err);
    }
  };

  const handleCreateVideoFromScript = (body: string, narrativeId?: string) => {
    useGenerateStore.getState().openGenerator({
      script: body,
      mode: "verbatim",
      format: "video",
      narrativeId: narrativeId,
    });
  };

  const handleCreateCarouselFromScript = (body: string, narrativeId?: string) => {
    useGenerateStore.getState().openGenerator({
      script: body,
      mode: "verbatim",
      format: "carousel",
      narrativeId: narrativeId,
    });
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
    <Card className="bg-white/50 dark:bg-white/5 border-dashed border-slate-200 dark:border-white/10">
      <CardContent className="flex flex-col items-center justify-center py-20">
        <div className="h-20 w-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">
            {icon}
          </span>
        </div>
        <h3 className="text-xl font-black mb-2">{title}</h3>
        <p className="text-slate-500 text-sm max-w-xs mb-8 font-medium text-center">
          {description}
        </p>
        {action}
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full font-sans text-white">
      <div className="w-full">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
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
            <TabsList className="bg-white/5 border border-white/10 mb-6 h-12 p-1.5 rounded-2xl gap-2">
            <TabsTrigger
              value="brand"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
            >
              <span className="material-symbols-outlined text-lg mr-2">token</span>
              Projects
              <Badge variant="secondary" className="ml-2 text-[9px] bg-red-500/10 text-red-500 border-none px-2">{allNarratives.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="storytelling"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
            >
              <span className="material-symbols-outlined text-lg mr-2">auto_stories</span>
              Series
              <Badge variant="secondary" className="ml-2 text-[9px] bg-amber-500/10 text-amber-500 border-none px-2">{allSeries.length}</Badge>
            </TabsTrigger>
            
            <TabsTrigger
              value="drafts"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
            >
              <span className="material-symbols-outlined text-lg mr-2">auto_awesome_motion</span>
              Drafts
              <Badge variant="secondary" className="ml-2 text-[9px] bg-blue-500/10 text-blue-500 border-none px-2">{allContentPieces.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="media"
              className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/40 font-black uppercase tracking-widest text-[10px] rounded-xl px-8 h-full transition-all"
            >
              <span className="material-symbols-outlined text-lg mr-2">play_circle</span>
              Media
              <Badge variant="secondary" className="ml-2 text-[9px] bg-purple-500/10 text-purple-500 border-none px-2">{allPlans.length + seriesCount}</Badge>
            </TabsTrigger>
            </TabsList>

            {/* 1. BRAND TAB */}
            <TabsContent value="brand" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {allNarratives.length === 0 ? (
              <EmptyState
                icon="token"
                title="Define your brand positioning"
                description="Answer 10 questions about your startup. Get AI content that sounds like you."
                action={
                  <Button
                    asChild
                    className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20 rounded-full px-8 h-11"
                  >
                    <Link href="/narrative/new">Create Strategy</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allNarratives.map((narrative) => {
                  // Calculate pieces for this specific narrative from allContentPieces
                  const narrativePieces = allContentPieces.filter(p => p.narrativeId === narrative.id);
                  const queued = narrativePieces.filter(
                    (p) => p.status === "suggested" || p.status === "edited"
                  ).length;
                  const approved = narrativePieces.filter(
                    (p) => p.status === "approved" || p.status === "published"
                  ).length;
                  
                  const mediaCount = allPlans.filter(p => p.narrativeId === narrative.id).length;

                  return (
                    <NarrativeCard
                      key={narrative.id}
                      narrative={narrative}
                      queuedCount={queued}
                      approvedCount={approved}
                      mediaCount={mediaCount}
                    />
                  );
                })}
              </div>
            )}
            </TabsContent>

            {/* 1b. SERIES TAB */}
            <TabsContent value="storytelling" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            {allSeries.length === 0 ? (
              <EmptyState
                icon="auto_stories"
                title="Launch a new series"
                description="Create episodic content that builds a narrative over time."
                action={
                  <Button
                    asChild
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 rounded-full px-8 h-11"
                  >
                    <Link href="/series/new">New Series</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allSeries.map((s) => (
                  <SeriesCard key={s.id} series={s} />
                ))}
              </div>
            )}
            </TabsContent>

            {/* 2. DRAFTS TAB */}
            <TabsContent value="drafts" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
            <Tabs defaultValue="queue" className="w-full">
              <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <TabsList className="bg-white/5 border border-white/10 p-1 h-10 rounded-full flex-shrink-0">
                  <TabsTrigger 
                    value="queue" 
                    className="rounded-full px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest h-full"
                  >
                    Queue
                    <Badge className="ml-2 bg-black/20 text-white border-0 text-[9px]">{filteredQueueContent.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="approved" 
                    className="rounded-full px-6 data-[state=active]:bg-green-600 data-[state=active]:text-white text-[10px] font-black uppercase tracking-widest h-full"
                  >
                    Approved
                    <Badge className="ml-2 bg-black/20 text-white border-0 text-[9px]">{filteredApprovedContent.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                {availableContentFormats.length > 0 && (
                  <Select value={contentFormatFilter} onValueChange={setContentFormatFilter}>
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
                            {allContentPieces.length}
                          </span>
                        </div>
                      </SelectItem>
                      {availableContentFormats.map((format) => (
                        <SelectItem key={format} value={format}>
                          <div className="flex items-center justify-between w-full pr-2">
                            <span className="capitalize">{format.replace('-', ' ')}</span>
                            <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {contentFormatCounts[format]}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <TabsContent value="queue" className="animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="space-y-4 max-w-3xl">
                  {filteredQueueContent.length === 0 ? (
                    <EmptyState
                      icon="inbox"
                      title="Queue is empty"
                      description="Generate content from your narratives to see it here."
                    />
                  ) : (
                    filteredQueueContent.map((piece) => (
                      <ContentCard
                        key={piece.id}
                        piece={piece}
                        expanded={expandedPost === piece.id}
                        onToggle={() =>
                          setExpandedPost(expandedPost === piece.id ? null : piece.id)
                        }
                        onUpdateStatus={handleUpdateStatus}
                        onCopy={handleCopyPost}
                        onCreateVideo={(body, draftId) => handleCreateVideoFromScript(body, piece.narrativeId)}
                        onCreateCarousel={(body, draftId) => handleCreateCarouselFromScript(body, piece.narrativeId)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="approved" className="animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="space-y-4 max-w-3xl">
                  {filteredApprovedContent.length === 0 ? (
                    <EmptyState
                      icon="check_circle"
                      title="No approved content"
                      description="Approve suggested posts to see them here."
                    />
                  ) : (
                    filteredApprovedContent.map((piece) => (
                      <ContentCard
                        key={piece.id}
                        piece={piece}
                        expanded={expandedPost === piece.id}
                        onToggle={() =>
                          setExpandedPost(expandedPost === piece.id ? null : piece.id)
                        }
                        onUpdateStatus={handleUpdateStatus}
                        onCopy={handleCopyPost}
                        onCreateVideo={(body, draftId) => handleCreateVideoFromScript(body, piece.narrativeId)}
                        onCreateCarousel={(body, draftId) => handleCreateCarouselFromScript(body, piece.narrativeId)}
                      />
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
            </TabsContent>

            {/* 3. MEDIA TAB */}
            <TabsContent value="media" className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none">
              <div className="flex items-center justify-end mb-8 gap-3 flex-wrap">
              <Select value={mediaContextFilter} onValueChange={(v: "all" | "projects" | "series") => setMediaContextFilter(v)}>
                <SelectTrigger className="w-[180px] h-10 bg-white/5 border-white/10 text-xs font-bold rounded-full">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-slate-400">category</span>
                    <SelectValue placeholder="Context" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span>All Content</span>
                      <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {allPlans.length + allSeries.length}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="projects">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span>Projects</span>
                      <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {allPlans.length}
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="series">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span>Series</span>
                      <span className="text-slate-500 text-[10px] ml-4 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {allSeries.length}
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {mediaFormatsList.length > 0 && mediaContextFilter !== "series" && (
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
                          {allPlans.length + seriesCount}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getCombinedProjects().map((project) =>
                    project._kind === "plan" ? (
                      <ProjectCard
                        key={project.id}
                        plan={project as VideoPlan}
                        onPreview={setPreviewPlan}
                      />
                    ) : (
                      <SeriesCard key={project.id} series={project as Series} />
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
