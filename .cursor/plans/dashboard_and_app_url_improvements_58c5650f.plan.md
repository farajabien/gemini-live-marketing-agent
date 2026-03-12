---
name: Dashboard and App URL Improvements
overview: Address dashboard redundancies (duplicate "All Media" filters), centralize app URL via env variable, ensure series background navigation works, and investigate/fix narrative route showing homepage content.
todos: []
isProject: false
---

# Dashboard Improvements, App URL Env, Series BG Nav, and Narrative Route Fix

## 1. Dashboard Redundancies

**Issue:** The Media tab shows two dropdowns that both display "All Media" with the same count (6), causing visual redundancy.

**Root cause:** In [components/screens/DashboardScreen.tsx](components/screens/DashboardScreen.tsx), there are two separate filters:

- **Context filter** (lines 515-546): "All Media" | "Projects" | "Series" - controls _what_ to show
- **Format filter** (lines 547-570): "All Media" | "video" | "carousel" | "series" - controls _format_ within context

When `mediaContextFilter === "all"`, both dropdowns show "All Media" as their first option with identical counts.

**Proposed changes:**

- **Rename labels** to reduce confusion: Context filter options → "All" | "Projects Only" | "Series Only" (or keep "All Media" but make the format filter's first option "All Formats" instead of "All Media")
- **Simplify format filter** when context is "all": The format filter's first option could be "All Formats" to distinguish from the context filter's "All Media"
- **Consider merging** into a single, two-dimensional filter if UX allows (e.g. "All · All Formats" vs "Projects · Video")

---

## 2. App URL Environment Variable

**Current state:** `NEXT_PUBLIC_APP_URL` exists in [remotion/Scene.tsx](remotion/Scene.tsx) and [lib/verify-assets.ts](lib/verify-assets.ts), but is not documented in `.env.example` and is hardcoded as `"http://localhost:3000"` in several places.

**Locations to standardize:**

| File                                                                                         | Current                                  | Change                                                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| [remotion/Scene.tsx](remotion/Scene.tsx) (lines 99-100, 109)                                 | `process.env.NEXT_PUBLIC_APP_URL         |                                                                                                               | "http://localhost:3000"` | Keep; ensure env is set      |
| [lib/verify-assets.ts](lib/verify-assets.ts) (line 23)                                       | `process.env.NEXT_PUBLIC_APP_URL!`       | Already uses env                                                                                              |
| [app/api/orchestrate-generation/route.ts](app/api/orchestrate-generation/route.ts) (line 61) | `request.nextUrl.origin`                 | Consider `process.env.NEXT_PUBLIC_APP_URL` for server-side API calls when origin may differ (e.g. serverless) |
| [components/GenerationStatusToast.tsx](components/GenerationStatusToast.tsx) (line 117)      | `window.location.href = \`/success?... ` | Uses relative path; no change needed                                                                          |                          | [.env.example](.env.example) | Missing | Add`NEXT_PUBLIC_APP_URL=[[http://localhost:3000`](http://localhost:3000`)](http://localhost:3000`](http://localhost:3000`)) |

**Plan:**

- Add `NEXT_PUBLIC_APP_URL` to `.env.example` with a comment for production (e.g. `https://your-app.vercel.app`)
- Create a shared util `lib/app-url.ts` that exports `getAppUrl()` returning `process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")` for client/server consistency
- Update [remotion/Scene.tsx](remotion/Scene.tsx) and [lib/verify-assets.ts](lib/verify-assets.ts) to use the util
- For [app/api/orchestrate-generation/route.ts](app/api/orchestrate-generation/route.ts): use `NEXT_PUBLIC_APP_URL` when available, else fall back to `request.nextUrl.origin` (for serverless where request origin may be a CDN)

---

## 3. Series Background Navigation

**Current behavior:**

- [components/series/ProductionOverlay.tsx](components/series/ProductionOverlay.tsx) shows "Safe to leave – generation continues in the background"
- [components/GenerationStatusToast.tsx](components/GenerationStatusToast.tsx) renders a floating pill that links to `/series/${episode.seriesId}` when the active plan belongs to a series (lines 38-39, 131-139)

**Verification / improvements:**

- The FAB already uses `<a href={destination}>` and navigates to the series page for series plans
- Ensure the FAB is visible and clickable when user navigates away from the series page during generation
- Add `Link` from Next.js for client-side navigation (faster) instead of full page reload via `<a href>`
- Consider making the ProductionOverlay's "Safe to leave" text a link to the series page so users can navigate without closing the overlay

---

## 4. Narrative Route Showing Homepage Content

**Reported issue:** Visiting `/narrative/{id}` sometimes shows the generic landing page ("Operationalize Your Positioning with AI") instead of narrative-specific content.

**App structure (verified):**

```
app/
├── page.tsx                    → LandingPageContent (homepage)
├── layout.tsx                  → Root layout
├── dashboard/
│   ├── layout.tsx              → AppLayout (no narrativeId)
│   └── page.tsx                → DashboardScreen
├── narrative/
│   ├── [id]/
│   │   ├── layout.tsx          → AppLayout narrativeId={id}
│   │   ├── page.tsx            → NarrativeOverviewScreen
│   │   ├── engine/page.tsx     → NarrativeEngineScreen
│   │   └── drafts/page.tsx     → NarrativeDraftsScreen
```

**Routing is correct:** [app/narrative/[id]/page.tsx](app/narrative/[id]/page.tsx) renders `NarrativeOverviewScreen`. There is no middleware. `LandingPageContent` is only used in [app/page.tsx](app/page.tsx).

**Possible causes:**

1. **Auth / query timing:** [NarrativeOverviewScreen](components/narrative/NarrativeOverviewScreen.tsx) shows `AuthScreen` when `!user` and "Narrative not found" when `!narrative`. It does not render landing content.
2. **Client-side navigation bug:** Sidebar links use `router.push(\`/narrative/${n.id})`. Verify` n.id` is correct and not undefined.
3. **Wrong route in production:** Vercel rewrites, redirects, or caching could serve the wrong page. Check `vercel.json` and deployment config.
4. **Firestore query returning null:** If the narrative query returns no data (e.g. wrong `userId`, deleted narrative, or collection name mismatch), the user sees "Narrative not found" — not the landing page. The landing page content would only appear if the user were actually on `/`.

**Investigation steps:**

- Add a temporary `console.log` or visible debug banner in `NarrativeOverviewScreen` (e.g. "NarrativeOverviewScreen loaded for {narrativeId}") to confirm the correct component mounts
- Verify sidebar `CommandItem` for narratives: ensure `n.id` exists and the path is `/narrative/${n.id}` (see [AppLayout.tsx](components/AppLayout.tsx) around line 300)
- Check if authenticated users visiting `/` should be redirected to `/dashboard` — if so, add a redirect in [app/page.tsx](app/page.tsx) or a layout so logged-in users never see the landing page when they expect the app
- Review `vercel.json` and any redirects in the project

**Proposed fix (if redirect is desired):** In [app/page.tsx](app/page.tsx), add a server component that checks auth and redirects to `/dashboard` when the user is logged in. This would require passing auth state (e.g. via cookies or a server-side auth check) to the page.

---

## Implementation Order

1. **App URL env** — Add to `.env.example`, create `lib/app-url.ts`, update usages
2. **Dashboard Media filters** — Rename labels to remove "All Media" redundancy
3. **Series FAB** — Switch to `Link` for client-side nav; optionally add link in ProductionOverlay
4. **Narrative investigation** — Add debug, verify links, then implement redirect if needed
