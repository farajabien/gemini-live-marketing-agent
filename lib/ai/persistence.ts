
import { id, tx } from "@instantdb/react";
import { VideoPlan } from "@/lib/types";
import { autoTagContent, type ContentTags } from "@/lib/marketing/content-tagging";

// Re-export id for use in components
export { id };

/**
 * Save a generated video plan to InstantDB and increment generation counters
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
  const planId = planIdArg || id();

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

  // Create the plan, link to user, and increment generation counters
  const planTx = tx.videoPlans[planId].update({
    title: plan.title,
    tone: plan.tone,
    scenes: plan.scenes,
    type: plan.type,
    status: "pending",
    createdAt: Date.now(),
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
  }).link({ owner: userId });

  // Link to narrative if provided
  if (narrativeId) {
    planTx.link({ narrative: narrativeId });
  }

  // Link to source content piece if provided
  if (sourceContentPieceId) {
    planTx.link({ sourceContentPiece: sourceContentPieceId });
  }

  return [
    planTx,
    // Increment generation counters
    tx.$users[userId].merge({
      lifetimeGenerations: 1,
      monthlyGenerations: 1,
    }),
  ];
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
  const planId = planIdArg || id();

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

  const planTx = tx.videoPlans[planId].update({
    title: plan.title,
    tone: plan.tone,
    scenes: plan.scenes,
    type: plan.type,
    status: "draft",
    createdAt: Date.now(),
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
  }).link({ owner: userId });

  // Link to narrative if provided
  if (narrativeId) {
    planTx.link({ narrative: narrativeId });
  }

  // Link to source content piece if provided
  if (sourceContentPieceId) {
    planTx.link({ sourceContentPiece: sourceContentPieceId });
  }

  return [planTx];
}
