
import { GiphyFetch } from "@giphy/js-fetch-api";

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

export interface GiphyResult {
  id: string;
  url: string; // MP4 url
  title: string;
  width: number;
  height: number;
}

export async function searchGiphy(query: string, limit = 1): Promise<GiphyResult[]> {
  if (!GIPHY_API_KEY) {
    console.error("Missing GIPHY_API_KEY");
    return [];
  }

  const gf = new GiphyFetch(GIPHY_API_KEY);

  try {
    async function fetchGiphy(q: string) {
        const result = await gf.search(q, {
            sort: 'relevant',
            lang: 'en',
            limit: limit,
            rating: 'g',
            type: 'gifs' // Explicitly fetch gifs, not stickers
        });
        return result;
    }

    let data;
    
    // 1. Try exact query
    try {
        data = await fetchGiphy(query);
    } catch (e) {
        console.warn(`[Giphy SDK] Search failed for "${query}"`, e);
        data = { data: [] };
    }

    // 2. Fallback: Check if empty and retry with cleaner query
    if (!data.data || data.data.length === 0) {
        // Remove content in parentheses e.g. "(not literal cars)"
        const cleaned = query.replace(/\([^)]*\)/g, "").trim();
        if (cleaned !== query && cleaned.length > 0) {
            console.log(`[Giphy] Retrying with cleaned query: "${cleaned}"`);
            try {
                data = await fetchGiphy(cleaned);
            } catch (e) {
                 console.warn(`[Giphy SDK] Cleaned search failed for "${cleaned}"`, e);
                 data = { data: [] };
            }
        }
    }

    // 3. Fallback: First 3 words + "aesthetic"
    if (!data.data || data.data.length === 0) {
        const words = query.split(" ").slice(0, 3).join(" ");
        const fallback = `${words} aesthetic`;
        console.log(`[Giphy] Retrying with fallback: "${fallback}"`);
        try {
            data = await fetchGiphy(fallback);
        } catch (e) {
             console.warn(`[Giphy SDK] Fallback search failed for "${fallback}"`, e);
             data = { data: [] };
        }
    }

    if (!data.data || data.data.length === 0) {
      console.warn("[Giphy SDK] No results found after all attempts.");
      return [];
    }

    return data.data.map((gif: any) => ({
      id: gif.id,
      // Prefer MP4 for Remotion performance
      url: gif.images?.original?.mp4 || gif.images?.downsized_small?.mp4 || gif.images?.original?.url, 
      title: gif.title,
      width: parseInt(gif.images?.original?.width || "0"),
      height: parseInt(gif.images?.original?.height || "0")
    }));

  } catch (error) {
    console.error("Giphy search failed:", error);
    return [];
  }
}
