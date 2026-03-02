"use server";

import { adminDb, generateId as id } from "@/lib/firebase-admin";
import { generateBrandPositioning, generateContentPillars, PositioningInput } from "@/lib/marketing/positioning";
import { generateDraftFromAngle, DraftGenerationInput } from "@/lib/marketing/generator";
import { analyzeNarrative, analyzeStoryNarrative, generateSmartTitle, type NarrativeInput, type SeriesNarrativeInput } from "@/lib/marketing/narrative-intelligence";

// Legacy type for backward compatibility
export async function createBrandNarrative(
  input: NarrativeInput | PositioningInput,
  ownerId: string
): Promise<{ narrativeId: string }> {
  try {
    // Check if this is new format (8-field wizard) or legacy (4-field)
    const isNewFormat = 'currentState' in input;

    let analysis;
    let legacyPositioning;
    let legacyPillars;

    if (isNewFormat) {
      // NEW: Full narrative intelligence analysis
      const { positioning: p, angles: a, narrativeStrength: s, totalCost: cost } = await analyzeNarrative(input as NarrativeInput);
      analysis = { positioning: p, angles: a, narrativeStrength: s, totalCost: cost };
    } else {
      // LEGACY: Old positioning system
      legacyPositioning = await generateBrandPositioning(input as PositioningInput);
      legacyPillars = await generateContentPillars(legacyPositioning, input as PositioningInput);
    }

    // 3. Create Entities in DB
    const narrativeId = id();
    const positioningId = id();

    // Transaction to create narrative
    if (isNewFormat) {
      const narrativeInput = input as NarrativeInput;
      await adminDb.transact([
        // Create Narrative with new structure
        adminDb.tx.narratives[narrativeId].update({
          userId: ownerId,
          title: analysis!.positioning.title,
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // Raw wizard inputs
          audience: narrativeInput.audience,
          currentState: narrativeInput.currentState,
          problem: narrativeInput.problem,
          costOfInaction: narrativeInput.costOfInaction,
          solution: narrativeInput.solution,
          afterState: narrativeInput.afterState,
          identityShift: narrativeInput.identityShift,
          voice: narrativeInput.voice,
          // AI-extracted data
          aiPositioning: analysis!.positioning,
          angles: analysis!.angles,
          narrativeStrength: analysis!.narrativeStrength,
          totalCost: analysis!.totalCost || 0,
          // Version history
          versions: [{
            timestamp: Date.now(),
            changes: {}, // Initial version, no changes
            updatedBy: ownerId,
          }],
        }).link({ owner: ownerId }),

        // Create Positioning (legacy structure for compatibility)
        adminDb.tx.brandPositioning[positioningId].update({
          userId: ownerId,
          narrativeId, // Required by schema
          villain: analysis!.positioning.villain,
          hero: analysis!.positioning.hero,
          transformation: analysis!.positioning.promise,
          corePromise: analysis!.positioning.promise,
          emotionalArc: `${analysis!.positioning.contrast.before} → ${analysis!.positioning.contrast.after}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).link({ narrative: narrativeId }),
      ]);
    } else {
      // Legacy format
      const legacyInput = input as PositioningInput;
      await adminDb.transact([
        adminDb.tx.narratives[narrativeId].update({
          userId: ownerId,
          title: `${legacyInput.audience} Narrative`,
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // Store in legacy fields
          desiredChange: legacyInput.audience,
          thePain: legacyInput.problem,
          yourApproach: legacyInput.solution,
          founderVoice: legacyInput.voice,
        }).link({ owner: ownerId }),

        adminDb.tx.brandPositioning[positioningId].update({
          userId: ownerId,
          ...legacyPositioning!,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).link({ narrative: narrativeId }),
      ]);
    }

    // Create Pillars (both formats)
    const pillarsToCreate = isNewFormat
      ? Object.entries(analysis!.angles).map(([category, angles]) => ({
          title: category.replace(/Angles$/, '').replace(/([A-Z])/g, ' $1').trim(),
          description: `Content angles focused on ${category.replace(/Angles$/, '').toLowerCase()}`,
          angles: angles as string[],
        }))
      : legacyPillars!;

    for (const pillar of pillarsToCreate) {
        const pillarId = id();
        await adminDb.transact([
            adminDb.tx.contentPillars[pillarId].update({
                userId: ownerId,
                narrativeId, // Required by schema
                title: pillar.title,
                description: pillar.description,
                angles: pillar.angles,
                status: "active",
                createdAt: Date.now(),
            }).link({ narrative: narrativeId })
        ]);
    }

    return { narrativeId };
  } catch (error: any) {
    console.error("Failed to create brand narrative:", error);
    throw new Error(error.message || "Failed to create narrative");
  }
}

export async function generateContentDraft(
  input: DraftGenerationInput,
  ownerId: string
): Promise<{ draftId: string }> {
    try {
        // 1. Generate Draft Content
        const result = await generateDraftFromAngle(input);
        
        // 2. Create Entities
        const draftId = id();
        const videoPlanId = id();
        
        await adminDb.transact([
            // Create Video Plan
             adminDb.tx.videoPlans[videoPlanId].update({
                userId: ownerId,
                ...result.videoPlan,
                status: "draft",
                createdAt: Date.now(),
            }).link({ owner: ownerId, narrative: input.narrativeId }),

            // Create Content Draft
            adminDb.tx.contentDrafts[draftId].update({
                userId: ownerId,
                title: result.title,
                angle: input.angle,
                slides: result.slides,
                visualPrompts: result.visualPrompts,
                captions: result.captions,
                status: "draft",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            }).link({ narrative: input.narrativeId })
              // Link draft to video plan if schema allows (it does: videoPlanId field, but not explicit relation in schema yet? 
              // Wait, schema has `videoPlanId` string field on `contentDrafts` but no relation defined in `links`?
              // Checking schema... `contentDrafts` has `videoPlanId` string. `videoPlans` has `narrative` relation.
              // We can just store the ID for now or add relation later.
        ]);
        
        return { draftId };
    } catch (error) {
        console.error("Failed to generate draft:", error);
        throw new Error("Failed to generate draft");
    }
}

export async function generatePositioningAction(input: PositioningInput) {
  try {
    const positioning = await generateBrandPositioning(input);
    // We also generate pillars to complete the context, though optional
    const pillars = await generateContentPillars(positioning, input);
    return { positioning, pillars };
  } catch (error) {
    console.error("Failed to generate positioning:", error);
    throw new Error("Failed to generate strategic context");
  }
}

// === Narrative Intelligence Actions ===

export async function updateNarrativeField(
  narrativeId: string,
  field: string,
  value: string,
  userId: string
): Promise<void> {
  try {
    // Fetch current narrative to track version history
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });

    const narrative = (data as any).narratives?.[0];
    if (!narrative) {
      throw new Error("Narrative not found");
    }

    const oldValue = (narrative as any)[field];

    // Build version history entry
    const versions = narrative.versions || [];
    const newVersion = {
      timestamp: Date.now(),
      changes: {
        [field]: {
          old: oldValue,
          new: value,
        }
      },
      updatedBy: "user", // In a real app, you'd pass userId here
    };

    // Keep only last 10 versions
    const updatedVersions = [newVersion, ...versions].slice(0, 10);

    // Update narrative
    await adminDb.transact([
      adminDb.tx.narratives[narrativeId].update({
        userId,
        [field]: value,
        versions: updatedVersions,
        updatedAt: Date.now(),
      })
    ]);

  } catch (error) {
    console.error("Failed to update narrative field:", error);
    throw new Error("Failed to update narrative");
  }
}

export async function regeneratePositioning(
  narrativeId: string,
  userId: string
): Promise<void> {
  try {
    // Fetch current narrative
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });

    const narrative = (data as any).narratives?.[0];
    if (!narrative) {
      throw new Error("Narrative not found");
    }

    // Build narrative input from current data
    const narrativeInput: NarrativeInput = {
      audience: narrative.audience || "",
      currentState: narrative.currentState || "",
      problem: narrative.problem || "",
      costOfInaction: narrative.costOfInaction || "",
      solution: narrative.solution || "",
      afterState: narrative.afterState || "",
      identityShift: narrative.identityShift || "",
      voice: narrative.voice || "calm",
    };

    console.log("[Action] Narrative Input for analysis:", JSON.stringify(narrativeInput, null, 2));

    // Run analysis
    console.log(`[Action] Regenerating narrative for id: ${narrativeId}`);
    const { positioning: p, angles: a, narrativeStrength: s, totalCost: cost } = await analyzeNarrative(narrativeInput);
    const analysis = { positioning: p, angles: a, narrativeStrength: s, totalCost: cost };
    console.log("[Action] Analysis result:", JSON.stringify(analysis.positioning, null, 2));


    // Track version change
    const versions = narrative.versions || [];
    const newVersion = {
      timestamp: Date.now(),
      changes: {
        positioning: {
          old: narrative.positioning,
          new: analysis.positioning,
        },
        angles: {
          old: narrative.angles,
          new: analysis.angles,
        },
        narrativeStrength: {
          old: narrative.narrativeStrength,
          new: analysis.narrativeStrength,
        }
      },
      updatedBy: userId,
    };

    const updatedVersions = [newVersion, ...versions].slice(0, 10);

    // Update narrative
    await adminDb.transact([
      adminDb.tx.narratives[narrativeId].update({
        userId,
        aiPositioning: analysis.positioning,
        angles: analysis.angles,
        narrativeStrength: analysis.narrativeStrength,
        totalCost: (narrative.totalCost || 0) + analysis.totalCost,
        versions: updatedVersions,
        updatedAt: Date.now(),
      })
    ]);


    // Also update brandPositioning entity for compatibility
    const posData = await adminDb.query({
      brandPositioning: { $: { where: { narrativeId } } }
    });

    const existingPositioning = (posData as any).brandPositioning?.[0];
    if (existingPositioning) {
      await adminDb.transact([
        adminDb.tx.brandPositioning[existingPositioning.id].update({
          userId,
          villain: analysis.positioning.villain,
          hero: analysis.positioning.hero,
          transformation: analysis.positioning.promise,
          corePromise: analysis.positioning.promise,
          emotionalArc: `${analysis.positioning.contrast.before} → ${analysis.positioning.contrast.after}`,
          updatedAt: Date.now(),
        })
      ]);
    }

  } catch (error) {
    console.error("Failed to regenerate positioning:", error);
    throw new Error("Failed to regenerate positioning");
  }
}

export async function generateSmartTitleAction(
  narrativeId: string,
  userId: string
): Promise<{ title: string; oneLiner: string }> {
  try {
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });

    const narrative = (data as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    const input: NarrativeInput = {
      audience: narrative.audience || "",
      currentState: narrative.currentState || "",
      problem: narrative.problem || "",
      costOfInaction: narrative.costOfInaction || "",
      solution: narrative.solution || "",
      afterState: narrative.afterState || "",
      identityShift: narrative.identityShift || "",
      voice: narrative.voice || "calm",
    };

    const result = await generateSmartTitle(input);

    await adminDb.transact([
      adminDb.tx.narratives[narrativeId].update({
        userId,
        title: result.title,
        oneLiner: result.oneLiner,
        updatedAt: Date.now(),
      })
    ]);

    return result;
  } catch (error) {
    console.error("Failed to generate smart title:", error);
    throw new Error("Failed to generate smart title");
  }
}

export async function createContentFromAngleAction(
  narrativeId: string,
  angle: string,
  userId: string
): Promise<{ draftId: string }> {
  try {
    const draftId = id();
    
    await adminDb.transact([
      adminDb.tx.contentDrafts[draftId].update({
        userId,
        narrativeId,
        angle,
        title: `Draft: ${angle.slice(0, 30)}...`,
        status: "draft",
        slides: [],
        visualPrompts: [],
        captions: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      // Link narrative to draft
      adminDb.tx.narratives[narrativeId].link({ drafts: draftId }),
    ]);

    return { draftId };
  } catch (error) {
    console.error("Failed to create content from angle:", error);
    throw new Error("Failed to create content from angle");
  }
}

export async function createSeriesNarrative(
  input: SeriesNarrativeInput,
  ownerId: string
): Promise<{ seriesNarrativeId: string }> {
  try {
    const { analysis, totalCost } = await analyzeStoryNarrative(input);
    
    const seriesNarrativeId = id();

    await adminDb.transact([
      adminDb.tx.seriesNarratives[seriesNarrativeId].update({
        userId: ownerId,
        title: analysis.title,
        genre: input.genre,
        worldSetting: input.worldSetting,
        conflictType: input.conflictType,
        protagonistArchetype: input.protagonistArchetype,
        centralTheme: input.centralTheme,
        narrativeTone: input.narrativeTone,
        visualStyle: input.visualStyle,
        episodeHooks: input.episodeHooks,
        
        characterDynamics: analysis.characterDynamics,
        plotBeats: analysis.plotBeats,
        
        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalCost: totalCost || 0,
      }).link({ owner: ownerId }),
    ]);

    return { seriesNarrativeId };
  } catch (error: any) {
    console.error("Failed to create series narrative:", error);
    throw error;
  }
}

