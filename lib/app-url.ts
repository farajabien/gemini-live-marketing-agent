export function getAppUrl(): string {
  // 1. Explicitly configured app URL (highest priority)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 2. Vercel deployment URL (useful for preview branches)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. Browser-side fallback to current origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 4. Server-side fallback to localhost
  return "http://localhost:3000";
}

