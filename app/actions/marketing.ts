"use server";

import { adminDb, generateId as id } from "@/lib/firebase-admin";
import { generateBrandPositioning, generateContentPillars, PositioningInput } from "@/lib/marketing/positioning";
import { generateDraftFromAngle, DraftGenerationInput } from "@/lib/marketing/generator";
import { analyzeNarrative, analyzeStoryNarrative, refineStoryNarrative, refineBrandNarrative, refineContentPillar, refineFullStrategy, evolveNarrative, generateSmartTitle, extractSeriesWizardDataFromBrainDump, generateSeriesSeasonPlot, type NarrativeInput, type SeriesNarrativeInput } from "@/lib/marketing/narrative-intelligence";

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
          aiPositioning: analysis!.positioning,
          angles: analysis!.angles,
          narrativeStrength: analysis!.narrativeStrength,
          totalCost: analysis!.totalCost || 0,
          // Polished framework for UI
          positioningStatement: analysis!.positioningStatement,
          coreMessage: analysis!.coreMessage,
          brandVoice: analysis!.brandVoice,
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

    console.log("[Action] Returning successful analysis. Keys:", analysis ? Object.keys(analysis) : "null");
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
        // 1. Fetch Narrative Brain Context (for history + evolution)
        const narrativeData = await adminDb.query({
          narratives: { $: { where: { id: input.narrativeId } } }
        });
        const narrative = (narrativeData as any).narratives?.[0];
        if (!narrative) throw new Error("Narrative not found");

        const contentHistory = narrative.contentHistory || [];
        
        // 2. Format history for AI variety
        const previousContentSummary = contentHistory
            .slice(-10) // provide more context to avoid repetition
            .map((h: any) => `- ${h.title} (${h.format}): ${h.hook}`)
            .join("\n\n");

        if (previousContentSummary) {
            input.previousContent = previousContentSummary;
        }

        // 3. Generate Draft Content
        const result = await generateDraftFromAngle(input);
        
        // 4. Create Entities
        const draftId = id();
        const videoPlanId = id();
        
        await adminDb.transact([
            // Create Video Plan
             adminDb.tx.videoPlans[videoPlanId].set({
                userId: ownerId, 
                ...result.videoPlan,
                status: "draft",
                createdAt: Date.now(),
            }).link({ owner: ownerId, narrative: input.narrativeId }),

            // Create Content Draft
            adminDb.tx.contentDrafts[draftId].set({
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
        ]);
        
        // 5. EVOLVE THE NARRATIVE BRAIN (The Distillation Loop)
        try {
            const currentNarrative: NarrativeInput = {
              audience: narrative.audience || "",
              currentState: narrative.currentState || "",
              problem: narrative.problem || "",
              costOfInaction: narrative.costOfInaction || "",
              solution: narrative.solution || "",
              afterState: narrative.afterState || "",
              identityShift: narrative.identityShift || "",
              voice: narrative.voice || "calm",
            };

            // Distill the essence
            const richInsight = `Content Angle used: "${input.angle}". Generated Title: "${result.title}". Core hook used: "${result.videoPlan.scenes[0]?.voiceover || ''}"`;
            const evolved = await evolveNarrative(currentNarrative, richInsight);

            // Update Brain: Evolution + Persist new history entry
            const newHistoryEntry = {
              timestamp: Date.now(),
              angle: input.angle,
              format: input.format,
              title: result.title,
              hook: result.videoPlan.scenes[0]?.voiceover || "No hook text",
            };

            await adminDb.transact([
              adminDb.tx.narratives[input.narrativeId].update({
                ...evolved,
                contentHistory: [...contentHistory, newHistoryEntry].slice(-50), // Keep last 50 for context
                updatedAt: Date.now(),
              })
            ]);
            console.log("🧠 Narrative Brain Evolved & Content Tracked.");
        } catch (evolutionError) {
          console.error("Evolution semi-failure (non-blocking):", evolutionError);
        }

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

export async function autoFillSeriesAction(brainDump: string): Promise<any> {
  try {
    const { data } = await extractSeriesWizardDataFromBrainDump(brainDump);
    return data;
  } catch (error: any) {
    console.error("Failed to auto-fill series:", error);
    throw new Error("Failed to auto-fill series data");
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

export async function refineContentPillarAction(
  narrativeId: string,
  pillarId: string,
  feedback: string
) {
  try {
    // 1. Fetch Narrative Context
    const narrativeData = await adminDb.query({
      narratives: {
        $: { where: { id: narrativeId } },
      },
    });
    const narrative = (narrativeData as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    // 2. Fetch Pillar
    const pillarData = await adminDb.query({
      contentPillars: {
        $: { where: { id: pillarId } },
      },
    });
    const pillar = (pillarData as any).contentPillars?.[0];
    if (!pillar) throw new Error("Pillar not found");

    // 3. Refine via AI
    const history = (narrative.contentHistory || [])
      .slice(-10)
      .map((h: any) => `- ${h.title}: ${h.hook}`)
      .join("\n");

    const refined = await refineContentPillar(
      {
        audience: narrative.audience,
        currentState: narrative.currentState,
        problem: narrative.problem,
        costOfInaction: narrative.costOfInaction,
        solution: narrative.solution,
        afterState: narrative.afterState,
        identityShift: narrative.identityShift,
        voice: narrative.voice,
      },
      {
        title: pillar.title,
        description: pillar.description,
        angles: pillar.angles,
      },
      feedback,
      history
    );

    // 4. Update DB
    await adminDb.transact([
      adminDb.tx.contentPillars[pillarId].update({
        title: refined.title,
        description: refined.description,
        angles: refined.angles,
        updatedAt: Date.now(),
      }),
    ]);

    // 5. EVOLVE THE NARRATIVE BRAIN based on feedback
    try {
      const currentNarrative: NarrativeInput = {
        audience: narrative.audience,
        currentState: narrative.currentState,
        problem: narrative.problem,
        costOfInaction: narrative.costOfInaction,
        solution: narrative.solution,
        afterState: narrative.afterState,
        identityShift: narrative.identityShift,
        voice: narrative.voice,
      };

      const evolved = await evolveNarrative(currentNarrative, feedback);
      
      await adminDb.transact([
        adminDb.tx.narratives[narrativeId].update({
          ...evolved,
          updatedAt: Date.now(),
        })
      ]);
      console.log("🧠 Narrative Brain evolved based on pillar refinement feedback.");
    } catch (evoError) {
      console.error("Evolution semi-failure (non-blocking):", evoError);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to refine content pillar:", error);
    throw new Error(error.message || "Failed to refine pillar");
  }
}

export async function refineFullContentEngineAction(
  narrativeId: string,
  feedback: string,
  ownerId: string
) {
  try {
    // 1. Fetch Narrative Brain
    const narrativeData = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative = (narrativeData as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    const contentHistory = (narrative.contentHistory || [])
      .slice(-15)
      .map((h: any) => `${h.title}: ${h.hook}`)
      .join("\n");

    const currentNarrativeInput: NarrativeInput = {
      audience: narrative.audience || "",
      currentState: narrative.currentState || "",
      problem: narrative.problem || "",
      costOfInaction: narrative.costOfInaction || "",
      solution: narrative.solution || "",
      afterState: narrative.afterState || "",
      identityShift: narrative.identityShift || "",
      voice: narrative.voice || "calm",
    };

    // 2. Snaphot current state for rollback
    const existingPillars = await adminDb.query({
      contentPillars: { $: { where: { narrative: narrativeId } } }
    });
    
    const pillarsToSnapshot = (existingPillars as any).contentPillars.map((p: any) => ({
      title: p.title,
      description: p.description,
      angles: p.angles
    }));

    const snapshot = {
      timestamp: Date.now(),
      narrative: currentNarrativeInput,
      pillars: pillarsToSnapshot,
      feedback: feedback
    };

    const updatedVersions = [snapshot, ...(narrative.versions || [])].slice(0, 3);

    const deleteOps = (existingPillars as any).contentPillars.map((p: any) => 
      adminDb.tx.contentPillars[p.id].delete()
    );

    // 3. AI Refinement (Narrative + New Pillars)
    const result = await refineFullStrategy(currentNarrativeInput, feedback, contentHistory);

    // 4. Batch Updates
    const createOps = result.pillars.map(p => {
      const pillarId = id();
      return adminDb.tx.contentPillars[pillarId].set({
        userId: ownerId,
        narrativeId,
        status: "active",
        createdAt: Date.now(),
        ...p
      }).link({ narrative: narrativeId });
    });

    await adminDb.transact([
      ...deleteOps,
      ...createOps,
      adminDb.tx.narratives[narrativeId].update({
        ...result.narrative,
        versions: updatedVersions,
        updatedAt: Date.now()
      })
    ]);

    console.log("🚀 Global Strategy Refined: Brain Evolved + Pillars Regenerated.");
    return { success: true };

  } catch (error: any) {
    console.error("Failed to refine full strategy:", error);
    throw new Error(error.message || "Failed to refine full strategy");
  }
}

export async function rollbackNarrativeAction(
  narrativeId: string,
  versionIndex: number,
  ownerId: string
) {
  try {
    // 1. Fetch Narrative Brain
    const narrativeData = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative = (narrativeData as any).narratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

    const versions = narrative.versions || [];
    const targetVersion = versions[versionIndex];
    if (!targetVersion) throw new Error("Version not found");

    // 2. Clear existing pillars
    const existingPillars = await adminDb.query({
      contentPillars: { $: { where: { narrative: narrativeId } } }
    });
    
    const deleteOps = (existingPillars as any).contentPillars.map((p: any) => 
      adminDb.tx.contentPillars[p.id].delete()
    );

    // 3. Restore pillars from snapshot
    const createOps = targetVersion.pillars.map((p: any) => {
      const pillarId = id();
      return adminDb.tx.contentPillars[pillarId].set({
        userId: ownerId,
        narrativeId,
        status: "active",
        createdAt: Date.now(),
        ...p
      }).link({ narrative: narrativeId });
    });

    // 4. Update versions array (remove the one we rolled back to, or just leave it?)
    // Usually, rolling back to 'v1' means v1 becomes current, and we might want to keep the "bad" version as a snapshot too.
    // For simplicity, let's just restore and remove that version from the array.
    const updatedVersions = versions.filter((_: any, i: number) => i !== versionIndex);

    await adminDb.transact([
      ...deleteOps,
      ...createOps,
      adminDb.tx.narratives[narrativeId].update({
        ...targetVersion.narrative,
        versions: updatedVersions,
        updatedAt: Date.now()
      })
    ]);

    console.log("⏪ Rollback Successful: Strategy restored to version from ", new Date(targetVersion.timestamp).toLocaleString());
    return { success: true };

  } catch (error: any) {
    console.error("Rollback failed:", error);
    throw new Error(error.message || "Rollback failed");
  }
}

export async function generateSeasonPlotAction(seriesNarrativeId: string, episodeCount: number = 3): Promise<string> {
  try {
    const data = await adminDb.query({
      seriesNarratives: { $: { where: { id: seriesNarrativeId } } }
    });
    const narrative = (data as any).seriesNarratives?.[0];
    if (!narrative) throw new Error("Narrative not found");

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

    return await generateSeriesSeasonPlot(input, episodeCount);
  } catch (error: any) {
    console.error("Failed to generate season plot:", error);
    throw new Error(error.message || "Failed to generate season plot");
  }
}

export async function getLiveConfigAction() {
  return {
    apiKey: process.env.GEMINI_API_KEY || "",
  };
}

export async function getDirectorPromptAction(type: 'narrative' | 'series', id: string) {
  try {
    const data = await adminDb.query({
      [type === 'narrative' ? 'narratives' : 'seriesNarratives']: { $: { where: { id } } }
    });
    const narrative = (data as any)[type === 'narrative' ? 'narratives' : 'seriesNarratives']?.[0];

    if (!narrative) return "You are a Brand Brainstorming Director. Help the user clarify their strategy.";

    const context = type === 'narrative' 
      ? `Brand: ${narrative.title}. Audience: ${narrative.audience}. Core Message: ${narrative.coreMessage}.`
      : `Series: ${narrative.title}. Logline: ${narrative.logline}. Theme: ${narrative.centralTheme}.`;

    return `You are the Brainstorming Director for a high-end marketing agency. 
Your goal is to talk with the user and help them refine their ${type}.
Current Context: ${context}

Be encouraging, critical but constructive, and always try to find the "villain" and "hero" in every story. 
Keep your responses concise and conversational (since this is a voice interaction).`;
  } catch (err) {
    return "You are a Brand Brainstorming Director. Help the user clarify their strategy.";
  }
}
