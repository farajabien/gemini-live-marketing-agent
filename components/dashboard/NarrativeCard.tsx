"use client";

import { useState } from "react";
import { tx } from "@/lib/firebase-tx";
import Link from "next/link";
import {
  Edit,
  MoreHorizontal,
  FileText,
  CheckCircle2,
  PlayCircle,
  ChevronRight,
  Trash2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FounderNarrative, SeriesNarrative } from "@/lib/types";

interface NarrativeCardProps {
  narrative: any;
  queuedCount?: number;
  approvedCount?: number;
  mediaCount?: number;
  isSeriesNarrative?: boolean;
}

export function NarrativeCard({
  narrative,
  queuedCount = 0,
  approvedCount = 0,
  mediaCount = 0,
  isSeriesNarrative = false,
}: NarrativeCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this narrative? This will also remove all associated content pieces, video plans, and strategic goals. This action cannot be undone."
      )
    )
      return;

    setIsDeleting(true);
    try {
      const table = isSeriesNarrative ? tx.seriesNarratives : tx.narratives;
      await table[narrative.id].delete();
    } catch (err) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
    }
  };

  const handleRename = () => {
    const newTitle = prompt("Enter new title:", narrative.title);
    if (newTitle && newTitle !== narrative.title) {
      const table = isSeriesNarrative ? tx.seriesNarratives : tx.narratives;
      table[narrative.id].update({ title: newTitle });
    }
  };

  const statusVariant =
    narrative.status === "active"
      ? "default"
      : narrative.status === "wizard"
        ? "secondary"
        : "outline";

  const statusLabel = isSeriesNarrative
    ? "Series Architecture"
    : narrative.status === "wizard"
      ? "Drafting"
      : narrative.status;

  return (
    <div className="relative group">
      <Link
        href={
          narrative.status === "wizard"
            ? isSeriesNarrative
              ? `/series-narrative?resume=${narrative.id}`
              : `/narrative/new?resume=${narrative.id}`
            : isSeriesNarrative
              ? `/series-narrative/${narrative.id}`
              : `/narrative/${narrative.id}`
        }
        className="block cursor-pointer"
      >
        <Card
          className={cn(
            "p-7 rounded-[2rem] border shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 relative overflow-hidden group-hover:bg-accent/50",
            isSeriesNarrative && "border-purple-500/20"
          )}
        >
          {/* Glossy Backdrop Effect */}
          <div
            className={cn(
              "absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -mr-10 -mt-10 group-hover:opacity-80 transition-all duration-700",
              isSeriesNarrative
                ? "bg-purple-600/10 group-hover:bg-purple-600/20"
                : "bg-primary/5 group-hover:bg-primary/10"
            )}
          />

          <div className="flex items-start justify-between mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3",
                  isSeriesNarrative
                    ? "bg-purple-600/20 text-purple-500 border-purple-500/10 group-hover:text-purple-400"
                    : "bg-primary/10 text-primary border-primary/10 group-hover:text-primary/80"
                )}
              >
                {isSeriesNarrative ? (
                  <PlayCircle size={22} />
                ) : (
                  <FileText size={22} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={statusVariant}>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Menu Button */}
            <div onClick={(e) => e.preventDefault()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRename();
                    }}
                    className="cursor-pointer"
                  >
                    <Pencil size={14} className="text-primary" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            <h3 className="text-xl font-black leading-tight tracking-tight group-hover:text-primary transition-colors">
              {narrative.title}
            </h3>
            {(narrative.oneLiner || narrative.genre) && (
              <p className="text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">
                {isSeriesNarrative
                  ? `${narrative.genre} • ${narrative.narrativeTone}`
                  : narrative.oneLiner}
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              {queuedCount > 0 && (
                <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
                  <Edit size={12} />
                  {queuedCount} Drafts
                </Badge>
              )}
              {approvedCount > 0 && (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                  <CheckCircle2 size={12} />
                  {approvedCount} Approved
                </Badge>
              )}
              {mediaCount > 0 && (
                <Badge variant="outline" className="text-purple-500 border-purple-500/20 bg-purple-500/5">
                  <PlayCircle size={12} />
                  {mediaCount} Media
                </Badge>
              )}
            </div>

            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
              <ChevronRight size={16} />
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
