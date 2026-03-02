import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { canUserGenerate } from "@/lib/pricing";
import { startOfMonth } from "date-fns";
import type { Scene, User, VideoPlanWithOwner } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { wrapWithStyleConstraint } from "@/lib/constants";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!; 



export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();
    if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

    console.log(`Generating images for plan: ${planId}`);

    // Fetch Plan using Admin SDK
        const queryResult = await adminDb.query({
            videoPlans: {
                $: { where: { id: planId } },
                owner: {},
            },
        });

        const plan = queryResult.videoPlans?.[0] as VideoPlanWithOwner | undefined;

    if (!plan) {
        console.error("Plan not found via Admin SDK");
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // --- Usage Check with Monthly Reset ---
    const owner: User | undefined = plan.owner?.[0]; // Admin SDK returns joined entities as arrays
    if (owner) {
        const currentMonthStartUTC = startOfMonth(new Date()).getTime();
        
        // Check if we need to reset monthly counter
        const needsReset = (owner.generationResetDate ?? 0) < currentMonthStartUTC;
        
        if (needsReset) {
            // Reset monthly counter for new month
            await adminDb.transact([
                adminDb.tx.$users[owner.id].update({
                    monthlyGenerations: 0,
                    generationResetDate: currentMonthStartUTC,
                }),
            ]);
            owner.monthlyGenerations = 0;
            owner.generationResetDate = currentMonthStartUTC;
        }
        
        const usageCount = owner.monthlyGenerations ?? 0;
        
        if (!canUserGenerate(owner.planId as string, usageCount)) {
            return NextResponse.json({ 
                error: "Limit Reached", 
                message: "You have reached your monthly video generation limit.",
                limitReached: true 
            }, { status: 403 });
        }
    }
    // --- End Usage Check ---

    // Identify scenes needing images
    // We work with a local copy that we update incrementally
    const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];
    
    // Find indices that need images
    const scenesToGenerate: number[] = [];
    updatedScenes.forEach((scene, index) => {
        // If image is present (un-null), it's considered done.
        // We support data URIs, HTTP URLs, and relative Storage Paths.
        const hasValidImage = !!scene.imageUrl;
        
        if (!hasValidImage) {
            scenesToGenerate.push(index);
        }
    });

    if (scenesToGenerate.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: "No images needed" });
    }

    console.log(`Generating images for scenes: ${scenesToGenerate.join(', ')}`);

    // Process in parallel for massive speed improvement (150s -> 30s for 5 scenes)
    // Initialize Google GenAI Client
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Aspect ratio based on plan type
    const aspectRatio = plan.type === "carousel" ? "1:1" : "9:16";

    // Generate all images in parallel
    const imageGenerationPromises = scenesToGenerate.map(async (index) => {
        const scene = updatedScenes[index];

        console.log(`[Parallel] Starting image generation for scene ${index}...`);

        // Retry loop for robustness
        let attempts = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                // Enforce style constraint on every prompt
                const sceneContent = plan.visualConsistency
                    ? `Visual Style Guide: ${plan.visualConsistency}\n\nScene Prompt: ${scene.visualPrompt}`
                    : scene.visualPrompt;
                const styleEnforcedPrompt = wrapWithStyleConstraint(sceneContent);

                const response = await ai.models.generateContent({
                    model: "gemini-3-pro-image-preview",
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: styleEnforcedPrompt }]
                        }
                    ],
                    config: {
                         responseModalities: ["IMAGE"],
                         imageConfig: {
                            aspectRatio: aspectRatio,
                            imageSize: "2K"
                         }
                    }
                });

                // The SDK response structure for images:
                // candidates[0].content.parts[].inlineData
                const candidate = response.candidates?.[0];
                if (!candidate) throw new Error("No candidates returned");

                let base64Image: string | null = null;

                for (const part of candidate.content?.parts || []) {
                    if (part.inlineData && part.inlineData.data) {
                        base64Image = part.inlineData.data;
                        break;
                    }
                }

                if (!base64Image) {
                     throw new Error("No image data found in response");
                }

                // Log base64 image length
                console.log(`[Gemini] base64Image length for scene ${index}:`, base64Image.length);

                // Upload logic
                const fileName = `generated/${planId}/${index}-${Date.now()}.png`;
                const buffer = Buffer.from(base64Image, 'base64');
                // Log buffer size
                console.log(`[Gemini] buffer size for scene ${index}:`, buffer.length);

                // TODO: Migrate to Firebase Storage
                // Using data URLs temporarily
                const dataUrl = `data:image/png;base64,${base64Image}`;
                let storagePath = dataUrl;
                const publicUrl = dataUrl;
                let fetchOk = true;
                for (let checkAttempt = 1; checkAttempt <= 3; checkAttempt++) {
                    try {
                        const resp = await fetch(publicUrl);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            if (blob && blob.size > 0) {
                                fetchOk = true;
                                break;
                            } else {
                                console.warn(`[Parallel] Post-upload check: empty blob for ${publicUrl}, attempt ${checkAttempt}`);
                            }
                        } else {
                            console.warn(`[Parallel] Post-upload check: fetch failed for ${publicUrl}, status ${resp.status}, attempt ${checkAttempt}`);
                        }
                    } catch (fetchErr) {
                        console.error(`[Parallel] Post-upload fetch error for ${publicUrl}, attempt ${checkAttempt}:`, fetchErr);
                    }
                    // Wait before retrying
                    await new Promise(r => setTimeout(r, 1000 * checkAttempt));
                }
                if (!fetchOk) {
                    throw new Error(`Image not available after upload: ${publicUrl}`);
                }

                scene.imageUrl = storagePath;

                // SAVE INCREMENTALLY (per scene, for progress visibility)
                await adminDb.transact([
                    adminDb.tx.videoPlans[planId].update({ scenes: updatedScenes })
                ]);

                console.log(`[Parallel] ✅ Success & Saved: Scene ${index}`);
                success = true;
                return { index, success: true };

            } catch (apiErr: unknown) {
                console.error(`[Parallel] Attempt ${attempts} failed for scene ${index}:`, apiErr);
                 if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 2000 * attempts));
            }
        }

        if (!success) {
            console.error(`[Parallel] ❌ Failed to generate image for scene ${index} after ${maxAttempts} attempts.`);
            return { index, success: false, error: "Max attempts exceeded" };
        }

        return { index, success: true };
    });

    // Wait for all images to complete
    const results = await Promise.allSettled(imageGenerationPromises);

    // Log summary
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.length - successCount;
    console.log(`[Parallel] Image generation complete: ${successCount} succeeded, ${failCount} failed`);

    // Note: Individual scenes are saved incrementally, so DB already has latest state

    return NextResponse.json({ success: true, count: scenesToGenerate.length });

    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("Generation error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
