export function getAppUrl(): string {
  // On the server, rely on NEXT_PUBLIC_APP_URL with a sensible fallback
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  // In the browser, prefer the configured env but fall back to current origin
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
}

