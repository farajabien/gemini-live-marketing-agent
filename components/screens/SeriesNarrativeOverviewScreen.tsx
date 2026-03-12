"use client";

import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export function SeriesNarrativeOverviewScreen({ narrativeId }: { narrativeId: string }) {
  const { user, isInitialLoading } = useAuth();
  const { data, isLoading } = (db as any).useDoc(user ? "seriesNarratives" : null, narrativeId);
  const [episodeCount, setEpisodeCount] = useState(3);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#080911] flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#f6f6f8] dark:bg-[#080911] font-sans text-slate-900 dark:text-white flex flex-col">
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <Link
          href="/dashboard"
          className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-bold flex items-center gap-1 mb-8"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Dashboard
        </Link>

        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
          <span className="text-purple-500 font-bold tracking-widest text-xs uppercase mb-4 block">
            Series Narrative Architecture
          </span>
          <h1 className="text-4xl font-black mb-6">{data.title}</h1>

          <div className="space-y-8 mb-12">
            {/* Logline */}
            <section>
              <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Logline</h3>
              <p className="text-xl text-slate-700 dark:text-white leading-relaxed">{data.logline}</p>
            </section>

            {/* Character Dynamics + Visual Moat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section>
                <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Character Dynamics</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {typeof data.characterDynamics === "object" && data.characterDynamics !== null
                    ? Object.values(data.characterDynamics).join(" • ")
                    : data.characterDynamics}
                </p>
              </section>
              <section>
                <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2">Visual Moat</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{data.visualMoat}</p>
              </section>
            </div>

            {/* Plot Beats */}
            {data.plotBeats && (
              <section>
                <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-3">Major Plot Beats</h3>
                <div className="space-y-4">
                  {(Array.isArray(data.plotBeats) ? data.plotBeats : []).map((beat: string, i: number) => (
                    <div
                      key={i}
                      className="flex gap-4 items-start bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 transition-colors hover:bg-slate-50 dark:hover:bg-white/10"
                    >
                      <span className="w-8 h-8 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-slate-700 dark:text-slate-200">{beat}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* World Rules */}
            {data.worldRules && (
              <section>
                <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-3">World Rules</h3>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(data.worldRules) ? data.worldRules : []).map((rule: string, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full text-sm"
                    >
                      {rule}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-white/10">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Genre</p>
                <p className="text-sm font-bold capitalize">{data.genre}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tone</p>
                <p className="text-sm font-bold capitalize">{data.narrativeTone}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Conflict</p>
                <p className="text-sm font-bold capitalize">{data.conflictType}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Archetype</p>
                <p className="text-sm font-bold capitalize">{data.protagonistArchetype}</p>
              </div>
            </div>
          </div>

          {/* Create Series CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-8 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">Episodes</span>
              <select
                value={episodeCount}
                onChange={(e) => setEpisodeCount(Number(e.target.value))}
                className="bg-transparent text-slate-900 dark:text-white font-black text-sm outline-none cursor-pointer"
              >
                {[2, 3, 4, 5, 6, 8].map((n) => (
                  <option key={n} value={n} className="bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white">
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Link href={`/series/new?narrativeId=${narrativeId}&episodes=${episodeCount}`}>
              <Button className="bg-white dark:bg-white text-black hover:bg-slate-200 dark:hover:bg-slate-200 font-black px-10 py-6 h-auto text-lg rounded-full shadow-2xl shadow-white/10">
                Create Series
                <span className="material-symbols-outlined ml-2">rocket_launch</span>
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
