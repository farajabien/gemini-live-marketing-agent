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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
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
  Volume2
} from "lucide-react";
import { LiveDirectorFAB } from "./narrative/LiveDirectorFAB";


import type { FounderNarrative, Series, User, VideoPlan } from "@/lib/types";

interface AppLayoutProps {
  children: React.ReactNode;
  narrativeId?: string;
  seriesId?: string;
  noPadding?: boolean;
}

export function AppLayout({ children, narrativeId, seriesId }: AppLayoutProps) {
  return (
    <Suspense fallback={<div className="flex h-screen bg-black" />}>
      <AppLayoutContent narrativeId={narrativeId} seriesId={seriesId}>{children}</AppLayoutContent>
    </Suspense>
  );
}

function AppLayoutContent({ children, narrativeId, seriesId, noPadding }: AppLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { isOpen: isGenerateOpen, closeGenerator, params: generateParams } = useGenerateStore();

  const initialPlanId = searchParams.get("planId") || undefined;

  useEffect(() => {
    // Open generator if either tool=generate OR we have a planId
    if ((searchParams.get("tool") === "generate" || initialPlanId) && !isGenerateOpen) {
      useGenerateStore.getState().openGenerator({ narrativeId, planId: initialPlanId });
      
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
      narrativeId && user
        ? { narratives: { $: { where: { id: narrativeId, userId: user.id } } } }
        : null,
    [narrativeId, user?.id]
  );
  const { data: currentNarrativeData } = (db as any).useQuery(currentNarrativeQuery);
  const narrative = currentNarrativeData?.narratives?.[0] as FounderNarrative | undefined;

  // Fetch episodes if in series context
  const episodesQuery = useMemo(
    () =>
      seriesId
        ? { episodes: { $: { where: { seriesId }, order: { episodeNumber: "asc" } } } }
        : null,
    [seriesId]
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
                  status: { in: ['pending', 'generating', 'generating_audio', 'rendering_video', 'rendering'] } 
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
  const series = seriesId ? allSeries.find((s) => s.id === seriesId) : undefined;

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
    if (pathname.includes("/engine")) {
      list.push({ label: "Content Engine", href: pathname });
    } else if (pathname.includes("/drafts")) {
      list.push({ label: "Content Library", href: pathname });
    }
    return list;
  }, [narrative, series, pathname]);

  return (
    <SidebarProvider>
      <AppSidebar 
        narrativeId={narrativeId}
        narrative={narrative}
        allNarratives={allNarratives}
        seriesId={seriesId}
        series={series}
        seriesEpisodes={seriesEpisodes}
        allSeries={allSeries}
        switcherOpen={switcherOpen}
        setSwitcherOpen={setSwitcherOpen}
        pathname={pathname}
        searchParams={searchParams}
        router={router}
        user={user}
        signOut={signOut}
        setProfileOpen={setProfileOpen}
        setSecurityOpen={setSecurityOpen}
      />
      <MainContent 
        breadcrumbs={breadcrumbs} 
        noPadding={noPadding} 
        latestNarrative={narrative}
        user={user}
        activeProductionPlan={activeProductionPlan}
      >
        {children}
        <LiveDirectorFAB narrativeId={narrativeId} seriesId={seriesId} />
      </MainContent>

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
    </SidebarProvider>
  );
}

/* ─── Sidebar Component ─── */
function AppSidebar({
  narrativeId,
  narrative,
  allNarratives,
  seriesId,
  series,
  seriesEpisodes,
  allSeries,
  switcherOpen,
  setSwitcherOpen,
  pathname,
  searchParams,
  router,
  user,
  signOut,
  setProfileOpen,
  setSecurityOpen,
}: {
  narrativeId?: string;
  narrative?: FounderNarrative;
  allNarratives: FounderNarrative[];
  seriesId?: string;
  series?: Series;
  seriesEpisodes: any[];
  allSeries: Series[];
  switcherOpen: boolean;
  setSwitcherOpen: (v: boolean) => void;
  pathname: string;
  searchParams: URLSearchParams;
  router: any;
  user: any;
  signOut: () => void;
  setProfileOpen: (v: boolean) => void;
  setSecurityOpen: (v: boolean) => void;
}) {
  const activeSeriesId = seriesId || narrative?.id; // In our connected plan, sometimes they overlap

  return (
    <Sidebar collapsible="icon" className="bg-[#050505] border-r border-white/5">
    
      <SidebarContent>
        {/* Project Switcher */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton 
                      size="lg"
                      className="w-full bg-white/5 border border-white/5 hover:border-red-600/50 hover:bg-white/10 transition-all text-left group/switcher h-auto py-2.5"
                    >
                      <div className={cn(
                        "flex aspect-square size-7 items-center justify-center rounded font-bold text-[11px] shrink-0 transition-colors",
                        narrative ? "bg-red-600 text-white" : series ? "bg-amber-600 text-white" : "bg-white/10 text-white/50"
                      )}>
                        {narrative ? narrative.title.charAt(0).toUpperCase() : series ? series.title.charAt(0).toUpperCase() : <LayoutDashboard className="size-4" />}
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="text-xs font-bold text-white truncate">
                          {narrative ? narrative.title : series ? series.title : "All Projects & Series"}
                        </span>
                        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                          {narrative ? "Active Project" : series ? "Active Series" : "Switch Projects"}
                        </span>
                      </div>
                      <ChevronRight className="ml-auto size-3 text-white/20 group-hover/switcher:text-white/60 transition-colors" />
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0 bg-[#0a0a0a] border-white/10 shadow-2xl" align="start">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Search projects & series..." className="h-9" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-4 text-center text-xs text-white/40">No projects or series found.</CommandEmpty>
                        <CommandGroup heading="Projects">
                          <CommandItem
                            value="all-projects"
                            onSelect={() => { router.push("/dashboard"); setSwitcherOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer py-2 focus:bg-red-600/10 focus:text-red-500"
                          >
                            <LayoutDashboard className="size-4 text-white/60" />
                            <span className="text-sm font-medium">All Projects</span>
                          </CommandItem>
                          {allNarratives.map((n) => (
                            <CommandItem
                              key={n.id}
                              value={`project-${n.title}-${n.id}`}
                              onSelect={() => { router.push(`/narrative/${n.id}`); setSwitcherOpen(false); }}
                              className="flex items-center gap-2 cursor-pointer py-2 focus:bg-red-600/10 focus:text-red-500"
                            >
                              <div className="size-5 rounded bg-red-600/20 text-red-500 flex items-center justify-center text-[10px] font-bold">
                                {n.title.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium truncate">{n.title}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Series">
                          {allSeries.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`series-${s.title}-${s.id}`}
                              onSelect={() => { router.push(`/series/${s.id}`); setSwitcherOpen(false); }}
                              className="flex items-center gap-2 cursor-pointer py-2 focus:bg-amber-600/10 focus:text-amber-500"
                            >
                              <div className="size-5 rounded bg-amber-600/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">
                                {s.title.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium truncate">{s.title}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <Separator className="bg-white/5 my-1" />
                        <CommandGroup>
                          <CommandItem
                            value="new-narrative"
                            onSelect={() => { router.push("/narrative/new"); setSwitcherOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer py-2 text-red-500 font-bold focus:bg-red-600/10"
                          >
                            <PlusCircle className="size-4" />
                            <span className="text-sm">New Narrative</span>
                          </CommandItem>
                          <CommandItem
                            value="new-series"
                            onSelect={() => { router.push("/series/new"); setSwitcherOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer py-2 text-amber-500 font-bold focus:bg-amber-600/10"
                          >
                            <PlusCircle className="size-4" />
                            <span className="text-sm">New Series</span>
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* The Strategic Core (Shared context for Narrative & Linked Series) */}
        {(narrativeId || (series && series.seriesNarrativeId)) && !seriesId && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/30 uppercase text-[9px] tracking-[0.2em] font-black px-2">
              Business
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem 
                  icon={<Brain className="size-4" />} 
                  label="Strategy Hub" 
                  href={`/narrative/${narrativeId || series?.seriesNarrativeId}`} 
                  isActive={pathname === `/narrative/${narrativeId || series?.seriesNarrativeId}`}
                />
                <SidebarNavItem 
                  icon={<Sparkles className="size-4" />} 
                  label="Context Engine" 
                  href={`/narrative/${narrativeId || series?.seriesNarrativeId}/engine`} 
                  isActive={pathname.includes("/engine")}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Active Production (Episodes) */}
        {seriesId && !narrativeId && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/30 uppercase text-[9px] tracking-[0.15em] font-black px-2 flex items-center justify-between group-data-[collapsible=icon]:hidden">
              <span className="truncate max-w-[120px]">{series?.title || "Episodes"}</span>
              <button 
                onClick={() => router.push(`/series/${seriesId}?add=1`)}
                className="hover:text-amber-500 transition-colors"
                title="Add New Episode"
              >
                <PlusCircle className="size-3" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem 
                  icon={<LayoutDashboard className="size-4" />} 
                  label="Series Hub" 
                  href={`/series/${seriesId}`} 
                  isActive={pathname === `/series/${seriesId}`}
                />
                
                {/* Episodes List */}
                <div className="mt-2 px-2 pb-2 space-y-1 group-data-[collapsible=icon]:hidden">
                  {seriesEpisodes.map((ep) => (
                    <Link 
                      key={ep.id}
                      href={`/series/${seriesId}?episodeId=${ep.id}`}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border border-transparent",
                        searchParams.get("episodeId") === ep.id 
                          ? "bg-amber-600/20 text-amber-500 border-amber-600/30" 
                          : "text-white/30 hover:text-white/60 hover:bg-white/5"
                      )}
                    >
                      <div className={cn(
                        "size-1.5 rounded-full shrink-0",
                        ep.status === 'complete' ? "bg-emerald-500" : ep.status === 'generating' ? "bg-amber-500 animate-pulse" : "bg-white/20"
                      )} />
                      <span className="truncate">Ep {ep.episodeNumber}: {ep.title}</span>
                    </Link>
                  ))}
                  
                  <button
                    onClick={() => router.push(`/series/${seriesId}?add=1`)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[10px] font-black uppercase tracking-widest text-amber-500 hover:bg-amber-600/10 transition-all border border-dashed border-amber-600/20 hover:border-amber-600/40 mt-2"
                  >
                    <PlusCircle className="size-3" />
                    + New Episode
                  </button>
                </div>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Global Dashboard (Fallback) */}
        {!narrativeId && !seriesId && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/30 uppercase text-[9px] tracking-[0.2em] font-black px-2">
              Studio
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem 
                  icon={<LayoutDashboard className="size-4" />} 
                  label="Dashboard" 
                  href="/dashboard" 
                  isActive={pathname === "/dashboard"}
                />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton 
                  size="lg" 
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 border border-white/10 rounded-lg">
                    <AvatarFallback className="bg-red-600 text-[11px] font-black text-white rounded-lg">
                      {user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate text-xs font-semibold text-white">
                      {user?.email || "User Account"}
                    </span>
                    <span className="truncate text-[10px] text-white/40 font-medium">Pro Member</span>
                  </div>
                  <MoreVertical className="ml-auto size-4 text-white/20" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-[#0a0a0a] border-white/10 shadow-2xl rounded-lg" side="right" align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => setProfileOpen(true)} className="cursor-pointer gap-2 focus:bg-red-600/10 focus:text-red-500">
                  <Settings className="size-4" /> Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSecurityOpen(true)} className="cursor-pointer gap-2 focus:bg-red-600/10 focus:text-red-500">
                  <Sparkles className="size-4" /> Security
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer gap-2 text-red-500 focus:bg-red-600/10">
                  <LogOut className="size-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/* ─── Nav Item ─── */
function SidebarNavItem({ icon, label, href, isActive }: { icon: React.ReactNode, label: string, href: string, isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton 
        asChild 
        isActive={isActive}
        tooltip={label}
        className={cn(
          "text-xs font-black uppercase tracking-[0.15em] transition-all",
          isActive ? "text-red-500 bg-red-600/10 hover:bg-red-600/20 hover:text-red-500" : "text-white/40 hover:text-white"
        )}
      >
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ─── Main Content (with sidebar-aware margin) ─── */
interface MainContentProps {
  children: React.ReactNode;
  breadcrumbs: { label: string; href: string }[];
  noPadding?: boolean;
  latestNarrative?: FounderNarrative;
  user?: User | null;
  activeProductionPlan?: VideoPlan;
}

function MainContent({ 
  children, 
  breadcrumbs, 
  noPadding,
  latestNarrative,
  user,
  activeProductionPlan
}: MainContentProps) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  return (
    <main
      className="min-h-svh bg-black transition-[margin-left] duration-200 ease-linear"
      style={{
        marginLeft: isMobile ? 0 : isCollapsed ? "3rem" : "16rem",
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-20 px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 text-white/40 hover:text-white" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
          <Breadcrumb className="hidden xl:block">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard" className="text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbSeparator className="hidden md:block text-white/20" />
                  <BreadcrumbItem>
                    {idx === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="text-[10px] font-black text-white uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/10">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href} className="text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest">
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Center Logo branding */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <Image 
            src={LOGO.full} 
            alt={LOGO.alt} 
            width={120} 
            height={30} 
            className="h-6 w-auto"
            priority
          />
          {user?.planId && (
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-red-600 to-orange-600 text-[8px] font-black text-white uppercase tracking-widest shadow-lg shadow-red-500/20">
              {user.planId.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Unified Branding & Global Actions */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             {activeProductionPlan && (
               <button
                 onClick={() => useGenerateStore.getState().openGenerator({ 
                   planId: activeProductionPlan.id,
                   narrativeId: activeProductionPlan.narrativeId
                 })}
                 className="flex items-center gap-2 h-8 px-3 rounded-lg bg-blue-600/10 border border-blue-600/20 text-blue-500 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all group"
               >
                 <span className="relative flex size-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                   <span className="relative inline-flex rounded-full size-2 bg-blue-500 group-hover:bg-white" />
                 </span>
                 Resume Production
               </button>
             )}

             <Link
                href="/dashboard"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition flex items-center gap-2"
              >
                <LayoutDashboard className="size-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>

              <div className="relative">
                <button 
                  onClick={() => setCreateMenuOpen(!createMenuOpen)}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-[0.15em] transition-all",
                    createMenuOpen ? "bg-red-600 text-white" : "bg-white/5 text-white/40 hover:text-white border border-white/5"
                  )}
                >
                  <PlusCircle className="size-3.5" />
                  Create
                </button>

                {createMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCreateMenuOpen(false)} />
                    <div className="absolute right-0 mt-3 w-56 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-20 animate-in fade-in zoom-in-95 duration-200 origin-top-right backdrop-blur-3xl">
                      <Link href="/narrative/new" onClick={() => setCreateMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                        <div className="size-8 rounded-lg bg-red-600/10 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all">
                          <Brain className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Narrative</span>
                          <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Define core story</span>
                        </div>
                      </Link>
                      <Link href="/series/new" onClick={() => setCreateMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                        <div className="size-8 rounded-lg bg-amber-600/10 flex items-center justify-center text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all">
                          <Layers className="size-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Series</span>
                          <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Episodic story</span>
                        </div>
                      </Link>
                      {latestNarrative && (
                        <>
                          <div className="h-px bg-white/5 my-1" />
                          <Link href={`/narrative/${latestNarrative.id}/drafts`} onClick={() => setCreateMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-colors group">
                            <div className="size-8 rounded-lg bg-emerald-600/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                              <Sparkles className="size-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-white">Quick Video</span>
                              <span className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Gen from drafts</span>
                            </div>
                          </Link>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
          </div>
        </div>
      </header>
      <div className={cn(
        "transition-all duration-300",
        noPadding ? "p-0" : "p-6 md:p-8 lg:p-10"
      )}>
        <div className={cn(
          "mx-auto w-full",
          noPadding ? "max-w-none" : "max-w-7xl"
        )}>
          {children}
        </div>
      </div>
    </main>
  );
}
