import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/firebase-admin";
import { readFile } from "fs/promises";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// HEAD handler for asset verification (lightweight check without downloading full asset)
export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const storagePath = searchParams.get("path");

  if (!imageUrl && !storagePath) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    let targetUrl = imageUrl;

    if (storagePath) {
      try {
        const storage = (db as any).storage;
          if (storage?.getDownloadUrl) {
            const result = await storage.getDownloadUrl(storagePath);
            if (result) {
              targetUrl = typeof result === 'string' ? result : result.url || result.data || result.signedUrl;
              console.log(`[HEAD Proxy] Got signed URL for ${storagePath}: ${targetUrl ? 'YES' : 'NO'}`);
            } else {
              console.log(`[HEAD Proxy] getDownloadUrl returned null for ${storagePath}`);
            }
          }
      } catch (e) {
        console.log("❌ [HEAD Proxy] Admin SDK resolution failed:", e);
      }

      if (!targetUrl || typeof targetUrl !== 'string') {
        if (STORAGE_BUCKET) {
          targetUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
          console.log(`[HEAD Proxy] Fallback to Firebase Storage URL`);
        } else {
          console.log(`[HEAD Proxy] No storage bucket configured`);
          return new NextResponse(null, { status: 404 });
        }
      }
    }

    if (!targetUrl) {
      console.log("[HEAD Proxy] No target URL found");
      return new NextResponse(null, { status: 404 });
    }

    // Make GET request with Range header (workaround for S3 signed URLs that reject HEAD)
    console.log(`[HEAD Proxy] Checking via GET (byte 0): ${targetUrl.substring(0, 100)}...`);
    const response = await fetch(targetUrl, { 
        method: "GET",
        headers: { "Range": "bytes=0-0" }
    });
    console.log(`[HEAD Proxy] Response: ${response.status} ${response.statusText}`);

    if (response.ok || response.status === 206) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        }
      });
    }

    return new NextResponse(null, { status: response.status });
  } catch (error) {
    console.error("[HEAD Proxy] Error:", error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const storagePath = searchParams.get("path");

  if (!imageUrl && !storagePath) {
    return NextResponse.json({ error: "Missing url or path parameter" }, { status: 400 });
  }

  try {
    let targetUrl = imageUrl;

    // --- NEW: Support serving local temp files via HTTP ---
    // This allows Remotion's headless browser to access local assets that would 
    // otherwise be blocked by the file:// protocol security restrictions.
    if (storagePath && (storagePath.startsWith('/') || storagePath.startsWith('file:'))) {
        const cleanPath = storagePath.replace("file://", "");
        if (cleanPath.startsWith("/tmp/") || cleanPath.startsWith("/var/")) {
            console.log(`[Proxy GET] Serving local file: ${cleanPath}`);
            try {
                const buffer = await readFile(cleanPath);
                
                // Basic MIME type detection based on extension
                let contentType = "image/png";
                if (cleanPath.toLowerCase().endsWith(".mp3")) contentType = "audio/mpeg";
                if (cleanPath.toLowerCase().endsWith(".mp4")) contentType = "video/mp4";
                if (cleanPath.toLowerCase().endsWith(".jpg") || cleanPath.toLowerCase().endsWith(".jpeg")) contentType = "image/jpeg";
                if (cleanPath.toLowerCase().endsWith(".gif")) contentType = "image/gif";
                
                return new NextResponse(buffer, {
                    status: 200,
                    headers: {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=31536000, immutable",
                        "Access-Control-Allow-Origin": "*"
                    }
                });
            } catch (readErr) {
                console.error(`[Proxy GET] Local file read error: ${cleanPath}`, readErr);
                // Fall through to Firebase logic if it's not actually a local path or doesn't exist
            }
        }
    }

    // If it's a storage path, resolve it via Firebase Admin SDK
    if (storagePath) {
        try {
          const storage = (db as any).storage;
          if (storage?.getDownloadUrl) {
            const result = await storage.getDownloadUrl(storagePath);
            if (result) {
               targetUrl = typeof result === 'string' ? result : result.url || result.data || result.signedUrl;
            }
          }
        } catch (e) {
            console.warn("Proxy resolution error:", e);
        }

        // Fallback to direct Firebase Storage URL
        if (!targetUrl || typeof targetUrl !== 'string') {
            if (STORAGE_BUCKET) {
              targetUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
            }
        }
    }

    if (!targetUrl) throw new Error("Could not resolve target URL");

    // Fetch the image from the target URL
    console.log(`[Proxy GET] Fetching: ${storagePath || imageUrl} → ${targetUrl.substring(0, 120)}...`);
    const response = await fetch(targetUrl);

    if (!response.ok) {
        console.error(`[Proxy GET] Upstream ${response.status} for path: ${storagePath || imageUrl}`);
        throw new Error(`Failed to fetch upstream: ${response.status}`);
    }

    // Stream the response back to the client
    // This allows the browser to see the request as same-origin (no CORS issues)
    const headers = new Headers(response.headers);
    
    // Ensure we set correct CORS headers for the client
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    
    // Remove headers that might cause issues
    headers.delete("Content-Encoding");
    headers.delete("Content-Length"); // Let the stream handle it

    return new NextResponse(response.body, {
        status: 200,
        headers
    });

  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
