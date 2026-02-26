/**
 * Database helper functions for Series & Episodes
 * Server-side utilities for managing serial content
 */

import { db } from "@/lib/instant-client";
import { tx } from "@instantdb/react";
import type { Series, Episode, SeriesMetadata } from "@/lib/types";

/**
 * Create a new series with associated episodes
 */
export async function createSeries(
  userId: string,
  megaPrompt: string,
  formalizedJson: SeriesMetadata
): Promise<{ seriesId: string; episodeIds: string[] }> {
  const seriesId = crypto.randomUUID();
  const now = Date.now();

  // Create series entity
  const series: Omit<Series, "id"> = {
    userId,
    title: formalizedJson.title,
    tagline: formalizedJson.tagline,
    megaPrompt,
    formalizedJson,
    visualConsistency: formalizedJson.visualConsistency,
    episodeCount: formalizedJson.episodes.length,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  // Create episode entities
  const episodeIds: string[] = [];
  const episodes: Array<Omit<Episode, "id">> = formalizedJson.episodes.map((ep, index) => {
    const episodeId = crypto.randomUUID();
    episodeIds.push(episodeId);

    return {
      seriesId,
      episodeNumber: index + 1,
      title: ep.title,
      script: "", // Will be generated in next step
      visualPrompts: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
  });

  // Batch insert to database
  await db.transact([
    tx.series[seriesId].update(series as any),
    ...episodes.map((ep, idx) => tx.episodes[episodeIds[idx]].update(ep as any)),
  ]);

  return { seriesId, episodeIds };
}

/**
 * Update episode script
 */
export async function updateEpisodeScript(
  episodeId: string,
  script: string,
  visualPrompts?: string[]
): Promise<void> {
  const updates: Partial<Episode> = {
    script,
    status: "script_ready",
    updatedAt: Date.now(),
  };

  if (visualPrompts) {
    updates.visualPrompts = visualPrompts;
  }

  await db.transact([tx.episodes[episodeId].update(updates as any)]);
}

/**
 * Update episode status
 */
export async function updateEpisodeStatus(
  episodeId: string,
  status: Episode["status"],
  additionalFields?: Partial<Pick<Episode, "videoUrl" | "thumbnailUrl" | "duration" | "videoPlanId">>
): Promise<void> {
  const updates: Partial<Episode> = {
    status,
    updatedAt: Date.now(),
    ...additionalFields,
  };

  await db.transact([tx.episodes[episodeId].update(updates as any)]);
}

/**
 * Update series status based on episode statuses
 */
export async function updateSeriesStatus(seriesId: string): Promise<void> {
  // This would need to query all episodes and determine series status
  // For now, just update timestamp
  await db.transact([
    tx.series[seriesId].update({ updatedAt: Date.now() } as any),
  ]);
}

/**
 * Get series with episodes
 */
export async function getSeriesWithEpisodes(seriesId: string) {
  // This will be implemented using InstantDB queries
  // For now, return type placeholder
  return null as any;
}
