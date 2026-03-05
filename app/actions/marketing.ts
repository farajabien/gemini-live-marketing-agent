"use server";

import { adminDb, generateId as id } from "@/lib/firebase-admin";
import { generateBrandPositioning, generateContentPillars, PositioningInput } from "@/lib/marketing/positioning";
import { generateDraftFromAngle, DraftGenerationInput } from "@/lib/marketing/generator";
import { analyzeNarrative, analyzeStoryNarrative, refineStoryNarrative, refineBrandNarrative, generateSmartTitle, type NarrativeInput, type SeriesNarrativeInput } from "@/lib/marketing/narrative-intelligence";

// Legacy type for backward compatibility
export async function createBrandNarrative(
  input: NarrativeInput | PositioningInput,
  ownerId: string
): Promise<{ narrativeId: string; analysis: any }> {
  try {
    // Check if this is new format (8-field wizard) or legacy (4-field)
    const isNewFormat = 'currentState' in input;

    let analysis: any;
    let legacyPositioning;
    let legacyPillars;

    if (isNewFormat) {
      // NEW: Full narrative intelligence analysis
      const { positioning: p, angles: a, framework: f, narrativeStrength: s, totalCost: cost } = await analyzeNarrative(input as NarrativeInput);
      analysis = { ...f, positioning: p, angles: a, narrativeStrength: s, totalCost: cost };
    } else {
      // LEGACY: Old positioning system
      legacyPositioning = await generateBrandPositioning(input as PositioningInput);
      legacyPillars = await generateContentPillars(legacyPositioning, input as PositioningInput);
    }

    // 3. Create Entities in DB
    const narrativeId = id();
    const positioningId = id();

    // Transaction to create narrative
    if (isNewFormat && analysis) {
      const narrativeInput = input as NarrativeInput;
      await adminDb.transact([
        // Create Narrative with new structure
        adminDb.tx.narratives[narrativeId].set({
          userId: ownerId, // Required by security rules
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
          aiPositioning: analysis.positioning,
          angles: analysis.angles,
          narrativeStrength: analysis.narrativeStrength,
          totalCost: analysis.totalCost || 0,
          // Polished framework for UI
          positioningStatement: analysis.positioningStatement,
          coreMessage: analysis.coreMessage,
          brandVoice: analysis.brandVoice,
          // Version history
          versions: [{
            timestamp: Date.now(),
            changes: {}, // Initial version, no changes
            updatedBy: ownerId,
          }],
        }).link({ owner: ownerId }),

        // Create Positioning (legacy structure for compatibility)
        adminDb.tx.brandPositioning[positioningId].set({
          userId: ownerId, // Required by security rules
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
        adminDb.tx.narratives[narrativeId].set({
          userId: ownerId, // Required by security rules
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

        adminDb.tx.brandPositioning[positioningId].set({
          userId: ownerId, // Required by security rules
          ...legacyPositioning!,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }).link({ narrative: narrativeId }),
      ]);
    }

    // Create Pillars (both formats)
    const pillarsToCreate = (isNewFormat && analysis)
      ? analysis.contentPillars
      : legacyPillars!;

    for (const pillar of pillarsToCreate) {
        const pillarId = id();
        await adminDb.transact([
            adminDb.tx.contentPillars[pillarId].set({
                userId: ownerId, // Required by security rules
                narrativeId, // Required by schema
                title: pillar.title,
                description: pillar.description,
                angles: pillar.angles,
                status: "active",
                createdAt: Date.now(),
            }).link({ narrative: narrativeId })
        ]);
    }

    // Verify synthesis integrity before returning
    if (analysis && (!analysis.positioningStatement || !analysis.coreMessage)) {
      console.error("!! [INTEGRITY FAILURE] Analysis missing key framework fields:", Object.keys(analysis));
      // Try a last-ditch fallback or re-spread if somehow 'f' was lost
      if (analysis.positioning && !analysis.positioningStatement) {
         console.warn("[Action] Fallback: Using raw positioning promise as statement");
         analysis.positioningStatement = analysis.positioning.promise;
         analysis.coreMessage = `${analysis.positioning.contrast.before} but soon to be ${analysis.positioning.contrast.after}`;
      }
    }

    console.log("[Action] Returning successful analysis. Keys:", Object.keys(analysis));
    return { narrativeId, analysis };
  } catch (error: any) {
    console.error("!! [DB FAILURE] Failed to create brand narrative document:", error.code, error.message);
    
    // If it's a Firestore 5 NOT_FOUND error, we likely have the analysis but can't save it.
    // We throw but include the analysis in a structured way if possible, or just let the client know.
    // Actually, to keep it simple, we'll throw a specific error message.
    const isDbNotFound = error.message?.includes("NOT_FOUND") || error.code === 5;
    if (isDbNotFound) {
      console.error("!! CRITICAL: Firestore Database '(default)' seems to be missing in project:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    }
    
    throw new Error(error.message || "Failed to create narrative");
  }
}

export async function generateContentDraft(
  input: DraftGenerationInput,
  ownerId: string
): Promise<{ draftId: string }> {
    try {
        // 1. Fetch previous content for this angle to ensure variety
        const historyData = await adminDb.query({
            videoPlans: {
                $: {
                    where: {
                        narrative: input.narrativeId,
                        // We might not have 'angle' field in videoPlans in all cases, 
                        // but generateDraftFromAngle passes it in strategy
                    }
                }
            }
        });
        
        // Filter by angle if possible (VideoPlan has pillars linked, but angle might be in prompt)
        // For now, let's just get the last few plans for this narrative to be safe
        const previousPlans = (historyData as any).videoPlans || [];
        const previousContentSummary = previousPlans
            .slice(-3) // last 3 plans
            .map((p: any) => `- ${p.title}: ${p.scenes?.map((s: any) => s.voiceover).join(" ")}`)
            .join("\n\n");

        if (previousContentSummary) {
            input.previousContent = previousContentSummary;
        }

        // 2. Generate Draft Content
        const result = await generateDraftFromAngle(input);
        
        // 2. Create Entities
        const draftId = id();
        const videoPlanId = id();
        
        await adminDb.transact([
            // Create Video Plan
             adminDb.tx.videoPlans[videoPlanId].set({
                userId: ownerId, // Required by security rules
                ...result.videoPlan,
                status: "draft",
                createdAt: Date.now(),
            }).link({ owner: ownerId, narrative: input.narrativeId }),

            // Create Content Draft
            adminDb.tx.contentDrafts[draftId].set({
                userId: ownerId, // Required by security rules
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
    const { positioning: p, angles: a, framework: f, narrativeStrength: s, totalCost: cost } = await analyzeNarrative(narrativeInput);
    const analysis = { ...f, positioning: p, angles: a, narrativeStrength: s, totalCost: cost };
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
        aiPositioning: analysis.positioning,
        angles: analysis.angles,
        narrativeStrength: analysis.narrativeStrength,
        positioningStatement: analysis.positioningStatement,
        coreMessage: analysis.coreMessage,
        brandVoice: analysis.brandVoice,
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

/**
 * Generate content pillars for an existing narrative that doesn't have any.
 * This reads the narrative's AI-extracted angles and creates contentPillars docs.
 */
export async function generatePillarsForNarrative(
  narrativeId: string,
  userId: string
): Promise<void> {
  try {
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative = (data as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    // Check if pillars already exist
    const existingPillars = await adminDb.query({
      contentPillars: { $: { where: { narrative: narrativeId } } }
    });
    if ((existingPillars as any).contentPillars?.length > 0) {
      return; // Pillars already exist
    }

    // Build pillars from the narrative's AI-extracted angles
    const angles = narrative.angles;
    if (!angles || Object.keys(angles).length === 0) {
      // No angles available — we need to run analysis first
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
      const { angles: newAngles } = await analyzeNarrative(narrativeInput);
      
      // Update narrative with new angles
      await adminDb.transact([
        adminDb.tx.narratives[narrativeId].update({
          angles: newAngles,
          updatedAt: Date.now(),
        })
      ]);

      // Create pillars from new angles
      for (const [category, categoryAngles] of Object.entries(newAngles)) {
        const pillarId = id();
        await adminDb.transact([
          adminDb.tx.contentPillars[pillarId].set({
            userId,
            narrativeId,
            title: category.replace(/Angles$/, '').replace(/([A-Z])/g, ' $1').trim(),
            description: `Content angles focused on ${category.replace(/Angles$/, '').toLowerCase()}`,
            angles: categoryAngles as string[],
            status: "active",
            createdAt: Date.now(),
          }).link({ narrative: narrativeId })
        ]);
      }
    } else {
      // Create pillars from existing angles
      for (const [category, categoryAngles] of Object.entries(angles)) {
        const pillarId = id();
        await adminDb.transact([
          adminDb.tx.contentPillars[pillarId].set({
            userId,
            narrativeId,
            title: category.replace(/Angles$/, '').replace(/([A-Z])/g, ' $1').trim(),
            description: `Content angles focused on ${category.replace(/Angles$/, '').toLowerCase()}`,
            angles: categoryAngles as string[],
            status: "active",
            createdAt: Date.now(),
          }).link({ narrative: narrativeId })
        ]);
      }
    }
  } catch (error) {
    console.error("Failed to generate pillars:", error);
    throw new Error("Failed to generate content pillars");
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
      adminDb.tx.contentDrafts[draftId].set({
        userId: userId, // Required by security rules
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
): Promise<{ seriesNarrativeId: string; analysis: any }> {
  try {
    const { analysis, totalCost } = await analyzeStoryNarrative(input);
    
    const seriesNarrativeId = id();

    await adminDb.transact([
      adminDb.tx.seriesNarratives[seriesNarrativeId].set({
        userId: ownerId, // Required by security rules
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
        worldRules: analysis.worldRules,
        visualMoat: analysis.visualMoat,
        logline: analysis.logline,

        createdAt: Date.now(),
        updatedAt: Date.now(),
        totalCost: totalCost || 0,
      }).link({ owner: ownerId }),
    ]);

    return { seriesNarrativeId, analysis };
  } catch (error: any) {
    console.error("Failed to create series narrative:", error);
    throw error;
  }
}

export async function refineSeriesNarrativeAction(
  seriesNarrativeId: string,
  feedback: string,
  userId: string
): Promise<any> {
  try {
    // 1. Fetch current narrative
    const data = await adminDb.query({
      seriesNarratives: { $: { where: { id: seriesNarrativeId } } }
    });
    const narrative = (data as any).seriesNarratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    // 2. Prepare input for AI
    const input: SeriesNarrativeInput = {
      genre: narrative.genre,
      worldSetting: narrative.worldSetting,
      conflictType: narrative.conflictType,
      protagonistArchetype: narrative.protagonistArchetype,
      centralTheme: narrative.centralTheme,
      narrativeTone: narrative.narrativeTone,
      visualStyle: narrative.visualStyle,
      episodeHooks: narrative.episodeHooks,
    };

    const currentAnalysis = {
      characterDynamics: narrative.characterDynamics,
      plotBeats: narrative.plotBeats,
      worldRules: narrative.worldRules,
      visualMoat: narrative.visualMoat,
      title: narrative.title,
      logline: narrative.logline,
    };

    // 3. Run AI Refinement
    const { analysis, totalCost } = await refineStoryNarrative(input, currentAnalysis, feedback);

    // 4. Update Database
    await adminDb.transact([
      adminDb.tx.seriesNarratives[seriesNarrativeId].update({
        characterDynamics: analysis.characterDynamics,
        plotBeats: analysis.plotBeats,
        worldRules: analysis.worldRules,
        visualMoat: analysis.visualMoat,
        title: analysis.title,
        logline: analysis.logline,
        totalCost: (narrative.totalCost || 0) + totalCost,
        updatedAt: Date.now(),
      })
    ]);

    return analysis;
  } catch (error: any) {
    console.error("Failed to refine series narrative:", error);
    throw error;
  }
}


export async function refineBrandNarrativeAction(
  narrativeId: string,
  feedback: string,
  userId: string
): Promise<any> {
  try {
    // 1. Fetch current narrative
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative = (data as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    // 2. Prepare input for AI
    const input: NarrativeInput = {
      audience: narrative.audience,
      currentState: narrative.currentState,
      problem: narrative.problem,
      costOfInaction: narrative.costOfInaction,
      solution: narrative.solution,
      afterState: narrative.afterState,
      identityShift: narrative.identityShift,
      voice: narrative.brandVoice
    };

    const currentAnalysis = {
      positioningStatement: narrative.positioningStatement,
      coreMessage: narrative.coreMessage,
      brandVoice: narrative.brandVoice,
    };
    
    // Fetch pillars
    const pillarsData = await adminDb.query({
      contentPillars: { $: { where: { narrative: narrativeId } } }
    });
    const contentPillars = (pillarsData as any).contentPillars;
    (currentAnalysis as any).contentPillars = contentPillars;

    // 3. Run AI Refinement
    const { analysis, totalCost } = await refineBrandNarrative(input, currentAnalysis, feedback);

    // 4. Update Database
    const transactions = [
      adminDb.tx.narratives[narrativeId].update({
        positioningStatement: analysis.positioningStatement,
        coreMessage: analysis.coreMessage,
        brandVoice: analysis.brandVoice,
        totalCost: (narrative.totalCost || 0) + totalCost,
        updatedAt: Date.now(),
      })
    ];

    if (analysis.contentPillars) {
        analysis.contentPillars.forEach((pillar: any) => {
            const pillarId = id();
            transactions.push(
                adminDb.tx.contentPillars[pillarId].set({
                    userId,
                    narrativeId, // Schema requirement
                    title: pillar.title,
                    description: pillar.description,
                    angles: pillar.angles,
                    status: "active",
                    createdAt: Date.now(),
                }).link({ narrative: narrativeId })
            );
        });
    }

    await adminDb.transact(transactions);

    return analysis;
  } catch (error: any) {
    console.error("Failed to refine brand narrative:", error);
    throw error;
  }
}
