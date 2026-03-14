"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LOGO } from "@/lib/branding";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { initializeDraftNarrative } from "@/app/actions/marketing";
import { toast } from "sonner";

// shadcn UI
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
  PlusCircle, 
  Video, 
  Brain,
  Layers,
  ChevronRight,
  MoreVertical,
  Settings,
  LogOut,
  Search,
  Plus
} from "lucide-react";

import { useGenerateStore } from "@/hooks/use-generate-store";
import type { FounderNarrative, Series, User } from "@/lib/types";

interface GlobalHeaderProps {
  user: User | null;
  signOut: () => void;
  allNarratives: FounderNarrative[];
  allSeries: Series[];
  activeProductionPlan?: any;
  narrative?: FounderNarrative;
  series?: Series;
  headerTitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  resolvedNarrativeId?: string;
  resolvedSeriesId?: string;
  onOpenProfile: () => void;
  onOpenSecurity: () => void;
}

export function GlobalHeader({ 
  user, 
  signOut, 
  allNarratives, 
  allSeries, 
  activeProductionPlan,
  narrative,
  series,
  headerTitle,
  headerActions,
  resolvedNarrativeId,
  resolvedSeriesId,
  onOpenProfile,
  onOpenSecurity
}: GlobalHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false);

  return (
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

          <Separator orientation="vertical" className="h-4 bg-white/10" />

          {/* Global Search Shortcut Hint */}
          <button 
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 px-3 h-8 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all text-slate-500 hover:text-white group"
          >
            <Search className="size-3" />
            <kbd className="hidden sm:inline-flex text-[9px] font-black opacity-30 group-hover:opacity-60 tabular-nums">⌘K</kbd>
          </button>
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
            <DropdownMenuItem onClick={onOpenProfile} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 focus:bg-white/5 focus:text-red-500 transition-colors">
              <Settings className="size-4 text-slate-500" /> Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSecurity} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 focus:bg-white/5 focus:text-red-500 transition-colors">
              <Layers className="size-4 text-slate-500" /> Security
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5 my-2" />
            <DropdownMenuItem onClick={signOut} className="rounded-xl cursor-pointer gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 focus:bg-red-500/10 transition-colors">
              <LogOut className="size-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
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
