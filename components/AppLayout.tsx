"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useState, Suspense, useMemo, useEffect } from "react";
import { ProfileDialog } from "./ProfileDialog";
import { SecureAccountDialog } from "./SecureAccountDialog";
import { GenerateScreen } from "@/components/screens/GenerateScreen";
import { firebaseDb as db } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";
import { useGenerateStore } from "@/hooks/use-generate-store";
import { LOGO } from "@/lib/branding";
import Image from "next/image";

// shadcn UI & Layout
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

// icons
import { 
  LayoutDashboard, 
  FolderPlus, 
  Brain, 
  FileEdit, 
  CalendarDays, 
  PlusCircle, 
  Video, 
  Palette,
  Settings,
  LogOut,
  ChevronRight,
  MoreVertical,
  Layers,
  Sparkles,
  Mic,
  Volume2,
  Plus,
  MessageSquare
} from "lucide-react";
import { initializeDraftNarrative } from "@/app/actions/marketing";
import { toast } from "sonner";


import type { FounderNarrative, Series, User, VideoPlan } from "@/lib/types";

interface AppLayoutProps {
  children: React.ReactNode;
  narrativeId?: string;
  seriesId?: string;
  noPadding?: boolean;
  headerTitle?: React.ReactNode;
  headerActions?: React.ReactNode;
}

import { GlobalHeader } from "@/components/layout/GlobalHeader";

export function AppLayout({ children, narrativeId, seriesId, noPadding, headerTitle, headerActions }: AppLayoutProps) {
  return (
    <Suspense fallback={<div className="flex h-screen bg-black" />}>
      <AppLayoutContent narrativeId={narrativeId} seriesId={seriesId} noPadding={noPadding} headerTitle={headerTitle} headerActions={headerActions}>
        {children}
      </AppLayoutContent>
    </Suspense>
  );
}

function AppLayoutContent({ children, narrativeId, seriesId, noPadding, headerTitle, headerActions }: AppLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  const { isOpen: isGenerateOpen, closeGenerator, params: generateParams } = useGenerateStore();

  const initialPlanId = searchParams.get("planId") || undefined;
  
  // Resolve context IDs from props or search params
  const resolvedNarrativeId = narrativeId || searchParams.get("narrativeId") || undefined;
  const resolvedSeriesId = seriesId || searchParams.get("seriesId") || undefined;

  const initialSeriesId = searchParams.get("seriesId") || resolvedSeriesId;

  useEffect(() => {
    // Open generator if either tool=generate OR we have a planId
    if ((searchParams.get("tool") === "generate" || initialPlanId) && !isGenerateOpen) {
      useGenerateStore.getState().openGenerator({ narrativeId, planId: initialPlanId, seriesId: initialSeriesId });
      
      if (searchParams.get("tool") === "generate") {
        const url = new URL(window.location.href);
        url.searchParams.delete("tool");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams, isGenerateOpen, narrativeId, initialPlanId]);

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
    <div className="min-h-svh bg-black text-white flex flex-col">
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

      {/* Main Viewport */}
      <div className={cn(
        "flex-1 overflow-auto transition-all duration-300",
        noPadding ? "p-0" : "p-4 md:p-6"
      )}>
        <div className={cn(
          "mx-auto w-full h-full",
          noPadding ? "max-w-none" : "max-w-7xl"
        )}>
          {children}
        </div>
      </div>

      {/* Global Dialogs */}
      <Dialog open={isGenerateOpen} onOpenChange={(open) => !open && closeGenerator()}>
        <DialogContent className="w-[95vw] sm:max-w-5xl xl:max-w-7xl h-[85vh] p-0 overflow-hidden bg-[#050505] border-white/10 flex flex-col items-center justify-center sm:rounded-[3rem]">
          <DialogTitle className="sr-only">Content Generator</DialogTitle>
          <div className="w-full h-full overflow-y-auto">
            <GenerateScreen
              isModal={true}
              hideHeader={true}
              initialPlanId={initialPlanId}
              activeNarrativeId={generateParams.narrativeId || narrativeId}
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
    </div>
  );
}
