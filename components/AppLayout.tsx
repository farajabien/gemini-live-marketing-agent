"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LOGO } from "@/lib/branding";
import Image from "next/image";
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
  SidebarGroupContent
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
      <Sidebar className="border-r border-white/5 bg-[#050505]">

      {/* Screen reader only section */}
          <SidebarHeader className="sr-only h-14 border-b border-white/5 flex items-center px-4 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="size-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                <Image
                  src={LOGO.icon}
                  alt={LOGO.alt}
                  width={20}
                  height={20}
                  className="shrink-0 brightness-0 invert"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tighter text-white leading-none">IdeaToVideo</span>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5">Studio</span>
              </div>
            </Link>
          </SidebarHeader>

          <SidebarContent className="pt-2">
            <SidebarGroup>
           <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
                      <PopoverTrigger asChild>
                        <SidebarMenuButton 
                          size="lg"
                          className="w-full bg-white/5 border border-white/5 hover:border-red-600/50 hover:bg-white/10 transition-all text-left group h-auto py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "size-7 rounded flex items-center justify-center font-bold text-[11px] shrink-0 transition-colors",
                              narrative ? "bg-red-600 text-white" : "bg-white/10 text-white/50"
                            )}>
                              {narrative ? narrative.title.charAt(0).toUpperCase() : <LayoutDashboard className="size-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate leading-tight">
                                {narrative ? narrative.title : "All Projects"}
                              </p>
                              <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mt-0.5">
                                {narrative ? "Active Narrative" : "Switch Projects"}
                              </p>
                            </div>
                            <ChevronRight className="ml-auto size-3 text-white/20 group-hover:text-white/60 transition-colors" />
                          </div>
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

            <SidebarGroup className="mt-2">
              <SidebarGroupLabel className="text-white/30 uppercase text-[9px] tracking-[0.2em] font-black px-4 mb-2">
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

          <SidebarFooter className="p-2 border-t border-white/5 bg-black/40">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton 
                      size="lg" 
                      className="hover:bg-white/5 data-[state=open]:bg-white/5"
                    >
                      <Avatar className="size-8 border border-white/10 shrink-0">
                        <AvatarFallback className="bg-red-600 text-[11px] font-black text-white">
                          {user?.email?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[11px] font-black text-white truncate group-hover:text-red-500 transition-colors">
                          {user?.email || "User Account"}
                        </p>
                        <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Pro Member</p>
                      </div>
                      <MoreVertical className="size-4 text-white/20 shrink-0 ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-[#0a0a0a] border-white/10 shadow-2xl" side="right" align="end">
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
        </Sidebar>

        {/* Main Content Area */}
        <main className="flex min-h-screen flex-1 flex-col bg-black md:ml-60 overflow-x-hidden">
          <header className="h-14 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-white/40 hover:text-white" />
              <Separator orientation="vertical" className="h-4 bg-white/10" />
            </div>

            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((bc, i) => (
                  <React.Fragment key={bc.href}>
                    <BreadcrumbItem>
                      {i === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{bc.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={bc.href} className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-[0.2em] transition-colors">
                          {bc.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {i < breadcrumbs.length - 1 && <BreadcrumbSeparator className="text-white/10" />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-3">
               <div className="flex items-center gap-1.5 bg-red-600/10 px-3 py-1.5 rounded-full border border-red-600/20">
                  <div className="size-1.5 rounded-full bg-red-600 animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-red-500">System Live</span>
               </div>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            {children}
          </div>
        </main>

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

function SidebarNavItem({ icon, label, href, isActive }: { icon: React.ReactNode, label: string, href: string, isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton 
        asChild 
        isActive={isActive}
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
