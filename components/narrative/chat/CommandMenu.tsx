"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

interface CommandMenuProps {
  commands: Command[];
  selectedIndex: number;
  onSelect: (commandId: string) => void;
  onHover: (index: number) => void;
}

export function CommandMenu({ commands, selectedIndex, onSelect, onHover }: CommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 w-full mb-3 p-2 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 backdrop-blur-3xl z-30">
      <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Director Commands</span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-bold text-slate-600">Select</span>
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono text-slate-400">ENTER</kbd>
        </div>
      </div>
      {commands.map((cmd, idx) => (
        <button
          key={cmd.id}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => onHover(idx)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group/cmd",
            idx === selectedIndex ? "bg-white/5 border border-white/5" : "border border-transparent"
          )}
        >
          <div className={cn(
            "size-8 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center transition-colors shadow-sm",
            idx === selectedIndex ? "bg-white/10 text-white" : "text-slate-600 group-hover/cmd:text-white"
          )}>
            <cmd.icon className={cn("size-4", idx === selectedIndex ? cmd.color : "text-slate-600")} />
          </div>
          <div className="flex flex-col">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest transition-colors",
              idx === selectedIndex ? "text-white" : "text-slate-400 group-hover/cmd:text-white"
            )}>
              {cmd.label}
            </span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{cmd.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
