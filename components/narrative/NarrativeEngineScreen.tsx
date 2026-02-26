"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { AuthScreen } from "@/components/screens/AuthScreen";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FounderNarrative } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Brain, ArrowRight, Bot, PlusCircle, CheckCircle2 } from "lucide-react";

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

  const { data, isLoading, error } = (db as any).useQuery(
    user
      ? {
          narratives: {
            $: { where: { id: narrativeId } },
            pillars: {},
            contentPieces: {},
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
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
        <Link href="/dashboard" className="text-blue-600 font-bold">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const pillars = narrative.pillars || [];

  const handleGenerateFromAngle = (angle: string, pillarId: string) => {
    // Navigate to library with the angle pre-selected for generation
    router.push(
      `/narrative/${narrativeId}/drafts?generate=true&angle=${encodeURIComponent(angle)}&pillarId=${pillarId}`
    );
  };

  // Group Content by Angle -> Format -> Count
  const contentPieces = narrative.contentPieces || [];
  const angleContentCounts = contentPieces.reduce((acc: Record<string, Record<string, number>>, piece: any) => {
    if (!piece.angle || piece.status !== 'approved') return acc;
    if (!acc[piece.angle]) acc[piece.angle] = {};
    acc[piece.angle][piece.format] = (acc[piece.angle][piece.format] || 0) + 1;
    return acc;
  }, {});

  // Group Content by Pillar -> Format -> Count
  const pillarContentCounts = pillars.reduce((acc: Record<string, Record<string, number>>, pillar) => {
    acc[pillar.id] = {};
    contentPieces
      .filter((p: any) => p.status === 'approved' && p.angle && pillar.angles.includes(p.angle))
      .forEach((piece: any) => {
        acc[pillar.id][piece.format] = (acc[pillar.id][piece.format] || 0) + 1;
      });
    return acc;
  }, {});

  // Helper to format the display string
  const formatName = (format: string) => format.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());


  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black mb-2 text-white">Content Engine</h1>
          <p className="text-slate-400">
            Your core pillars and angles. Click on any angle to generate content.
          </p>
        </div>
        <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
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
              Your content pillars are the strategic foundations generated during your initial brand sprint.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/narrative/new")}
              className="border-red-500/30 text-red-400 hover:bg-red-600/10 h-11 px-8 rounded-full"
            >
              <PlusCircle className="size-4 mr-2" />
              Start Brand Sprint
            </Button>
        </div>
      ) : (
        <Tabs defaultValue={pillars[0].id} className="w-full">
          <TabsList className="bg-white/5 border border-white/10 p-1 mb-10 overflow-x-auto w-full justify-start h-auto rounded-2xl">
            {pillars.map((pillar) => (
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

          {pillars.map((pillar) => (
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
                    {pillar.angles?.map((angle, i) => (
                      <button
                        key={i}
                        onClick={() => handleGenerateFromAngle(angle, pillar.id)}
                        className="group relative w-full flex items-start gap-4 text-sm text-slate-300 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] hover:border-red-500/30 transition-all cursor-pointer text-left"
                      >
                        <div className="mt-1 size-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                          <span className="text-[10px] font-black text-slate-500 group-hover:text-red-400">{i + 1}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <span className="block leading-relaxed group-hover:text-white transition-colors">{angle}</span>
                          
                          {/* Generated Content Badges */}
                          {angleContentCounts[angle] && Object.keys(angleContentCounts[angle]).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1 pb-1">
                              {Object.entries(angleContentCounts[angle]).map(([format, count]) => (
                                <Badge key={format} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] uppercase tracking-widest px-2 py-0.5 pointer-events-none flex items-center gap-1.5">
                                  <CheckCircle2 className="size-3" />
                                  {count} {formatName(format)}{count > 1 ? 's' : ''}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 mt-2">
                            Click to generate <ArrowRight className="size-2.5" />
                          </span>
                        </div>
                      </button>
                    ))}
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
