"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { Series } from "@/lib/types";
import { tx } from "@/lib/firebase-tx";
import Link from "next/link";
import {
  MoreHorizontal,
  BookOpen,
  Pencil,
  Trash2,
  Palette,
  Sparkles,
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

interface SeriesCardProps {
  series: Series;
}

export function SeriesCard({ series }: SeriesCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this series?")) return;

    setIsDeleting(true);
    try {
      await tx.series[series.id].delete();
    } catch (err) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
    }
  };

  const handleRename = () => {
    const newTitle = prompt("Enter new title:", series.title);
    if (newTitle && newTitle !== series.title) {
      tx.series[series.id].update({ title: newTitle });
    }
  };

  return (
    <div className="relative group">
      <Link
        href={`/series/${series.id}`}
        className="block cursor-pointer"
      >
        <Card className="rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          {/* Thumbnail Area - Stacked Effect */}
          <div className="aspect-[4/5] w-full bg-muted relative overflow-hidden flex items-center justify-center">
            {/* Decorative Stack of "Episodes" */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-2/3 aspect-[9/16] bg-muted-foreground/10 rounded shadow-lg translate-x-4 -rotate-6 opacity-30" />
              <div className="absolute w-2/3 aspect-[9/16] bg-muted-foreground/20 rounded shadow-lg -translate-x-4 rotate-6 opacity-60" />
              <div className="absolute w-2/3 aspect-[9/16] bg-gradient-to-br from-blue-600 to-purple-600 rounded shadow-2xl flex flex-col items-center justify-center text-white p-4 text-center">
                <BookOpen className="size-8 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                  Serial Narrative
                </span>
              </div>
            </div>

            {/* Badge */}
            <div className="absolute top-3 left-3">
              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0 shadow-lg">
                Series
              </Badge>
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity",
                  series.status === "complete"
                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                    : "text-primary border-primary/30 bg-primary/10"
                )}
              >
                {series.status}
              </Badge>

              {/* Actions Menu */}
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename();
                      }}
                      className="cursor-pointer"
                    >
                      <Pencil className="size-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      className="cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            <h3 className="font-bold text-lg mb-1 truncate leading-tight group-hover:text-primary transition-colors">
              {series.title}
            </h3>
            <p className="text-xs text-muted-foreground font-medium mb-3">
              {series.createdAt
                ? formatDistanceToNow(series.createdAt)
                : "Unknown"}{" "}
              ago
            </p>

            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="gap-1">
                <Palette className="size-3" />
                Consistent
              </Badge>
              {series.seriesNarrativeId && (
                <Badge variant="outline" className="text-purple-500 border-purple-500/20 bg-purple-500/10 gap-1 font-bold">
                  <Sparkles className="size-3" />
                  Architected
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
