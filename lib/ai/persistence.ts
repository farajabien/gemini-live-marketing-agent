
import { VideoPlan } from "@/lib/types";
import { autoTagContent, type ContentTags } from "@/lib/marketing/content-tagging";
import { serverDb, generateId, FieldValue } from "@/lib/firebase-admin";

// Re-export id for use in components
export { generateId as id };

/**
 * Save a generated video plan to Firebase and increment generation counters
 * Now includes auto-tagging for content intelligence
 */
export async function saveVideoPlan(
  userId: string,
  plan: VideoPlan,
  planIdArg?: string,
  narrativeId?: string,
  narrativeAngles?: any,
  sourceContentPieceId?: string
) {
  const planId = planIdArg || generateId();

  // Calculate duration safely - ensure it's always a number
  const calculatedDuration = typeof plan.duration === 'number' ? plan.duration :
                             typeof plan.estimatedDuration === 'number' ? plan.estimatedDuration :
                             (plan.scenes?.reduce((sum, s: any) => sum + (s.duration || 0), 0) ?? 0);

  // Auto-tag content
  let contentTags: ContentTags | undefined;
  try {
    contentTags = await autoTagContent(plan, narrativeAngles);
  } catch (error) {
    console.error("Failed to auto-tag content:", error);
    // Continue without tags
  }

  const videoPlanData = {
    title: plan.title,
    tone: plan.tone,
    scenes: plan.scenes,
    type: plan.type,
    status: "pending",
    createdAt: Date.now(),
    userId,
    // Optional fields
    ...(plan.thumbnailPrompt && { thumbnailPrompt: plan.thumbnailPrompt }),
    ...(plan.visualConsistency && { visualConsistency: plan.visualConsistency }),
    // Verbatim mode fields
    ...(plan.verbatimMode !== undefined && { verbatimMode: plan.verbatimMode }),
    ...(plan.verbatimTone && { verbatimTone: plan.verbatimTone }),
    ...(plan.originalScript && { originalScript: plan.originalScript }),
    // Duration (calculate from scenes if not provided)
    duration: calculatedDuration,
    // Visual Strategy
    visualMode: plan.visualMode || "image",
    // Content Tags
    ...(contentTags && { contentTags }),
    // Initialize empty metrics
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
    // Link fields
    ...(narrativeId && { narrativeId }),
    ...(sourceContentPieceId && { sourceContentPieceId }),
  };

  // Create the video plan
  await serverDb.collection('videoPlans').doc(planId).set(videoPlanData);

  // Increment generation counters using increment
  const userRef = serverDb.collection('users').doc(userId);
  await userRef.set({
    lifetimeGenerations: FieldValue.increment(1),
    monthlyGenerations: FieldValue.increment(1),
  }, { merge: true });

  return planId;
}

/**
 * Save a video plan as a draft (generated but not yet compiled)
 * Drafts don't increment generation counters
 * Also includes auto-tagging for content intelligence
 */
export async function saveDraftVideoPlan(
  userId: string,
  plan: VideoPlan,
  planIdArg?: string,
  narrativeId?: string,
  narrativeAngles?: any,
  sourceContentPieceId?: string
) {
  const planId = planIdArg || generateId();

  // Calculate duration safely - ensure it's always a number
  const calculatedDuration = typeof plan.duration === 'number' ? plan.duration :
                             typeof plan.estimatedDuration === 'number' ? plan.estimatedDuration :
                             (plan.scenes?.reduce((sum, s: any) => sum + (s.duration || 0), 0) ?? 0);

  // Auto-tag content
  let contentTags: ContentTags | undefined;
  try {
    contentTags = await autoTagContent(plan, narrativeAngles);
  } catch (error) {
    console.error("Failed to auto-tag content:", error);
    // Continue without tags
  }

  const videoPlanData = {
    title: plan.title,
    tone: plan.tone,
    scenes: plan.scenes,
    type: plan.type,
    status: "draft",
    createdAt: Date.now(),
    userId,
    // Optional fields
    ...(plan.thumbnailPrompt && { thumbnailPrompt: plan.thumbnailPrompt }),
    ...(plan.visualConsistency && { visualConsistency: plan.visualConsistency }),
    // Content settings
    ...(plan.style && { style: plan.style }),
    ...(plan.audience && { audience: plan.audience }),
    ...(plan.goal && { goal: plan.goal }),
    ...(plan.outputFormat && { outputFormat: plan.outputFormat }),
    ...(plan.verbatimTone && { verbatimTone: plan.verbatimTone }),
    ...(plan.originalScript && { originalScript: plan.originalScript }),
    // Duration (calculate from scenes if not provided)
    duration: calculatedDuration,
    // Visual Strategy
    visualMode: plan.visualMode || "image",
    // Content Tags
    ...(contentTags && { contentTags }),
    // Initialize empty metrics
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
    // Link fields
    ...(narrativeId && { narrativeId }),
    ...(sourceContentPieceId && { sourceContentPieceId }),
  };

  await serverDb.collection('videoPlans').doc(planId).set(videoPlanData);

  return planId;
}
