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
  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

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
      
      // We purposefully DO NOT clean up planId from the URL here, because GenerateScreen
      // needs to read `initialPlanId` from its own searchParams hook to load the plan.
      if (searchParams.get("tool") === "generate") {
        const url = new URL(window.location.href);
        url.searchParams.delete("tool");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams, isGenerateOpen, narrativeId, initialPlanId]);

  // Fetch current narrative if ID present - with userId guard
  const currentNarrativeQuery = useMemo(
    () =>
      resolvedNarrativeId && user
        ? { narratives: { $: { where: { id: resolvedNarrativeId, userId: user.id } } } }
        : null,
    [resolvedNarrativeId, user?.id]
  );
  const { data: currentNarrativeData } = (db as any).useQuery(currentNarrativeQuery);
  const narrative = currentNarrativeData?.narratives?.[0] as FounderNarrative | undefined;

  // Fetch episodes if in series context
  const episodesQuery = useMemo(
    () =>
      resolvedSeriesId
        ? { episodes: { $: { where: { seriesId: resolvedSeriesId }, order: { episodeNumber: "asc" } } } }
        : null,
    [resolvedSeriesId]
  );
  const { data: episodesData } = (db as any).useQuery(episodesQuery);
  const seriesEpisodes = (episodesData?.episodes || []) as any[];

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

  const isNavItemActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;
    if (href !== "/dashboard" && pathname.startsWith(href)) return true;
    return false;
  };

  const breadcrumbs = useMemo(() => {
    const list = [];
    if (narrative) {
      list.push({ label: narrative.title, href: `/narrative/${narrative.id}` });
    }
    if (series) {
      list.push({ label: series.title, href: `/series/${series.id}` });
    }
    if (pathname.includes("/media")) {
      list.push({ label: "Media Library", href: "/media" });
    }
    return list;
  }, [narrative, series, pathname]);

  return (
    <div className="min-h-svh bg-black text-white flex flex-col">
      {/* Unified Global Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50 px-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Logo & Project Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="transition-transform hover:scale-105 active:scale-95">
              <Image
                src={LOGO.full}
                alt={LOGO.alt}
                width={80}
                height={20}
                className="h-4 w-auto"
                priority
              />
            </Link>

            <Separator orientation="vertical" className="h-4 bg-white/10" />

            {/* Project Switcher Popover */}
            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-red-600/50 hover:bg-white/10 transition-all group max-w-[160px]">
                  <div className={cn(
                    "flex aspect-square size-4 items-center justify-center rounded font-bold text-[8px] shrink-0",
                    narrative ? "bg-red-600 text-white" : series ? "bg-amber-600 text-white" : "bg-white/10 text-white/50"
                  )}>
                    {narrative ? narrative.title.charAt(0).toUpperCase() : series ? series.title.charAt(0).toUpperCase() : <Plus className="size-2.5" />}
                  </div>
                  <span className="text-[10px] font-bold text-white truncate max-w-[100px]">
                    {narrative ? narrative.title : series ? series.title : "Switch"}
                  </span>
                  <ChevronRight className="size-3 text-white/20 group-hover:text-white/60 transition-colors" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0 bg-[#0a0a0a] border-white/10 shadow-2xl rounded-2xl overflow-hidden" align="start">
                <Command className="bg-transparent">
                  <CommandInput placeholder="Search projects & series..." className="h-10 border-none focus:ring-0" />
                  <CommandList className="max-h-[400px]">
                    <CommandEmpty className="py-6 text-center text-xs text-white/40 italic">No matches found.</CommandEmpty>

                    <CommandGroup heading="Active War Rooms">
                      <CommandItem
                        value="all-projects"
                        onSelect={() => { router.push("/dashboard"); setSwitcherOpen(false); }}
                        className="flex items-center gap-3 cursor-pointer py-3 px-4 focus:bg-red-600/10 focus:text-red-500 rounded-lg mx-1"
                      >
                        <LayoutDashboard className="size-4 text-white/40" />
                        <span className="text-xs font-black uppercase tracking-widest">All Projects</span>
                      </CommandItem>
                      {allNarratives.map((n) => (
                        <CommandItem
                          key={n.id}
                          value={`project-${n.title}-${n.id}`}
                          onSelect={() => { router.push(`/narrative/${n.id}`); setSwitcherOpen(false); }}
                          className="flex items-center gap-3 cursor-pointer py-3 px-4 focus:bg-red-600/10 focus:text-red-500 rounded-lg mx-1"
                        >
                          <div className="size-6 rounded bg-red-600/20 text-red-500 flex items-center justify-center text-[10px] font-black uppercase">
                            {n.title.charAt(0)}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest truncate">{n.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>

                    <CommandGroup heading="Strategic Series">
                      {allSeries.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`series-${s.title}-${s.id}`}
                          onSelect={() => { router.push(`/series/${s.id}`); setSwitcherOpen(false); }}
                          className="flex items-center gap-3 cursor-pointer py-3 px-4 focus:bg-amber-600/10 focus:text-amber-500 rounded-lg mx-1"
                        >
                          <div className="size-6 rounded bg-amber-600/20 text-amber-500 flex items-center justify-center text-[10px] font-black uppercase">
                            {s.title.charAt(0)}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest truncate">{s.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>

                    <CommandGroup className="border-t border-white/5 mt-1 pt-1">
                      <CommandItem
                        value="new-narrative"
                        onSelect={async () => {
                          if (isCreatingGlobal) return;
                          setIsCreatingGlobal(true);
                          setSwitcherOpen(false);
                          try {
                            const { narrativeId: nid } = await initializeDraftNarrative(user?.id || "");
                            router.push(`/narrative/${nid}`);
                          } catch (e) {
                            toast.error("Failed to start project");
                          } finally {
                            setIsCreatingGlobal(false);
                          }
                        }}
                        className="flex items-center gap-3 cursor-pointer py-3 px-4 text-red-500 font-black uppercase tracking-[0.2em] text-[10px] focus:bg-red-600/10 rounded-lg mx-1"
                      >
                        <PlusCircle className="size-4" />
                        <span>{isCreatingGlobal ? "Initializing..." : "New Narrative"}</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Separator orientation="vertical" className="h-4 bg-white/10 hidden xl:block" />

          {/* Integrated Screen Title */}
          {headerTitle && (
            <div className="hidden sm:flex items-center flex-1 min-w-0 px-2">
              {headerTitle}
            </div>
          )}

          {/* Core Navigation (if no custom title) */}
          {!headerTitle && (
            <nav className="hidden lg:flex items-center gap-1">
              <NavLink href="/dashboard" icon={<LayoutDashboard className="size-3" />} label="Hub" isActive={pathname === "/dashboard"} />
              <NavLink href="/media" icon={<Video className="size-3" />} label="Archives" isActive={pathname === "/media"} />
              {resolvedNarrativeId && (
                <NavLink href={`/narrative/${resolvedNarrativeId}`} icon={<Brain className="size-3" />} label="War Room" isActive={pathname === `/narrative/${resolvedNarrativeId}`} />
              )}
              {resolvedSeriesId && (
                <NavLink href={`/series/${resolvedSeriesId}`} icon={<Layers className="size-3" />} label="Series Hub" isActive={pathname === `/series/${resolvedSeriesId}`} />
              )}
            </nav>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
              <div className="h-4 w-px bg-white/10 mx-1" />
            </div>
          )}

          {activeProductionPlan && (
            <button
              onClick={() => useGenerateStore.getState().openGenerator({
                planId: activeProductionPlan.id,
                narrativeId: activeProductionPlan.narrativeId
              })}
              className="flex items-center gap-2 h-8 px-3 rounded-xl bg-blue-600/10 border border-blue-600/20 text-blue-500 text-[8px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all group shadow-xl shadow-blue-900/10"
            >
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-blue-500 group-hover:bg-white" />
              </span>
              Resume
            </button>
          )}

          <div className="h-4 w-px bg-white/10" />

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/5 transition-colors group">
                <Avatar className="size-7 border border-white/10 rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                  <AvatarFallback className="bg-red-600 text-[9px] font-black text-white rounded-lg">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <MoreVertical className="size-3 text-slate-600 group-hover:text-white transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[#0a0a0a] border-white/10 shadow-2xl rounded-2xl p-2 mt-2" side="bottom" align="end" sideOffset={8}>
              <div className="px-3 py-2 mb-2 border-b border-white/5">
                 <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Signed in as</p>
                 <p className="text-xs font-bold text-white truncate">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => setProfileOpen(true)} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 focus:bg-white/5 focus:text-red-500 transition-colors">
                <Settings className="size-4 text-slate-500" /> Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 focus:bg-white/5 focus:text-red-500 transition-colors">
                <Layers className="size-4 text-slate-500" /> Security
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5 my-2" />
              <DropdownMenuItem onClick={() => signOut()} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors">
                <LogOut className="size-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

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

function NavLink({ href, icon, label, isActive }: { href: string; icon: React.ReactNode; label: string; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all border border-transparent",
        isActive
          ? "bg-red-600/10 text-red-500 border-red-600/10 shadow-[0_0_20px_rgba(220,38,38,0.05)]"
          : "text-slate-500 hover:text-white hover:bg-white/5"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
