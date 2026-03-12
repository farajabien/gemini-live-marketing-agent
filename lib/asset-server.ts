/**
 * Lightweight HTTP server for serving local temp files during Remotion render.
 * Bypasses Next.js proxy to avoid contention and "server sent no data" timeouts.
 */

import { createServer } from "http";
import { readFile } from "fs/promises";
import { join } from "path";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

export async function createAssetServer(
  dirPath: string
): Promise<{ url: string; close: () => void }> {
  const server = createServer(async (req, res) => {
    const pathname = req.url?.split("?")[0] ?? "/";
    const filename = pathname.slice(1);
    if (!filename || filename.includes("..") || filename.includes("/")) {
      res.writeHead(400);
      res.end("Invalid path");
      return;
    }
    const filePath = join(dirPath, filename);
    try {
      const buf = await readFile(filePath);
      const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
      const contentType = MIME[ext] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}`;
      resolve({
        url,
        close: () => server.close(),
      });
    });
  });
}
