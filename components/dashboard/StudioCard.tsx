"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tx } from "@/lib/firebase-tx";
import type { VideoPlan, Series, FounderNarrative } from "@/lib/types";
import Image from "next/image";
import Link from "next/link";
import {
  MoreHorizontal,
  PlayCircle,
  Trash2,
  Pencil,
  FileText,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  Wand2,
  Upload,
  Download,
  Eye,
  Heart,
  AudioLines,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StudioCardVariant = "project" | "series" | "media";

interface StudioCardProps {
  variant: StudioCardVariant;
  data: any; // Can be VideoPlan, Series, or FounderNarrative
  onPreview?: (plan: VideoPlan) => void;
}

export function StudioCard({ variant, data, onPreview }: StudioCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const typeLabel = variant === "project" ? "project" : variant === "series" ? "series" : "media";
    if (!confirm(`Are you sure you want to delete this ${typeLabel}?`)) return;

    setIsDeleting(true);
    try {
      if (variant === "project") await tx.narratives[data.id].delete();
      else if (variant === "series") await tx.series[data.id].delete();
      else if (variant === "media") await tx.videoPlans[data.id].delete();
    } catch (err) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
    }
  };

  const handleRename = () => {
    const newTitle = prompt("Enter new title:", data.title);
    if (newTitle && newTitle !== data.title) {
      if (variant === "project") tx.narratives[data.id].update({ title: newTitle });
      else if (variant === "series") tx.series[data.id].update({ title: newTitle });
      else if (variant === "media") tx.videoPlans[data.id].update({ title: newTitle });
    }
  };

  const handleTogglePosted = () => {
    if (variant !== "media") return;
    const newPostedAt = data.postedAt ? undefined : Date.now();
    tx.videoPlans[data.id].update({ postedAt: newPostedAt });
  };

  // Helper to get time ago
  const timeAgo = data.createdAt ? formatDistanceToNow(data.createdAt) + " ago" : "Unknown";

  // Navigation logic
  const getHref = () => {
    if (variant === "project") {
      return data.status === "wizard" ? `/narrative/new?resume=${data.id}` : `/narrative/${data.id}`;
    }
    if (variant === "series") return `/series/${data.id}`;
    return undefined; // Media opens preview
  };

  const href = getHref();

  return (
    <Card
      onClick={() => variant === "media" && onPreview?.(data)}
      className={cn(
        "group relative rounded-[2rem] overflow-hidden border border-white/5 bg-[#050505]/60 backdrop-blur-md hover:bg-[#080808]/80 hover:border-white/20 hover:shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-1.5 cursor-pointer flex flex-col",
        variant === "project" && "h-fit"
      )}
    >
      {/* Background Aura Pulse on Hover */}
      <div className="absolute inset-0 bg-blue-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      {/* Thumbnail / Header Area */}
      {variant !== "project" ? (
        <div className="aspect-[4/5] w-full bg-slate-800/50 relative overflow-hidden">
          {variant === "media" && (
            <MediaPreview plan={data} />
          )}
          {variant === "series" && (
            <SeriesStack />
          )}

          {/* Overlays */}
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className={cn(
              "border-0 shadow-lg",
              variant === "series" ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
            )}>
              {variant === "series" ? "Series" : data.type || "Video"}
            </Badge>
            
            {variant === "media" && data.status && data.status !== "completed" && data.status !== "draft" && (
               <Badge className="bg-amber-500 text-white border-0 gap-1 animate-pulse">
                <span className="size-1 h-1 w-1 rounded-full bg-white inline-block" />
                Processing
              </Badge>
            )}
          </div>
          
          <ActionMenu 
            variant={variant} 
            data={data} 
            onRename={handleRename} 
            onDelete={handleDelete} 
            onTogglePosted={handleTogglePosted}
            onPreview={() => variant === "media" && onPreview?.(data)}
          />

          {variant === "media" && data.postedAt && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-emerald-500/10 backdrop-blur-md text-emerald-500 border border-emerald-500/20 shadow-lg gap-1.5 px-3 rounded-full text-[8px] font-black uppercase tracking-widest">
                <CheckCircle2 className="size-2.5" />
                Archived
              </Badge>
            </div>
          )}
        </div>
      ) : (
        /* Narrative Card Style (Compact Header) */
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-800/20">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
              <FileText size={16} />
            </div>
            <Badge variant={data.status === "active" ? "default" : "secondary"} className="text-[10px] uppercase tracking-tighter">
              {data.status}
            </Badge>
          </div>
          <ActionMenu 
            variant={variant} 
            data={data} 
            onRename={handleRename} 
            onDelete={handleDelete} 
          />
        </div>
      )}

      {/* Content Area */}
      <div className={cn("p-4 flex flex-col flex-grow", variant === "project" ? "" : "min-h-[100px]")}>
        {href ? (
          <Link href={href} className="block group/link">
            <CardTitle title={data.title} />
          </Link>
        ) : (
          <CardTitle title={data.title} />
        )}
        
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {timeAgo}
          </p>
          {variant === "media" && data.seriesId && (
            <Badge variant="outline" className="h-5 border-amber-500/20 bg-amber-500/5 text-amber-500 text-[8px] font-black uppercase px-2 rounded-full">
              Series Asset
            </Badge>
          )}
        </div>

        {variant === "project" && data.oneLiner && (
          <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed mb-4">
            {data.oneLiner}
          </p>
        )}

        {/* Footer Info */}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex gap-2">
            {variant === "media" && (
              <>
                <Badge variant="secondary" className="text-[9px] h-5">
                  {data.scenes?.length || 0}s
                </Badge>
                {data.voiceId && (
                  <AudioLines size={12} className="text-blue-400 mt-1" />
                )}
              </>
            )}
            {variant === "series" && (
              <>
                <Badge variant="secondary" className="text-[9px] h-5 gap-1">
                  <Palette className="size-2.5" />
                  Visual Sync
                </Badge>
              </>
            )}
            {variant === "project" && (
               <Badge variant="outline" className="text-[9px] h-5 border-white/10 text-slate-500">
                Studio Project
               </Badge>
            )}
          </div>

          {href && (
            <Link href={href} className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 group-hover:text-primary transition-colors">
              Open <ChevronRight size={10} />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function CardTitle({ title }: { title: string }) {
  return (
    <h3 className="font-bold text-base mb-1 truncate leading-tight group-hover:text-primary transition-colors text-slate-100">
      {title}
    </h3>
  );
}

function MediaPreview({ plan }: { plan: VideoPlan }) {
  const rawUrl = plan.thumbnailUrl || plan.scenes?.[0]?.imageUrl;
  if (!rawUrl) {
    return (
      <div className="flex items-center justify-center w-full h-full text-slate-600 bg-slate-900/50">
        <ImageIcon className="size-8" />
      </div>
    );
  }

  const finalUrl = (() => {
    if (rawUrl.startsWith("data:")) return rawUrl;
    if (rawUrl.includes("giphy.com")) return rawUrl;
    const isStoragePath = !rawUrl.startsWith("http");
    return isStoragePath
      ? `/api/proxy-image?path=${encodeURIComponent(rawUrl)}`
      : `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
  })();

  if (rawUrl.includes(".mp4") || rawUrl.includes("giphy")) {
    return (
      <video
        src={finalUrl}
        muted
        loop
        playsInline
        autoPlay
        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
      />
    );
  }

  return (
    <Image
      src={finalUrl}
      alt={plan.title}
      unoptimized
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
    />
  );
}

function SeriesStack() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
      <div className="relative w-2/3 aspect-[9/16] bg-slate-800 rounded shadow-lg translate-x-3 -rotate-3 opacity-30" />
      <div className="absolute w-2/3 aspect-[9/16] bg-slate-700 rounded shadow-lg -translate-x-3 rotate-3 opacity-60" />
      <div className="absolute w-2/3 aspect-[9/16] bg-gradient-to-br from-blue-600/80 to-purple-600/80 rounded shadow-2xl flex flex-col items-center justify-center text-white p-4 backdrop-blur-sm border border-white/10">
        <BookOpen className="size-8 mb-2" />
        <span className="text-[10px] font-black uppercase tracking-widest opacity-80 text-center">
          Serial Narrative
        </span>
      </div>
    </div>
  );
}

function ActionMenu({ 
  variant, 
  data, 
  onRename, 
  onDelete, 
  onTogglePosted,
  onPreview 
}: { 
  variant: StudioCardVariant; 
  data: any; 
  onRename: () => void; 
  onDelete: () => void;
  onTogglePosted?: () => void;
  onPreview?: () => void;
}) {
  return (
    <div 
      className={cn(
        "z-20",
        variant === "project" ? "relative" : "absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
      )}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 bg-slate-900 border-white/10 text-slate-200">
          {variant === "media" && (
            <DropdownMenuItem onClick={onPreview} className="cursor-pointer gap-2">
              <PlayCircle className="size-4" /> Play
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={onRename} className="cursor-pointer gap-2">
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>

          {variant === "media" && (
            <>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                onClick={(e) => {
                  window.location.href = `/post-assistant/${data.id}`;
                }}
                className="cursor-pointer text-primary gap-2"
              >
                <Wand2 className="size-4" /> Post Assistant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePosted} className="cursor-pointer gap-2">
                {data.postedAt ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Upload className="size-4" />}
                {data.postedAt ? "Unmark Posted" : "Mark as Posted"}
              </DropdownMenuItem>
               <DropdownMenuItem onClick={onPreview} className="cursor-pointer gap-2">
                <Download className="size-4" /> Download
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="bg-white/5" />
          <DropdownMenuItem
            variant="destructive"
            onClick={onDelete}
            className="cursor-pointer gap-2"
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
