"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NarrativeStep } from "@/lib/narrative-config";
import { cn } from "@/lib/utils";

interface RefineWithAIButtonProps {
  step: NarrativeStep;
  currentValue: string;
  onRefined: (newValue: string) => void;
  className?: string;
}

export function RefineWithAIButton({ step, currentValue, onRefined, className }: RefineWithAIButtonProps) {
  const [isRefining, setIsRefining] = useState(false);

  const handleRefine = async () => {
    if (!currentValue || currentValue.length < 3) return;
    
    setIsRefining(true);
    try {
      const response = await fetch("/api/refine-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: step.id,
          stepTitle: step.title,
          stepDescription: step.description,
          currentValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to refine narrative");
      }

      const data = await response.json();
      
      onRefined(data.refinedText);
      toast.success("AI refined your answer!", {
        description: data.explanation,
      });
      
    } catch (error) {
      console.error("Failed to refine with AI", error);
      toast.error("AI Refinement failed. Please try again.");
    } finally {
      setIsRefining(false);
    }
  };

  if (!currentValue || currentValue.length < 3 || step.type !== "text") {
    return null;
  }

  return (
    <Button
      type="button"
      onClick={handleRefine}
      disabled={isRefining}
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30 transition-all font-semibold rounded-xl",
        className
      )}
    >
      <span className={cn("material-symbols-outlined text-[18px]", isRefining && "animate-spin")}>
        {isRefining ? "progress_activity" : "auto_awesome"}
      </span>
      {isRefining ? "Refining..." : "Refine with AI"}
    </Button>
  );
}
