/**
 * Firebase Database Helper Functions for Series & Episodes
 *
 * Server-side utilities for managing serial content with Firebase.
 */

import { batchWrite } from '@/hooks/use-firestore';
import type { Series, Episode, SeriesMetadata } from '@/lib/types';

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

  // Create series data
  const series: Omit<Series, 'id'> & { id: string; userId: string } = {
    id: seriesId,
    userId,
    title: formalizedJson.title,
    tagline: formalizedJson.tagline,
    megaPrompt,
    formalizedJson,
    visualConsistency: formalizedJson.visualConsistency,
    episodeCount: formalizedJson.episodes.length,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  // Create episode data
  const episodeIds: string[] = [];
  const episodes: Array<Omit<Episode, 'id'> & { id: string; seriesId: string; userId: string }> =
    formalizedJson.episodes.map((ep, index) => {
      const episodeId = crypto.randomUUID();
      episodeIds.push(episodeId);

      return {
        id: episodeId,
        userId,
        seriesId,
        episodeNumber: index + 1,
        title: ep.title,
        script: '', // Will be generated in next step
        visualPrompts: [],
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      };
    });

  // Batch write all operations
  const operations = [
    {
      type: 'create' as const,
      collection: 'series',
      id: seriesId,
      data: series,
    },
    ...episodes.map((ep) => ({
      type: 'create' as const,
      collection: 'episodes',
      id: ep.id,
      data: ep,
    })),
  ];

  await batchWrite(operations);

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
    status: 'script_ready',
    updatedAt: Date.now(),
  };

  if (visualPrompts) {
    updates.visualPrompts = visualPrompts;
  }

  await batchWrite([
    {
      type: 'update',
      collection: 'episodes',
      id: episodeId,
      data: updates,
    },
  ]);
}

/**
 * Update episode status
 */
export async function updateEpisodeStatus(
  episodeId: string,
  status: Episode['status'],
  additionalFields?: Partial<Pick<Episode, 'videoUrl' | 'thumbnailUrl' | 'duration' | 'videoPlanId'>>
): Promise<void> {
  const updates: Partial<Episode> = {
    status,
    updatedAt: Date.now(),
    ...additionalFields,
  };

  await batchWrite([
    {
      type: 'update',
      collection: 'episodes',
      id: episodeId,
      data: updates,
    },
  ]);
}

/**
 * Update series status based on episode statuses
 */
export async function updateSeriesStatus(seriesId: string, status?: Series['status']): Promise<void> {
  const updates: Partial<Series> = {
    updatedAt: Date.now(),
  };

  if (status) {
    updates.status = status;
  }

  await batchWrite([
    {
      type: 'update',
      collection: 'series',
      id: seriesId,
      data: updates,
    },
  ]);
}

/**
 * Get series with episodes (for server-side use)
 * Note: For client-side, use the useCollection hook with appropriate queries
 */
export async function getSeriesWithEpisodes(seriesId: string) {
  // This is a placeholder for server-side implementation
  // In practice, you would use the Firebase Admin SDK here
  console.warn('getSeriesWithEpisodes should be implemented with Firebase Admin SDK');
  return null;
}
