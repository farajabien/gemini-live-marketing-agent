import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import type { Scene, VideoPlanWithOwner, VoiceTone } from "@/lib/types";
import { getErrorMessage } from "@/lib/types";
import { enhanceWithSSMLPauses, getTTSSettingsForTone, tidyPunctuation } from "@/lib/ai/verbatim";
import { generateGeminiTTS, GeminiVoiceName } from "@/lib/ai/gemini-tts";
import { withRetry } from "@/lib/ai/retry";

// Initialize Admin SDK
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_TOKEN = process.env.INSTANT_APP_ADMIN_TOKEN!;

if (!APP_ID || !ADMIN_TOKEN) {
  throw new Error("Missing InstantDB Environment Variables for Admin SDK");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN,
});

// Default voice if none specified
const DEFAULT_VOICE_ID = "Zephyr"; // Gemini Woman Voice

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized: Missing or invalid token" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    // DEBUG: Log token info
    console.log("[DEBUG] Audio API auth check:", {
      authHeader: authHeader.substring(0, 20) + "...",
      token: token?.substring(0, 20) + "...",
      tokenType: typeof token,
      tokenLength: token?.length,
      isUndefined: token === undefined,
      isNull: token === null
    });

    // Verify the token with InstantDB
    const authUser = await db.auth.verifyToken(token);
    if (!authUser || !authUser.id) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    const userId = authUser.id;

    const { planId } = await request.json();
    if (!planId) {
      return NextResponse.json({ error: "Missing planId" }, { status: 400 });
    }

    console.log(`Generating audio for plan: ${planId} (requested by ${userId})`);

    // Fetch Plan using Admin SDK
    const queryResult = await db.query({
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

    // Security check: ensure the authenticated user owns this plan
    const planOwnerId = plan.owner?.[0]?.id;
    if (planOwnerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You do not own this plan" }, { status: 403 });
    }

    // NOTE: No usage/quota check here - that's enforced at video plan creation.
    // Audio generation is just completing an already-approved plan.

    // Get voice ID from plan or use default
    const voiceId = plan.voiceId || DEFAULT_VOICE_ID;
    console.log(`Using voice ID: ${voiceId}`);

    // Check if verbatim mode is enabled
    const isVerbatimMode = (plan as VideoPlanWithOwner & { verbatimMode?: boolean }).verbatimMode === true;
    const verbatimTone = ((plan as VideoPlanWithOwner & { verbatimTone?: VoiceTone }).verbatimTone) || "neutral";
    
    if (isVerbatimMode) {
      console.log(`Verbatim mode enabled with tone: ${verbatimTone}`);
    }

    // SKIP Audio for "text_motion" mode (Silent Mode)
    // "gif_voice" mode WILL proceed to generate audio as normal
    if (plan.visualMode === 'text_motion') {
         console.log("Visual mode is 'text_motion' (Silent). Skipping audio generation.");
         return NextResponse.json({ success: true, skipped: true });
    }

    // ============================================================================
    // PARALLEL AUDIO GENERATION (Optimized for Speed)
    // ============================================================================
    
    const updatedScenes: Scene[] = [...(plan.scenes as Scene[])];
    let hasUpdates = false;
   
    /**
     * Generate audio for a single scene with caching and error handling
     */
    async function generateSingleSceneAudio(
      scene: Scene,
      index: number,
      voiceId: string,
      isVerbatimMode: boolean,
      verbatimTone: VoiceTone
    ): Promise<Scene> {
      // Skip if audio already exists
      if (scene.audioUrl) {
        console.log(`Scene ${index} already has audio, skipping...`);
        return scene;
      }

      try {
        // Prepare the text for TTS
        let textForTTS = scene.voiceover;
        textForTTS = tidyPunctuation(textForTTS);
        if (isVerbatimMode || scene.isVerbatimLocked) {
          textForTTS = enhanceWithSSMLPauses(textForTTS);
        }
        
        // --- COMPUTING PERMANENT CACHE KEY ---
        const { createHash } = await import('crypto');
        const cacheKeyInput = `${textForTTS.trim().toLowerCase()}-${voiceId}-${isVerbatimMode ? verbatimTone : 'neutral'}`;
        const cacheHash = createHash('sha256').update(cacheKeyInput).digest('hex');
        
        // Determine extension
        const fileExtension = 'wav';
        const cacheFileName = `audio-cache/${cacheHash}.${fileExtension}`;
        
        console.log(`[Audio ${index}] Processing - Hash: ${cacheHash.substring(0, 8)}...`);

        // --- 1. CHECK CACHE IN STORAGE ---
        let cachedUrl: string | null = null;
        try {
           const adminDb = db as unknown as { storage?: { getDownloadUrl: (path: string) => Promise<string | { url?: string; data?: string; signedUrl?: string }> } };
           if (adminDb.storage && adminDb.storage.getDownloadUrl) {
               const result = await adminDb.storage.getDownloadUrl(cacheFileName);
               if (result) {
                   const urlResult = typeof result === 'string' ? result : (result.url || result.data || result.signedUrl || null);
                   cachedUrl = urlResult || null;
               }
           }
        } catch (_cacheErr) {
            // Ignore cache read errors, proceed to generation
        }

        if (cachedUrl) {
            console.log(`[Audio ${index}] ✅ Cache HIT. Using existing audio.`);
            scene.audioUrl = cachedUrl;
            return scene;
        }
        
        console.log(`[Audio ${index}] ❌ Cache MISS. Generating new audio...`);
        
        let buffer: Buffer | null = null;
        const cleanVoiceId = voiceId.replace(" (Gemini)", "");

        // Generate audio with retry logic for rate limiting
        buffer = await withRetry(async () => {
            console.log(`[Audio ${index}] Using Gemini TTS with voice: ${cleanVoiceId}`);
            const result = await generateGeminiTTS({
               text: textForTTS,
               voiceName: cleanVoiceId as GeminiVoiceName,
            });
            console.log(`[Audio ${index}] Gemini buffer size: ${result?.length} bytes`);
            return result;
        });
        
        if (!buffer) {
          scene.audioUrl = undefined;
          return scene;
        }

        // --- CALCULATE ACTUAL AUDIO DURATION ---
        try {
          const { parseBuffer } = await import('music-metadata');
          const mimeType = 'audio/wav';
          
          console.log(`[Audio ${index}] Parsing buffer (${buffer.length} bytes, ${mimeType})`);
          const metadata = await parseBuffer(buffer, { mimeType });
          const actualDuration = metadata.format.duration;
          
          if (actualDuration && actualDuration > 0) {
            // Use actual duration rounded to 2 decimal places
            const newDuration = Math.round(actualDuration * 100) / 100;
            const originalDuration = scene.duration;
            scene.duration = newDuration;
            
            console.log(`[Audio ${index}] Duration: ${originalDuration}s → ${newDuration}s (actual: ${actualDuration.toFixed(4)}s)`);
          } else {
            console.warn(`[Audio ${index}] Invalid duration from metadata: ${actualDuration}`);
            scene.duration = scene.duration || 5;
          }
        } catch (durationErr) {
          console.error(`[Audio ${index}] Duration calculation failed:`, durationErr);
          scene.duration = scene.duration || 5;
        }

        // --- 2. UPLOAD TO STORAGE FOR PERSISTENCE ---
        try {
            const adminDb = db as unknown as { storage?: { uploadFile: (path: string, buffer: Buffer, options: { contentType: string }) => Promise<unknown>; getDownloadUrl: (path: string) => Promise<string | { url?: string; data?: string; signedUrl?: string }> } };
            if (adminDb.storage && adminDb.storage.uploadFile) {
                const contentType = "audio/wav";
                console.log(`[Audio ${index}] Uploading to cache: ${cacheFileName}`);
                await adminDb.storage.uploadFile(cacheFileName, buffer, { contentType });
                
                const cacheResult = await adminDb.storage.getDownloadUrl(cacheFileName);
                const newCachedUrl = typeof cacheResult === 'string' ? cacheResult : (cacheResult?.url || cacheResult?.data || cacheResult?.signedUrl || null);
                
                if (newCachedUrl) {
                    scene.audioUrl = newCachedUrl;
                    console.log(`[Audio ${index}] ✅ Stored and linked cached audio`);
                } else {
                    throw new Error("Upload verification failed");
                }
            } else {
                throw new Error("Storage SDK not available");
            }
        } catch (uploadOrStorageErr) {
            console.warn(`[Audio ${index}] Storage upload failed, falling back to Data URI:`, uploadOrStorageErr);
            
            // FALLBACK: Data URI
            let mimeType = "audio/mpeg"; 
            if (buffer.subarray(0, 4).toString() === "RIFF") {
                mimeType = "audio/wav"; 
            }
            const base64Audio = buffer.toString("base64");
            scene.audioUrl = `data:${mimeType};base64,${base64Audio}`;
        }
        
        return scene;
        
      } catch (audioError: unknown) {
        console.error(`[Audio ${index}] Failed to generate audio:`, audioError);
        scene.audioUrl = undefined;
        return scene;
      }
    }

    // ============================================================================
    // PARALLEL EXECUTION
    // ============================================================================
    
    const startTime = Date.now();
    console.log(`[Audio] Starting parallel generation for ${updatedScenes.length} scenes...`);
    
    // Create promises for all scenes
    const audioPromises = updatedScenes.map((scene, index) =>
      generateSingleSceneAudio(scene, index, voiceId, isVerbatimMode, verbatimTone)
    );

    // Execute all in parallel
    const results = await Promise.allSettled(audioPromises);
    
    // Process results  
    let successCount = 0;
    let failureCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        updatedScenes[index] = result.value;
        if (result.value.audioUrl) {
          successCount++;
          hasUpdates = true;
        }
      } else {
        failureCount++;
        const reason = result.reason;
        console.error(`[Audio] Scene ${index} failed:`, reason);
        // Check if this was a rate limit error
        if (reason?.status === 429 || reason?.code === 429) {
          (global as any).lastGenerateAudioError = 429;
        }
      }
    });
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Audio] ✅ Parallel generation complete in ${totalTime}s`);
    console.log(`[Audio] Success: ${successCount}/${updatedScenes.length}, Failures: ${failureCount}`);

    // If we have failures and one of them was a 429, signal it to the frontend
    if (failureCount > 0 && (global as any).lastGenerateAudioError === 429) {
      delete (global as any).lastGenerateAudioError;
      return NextResponse.json({ 
        error: "Gemini Quota Exhausted", 
        rateLimited: true 
      }, { status: 429 });
    }


    // Check if ALL scenes now have audio
    const allAudioDone = updatedScenes.every((s) => !!s.audioUrl);

    // Update status based on completion
    // Don't jump straight to "completed" - let SuccessScreen orchestrate that
    if (hasUpdates || allAudioDone) {
      const newStatus = allAudioDone ? "audio_ready" : "generating_audio";
      
      await db.transact([
          db.tx.videoPlans[planId].update({ 
              scenes: updatedScenes,
              status: newStatus
            })
      ]);
      console.log(`Plan updated with audio. Status: ${newStatus}`);
    } else {
      console.log("No new audio needed - all scenes already have audio.");
    }

    return NextResponse.json({
      success: true,
      scenes: updatedScenes,
      voiceUsed: voiceId,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Audio generation error:", error);
    return NextResponse.json(
      { error: message || "Audio generation failed" },
      { status: 500 }
    );
  }
}
