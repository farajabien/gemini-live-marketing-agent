"use client"
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function NewNarrativeTypeSelection() {
  const router = useRouter();

  const choices = [
    {
      id: "business",
      title: "Business / Brand Identity",
      description: "Extract the strategic core of your business. Ideal for LinkedIn, X, and marketing content.",
      icon: "business_center",
      color: "text-red-400",
      borderColor: "hover:border-red-500",
      bgColor: "hover:bg-red-500/5",
      path: "/narrative/new/business"
    },
    {
      id: "series",
      title: "Story / Video Series",
      description: "Architect a deep story world. Ideal for Sci-Fi, Mystery, and immersive video series.",
      icon: "auto_stories",
      color: "text-purple-400",
      borderColor: "hover:border-purple-500",
      bgColor: "hover:bg-purple-500/5",
      path: "/series-narrative"
    }
  ];

  return (
    <div className="min-h-screen bg-[#050510] font-sans text-slate-100 flex flex-col">
      <Header transparent />

      <main className="flex-1 flex flex-col items-center justify-center p-6 pt-24">
        <div className="max-w-2xl w-full text-center">
          <span className="text-red-500 font-bold tracking-widest text-xs uppercase mb-4 block">
            Intelligence Engine
          </span>
          <h1 className="text-5xl font-black mb-6 tracking-tight">
            What are we <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500">designing</span> today?
          </h1>
          <p className="text-slate-400 mb-12 text-xl max-w-lg mx-auto">
            Choose the narrative framework that best fits your content goals.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {choices.map((choice) => (
              <Card
                key={choice.id}
                className={cn(
                  "cursor-pointer transition-all border-white/10 bg-white/5 p-4 text-left",
                  choice.borderColor,
                  choice.bgColor,
                  "hover:scale-[1.02] group"
                )}
                onClick={() => router.push(choice.path)}
              >
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                    <span className={cn("material-symbols-outlined text-4xl", choice.color)}>
                      {choice.icon}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mb-3 text-white">{choice.title}</h3>
                  <p className="text-slate-400 leading-relaxed">
                    {choice.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
