"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Video,
  Brain,
  PlusCircle,
  Settings,
  Layers,
  Search,
  Zap,
  Film
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { firebaseDb as db } from "@/lib/firebase-client";
import { useCollection } from "@/hooks/use-firestore";

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // Fetch narratives and series for search
  const { data: narratives } = useCollection('narratives', {
    where: [{ field: 'userId', operator: '==', value: user?.id || 'guest' }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }]
  });

  const { data: series } = useCollection('series', {
    where: [{ field: 'userId', operator: '==', value: user?.id || 'guest' }],
    orderBy: [{ field: 'createdAt', direction: 'desc' }]
  });

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search projects..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard Hub</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/media"))}>
            <Video className="mr-2 h-4 w-4" />
            <span>Archive Library</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Active Narratives">
          {narratives?.map((n: any) => (
            <CommandItem key={n.id} onSelect={() => runCommand(() => router.push(`/narrative/${n.id}`))}>
              <Brain className="mr-2 h-4 w-4 text-red-500" />
              <span>{n.title}</span>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => runCommand(() => router.push("/narrative/new"))}>
            <PlusCircle className="mr-2 h-4 w-4 text-slate-500" />
            <span>New Narrative...</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Strategic Series">
          {series?.map((s: any) => (
            <CommandItem key={s.id} onSelect={() => runCommand(() => router.push(`/series/${s.id}`))}>
              <Film className="mr-2 h-4 w-4 text-amber-500" />
              <span>{s.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => {})}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <Layers className="mr-2 h-4 w-4" />
            <span>Security</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
