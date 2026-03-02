import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import { existsSync } from "fs";
import { unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { canUserGenerate } from "@/lib/pricing";
import { startOfMonth } from "date-fns";
import type { Scene, User, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { renderRemotionVideo } from "@/lib/remotion-renderer";

// Initialize Admin SDK
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN!;

if (!APP_ID || !ADMIN_TOKEN) {
  console.warn("InstantDB credentials not configured during build - will be required at runtime");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
});


export async function POST(request: NextRequest) {
  try {
    const { planId, background = false } = await request.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token with InstantDB
    const authUser = await db.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;

    console.log(`[VideoGen Remotion] Generating video for plan: ${planId} (Background: ${background}) (requested by ${userId})`);

    const queryResult = await db.query({
      videoPlans: {
        $: { where: { id: planId } },
        owner: {},
      },
    });
    const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = plan.owner?.[0]?.id;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    // --- Usage Check with Monthly Reset ---
    const owner: User | undefined = plan.owner?.[0];
    if (owner) {
        const currentMonthStartUTC = startOfMonth(new Date()).getTime();
        const needsReset = (owner.generationResetDate ?? 0) < currentMonthStartUTC;
        
        if (needsReset) {
            await db.transact([
                db.tx.$users[owner.id].update({
                    monthlyGenerations: 0,
                    generationResetDate: currentMonthStartUTC,
                }),
            ]);
            owner.monthlyGenerations = 0;
            owner.generationResetDate = currentMonthStartUTC;
        }
        
        const usageCount = owner.monthlyGenerations ?? 0;
        if (!canUserGenerate(owner.planId, usageCount)) {
            return NextResponse.json({ 
                error: "Limit Reached", 
                limitReached: true 
            }, { status: 403 });
        }
    }

    if (plan.videoUrl && background) {
        return NextResponse.json({ success: true, url: plan.videoUrl, cached: true });
    }

    const scenes = plan.scenes as Scene[];
    const visualMode = plan.visualMode || "image";
    
    // Log scene durations for debugging
    console.log(`[VideoGen] Plan has ${scenes.length} scenes with durations:`);
    scenes.forEach((scene, i) => {
      console.log(`  Scene ${i}: ${scene.duration}s - Audio: ${scene.audioUrl ? 'YES' : 'NO'} - Visual: ${scene.imageUrl || scene.videoClipUrl ? 'YES' : 'NO'}`);
    });
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    console.log(`[VideoGen] Total video duration should be: ${totalDuration.toFixed(2)}s`);

    // Check asset readiness (basic check)
    if (visualMode === "broll") {
      if (scenes.some((s) => !s.videoClipUrl || !s.audioUrl)) {
        return NextResponse.json({ error: "B-roll clips or audio not ready" }, { status: 400 });
      }
    } else if (visualMode === "text_motion") {
      // Text Motion is silent first, so we only check for imageUrl (which holds the Giphy URL)
      if (scenes.some((s) => !s.imageUrl)) {
        return NextResponse.json({ error: "Visuals not ready" }, { status: 400 });
      }
    } else {
      if (scenes.some((s) => !s.imageUrl || !s.audioUrl)) {
        return NextResponse.json({ error: "Images or audio not ready" }, { status: 400 });
      }
    }

    // Remotion's <Img>, <Video>, and <Audio> components automatically handle asset loading
    // and ensure assets are fully loaded before rendering, so no pre-verification needed.
    // This saves 8+ seconds and eliminates 425 retry loops.
    console.log("[VideoGen] Trusting Remotion's built-in asset loading (no pre-verification needed)");

    // Set status to rendering
    await db.transact([db.tx.videoPlans[planId].update({ status: 'rendering' })]);

    const videoPath = join(tmpdir(), `render-${planId}.mp4`);
    
    // Call the new Remotion renderer
    try {
      await renderRemotionVideo(plan, videoPath);
    } catch (renderErr) {
      console.error("Remotion rendering failed:", renderErr);
      throw new Error(`Rendering failed: ${getErrorMessage(renderErr)}`);
    }

    // Read and Upload to Storage
    if (!existsSync(videoPath)) {
      throw new Error("Rendered video file not found after rendering process.");
    }
    
    const videoBuffer = await readFile(videoPath);
    const fileName = `renders/${planId}.mp4`;
    
    console.log("Uploading rendered video to storage...");
    type AdminStorage = { storage?: { uploadFile?: (path: string, file: Buffer, opts?: { contentType?: string }) => Promise<unknown> } };
    const adminDb = db as unknown as AdminStorage;
    
    if (adminDb.storage?.uploadFile) {
      await adminDb.storage.uploadFile(fileName, videoBuffer, { contentType: "video/mp4" });
    } else {
      console.warn("Storage upload unavailable, skipping upload.");
    }

    // Update DB
    await db.transact([
        db.tx.videoPlans[planId].update({ 
            videoUrl: fileName,
            status: 'completed'
        })
    ]);

    // Cleanup local temp
    try { await unlink(videoPath); } catch (e) {}

    if (background) {
        return NextResponse.json({ success: true, url: fileName });
    }

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="ideatovideo-${planId}.mp4"`,
      },
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Video generation error:", error);
    return NextResponse.json({ error: message || "Video generation failed" }, { status: 500 });
  }
}
