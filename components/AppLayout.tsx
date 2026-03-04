"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useState, Suspense, useMemo, useEffect } from "react";
import { ProfileDialog } from "./ProfileDialog";
import { SecureAccountDialog } from "./SecureAccountDialog";
import { GenerateScreen } from "@/components/screens/GenerateScreen";
import { db } from "@/lib/instant-client";
import { cn } from "@/lib/utils";
import { useGenerateStore } from "@/hooks/use-generate-store";

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
  Sparkles
} from "lucide-react";

import type { FounderNarrative } from "@/lib/types";

interface AppLayoutProps {
  children: React.ReactNode;
  narrativeId?: string;
}

export function AppLayout({ children, narrativeId }: AppLayoutProps) {
  return (
    <Suspense fallback={<div className="flex h-screen bg-black" />}>
      <AppLayoutContent narrativeId={narrativeId}>{children}</AppLayoutContent>
    </Suspense>
  );
}

function AppLayoutContent({ children, narrativeId }: AppLayoutProps) {
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

  // Fetch current narrative if ID present
  const { data: currentNarrativeData } = (db as any).useQuery(
    narrativeId ? { narratives: { $: { where: { id: narrativeId } } } } : null
  );
  const narrative = currentNarrativeData?.narratives?.[0] as FounderNarrative | undefined;

  // Fetch ALL user narratives for the switcher and count
  const { data: allNarrativesData } = (db as any).useQuery(
    user
      ? { narratives: { $: { where: { userId: user.id }, order: { createdAt: "desc" } } } }
      : null
  );
  const allNarratives = (allNarrativesData?.narratives || []) as FounderNarrative[];
  const narrativeCount = allNarratives.length;

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
    if (pathname.includes("/engine")) {
      list.push({ label: "Content Engine", href: pathname });
    } else if (pathname.includes("/drafts")) {
      list.push({ label: "Content Library", href: pathname });
    }
    return list;
  }, [narrative, pathname]);

  return (
    <SidebarProvider>
      <AppSidebar 
        narrativeId={narrativeId}
        narrative={narrative}
        allNarratives={allNarratives}
        switcherOpen={switcherOpen}
        setSwitcherOpen={setSwitcherOpen}
        pathname={pathname}
        router={router}
        user={user}
        signOut={signOut}
        setProfileOpen={setProfileOpen}
        setSecurityOpen={setSecurityOpen}
      />
      <MainContent breadcrumbs={breadcrumbs}>
        {children}
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
  switcherOpen,
  setSwitcherOpen,
  pathname,
  router,
  user,
  signOut,
  setProfileOpen,
  setSecurityOpen,
}: {
  narrativeId?: string;
  narrative?: FounderNarrative;
  allNarratives: FounderNarrative[];
  switcherOpen: boolean;
  setSwitcherOpen: (v: boolean) => void;
  pathname: string;
  router: any;
  user: any;
  signOut: () => void;
  setProfileOpen: (v: boolean) => void;
  setSecurityOpen: (v: boolean) => void;
}) {
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
                        narrative ? "bg-red-600 text-white" : "bg-white/10 text-white/50"
                      )}>
                        {narrative ? narrative.title.charAt(0).toUpperCase() : <LayoutDashboard className="size-4" />}
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="text-xs font-bold text-white truncate">
                          {narrative ? narrative.title : "All Projects"}
                        </span>
                        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
                          {narrative ? "Active Narrative" : "Switch Projects"}
                        </span>
                      </div>
                      <ChevronRight className="ml-auto size-3 text-white/20 group-hover/switcher:text-white/60 transition-colors" />
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0 bg-[#0a0a0a] border-white/10 shadow-2xl" align="start">
                    <Command className="bg-transparent">
                      <CommandInput placeholder="Search projects..." className="h-9" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-4 text-center text-xs text-white/40">No projects found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => { router.push("/dashboard"); setSwitcherOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer py-2 focus:bg-red-600/10 focus:text-red-500"
                          >
                            <LayoutDashboard className="size-4 text-white/60" />
                            <span className="text-sm font-medium">All Projects</span>
                          </CommandItem>
                          {allNarratives.map((n) => (
                            <CommandItem
                              key={n.id}
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
                        <Separator className="bg-white/5 my-1" />
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => { router.push("/narrative/new"); setSwitcherOpen(false); }}
                            className="flex items-center gap-2 cursor-pointer py-2 text-red-500 font-bold focus:bg-red-600/10"
                          >
                            <PlusCircle className="size-4" />
                            <span className="text-sm">New Narrative</span>
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

        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/30 uppercase text-[9px] tracking-[0.2em] font-black px-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {narrativeId ? (
                <>
                  <SidebarNavItem 
                    icon={<LayoutDashboard className="size-4" />} 
                    label="Overview" 
                    href={`/narrative/${narrativeId}`} 
                    isActive={pathname === `/narrative/${narrativeId}`}
                  />
                  <SidebarNavItem 
                    icon={<Brain className="size-4" />} 
                    label="Content Engine" 
                    href={`/narrative/${narrativeId}/engine`} 
                    isActive={pathname.includes("/engine")}
                  />
                  <SidebarNavItem 
                    icon={<FileEdit className="size-4" />} 
                    label="Content Library" 
                    href={`/narrative/${narrativeId}/drafts`} 
                    isActive={pathname.includes("/drafts")}
                  />
                </>
              ) : (
                <SidebarNavItem 
                  icon={<LayoutDashboard className="size-4" />} 
                  label="Dashboard" 
                  href="/dashboard" 
                  isActive={pathname === "/dashboard"}
                />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
function MainContent({ children, breadcrumbs }: { children: React.ReactNode; breadcrumbs: { label: string; href: string }[] }) {
  const { state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <main
      className="min-h-svh bg-black transition-[margin-left] duration-200 ease-linear"
      style={{
        marginLeft: isMobile ? 0 : isCollapsed ? "3rem" : "16rem",
      }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1 text-white/40 hover:text-white" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard" className="text-xs font-bold text-white/40 hover:text-white transition-colors">
                  Studio
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.href}>
                  <BreadcrumbSeparator className="hidden md:block text-white/20" />
                  <BreadcrumbItem>
                    {idx === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="text-xs font-black text-red-500 uppercase tracking-widest">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href} className="text-xs font-bold text-white/40 hover:text-white transition-colors">
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </div>
    </main>
  );
}
