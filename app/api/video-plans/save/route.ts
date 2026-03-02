import { NextRequest, NextResponse } from "next/server";
import { adminDb, serverDb, generateId, FieldValue } from "@/lib/firebase-admin";
import { autoTagContent, type ContentTags } from "@/lib/marketing/content-tagging";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // Verify the token
    const authUser = await adminDb.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;
    const { plan, planId, narrativeId, narrativeAngles, sourceContentPieceId, voiceId, visualMode } = await request.json();

    if (!plan) {
      return NextResponse.json({ error: "Missing plan data" }, { status: 400 });
    }

    const newPlanId = planId || generateId();

    // Calculate duration safely
    const calculatedDuration = typeof plan.duration === 'number' ? plan.duration :
                               typeof plan.estimatedDuration === 'number' ? plan.estimatedDuration :
                               (plan.scenes?.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) ?? 0);

    // Auto-tag content
    let contentTags: ContentTags | undefined;
    try {
      contentTags = await autoTagContent(plan, narrativeAngles);
    } catch (error) {
      console.error("Failed to auto-tag content:", error);
    }

    const videoPlanData = {
      title: plan.title,
      tone: plan.tone,
      scenes: plan.scenes,
      type: plan.type,
      status: "pending",
      createdAt: Date.now(),
      userId,
      ...(plan.thumbnailPrompt && { thumbnailPrompt: plan.thumbnailPrompt }),
      ...(plan.visualConsistency && { visualConsistency: plan.visualConsistency }),
      ...(plan.verbatimMode !== undefined && { verbatimMode: plan.verbatimMode }),
      ...(plan.verbatimTone && { verbatimTone: plan.verbatimTone }),
      ...(plan.originalScript && { originalScript: plan.originalScript }),
      duration: calculatedDuration,
      visualMode: visualMode || plan.visualMode || "image",
      ...(voiceId && { voiceId }),
      ...(contentTags && { contentTags }),
      metrics: {
        posted: false,
        postedAt: null,
        platform: "",
        videoUrl: "",
        metrics24h: null,
        metrics7d: null,
        boosted: false,
        organic: true,
      },
      ...(narrativeId && { narrativeId }),
      ...(sourceContentPieceId && { sourceContentPieceId }),
    };

    // Save video plan
    await serverDb.collection('videoPlans').doc(newPlanId).set(videoPlanData);

    // Increment generation counters
    const userRef = serverDb.collection('users').doc(userId);
    await userRef.set({
      lifetimeGenerations: FieldValue.increment(1),
      monthlyGenerations: FieldValue.increment(1),
    }, { merge: true });

    return NextResponse.json({ planId: newPlanId });
  } catch (error: any) {
    console.error("Error saving video plan:", error);
    return NextResponse.json({ error: error.message || "Failed to save plan" }, { status: 500 });
  }
}
