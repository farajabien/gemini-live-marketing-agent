"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/instant-client";
import { Header } from "@/components/Header";
import { AuthChoiceDialog } from "@/components/AuthChoiceDialog";
import { GenerationDialog } from "@/components/GenerationDialog";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function CreateSeriesScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading, refreshToken } = useAuth();
  const [megaPrompt, setMegaPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [selectedNarrativeId, setSelectedNarrativeId] = useState<string | null>(null);

  // Fetch narratives
  const { data: narrativesData } = (db as any).useQuery(
    user ? { seriesNarratives: { $: { where: { userId: user.id } } } } : null
  );
  const narratives = (narrativesData?.seriesNarratives || []) as any[];


  const handleCreateSeries = async () => {
    if (!user || !refreshToken) {
      setIsAuthDialogOpen(true);
      return;
    }

    if (megaPrompt.length < 100) {
      setError("Please provide more details (minimum 100 characters)");
      return;
    }

    setIsCreating(true);
    setError(null);
    setProgressMessage(null);
    setTotalCost(0);


    try {
      const response = await fetch("/api/series/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${refreshToken}`
        },
        body: JSON.stringify({ megaPrompt, seriesNarrativeId: selectedNarrativeId }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to create series");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "progress") {
              setProgressMessage(data.message);
              if (data.totalCost !== undefined) {
                setTotalCost(data.totalCost);
              }
            } else if (data.type === "success") {

              const { seriesId } = data.data;
              router.push(`/series/${seriesId}`);
              return;
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      }

    } catch (err: any) {
      console.error("Series creation failed:", err);
      setError(err.message || "Something went wrong");
      setIsCreating(false);
    }
  };

  const examplePrompts = [
    {
      title: "Zog's Galactic Hackathon",
      prompt: "Create a 3-episode series about Zog, an alien who attends a Silicon Valley hackathon.\\n\\nEpisode 1: Zog lands in San Francisco and enters the hackathon wearing a hoodie.\\nEpisode 2: Zog uses 'Alien Intelligence' to build a telepathic marketing agent while humans struggle with API keys.\\nEpisode 3: Zog wins the grand prize but is disappointed it's a MacBook instead of iridium.\\n\\nStyle: Sci-fi cinematic, vibrant neon lighting, high-tech alien UI overlays\\nTone: Humorous and disruptive"
    },
    {
      title: "CyniToast: Founder Narrative",
      prompt: "Create a 5-episode series for 'CyniToast'—a breakfast delivery service with cynical news updates.\\n\\nEpisode 1: The founder's frustration with 'toxic positivity' and birth of the idea.\\nEpisode 2: Perfecting the existential sourdough recipe.\\nEpisode 3: Integrating the cynical AI news engine.\\nEpisode 4: Reaching 100 grumpy but satisfied subscribers.\\nEpisode 5: The future of breakfast in a cynical world.\\n\\nStyle: Premium dark aesthetic, moody food photography, minimalist typography\\nTone: Sardonic and premium"
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#f6f6f8] dark:bg-[#080911] font-sans text-slate-900 dark:text-white flex flex-col">
      <Header />
      
      <AuthChoiceDialog 
        isOpen={isAuthDialogOpen} 
        onClose={() => setIsAuthDialogOpen(false)} 
        onContinueAsGuest={() => setIsAuthDialogOpen(false)}
      />
      
      <GenerationDialog 
        isOpen={isCreating} 
        statusText={progressMessage || "Creating Series..."} 
        cost={totalCost} 
      />

      <div className="flex-1 flex items-center justify-center p-6 mt-20">
        <div className="max-w-3xl w-full">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm font-bold flex items-center gap-1 mb-8">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                Back to Creation Hub
            </Link>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create Your Series
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Describe your series idea. AI will generate scripts for all episodes.
            </p>
          </div>

          {/* Mega-Prompt Input */}
          <div className="bg-white dark:bg-[#101322] rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-white/10 mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                Series Mega-Prompt
              </label>
              <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-black text-slate-500">
                {megaPrompt.length} / 5000 CHARS
              </div>
            </div>

            {/* Narrative Selection */}
            {narratives.length > 0 && (
              <div className="mb-6">
                <label className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 mb-3 block">
                  Select Story Architecture (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedNarrativeId(null)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all",
                      !selectedNarrativeId 
                        ? "border-blue-500 bg-blue-500/10" 
                        : "border-slate-200 dark:border-white/10 hover:border-blue-500/50"
                    )}
                  >
                    <div className="font-bold text-sm">None (Raw AI)</div>
                    <div className="text-[10px] text-slate-500 uppercase">Standard prompt only</div>
                  </button>
                  {narratives.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNarrativeId(n.id)}
                      className={cn(
                        "p-4 rounded-2xl border text-left transition-all",
                        selectedNarrativeId === n.id 
                          ? "border-purple-500 bg-purple-500/10" 
                          : "border-slate-200 dark:border-white/10 hover:border-purple-500/50"
                      )}
                    >
                      <div className="font-bold text-sm line-clamp-1">{n.title}</div>
                      <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">auto_stories</span>
                        {n.genre} architecture
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              className="w-full resize-none rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0d101b] p-6 text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 min-h-[300px] leading-relaxed transition-all shadow-inner font-mono"
              placeholder={`Example:

Create a 3-episode series about...

Episode 1: [First episode description]
Episode 2: [Second episode]
Episode 3: [Third episode]

Style: [Visual style]
Tone: [Narrative tone]
Duration: [Target length]`}
              value={megaPrompt}
              maxLength={5000}
              onChange={(e) => setMegaPrompt(e.target.value)}
            />


            {error && !isCreating && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{error}</p>
              </div>
            )}





            <button
              onClick={handleCreateSeries}
              disabled={isCreating || megaPrompt.length < 100}
              className="mt-6 w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isCreating ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Series...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  Create Series
                </>
              )}
            </button>
          </div>

          {/* Example Prompts */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Example Prompts
            </h3>
            <div className="grid gap-4">
              {examplePrompts.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => setMegaPrompt(example.prompt)}
                  className="text-left p-6 bg-white dark:bg-[#101322] rounded-2xl border border-slate-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 transition-all group"
                >
                  <h4 className="font-black text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {example.title}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 font-mono">
                    {example.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
