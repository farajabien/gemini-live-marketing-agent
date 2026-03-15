import { ViralPattern, FounderNarrative } from "@/lib/types";

/**
 * Updates viral pattern success scores based on real performance metrics.
 * This creates a learning loop where the War Room gets smarter over time.
 */
export function updatePatternMemory(narrative: FounderNarrative, videoId: string, metrics: { views: number, engagement: number, shares: number }): FounderNarrative {
  const patternLibrary = [...(narrative.patternLibrary || [])];
  
  // Find which pattern was used for this video
  // (In a real scenario, we'd link videoId to patternId)
  // For now, let's assume we update the active pattern
  const activePatternId = narrative.activePatternId;
  const patternIndex = patternLibrary.findIndex(p => p.id === activePatternId);
  
  if (patternIndex !== -1) {
    const pattern = patternLibrary[patternIndex];
    // Simple reinforcement learning: adjust score based on viewership/engagement vs baseline
    const performanceScore = (metrics.engagement / metrics.views) * 10; // Normalized 0-1ish
    const newScore = (pattern.successScore * 0.7) + (performanceScore * 0.3);
    
    patternLibrary[patternIndex] = {
      ...pattern,
      successScore: Math.min(Math.max(newScore, 0), 1)
    };
  }

  return {
    ...narrative,
    patternLibrary
  };
}

/**
 * Suggests the best pattern to use next based on current narrative strength and historical performance.
 */
export function suggestNextPattern(narrative: FounderNarrative): ViralPattern | null {
  if (!narrative.patternLibrary || narrative.patternLibrary.length === 0) return null;
  
  // Sort by success score and return the top performing one
  return [...narrative.patternLibrary].sort((a, b) => b.successScore - a.successScore)[0];
}
