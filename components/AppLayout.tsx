"use client";

import * as React from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useState, Suspense, useMemo, useEffect } from "react";
import { ProfileDialog } from "./ProfileDialog";
import { SecureAccountDialog } from "./SecureAccountDialog";
import { GenerateScreen } from "@/components/screens/GenerateScreen";
import { firebaseDb as db } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";
import { useGenerateStore } from "@/hooks/use-generate-store";
import { motion, AnimatePresence } from "framer-motion";

// shadcn UI & Layout
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { FounderNarrative, Series } from "@/lib/types";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalCommandPalette } from "@/components/layout/CommandPalette";

interface AppLayoutProps {
  children: React.ReactNode;
  narrativeId?: string;
  seriesId?: string;
  noPadding?: boolean;
  headerTitle?: React.ReactNode;
  headerActions?: React.ReactNode;
}

import { WarRoomSkeleton } from "@/components/ui/PremiumSkeleton";

export function AppLayout({ children, narrativeId, seriesId, noPadding, headerTitle, headerActions }: AppLayoutProps) {
  return (
    <Suspense fallback={<WarRoomSkeleton />}>
      <AppLayoutContent narrativeId={narrativeId} seriesId={seriesId} noPadding={noPadding} headerTitle={headerTitle} headerActions={headerActions}>
        {children}
      </AppLayoutContent>
    </Suspense>
  );
}

function AppLayoutContent({ children, narrativeId, seriesId, noPadding, headerTitle, headerActions }: AppLayoutProps) {
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const { isOpen: isGenerateOpen, closeGenerator, params: generateParams } = useGenerateStore();

  const initialPlanId = searchParams.get("planId") || undefined;
  const resolvedNarrativeId = narrativeId || searchParams.get("narrativeId") || undefined;
  const resolvedSeriesId = seriesId || searchParams.get("seriesId") || undefined;
  const initialSeriesId = searchParams.get("seriesId") || resolvedSeriesId;

  useEffect(() => {
    if ((searchParams.get("tool") === "generate" || initialPlanId) && !isGenerateOpen) {
      useGenerateStore.getState().openGenerator({ narrativeId: resolvedNarrativeId, planId: initialPlanId, seriesId: initialSeriesId });
    }
  }, [searchParams, isGenerateOpen, resolvedNarrativeId, initialPlanId, initialSeriesId]);

  // Fetch current narrative if ID present
  const currentNarrativeQuery = useMemo(
    () =>
      resolvedNarrativeId && user
        ? { narratives: { $: { where: { id: resolvedNarrativeId, userId: user.id } } } }
        : null,
    [resolvedNarrativeId, user?.id]
  );
  const { data: currentNarrativeData } = (db as any).useQuery(currentNarrativeQuery);
  const narrative = currentNarrativeData?.narratives?.[0] as FounderNarrative | undefined;

  // Fetch ALL user narratives and series for the switcher
  const allItemsQuery: any = useMemo(
    () =>
      user
        ? {
            narratives: { $: { where: { userId: user.id }, order: { createdAt: "desc" } } },
            series: { $: { where: { userId: user.id }, order: { createdAt: "desc" } } },
            activePlans: { 
              $: { 
                collection: 'videoPlans', 
                where: { 
                  userId: user.id, 
                  status: { in: ['pending', 'generating', 'generating_audio', 'rendering'] } 
                },
                order: { createdAt: 'desc' },
                limit: 1
              } 
            }
          }
        : null,
    [user?.id]
  );
  const { data: allItemsData } = db.useQuery(allItemsQuery);
  const allNarratives = ((allItemsData)?.narratives || []) as FounderNarrative[];
  const allSeries = ((allItemsData)?.series || []) as Series[];
  const activeProductionPlan = ((allItemsData)?.activePlans?.[0]);
  const series = resolvedSeriesId ? allSeries.find((s) => s.id === resolvedSeriesId) : undefined;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black selection:bg-red-500/30">
      <GlobalHeader
        user={user as any}
        signOut={signOut}
        allNarratives={allNarratives}
        allSeries={allSeries}
        activeProductionPlan={activeProductionPlan}
        narrative={narrative}
        series={series}
        headerTitle={headerTitle}
        headerActions={headerActions}
        resolvedNarrativeId={resolvedNarrativeId}
        resolvedSeriesId={resolvedSeriesId}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenSecurity={() => setSecurityOpen(true)}
      />

      <main className={cn(
        "flex-1 overflow-hidden relative",
        !noPadding && "p-6"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={resolvedNarrativeId || resolvedSeriesId || 'root'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="h-full"
          >
            <div className={cn(
              "mx-auto w-full h-full",
              noPadding ? "max-w-none" : "max-w-7xl"
            )}>
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Dialogs */}
      <Dialog open={isGenerateOpen} onOpenChange={(open) => !open && closeGenerator()}>
        <DialogContent className="w-[95vw] sm:max-w-5xl xl:max-w-7xl h-[85vh] p-0 overflow-hidden bg-[#050505] border-white/10 flex flex-col items-center justify-center sm:rounded-[3rem]">
          <DialogTitle className="sr-only">Content Generator</DialogTitle>
          <div className="w-full h-full overflow-y-auto">
            <GenerateScreen
              isModal={true}
              hideHeader={true}
              initialPlanId={initialPlanId}
              activeNarrativeId={generateParams.narrativeId || resolvedNarrativeId}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ProfileDialog
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenSecurity={() => setSecurityOpen(true)}
      />
      <SecureAccountDialog
        isOpen={securityOpen}
        onClose={() => setSecurityOpen(false)}
      />
      
      <GlobalCommandPalette />
    </div>
  );
}
