"use client";

import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { Header } from "@/components/Header";
import { AuthScreen } from "@/components/screens/AuthScreen";
import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import type { VideoPlan, Scene } from "@/lib/types";

interface PostAssistantScreenProps {
  planId: string;
}

export function PostAssistantScreen({ planId }: PostAssistantScreenProps) {
  const { user, refreshToken, isLoading: isAuthLoading } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data, isLoading } = db.useQuery(
    planId ? { videoPlans: { $: { where: { id: planId } } } } : null
  );

  const plan = (data && 'videoPlans' in data ? data.videoPlans?.[0] : undefined) as VideoPlan | undefined;

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#080911] flex flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        <p className="text-sm text-slate-500">Loading Assistant...</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#080911] flex flex-col items-center justify-center gap-4 text-white">
        <h1 className="text-2xl font-black">Project not found</h1>
        <p className="text-slate-500">We couldn't find the content you're looking for.</p>
      </div>
    );
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, { icon: "📋" });
  };

  const handleGenerateCaptions = async () => {
    if (!refreshToken) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/video-plans/${planId}/generate-captions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
      });
      if (!response.ok) throw new Error("Failed to generate captions");
      toast.success("Captions generated!", { icon: "✨" });
    } catch (err) {
      toast.error("Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const socialMetadata = plan.socialMetadata as any || {};
  const captions = socialMetadata.suggestedCaptions || {};
  const hashtags = socialMetadata.hashtags || [];

  return (
    <div className="min-h-screen bg-[#080911] text-white">
      <Header />
      <main className="max-w-5xl mx-auto px-4 pt-32 pb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">Post Assistant</h1>
            <p className="text-slate-400 font-medium">Ready to share your {plan.type}?</p>
          </div>
          <button
            onClick={handleGenerateCaptions}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-xl font-black hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            {isGenerating ? "Generating..." : (socialMetadata.suggestedCaptions ? "Regenerate Captions" : "Generate Social Captions")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scenes & Images Column */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">view_carousel</span>
              Content Scenes ({plan.scenes.length})
            </h2>
            <div className="grid gap-6">
              {plan.scenes.map((scene: Scene, i: number) => {
                const rawUrl = scene.imageUrl;
                const finalUrl = (() => {
                  if (!rawUrl) return null;
                  if (rawUrl.startsWith('data:')) return rawUrl;
                  if (rawUrl.includes("giphy.com")) return rawUrl;
                  
                  const isStoragePath = !rawUrl.startsWith('http');
                  return isStoragePath 
                      ? `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`
                      : `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
                })();

                return (
                  <div key={i} className="bg-white/5 rounded-3xl overflow-hidden border border-white/10 flex flex-col md:flex-row shadow-xl">
                    <div className="md:w-1/3 aspect-square relative bg-slate-900 border-b md:border-b-0 md:border-r border-white/10 shrink-0">
                      {finalUrl ? (
                        <Image
                          src={finalUrl}
                          alt={`Scene ${i + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-700">
                          <span className="material-symbols-outlined text-5xl">image</span>
                        </div>
                      )}
                      <div className="absolute top-4 left-4 size-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-black">
                        {i + 1}
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Voiceover / Script</h4>
                        <p className="text-slate-300 text-sm leading-relaxed">{scene.voiceover}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(scene.voiceover || "", `Scene ${i+1} Text`)}
                        className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-white transition-colors self-start"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                        Copy Text
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Social Metadata Column */}
          <div className="space-y-8">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">share</span>
              Distribution Assistant
            </h2>

            {socialMetadata.suggestedCaptions ? (
              <div className="space-y-6">
                {/* Proposed Captions */}
                {[
                  { id: 'linkedin', name: 'LinkedIn', icon: 'business', text: captions.linkedin },
                  { id: 'twitter', name: 'X / Twitter', icon: 'alternate_email', text: captions.twitter },
                  { id: 'tiktok', name: 'TikTok / IG Reels', icon: 'movie_filter', text: captions.tiktok }
                ].map(platform => platform.text && (
                  <div key={platform.id} className="bg-white/5 rounded-2xl border border-white/5 p-5 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 uppercase tracking-widest font-black text-[10px] text-slate-500">
                        <span className="material-symbols-outlined text-sm">{platform.icon}</span>
                        {platform.name}
                      </div>
                      <button
                        onClick={() => handleCopy(platform.text, platform.name)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">
                      {platform.text}
                    </p>
                  </div>
                ))}

                {/* Hashtags */}
                {hashtags.length > 0 && (
                  <div className="bg-blue-600/10 rounded-2xl border border-blue-500/20 p-5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">tag</span>
                      Suggested Hashtags
                    </h4>
                    <div className="flex flex-wrap gap-2 text-sm font-bold text-blue-300">
                      {hashtags.map((tag: string, i: number) => (
                        <span key={i} className="hover:text-white transition-colors cursor-pointer">#{tag}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleCopy(hashtags.map((h: string) => `#${h}`).join(' '), "Hashtags")}
                      className="mt-4 w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 rounded-xl text-xs font-black text-blue-400 transition-colors"
                    >
                      Copy All Hashtags
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white/5 rounded-3xl p-10 border border-white/10 border-dashed text-center">
                <div className="size-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-slate-700 text-3xl">magic_button</span>
                </div>
                <h3 className="text-lg font-bold mb-2">No Captions Yet</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Click the button above to generate AI-optimized captions for your social media posts.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
