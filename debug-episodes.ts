import { adminDb } from "./lib/firebase-admin";

async function debugEpisodes() {
  const seriesId = "d0fcfbe6-6df1-4850-a2be-fc99032c44a6";
  console.log(`Checking episodes for series: ${seriesId}`);
  
  const results = await adminDb.query({
    episodes: { $: { where: { seriesId: seriesId } } }
  });
  
  console.log("Episodes found:", JSON.stringify(results.episodes, null, 2));
}

debugEpisodes().catch(console.error);
