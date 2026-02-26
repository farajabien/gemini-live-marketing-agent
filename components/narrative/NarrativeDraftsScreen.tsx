"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { tx } from "@instantdb/react";
import { useState, useEffect } from "react";
import { AuthScreen } from "@/components/screens/AuthScreen";
import Link from "next/link";
import type { FounderNarrative, ContentPiece, ContentFormat, ContentStatus } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { ContentCard } from "@/components/narrative/ContentCard";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { SeriesCard } from "@/components/dashboard/SeriesCard";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { cn } from "@/lib/utils";
import { useGenerateStore } from "@/hooks/use-generate-store";
import type { VideoPlan, Series } from "@/lib/types";

// shadcn
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Target, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NarrativeDraftsScreenProps {
  narrativeId: string;
}

function AngleSelectorPopover({ 
  narrative, 
  value, 
  onChange 
}: { 
  narrative: any, 
  value: string, 
  onChange: (v: string) => void 
}) {
  const [open, setOpen] = useState(false);
  const angles = narrative.angles || {};
  const hasCategories = Object.keys(angles).length > 0;
  
  const categories = [
    { id: "pain", label: "Pain", list: angles.painAngles || [], color: "text-blue-400" },
    { id: "cost", label: "Cost", list: angles.costAngles || [], color: "text-red-400" },
    { id: "mechanism", label: "Mechanism", list: angles.mechanismAngles || [], color: "text-purple-400" },
    { id: "identity", label: "Identity", list: angles.identityAngles || [], color: "text-amber-400" },
    { id: "outcome", label: "Outcome", list: angles.outcomeAngles || [], color: "text-emerald-400" },
  ].filter(c => c.list.length > 0);

  const selectedAngleText = value || "Auto Angle";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open}
          className="w-[200px] justify-between bg-transparent border-white/10 text-xs font-bold text-slate-300 h-9 px-3"
        >
          <span className="truncate">{selectedAngleText === "Auto Angle" ? "Auto Angle" : selectedAngleText}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-[#0f1225] border-white/10 shadow-2xl">
        <Tabs defaultValue={categories[0]?.id || "legacy"} className="w-full">
          <TabsList className="w-full justify-start bg-white/5 rounded-none border-b border-white/10 p-0 h-10">
            {categories.map(c => (
              <TabsTrigger 
                key={c.id} 
                value={c.id} 
                className="text-[10px] uppercase tracking-tight px-3 data-[state=active]:bg-white/10 rounded-none h-full"
              >
                {c.label}
              </TabsTrigger>
            ))}
            {narrative.narrativeAngles?.length > 0 && (
              <TabsTrigger value="legacy" className="text-[10px] uppercase tracking-tight px-3 data-[state=active]:bg-white/10 rounded-none h-full">
                Other
              </TabsTrigger>
            )}
            <TabsTrigger value="auto" className="ml-auto text-[10px] uppercase tracking-tight px-3 data-[state=active]:bg-white/10 rounded-none h-full">
              Auto
            </TabsTrigger>
          </TabsList>
          
          <div className="max-h-[300px] overflow-y-auto p-2">
            {categories.map(c => (
              <TabsContent key={c.id} value={c.id} className="mt-0 space-y-1">
                {c.list.map((angle: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      onChange(angle);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5",
                      value === angle ? "bg-blue-600/20 text-blue-400 font-bold" : "text-slate-300"
                    )}
                  >
                    {angle}
                  </button>
                ))}
              </TabsContent>
            ))}
            
            <TabsContent value="legacy" className="mt-0 space-y-1">
              {narrative.narrativeAngles?.map((angle: string, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    onChange(angle);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5",
                    value === angle ? "bg-blue-600/20 text-blue-400 font-bold" : "text-slate-300"
                  )}
                >
                  {angle}
                </button>
              ))}
            </TabsContent>

            <TabsContent value="auto" className="mt-0">
               <button
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-4 rounded-lg text-sm transition-colors hover:bg-white/5 flex items-center gap-3",
                    value === "" ? "bg-blue-600/20 text-blue-400 font-bold" : "text-slate-300"
                  )}
                >
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <div>
                    <div className="font-bold">Auto Angle</div>
                    <div className="text-[10px] text-slate-500 font-normal">Randomize between all strategic perspectives</div>
                  </div>
                </button>
            </TabsContent>
          </div>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export function NarrativeDraftsScreen({ narrativeId }: NarrativeDraftsScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading, refreshToken } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const [generationFormat, setGenerationFormat] = useState<ContentFormat>("linkedin-post");
  const [generationCount, setGenerationCount] = useState(3);
  const [preferredAngle, setPreferredAngle] = useState<string>("");
  const [filterFormat, setFilterFormat] = useState<string>("all");
  const [previewPlan, setPreviewPlan] = useState<VideoPlan | null>(null);

  // Check for auto-generation trigger from Content Engine
  const autoGenerate = searchParams.get("generate") === "true";
  const angleFromUrl = searchParams.get("angle") || "";

  useEffect(() => {
    if (angleFromUrl) {
      setPreferredAngle(angleFromUrl);
    }
  }, [angleFromUrl]);

  const { data, isLoading } = (db as any).useQuery(
    user
      ? {
          narratives: {
            $: { where: { id: narrativeId } },
            contentPieces: {
              $: { order: { createdAt: "desc" } },
              generatedPlans: {},
            },
          },
          videoPlans: {
            $: {
              where: { 
                "owner.id": user.id,
                "narrative.id": narrativeId
              },
              order: { createdAt: "desc" }
            }
          },
          series: {
            $: {
              where: {
                "owner.id": user.id
              },
              order: { createdAt: "desc" }
            }
          }
        }
      : null
  );

  // Auto-trigger generation when navigating from engine screen
  useEffect(() => {
    if (autoGenerate && !isGenerating && data && refreshToken) {
      const narrative = (data as any)?.narratives?.[0];
      const hasStrategy = narrative?.synthesizedNarrative || narrative?.aiPositioning;
      if (hasStrategy) {
        handleGenerateContent();
        // Clean URL params
        router.replace(`/narrative/${narrativeId}/drafts`, { scroll: false });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, data, refreshToken]);

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const narrative = (data as any)?.narratives?.[0] as
    | (FounderNarrative & { contentPieces?: ContentPiece[] })
    | undefined;

  if (!narrative) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-black mb-2">Narrative not found</h1>
        <Link href="/dashboard" className="text-blue-600 font-bold">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const allContent = narrative.contentPieces || [];
  const queueContent = allContent.filter(
    (c: ContentPiece) => (c.status === "suggested" || c.status === "edited")
  );
  const approvedContent = allContent.filter(
    (c: ContentPiece) => (c.status === "approved" || c.status === "published")
  );

  // Compute dynamic format counts
  const availableFormats = Array.from(new Set(allContent.map((c: ContentPiece) => c.format))).filter(Boolean) as string[];
  const formatCounts = availableFormats.reduce((acc, format) => {
    acc[format] = allContent.filter((c: ContentPiece) => c.format === format).length;
    return acc;
  }, {} as Record<string, number>);

  const filteredQueueContent = queueContent.filter(
    (c: ContentPiece) => filterFormat === "all" || c.format === filterFormat
  );
  const filteredApprovedContent = approvedContent.filter(
    (c: ContentPiece) => filterFormat === "all" || c.format === filterFormat
  );

  const allPlans = ((data as any)?.videoPlans || []) as VideoPlan[];
  const allSeries = ((data as any)?.series || []) as Series[];
  const combinedMedia = [
    ...allPlans.map(p => ({ ...p, _kind: "plan" as const })),
    ...allSeries
      .filter(s => !(s as any).narrativeId || (s as any).narrativeId === narrativeId)
      .map(s => ({ ...s, _kind: "series" as const }))
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const handleGenerateContent = async () => {
    if (!refreshToken) return;
    setIsGenerating(true);
    setTotalCost(0);
    setProgressMessage("Starting content generation...");


    try {
      const response = await fetch("/api/narrative/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({
          narrativeId,
          format: generationFormat,
          count: generationCount,
          preferredAngle: preferredAngle || undefined,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed to generate content");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              if (eventData.type === "progress") {
                setProgressMessage(eventData.message);
                if (eventData.totalCost !== undefined) {
                  setTotalCost(eventData.totalCost);
                }
              } else if (eventData.type === "success") {

                setProgressMessage(null);
                setIsGenerating(false);
                return;
              } else if (eventData.type === "error") {
                throw new Error(eventData.error);
              }
            } catch (e: any) {
              if (!e.message?.includes("Unexpected end")) throw e;
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Content generation failed:", err);
      setProgressMessage(null);
    } finally {
      setIsGenerating(false);
    }
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

  const handleSaveContent = async (contentId: string, editedBody: string) => {
    if (!refreshToken) return;
    try {
      const response = await fetch(`/api/narrative/content/${contentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ status: "edited", editedBody }),
      });
      if (!response.ok) throw new Error("Failed to save content");
    } catch (err: any) {
      console.error("Failed to save content:", err);
      throw err;
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    try {
        type DbWithTransact = typeof db & { transact: (txns: unknown[]) => Promise<void> };
        await (db as DbWithTransact).transact([tx.contentPieces[contentId].delete()]);
    } catch (err: any) {
        console.error("Failed to delete content:", err);
        throw err;
    }
  };

  const handleCreateVideoFromScript = (body: string) => {
    // Navigate to dedicated generate route instead of opening dialog
    const params = new URLSearchParams({
      mode: "verbatim",
      format: "video",
      narrativeId: narrativeId,
    });

    // Store script in localStorage temporarily (URL has length limits)
    sessionStorage.setItem('generate-script', body);

    router.push(`/generate?${params.toString()}`);
  };

  const handleCreateCarouselFromScript = (body: string) => {
    // Navigate to dedicated generate route instead of opening dialog
    const params = new URLSearchParams({
      mode: "verbatim",
      format: "carousel",
      narrativeId: narrativeId,
    });

    // Store script in sessionStorage temporarily
    sessionStorage.setItem('generate-script', body);

    router.push(`/generate?${params.toString()}`);
  };

  const handleCopyPost = (body: string) => {
    navigator.clipboard.writeText(body);
  };

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Header & Generation Controls */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-slate-400">
                Generate, review, and approve content in your library.
              </p>
              {preferredAngle && (
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 font-bold px-3 py-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">target</span>
                  {preferredAngle}
                </Badge>
              )}
            </div>
          </div>

         
        </div>

         {/* Generation Controls */}
          <div className="flex gap-2 mt-2">
            <div className="flex items-center gap-2">
                <Select
                  value={generationFormat}
                  onValueChange={(v) => setGenerationFormat(v as ContentFormat)}
                >
                  <SelectTrigger className="w-[140px] bg-transparent border-white/10 text-xs font-bold text-slate-300 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1225] border-white/10">
                    <SelectItem value="linkedin-post">LinkedIn Post</SelectItem>
                    <SelectItem value="x-post">X/Twitter Post</SelectItem>
                    <SelectItem value="thread">Thread</SelectItem>
                    <SelectItem value="short-video">Video Script</SelectItem>
                    <SelectItem value="carousel">Carousel Copy</SelectItem>
                    <SelectItem value="tiktok-video">TikTok Video</SelectItem>
                    <SelectItem value="tiktok-carousel">TikTok Carousel</SelectItem>
                    <SelectItem value="blog-post">Blog Post</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={String(generationCount)}
                  onValueChange={(v) => setGenerationCount(parseInt(v))}
                >
                  <SelectTrigger className="w-[60px] bg-transparent border-white/10 text-xs font-bold text-slate-300 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0f1225] border-white/10">
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                  </SelectContent>
                </Select>

                {(narrative.narrativeAngles || (narrative as any).angles) && (
                  <AngleSelectorPopover 
                    narrative={narrative}
                    value={preferredAngle}
                    onChange={setPreferredAngle}
                  />
                )}
              </div>

              <Button
                onClick={handleGenerateContent}
                disabled={isGenerating || (!narrative.synthesizedNarrative && !(narrative as any).aiPositioning)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black uppercase tracking-widest text-xs h-10 px-6 rounded-xl shadow-lg hover:shadow-xl"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg mr-2">
                      auto_awesome
                    </span>
                    Generate
                  </>
                )}
              </Button>
          </div>
      </div>

      {/* Progress */}
      {isGenerating && progressMessage && (
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-800 rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <p className="text-sm text-blue-400 font-semibold">{progressMessage}</p>
            </div>
            {totalCost > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/50">Est. Cost</span>
                <span className="text-sm font-mono font-bold text-blue-400">${totalCost.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Tabs */}
      <Tabs defaultValue="queue" className="w-full">
      
      <div className="flex">
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger
            value="queue"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-slate-400 font-semibold"
          >
            <span className="material-symbols-outlined text-lg mr-2">inbox</span>
            Queue
            <Badge
              variant="secondary"
              className="ml-2 text-[10px] bg-white/10 data-[state=active]:bg-slate-200"
            >
              {filteredQueueContent.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="approved"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-slate-400 font-semibold"
          >
            <span className="material-symbols-outlined text-lg mr-2">
              check_circle
            </span>
            Approved
            <Badge
              variant="secondary"
              className="ml-2 text-[10px] bg-white/10 data-[state=active]:bg-slate-200"
            >
              {filteredApprovedContent.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 text-slate-400 font-semibold"
          >
            <span className="material-symbols-outlined text-lg mr-2">
              play_circle
            </span>
            Media
            <Badge
              variant="secondary"
              className="ml-2 text-[10px] bg-white/10 data-[state=active]:bg-slate-200"
            >
              {combinedMedia.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Filter:</span>
          <Select
            value={filterFormat}
            onValueChange={setFilterFormat}
          >
            <SelectTrigger className="w-[180px] bg-transparent border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 h-9 rounded-full px-4">
              <SelectValue placeholder="All Formats" />
            </SelectTrigger>
            <SelectContent className="bg-[#0f1225] border-white/10">
              <SelectItem value="all" className="text-[10px] uppercase font-bold">All Formats ({allContent.length})</SelectItem>
              {availableFormats.map(format => {
                const formatLabels: Record<string, string> = {
                  "linkedin-post": "LinkedIn Post",
                  "x-post": "X/Twitter Post",
                  "thread": "Thread",
                  "short-video": "Video Script",
                  "carousel": "Carousel Copy",
                  "tiktok-video": "TikTok Video",
                  "tiktok-carousel": "TikTok Carousel",
                  "blog-post": "Blog Post"
                };
                return (
                  <SelectItem key={format} value={format} className="text-[10px] uppercase font-bold">
                    {formatLabels[format] || format} ({formatCounts[format] || 0})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
</div>
        <TabsContent value="queue" className="space-y-4">
          {filteredQueueContent.length === 0 ? (
            <Card className="bg-white/5 border-white/10 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">
                  inbox
                </span>
                <h3 className="text-xl font-black mb-2 text-slate-300">
                  No pending content
                </h3>
                <p className="text-slate-500 text-sm mb-6">
                  Generate new post suggestions to review them here.
                </p>
                <Button
                  onClick={handleGenerateContent}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold"
                >
                  Generate Posts
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredQueueContent.map((piece: ContentPiece) => (
              <ContentCard
                key={piece.id}
                piece={piece}
                expanded={expandedPost === piece.id}
                onToggle={() =>
                  setExpandedPost(expandedPost === piece.id ? null : piece.id)
                }
                onUpdateStatus={handleUpdateStatus}
                onCopy={() => handleCopyPost(piece.editedBody || piece.body)}
                onCreateVideo={handleCreateVideoFromScript}
                onCreateCarousel={handleCreateCarouselFromScript}
                onSave={handleSaveContent}
                onDelete={handleDeleteContent}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {filteredApprovedContent.length === 0 ? (
            <Card className="bg-white/5 border-white/10 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">
                  check_circle
                </span>
                <h3 className="text-xl font-black mb-2 text-slate-300">
                  No approved content yet
                </h3>
                <p className="text-slate-500 text-sm">
                  Approve posts from your queue to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredApprovedContent.map((piece: ContentPiece) => (
              <ContentCard
                key={piece.id}
                piece={piece}
                expanded={expandedPost === piece.id}
                onToggle={() =>
                  setExpandedPost(expandedPost === piece.id ? null : piece.id)
                }
                onUpdateStatus={handleUpdateStatus}
                onCopy={() => handleCopyPost(piece.editedBody || piece.body)}
                onCreateVideo={handleCreateVideoFromScript}
                onCreateCarousel={handleCreateCarouselFromScript}
                onSave={handleSaveContent}
                onDelete={handleDeleteContent}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          {combinedMedia.length === 0 ? (
            <Card className="bg-white/5 border-white/10 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <span className="material-symbols-outlined text-5xl text-slate-600 mb-4">
                  inventory_2
                </span>
                <h3 className="text-xl font-black mb-2 text-slate-300">
                  No media generated yet
                </h3>
                <p className="text-slate-500 text-sm">
                  Create videos or carousels from your approved posts to see them here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {combinedMedia.map((project: any) =>
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
        </TabsContent>
      </Tabs>

      <PreviewDialog
        isOpen={!!previewPlan}
        plan={previewPlan}
        onClose={() => setPreviewPlan(null)}
      />
    </div>
  );
}
