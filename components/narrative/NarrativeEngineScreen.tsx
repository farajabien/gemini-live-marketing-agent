"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { AuthScreen } from "@/components/screens/AuthScreen";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FounderNarrative } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Brain, ArrowRight, Bot, CheckCircle2, Loader2, Target, ChevronDown } from "lucide-react";
import { generatePillarsForNarrative } from "@/app/actions/marketing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContentFormat } from "@/lib/types";
import { toast } from "sonner";

interface ContentPillar {
  id: string;
  narrativeId: string;
  title: string;
  description?: string;
  angles: string[];
  status: string;
  createdAt: number;
}

interface NarrativeEngineScreenProps {
  narrativeId: string;
}

export function NarrativeEngineScreen({ narrativeId }: NarrativeEngineScreenProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [isGeneratingPillars, setIsGeneratingPillars] = useState(false);
  
  // Inline generation state
  const [selectedAngle, setSelectedAngle] = useState<{ angle: string; pillarId: string } | null>(null);
  const [generationFormat, setGenerationFormat] = useState<ContentFormat>("linkedin-post");
  const [generationCount, setGenerationCount] = useState(3);
  const [isGeneratingAngle, setIsGeneratingAngle] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  // Query the narrative document
  const { data, isLoading, error } = (db as any).useQuery(
    user
      ? {
          narratives: {
            $: { where: { id: narrativeId } },
          },
        }
      : null
  );

  // Query content pillars linked to this narrative
  const { data: pillarsData } = (db as any).useQuery(
    user
      ? {
          contentPillars: {
            $: { where: { narrative: narrativeId, userId: user.id } },
          },
        }
      : null
  );

  // Query content pieces linked to this narrative
  const { data: piecesData } = (db as any).useQuery(
    user
      ? {
          contentPieces: {
            $: { where: { narrativeId: narrativeId, userId: user.id } },
          },
        }
      : null
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Brain className="size-8 text-red-500" />
        </div>
        <h2 className="text-xl font-black text-white mb-2">Query Error</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">{error.message || "Failed to load engine data. Please try again."}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10 text-white hover:bg-white/5">
          Retry Connection
        </Button>
      </div>
    );
  }

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const narrative = (data as any)?.narratives?.[0] as
    | (FounderNarrative & { pillars?: ContentPillar[], contentPieces?: any[] })
    | undefined;

  if (!narrative) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-black mb-2">Narrative not found</h1>
        <Link href="/dashboard" className="text-red-600 font-bold">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const pillars = (pillarsData as any)?.contentPillars || [];
  const contentPieces = (piecesData as any)?.contentPieces || [];

  const { refreshToken } = useAuth(); // Need refreshToken for the API

  const handleGenerateFromAngle = async (angle: string, pillarId: string) => {
    if (!refreshToken) return;
    
    setIsGeneratingAngle(true);
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
          preferredAngle: angle,
          pillarId,
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
              } else if (eventData.type === "success") {
                setProgressMessage(null);
                setIsGeneratingAngle(false);
                setSelectedAngle(null); // Close toolbar
                toast.success(`Successfully generated ${eventData.count} posts!`);
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
      toast.error(err.message || "Failed to generate content");
    } finally {
      setIsGeneratingAngle(false);
    }
  };

  const handleGeneratePillars = async () => {
    if (!user?.id) return;
    setIsGeneratingPillars(true);
    try {
      await generatePillarsForNarrative(narrativeId, user.id);
    } catch (err) {
      console.error("Failed to generate pillars:", err);
    } finally {
      setIsGeneratingPillars(false);
    }
  };

  // Group Content by Angle -> Format -> Count
  const angleContentCounts = contentPieces.reduce((acc: Record<string, Record<string, number>>, piece: any) => {
    if (!piece.angle || piece.status !== 'approved') return acc;
    if (!acc[piece.angle]) acc[piece.angle] = {};
    acc[piece.angle][piece.format] = (acc[piece.angle][piece.format] || 0) + 1;
    return acc;
  }, {});

  // Group Content by Pillar -> Format -> Count
  const pillarContentCounts = pillars.reduce((acc: Record<string, Record<string, number>>, pillar: any) => {
    acc[pillar.id] = {};
    contentPieces
      .filter((p: any) => p.status === 'approved' && p.angle && pillar.angles.includes(p.angle))
      .forEach((piece: any) => {
        acc[pillar.id][piece.format] = (acc[pillar.id][piece.format] || 0) + 1;
      });
    return acc;
  }, {});

  const formatName = (format: string) => format.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="w-full">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black mb-2 text-white">Content Engine</h1>
          <p className="text-slate-400">
            Your core pillars and angles. Click on any angle to generate content.
          </p>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
          {pillars.length} Pillars
        </Badge>
      </div>

      {pillars.length === 0 ? (
        <div className="bg-white/5 border border-white/10 border-dashed rounded-3xl flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="size-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <Brain className="size-8 text-slate-600" />
            </div>
            <h3 className="text-xl font-black mb-2 text-slate-300">No Pillars Defined</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-sm">
              Generate content pillars from your narrative strategy. This will create strategic content angles you can use to produce videos.
            </p>
            <Button
              variant="outline"
              onClick={handleGeneratePillars}
              disabled={isGeneratingPillars}
              className="border-red-500/30 text-red-400 hover:bg-red-600/10 h-11 px-8 rounded-full"
            >
              {isGeneratingPillars ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generating Pillars...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Generate Content Pillars
                </>
              )}
            </Button>
        </div>
      ) : (
        <Tabs defaultValue={pillars[0].id} className="w-full">
          <TabsList className="bg-white/5 border border-white/10 p-1 mb-10 overflow-x-auto w-full justify-start h-auto rounded-2xl">
            {pillars.map((pillar: ContentPillar) => (
              <TabsTrigger
                key={pillar.id}
                value={pillar.id}
                className="rounded-xl px-6 py-3 data-[state=active]:bg-white/10 data-[state=active]:text-white transition-all text-xs font-black uppercase tracking-widest gap-2"
              >
                <Bot className="size-3.5" />
                {pillar.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {pillars.map((pillar: ContentPillar) => (
            <TabsContent key={pillar.id} value={pillar.id} className="space-y-8 animate-in fade-in duration-500 outline-none">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Pillar Info */}
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20">
                    <Sparkles className="size-3 text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Selected Pillar</span>
                  </div>
                  <h2 className="text-5xl font-black text-white leading-tight">
                    {pillar.title}
                  </h2>
                  <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
                    {pillar.description || "Strategic content focus area designed to drive authority and conversion for your brand narrative."}
                  </p>
                  
                  {pillarContentCounts[pillar.id] && Object.keys(pillarContentCounts[pillar.id]).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {Object.entries(pillarContentCounts[pillar.id]).map(([format, count]) => (
                        <Badge key={format} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] uppercase tracking-widest px-2.5 py-1 pointer-events-none flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" />
                          {count as number} {formatName(format)}{(count as number) > 1 ? 's' : ''} Generated
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="pt-6">
                    <div className="flex items-center gap-3 text-slate-500">
                      <div className="h-px flex-1 bg-white/5" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Strategy Overview</span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                  </div>
                </div>

                {/* All Angles List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <ArrowRight className="size-4 text-red-500" />
                      Content Angles
                    </h3>
                    <Badge variant="secondary" className="bg-red-600/10 text-red-400 border-0 text-[10px] px-2.5 py-0.5">
                      {pillar.angles?.length || 0} Total
                    </Badge>
                  </div>
                  
                  <div className="grid gap-3">
                    {pillar.angles?.map((angle, i) => {
                      const isSelected = selectedAngle?.angle === angle && selectedAngle?.pillarId === pillar.id;
                      
                      return (
                      <div key={i} className={`group relative w-full flex flex-col gap-4 text-sm p-5 rounded-2xl border transition-all ${isSelected ? 'bg-white/[0.05] border-blue-500/30' : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.07] hover:border-blue-500/30'}`}>
                        <div 
                          className="flex items-start gap-4 cursor-pointer text-left"
                          onClick={() => {
                            if (!isGeneratingAngle) {
                              setSelectedAngle(isSelected ? null : { angle, pillarId: pillar.id });
                            }
                          }}
                        >
                          <div className={`mt-1 size-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500/20' : 'bg-white/5 group-hover:bg-blue-500/20'}`}>
                            <span className={`text-[10px] font-black ${isSelected ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`}>{i + 1}</span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <span className={`block leading-relaxed transition-colors ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{angle}</span>
                            
                            {angleContentCounts[angle] && Object.keys(angleContentCounts[angle]).length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1 pb-1">
                                {Object.entries(angleContentCounts[angle]).map(([format, count]) => (
                                  <Badge key={format} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] uppercase tracking-widest px-2 py-0.5 pointer-events-none flex items-center gap-1.5">
                                    <CheckCircle2 className="size-3" />
                                    {count as number} {formatName(format)}{(count as number) > 1 ? 's' : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {!isSelected && (
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 mt-2">
                                <Sparkles className="size-3 text-blue-500 mr-1" />
                                Click to generate
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="pt-4 mt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-2 flex flex-col gap-4">
                            {isGeneratingAngle ? (
                              <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl">
                                <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <span className="text-xs font-bold text-blue-400">{progressMessage}</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-3 bg-black/20 p-2 rounded-xl border border-white/5">
                                <Select
                                  value={generationFormat}
                                  onValueChange={(v) => setGenerationFormat(v as ContentFormat)}
                                >
                                  <SelectTrigger className="w-[160px] bg-transparent border-0 focus:ring-0 text-xs font-bold text-slate-200 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#0f1225] border-white/10 text-white">
                                    <SelectItem value="linkedin-post" className="text-xs">LinkedIn Post</SelectItem>
                                    <SelectItem value="x-post" className="text-xs">X/Twitter Post</SelectItem>
                                    <SelectItem value="thread" className="text-xs">Thread</SelectItem>
                                    <SelectItem value="short-video" className="text-xs">Video Script</SelectItem>
                                    <SelectItem value="carousel" className="text-xs">Carousel Copy</SelectItem>
                                    <SelectItem value="tiktok-video" className="text-xs">TikTok Video</SelectItem>
                                    <SelectItem value="tiktok-carousel" className="text-xs">TikTok Carousel</SelectItem>
                                    <SelectItem value="blog-post" className="text-xs">Blog Post</SelectItem>
                                  </SelectContent>
                                </Select>

                                <div className="w-px h-6 bg-white/10" />

                                <Select
                                  value={String(generationCount)}
                                  onValueChange={(v) => setGenerationCount(parseInt(v))}
                                >
                                  <SelectTrigger className="w-[70px] bg-transparent border-0 focus:ring-0 text-xs font-bold text-slate-200 h-8">
                                    <div className="flex items-center gap-1">
                                      <span className="text-white/40 font-normal">Qty:</span>
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#0f1225] border-white/10 text-white min-w-[70px]">
                                    <SelectItem value="1" className="text-xs">1</SelectItem>
                                    <SelectItem value="3" className="text-xs">3</SelectItem>
                                    <SelectItem value="5" className="text-xs">5</SelectItem>
                                  </SelectContent>
                                </Select>

                                <div className="flex-1 flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-[10px] uppercase font-bold text-slate-400 hover:text-white"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAngle(null);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-black tracking-widest px-4 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGenerateFromAngle(angle, pillar.id);
                                    }}
                                  >
                                    <Sparkles className="size-3 mr-1.5" />
                                    Generate
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* Link to library if it has content */}
                            {angleContentCounts[angle] && Object.keys(angleContentCounts[angle]).length > 0 && !isGeneratingAngle && (
                              <div className="flex justify-end pr-2">
                                <Link 
                                  href={`/narrative/${narrativeId}/drafts`}
                                  className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1"
                                >
                                  View all in Library <ArrowRight className="size-3" />
                                </Link>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
