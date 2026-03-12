"use client"
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Clapperboard } from "lucide-react";

export function NewNarrativeTypeSelection() {
  const router = useRouter();

  const choices = [
    {
      id: "business",
      title: "Business Narrative",
      description: "Tell your founder story and build your brand voice. Perfect for YouTube deep-dives, TikTok origin stories, and short-form business content.",
      Icon: Briefcase,
      color: "text-red-400",
      borderColor: "hover:border-red-500",
      bgColor: "hover:bg-red-500/5",
      iconBg: "bg-red-500/10 group-hover:bg-red-500/20",
      path: "/narrative/new/business"
    },
    {
      id: "series",
      title: "Story Series",
      description: "Architect an immersive narrative world with character arcs and plot threads. Built for YouTube episodic series and TikTok serialized storytelling.",
      Icon: Clapperboard,
      color: "text-purple-400",
      borderColor: "hover:border-purple-500",
      bgColor: "hover:bg-purple-500/5",
      iconBg: "bg-purple-500/10 group-hover:bg-purple-500/20",
      path: "/series-narrative"
    }
  ];

  return (
    <div className="min-h-full bg-transparent font-sans text-foreground flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center">
          <span className="text-primary font-bold tracking-widest text-xs uppercase mb-4 block">
            Intelligence Engine
          </span>
          <h1 className="text-5xl font-black mb-6 tracking-tight">
            What are we <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500">creating</span> today?
          </h1>
          <p className="text-muted-foreground mb-12 text-xl max-w-lg mx-auto">
            Choose the narrative framework that fits your content vision.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {choices.map((choice) => (
              <Card
                key={choice.id}
                className={cn(
                  "cursor-pointer transition-all border-border bg-card/50 p-4 text-left",
                  choice.borderColor,
                  choice.bgColor,
                  "hover:scale-[1.02] group"
                )}
                onClick={() => router.push(choice.path)}
              >
                <CardContent className="p-6">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors",
                    choice.iconBg
                  )}>
                    <choice.Icon className={cn("size-8", choice.color)} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{choice.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
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
