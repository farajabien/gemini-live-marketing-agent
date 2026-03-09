"use client";

import { useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { ACTIVE_GENERATION_STATUSES } from "@/lib/types";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

function statusLabel(status: string): string {
  switch (status) {
    case "generating":
      return "Generating visuals...";
    case "generating_audio":
      return "Synthesizing audio...";
    case "rendering_video":
    case "rendering":
      return "Rendering MP4...";
    case "pending":
      return "Starting...";
    default:
      return "Processing...";
  }
}

/**
 * Global generation watcher:
 * 1. Floating progress pill when generation is active (visible on all pages except /success)
 * 2. Toast notification when a plan transitions to 'completed'
 */
export function GenerationStatusToast() {
  const { user } = useAuth();
  const previousStatuses = useRef<Record<string, string>>({});
  const pathname = usePathname();

  const plansQuery = useMemo(
    () =>
      user
        ? {
            videoPlans: {
              $: {
                where: { userId: user.id },
                order: { createdAt: "desc" as const },
                limit: 10,
              },
            },
          }
        : null,
    [user?.id]
  );

  const { data } = db.useQuery(plansQuery);
  const plans = (data && "videoPlans" in data ? data.videoPlans : []) as Array<{
    id: string;
    title: string;
    status: string;
    type: string;
  }>;

  // Fire toast on completion transitions
  useEffect(() => {
    if (!plans || plans.length === 0) return;

    for (const plan of plans) {
      if (!plan.id || !plan.status) continue;

      const prev = previousStatuses.current[plan.id];

      if (plan.status === "completed" && prev && prev !== "completed") {
        toast.success(`"${plan.title || "Your video"}" is ready!`, {
          duration: 8000,
          action: {
            label: "View",
            onClick: () => {
              window.location.href = `/success?planId=${plan.id}&type=${plan.type || "video"}`;
            },
          },
        });
      }

      previousStatuses.current[plan.id] = plan.status;
    }
  }, [plans]);

  // Find actively generating plans
  const activePlans = plans.filter((p) => ACTIVE_GENERATION_STATUSES.includes(p.status as any));

  // Hide FAB on the success page (it has its own progress UI)
  const isOnSuccessPage = pathname?.startsWith("/success");
  if (activePlans.length === 0 || isOnSuccessPage) return null;

  const activePlan = activePlans[0];

  return (
    <a
      href={`/success?planId=${activePlan.id}&type=${activePlan.type || "video"}`}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
    >
      {/* Pulsing dot */}
      <span className="relative flex size-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full size-3 bg-white" />
      </span>

      <div className="flex flex-col">
        <span className="text-xs font-bold leading-tight truncate max-w-[180px]">
          {activePlan.title || "Video"}
        </span>
        <span className="text-[10px] text-white/70 font-medium">
          {statusLabel(activePlan.status)}
        </span>
      </div>

      {activePlans.length > 1 && (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
          +{activePlans.length - 1}
        </span>
      )}

      <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity -mr-1">
        arrow_forward
      </span>
    </a>
  );
}
