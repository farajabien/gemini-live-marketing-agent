"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tx } from "@/lib/firebase-tx";
import type { VideoPlan } from "@/lib/types";
import Image from "next/image";
import {
  MoreHorizontal,
  ImageIcon,
  ImageOff,
  PlayCircle,
  Trash2,
  Pencil,
  Wand2,
  CheckCircle,
  Upload,
  Download,
  Eye,
  Heart,
  AudioLines,
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

interface ProjectCardProps {
  plan: VideoPlan;
  onPreview: (plan: VideoPlan) => void;
}

export function ProjectCard({ plan, onPreview }: ProjectCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    setIsDeleting(true);
    try {
      await tx.videoPlans[plan.id!].delete();
    } catch (err) {
      console.error("Delete failed:", err);
      setIsDeleting(false);
    }
  };

  const handleRename = () => {
    const newTitle = prompt("Enter new title:", plan.title);
    if (newTitle && newTitle !== plan.title) {
      tx.videoPlans[plan.id!].update({ title: newTitle });
    }
  };

  const handleTogglePosted = () => {
    const newPostedAt = plan.postedAt ? undefined : Date.now();
    tx.videoPlans[plan.id!].update({ postedAt: newPostedAt });
  };

  return (
    <Card
      onClick={() => onPreview(plan)}
      className="group relative rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer p-0"
    >
      {/* Thumbnail Preview Area */}
      <div className="aspect-[4/5] w-full bg-muted relative overflow-hidden">
        {(() => {
          const rawUrl = plan.thumbnailUrl || plan.scenes?.[0]?.imageUrl;
          if (!rawUrl)
            return (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <ImageIcon className="size-8" />
              </div>
            );

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
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const parent = (e.target as HTMLElement).parentElement;
                if (parent) {
                  const placeholder = document.createElement("div");
                  placeholder.className =
                    "flex items-center justify-center w-full h-full text-muted-foreground";
                  placeholder.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                  parent.appendChild(placeholder);
                }
              }}
              className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            />
          );
        })()}

        {/* Badge */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge
            variant="secondary"
            className={cn(
              plan.type === "carousel"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border-0"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-0"
            )}
          >
            {plan.type}
          </Badge>
          {plan.status && plan.status !== "completed" && plan.status !== "draft" && (
            <Badge className="bg-amber-500 text-white border-0 gap-1 animate-pulse">
              <span className="size-1.5 rounded-full bg-white inline-block" />
              {plan.status === "generating" ? "Generating" :
               plan.status === "generating_audio" ? "Audio" :
               plan.status === "rendering_video" || plan.status === "rendering" ? "Rendering" :
               "Processing"}
            </Badge>
          )}
        </div>

        {/* Menu Button */}
        <div
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                className="rounded-full shadow-md"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(plan);
                }}
                className="cursor-pointer"
              >
                <PlayCircle className="size-4" />
                Play
              </DropdownMenuItem>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/post-assistant/${plan.id}`;
                }}
                className="cursor-pointer text-primary"
              >
                <Wand2 className="size-4" />
                Post Assistant
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePosted();
                }}
                className="cursor-pointer"
              >
                {plan.postedAt ? (
                  <CheckCircle className="size-4 text-emerald-500" />
                ) : (
                  <Upload className="size-4" />
                )}
                {plan.postedAt ? "Unmark Posted" : "Mark as Posted"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(plan);
                }}
                className="cursor-pointer"
              >
                <Download className="size-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

        {/* Posted Badge */}
        {plan.postedAt && (
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-500/20 gap-1">
              <CheckCircle className="size-3" />
              Posted
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-lg mb-1 truncate leading-tight group-hover:text-primary transition-colors">
          {plan.title}
        </h3>
        <p className="text-xs text-muted-foreground font-medium mb-3">
          {plan.createdAt
            ? formatDistanceToNow(plan.createdAt)
            : "Unknown"}{" "}
          ago
        </p>

        {/* Content Tags */}
        {(plan as any).contentTags && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="destructive" className="text-[9px]">
              {(plan as any).contentTags.primaryAngle}
            </Badge>
            <Badge variant="secondary" className="text-[9px]">
              {(plan as any).contentTags.hookType}
            </Badge>
          </div>
        )}

        {/* Metrics (if posted) */}
        {(plan as any).metrics?.posted &&
          (plan as any).metrics?.metrics24h && (
            <div className="mb-3 p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="text-[9px] uppercase tracking-widest font-black text-emerald-600 dark:text-emerald-400 mb-1">
                24h Performance
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Eye className="size-2.5" />
                  {(
                    (plan as any).metrics.metrics24h.views || 0
                  ).toLocaleString()}
                </span>
                <span className="flex items-center gap-0.5">
                  <Heart className="size-2.5" />
                  {(
                    (plan as any).metrics.metrics24h.likes || 0
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          )}

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="gap-1">
            {plan.scenes?.length || 0} Scenes
          </Badge>
          {plan.type === "video" && plan.voiceId && (
            <Badge variant="secondary" className="gap-1">
              <AudioLines className="size-3" />
              Audio
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
