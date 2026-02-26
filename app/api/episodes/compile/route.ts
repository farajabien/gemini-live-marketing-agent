import { NextRequest, NextResponse } from "next/server";
import { adminDb, id } from "@/lib/instant-admin";
import type { Scene, VideoPlanStatus, EpisodeStatus } from "@/lib/types";

/**
 * API Route: /api/episodes/compile
 * 
 * Takes an episode with a pre-generated script and visual prompts,
 * transforms it into a standard VideoPlan entity, and persists it.
 * This marks the episode as 'generating' and prepares it for rendering.
 */
export async function POST(request: NextRequest) {
  try {
    const { episodeId } = await request.json();
    if (!episodeId) {
      return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
    }

    // Authenticate user
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    
    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // Fetch episode and parent series with ownership info
    const queryResult = await adminDb.query({
      episodes: {
        $: { where: { id: episodeId } },
        series: {
          owner: {}
        }
      }
    });

    const episode = queryResult.episodes?.[0];
    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const series = episode.series;
    if (!series) {
      return NextResponse.json({ error: "Series context not found" }, { status: 404 });
    }
    
    // Security check: ensure the authenticated user owns this series
    const owner = series.owner;
    if (!owner || owner.id !== authUser.id) {
      return NextResponse.json({ error: "Forbidden: You do not own this series" }, { status: 403 });
    }

    // Transform script and visualPrompts into scenes
    // Scripts are generated as paragraphs separated by double newlines (\n\n)
    const paragraphs = episode.script.split(/\n\s*\n/).filter(p => p.trim());
    const visualPrompts = (episode.visualPrompts || []) as string[];

    // Pair each paragraph with its corresponding visual prompt
    const scenes: Scene[] = paragraphs.map((text, i) => ({
      id: id(),
      voiceover: text.trim(),
      visualPrompt: visualPrompts[i] || `Visual representation of: ${text.substring(0, 100)}...`,
      textOverlay: "", // Standardized empty overlay for series
      duration: 6, // Default to 6 seconds per scene for consistent flow
    }));

    // Reuse existing videoPlanId if this is a regeneration, otherwise create new
    const planId = episode.videoPlanId || id();
    
    const now = Date.now();
    const videoPlanData = {
      title: `${series.title} - Episode ${episode.episodeNumber}: ${episode.title}`,
      scenes,
      type: "video" as const,
      status: "pending" as VideoPlanStatus,
      visualConsistency: series.visualConsistency,
      createdAt: now,
      // Metadata for context-aware generation (consistent with dashboard defaults)
      style: "storytelling" as const,
      audience: "general" as const,
      goal: "engage" as const,
      outputFormat: "short-video" as const,
      tone: "neutral",
      verbatimMode: true,
      verbatimTone: "neutral" as const,
      originalScript: episode.script,
    };

    // Atomic transaction to create plan and link it to the episode
    await adminDb.transact([
      adminDb.tx.videoPlans[planId].update(videoPlanData),
      adminDb.tx.videoPlans[planId].link({ owner: authUser.id }),
      adminDb.tx.episodes[episodeId].update({
        videoPlanId: planId,
        status: "generating" as EpisodeStatus,
        updatedAt: now,
      })
    ]);

    console.log(`[EpisodeCompile] Success: Created/Updated plan ${planId} for episode ${episodeId}`);

    return NextResponse.json({ 
      success: true, 
      planId,
      message: "Episode compiled to video plan successfully." 
    });

  } catch (error: any) {
    console.error("[EpisodeCompile] Fatal error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during compilation" }, 
      { status: 500 }
    );
  }
}
