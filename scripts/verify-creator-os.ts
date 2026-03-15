import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeDraftNarrative, regeneratePositioning, updateNarrativeField } from "../app/actions/marketing";
import { adminDb } from "../lib/firebase-admin";

const TEST_USER_ID = "test-user-e2e";

async function verifyCreatorOSFlow() {
  console.log("\n--- 🚀 CREATOR OS E2E VERIFICATION ---");

  try {
    // 1. Initialize Project
    console.log("\n[1/4] Initializing new Project (War Room)...");
    const { narrativeId } = await initializeDraftNarrative(TEST_USER_ID);
    console.log(`✅ Project ID: ${narrativeId}`);

    // 2. Feed Strategic Data (Simulating User Chat/Inputs)
    console.log("\n[2/4] Feeding strategic context...");
    await updateNarrativeField(narrativeId, "audience", "Tech founders who are tired of generic AI videos", TEST_USER_ID);
    await updateNarrativeField(narrativeId, "problem", "AI videos feel soul-less and lack strategic depth", TEST_USER_ID);
    await updateNarrativeField(narrativeId, "solution", "IdeaToVideo: The OS that architects your brand before it renders a single frame", TEST_USER_ID);
    await updateNarrativeField(narrativeId, "identityShift", "From 'Video Producer' to 'Media CEO'", TEST_USER_ID);
    console.log("✅ Strategic DNA updated.");

    // 3. Trigger Synthesis
    console.log("\n[3/4] Triggering Strategic Synthesis (Brain Maturation)...");
    await regeneratePositioning(narrativeId, TEST_USER_ID);
    console.log("✅ Synthesis complete.");

    // 4. Final Verification
    console.log("\n[4/4] Verifying 'Total Capture' state...");
    const data = await adminDb.query({
      narratives: { $: { where: { id: narrativeId } } }
    });
    const narrative: any = data.narratives?.[0];

    if (!narrative) throw new Error("Narrative not found in database.");

    const score = Math.round(narrative.narrativeStrength?.overallScore || 0);
    const villain = narrative.aiPositioning?.villain;

    console.log("----------------------------------------");
    console.log(`📊 STRATEGIC HEALTH: ${score}%`);
    console.log(`🦹 IDENTIFIED VILLAIN: ${villain}`);
    console.log(`🎭 BRAND PROMISE: ${narrative.aiPositioning?.promise}`);
    console.log("----------------------------------------");

    if (score > 0 && villain) {
      console.log("\n🔥 E2E VERIFICATION SUCCESSFUL: Creator OS Pipeline is LIVE.");
    } else {
      console.error("\n⚠️ E2E VERIFICATION PARTIAL: Score or Villain missing.");
      process.exit(1);
    }

    // Cleanup (Optional)
    // await adminDb.tx.narratives[narrativeId].delete();

  } catch (error: any) {
    console.error("\n❌ E2E VERIFICATION FAILED:", error.message);
    process.exit(1);
  }

  process.exit(0);
}

verifyCreatorOSFlow();
