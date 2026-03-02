# MyContext Vision Testing - Feedback & Feature Requests

**From:** IdeaToVideo Team (Gemini Live Marketing Agent)
**Date:** March 2, 2026
**Context:** Alpha testing the new Vision Testing System integration.

## 📋 Executive Summary
The architecture for the Vision Testing system (`VisionNavigatorAgent`, `VisualValidatorAgent`, etc.) and the gravity system is incredibly promising. However, we encountered immediate friction when trying to integrate and automate the testing flow using the CLI.

## 🎯 Top Issue: Non-Automatable Test Initialization

### The Problem
The `mycontext test:vision:init` command relies *exclusively* on an interactive TTY prompt (via generic prompt libraries). This causes two major issues:
1. **CI/CD & Agent Blockers:** When AI agents or CI pipelines attempt to pipe in responses (e.g., sending `\n` or `\r`), the prompt library often fails to register the 'Enter' keystroke, hanging the process indefinitely.
2. **Lack of CLI Flags:** Running `mycontext test:vision:init --name "Test"` resulted in an `error: unknown option '--name'`. A tool designed for automation currently cannot be automated itself.

### The Solution (Feature Request)
Implement standard CLI flags for the `init` command to bypass the interactive wizard entirely.

**Proposed Implementation:**
```bash
mycontext test:vision:init \
  --name "Production Login Test" \
  --mission "User should log in with email and password and see the dashboard" \
  --expected "User is logged in and dashboard is visible" \
  --url "http://localhost:3000/login" \
  --no-interactive
```

### Why This Matters
For AI coding assistants (like Gemini) and CI pipelines (like GitHub Actions), interactive prompts require complex terminal multiplexers or PTY wrappers to navigate reliably. Providing flag-based inputs ensures 100% reliability when generating tests programmatically.

## 💡 Additional Feedback on `mycontext doctor` & `sanitize`
- **Great Additions:** The `doctor` command correctly identified unused exports and components, which is very helpful for codebase sanitation.
- **Speed:** The checks ran in ~6 seconds on our Next.js codebase, which is quite performant.
- **Scoring System:** The Letter Grade (e.g. `Score: 66/100 (C+)`) is a nice gamification touch that encourages housekeeping.

### 🚨 Critical Bug: `sanitize` deleting active files via alias mismatch
When running `mycontext sanitize --fix`, the CLI incorrectly deleted five active API routes (e.g., `app/api/generate-audio/route.ts`) and utility files.
- **Root Cause:** The CLI failed to resolve `tsconfig.json` path aliases (e.g., importing `withRetry` from ` "@/lib/ai/retry"`). Because it couldn't trace the alias back to the actual file (`lib/ai/retry.ts`), it flagged it as "dead/unused" and deleted it, which recursively caused the API routes importing it to be flagged and deleted.
- **Impact:** This immediately caused a Next.js build error on the frontend.
- **Silver Lining:** The Vision Testing agent proved its worth immediately! When attempting to navigate the broken site, the `VisionNavigatorAgent` correctly identified the Next.js build error screen and triggered a **Gravity Intervention**, stopping the test because it didn't align with the Prime Objective. The self-healing and contextual awareness worked flawlessly in a catastrophic edge case.

## � Cost Optimization: Supporting GitHub Models / Tokens for Text Operations
While Gemini 1.5 Pro/Flash is essential for the multimodal "Vision" aspects of the orchestrator, many sub-tasks during a test generate purely text (like planning the mission, generating Voice-Over scripts, or parsing error logs). 
- **Recommendation:** Allow `mycontext` to explicitly default to `GITHUB_TOKEN` (via the free tier of the GitHub Models API) for all **text-based** LLM generations during test runs. 
- **Benefit:** This would drastically reduce the cost of running Vision Tests on CI/CD pipelines by reserving paid Gemini or OpenAI credits *strictly* for the image analysis steps. Developers are much more likely to adopt automated AI testing if the text-heavy reasoning loops run on free or highly subsidized developer tokens.

## 🐛 React State Synchronization Bug (Agent Looping)
During the final E2E test of the CyniToast narrative creation flow, the `VisionNavigatorAgent` correctly identified the "Who are you helping?" `Textarea` and executed a `fill` action with high confidence (>95%). However, the agent got stuck in an infinite loop (filling the input over 12 times).
- **Root Cause:** The `VisionNavigatorAgent` uses Playwright's `fill()` method. While `fill()` sets the DOM value, it often fails to trigger React's synthetic `onChange` event in tightly controlled components (like Shadcn UI `Textarea` or Next.js state). Because the React state didn't update, our "Continue" button remained disabled (which requires `length > 5`), causing the agent to repeatedly try filling the form without progressing.
- **Solution / Feature Request:** The `mycontext-cli` agent implementation should switch from `element.fill(value)` to `element.pressSequentially(value)` or manually dispatch a `KeyboardEvent` / `InputEvent` that React's event listener can capture. This ensures the virtual DOM stays synced with reality.

## 📦 `@ai-sdk/gateway` Zod v4 Export Bug
When the internal browser agent manually clicked "Refine with AI", the app crashed with a catastrophic Next.js Build Error: `Module not found: Package path ./v4 is not exported from package zod`.
- **Root Cause:** The `@ai-sdk` packages (like `gateway` and `google`) recently updated to require `zod@^3.24.0` (which exports the `./v4` path), but if a host project has an older version pinned (e.g., `zod@3.22.3`), `pnpm` resolves the older version, breaking the AI SDK.
- **Immediate Fix applied to repo:** We added `"zod": "^3.24.0"` to the `pnpm.overrides` block in `package.json` to brutally force the correct resolution across the entire workspace tree.

## �🚀 Summary Verdict
The underlying AI vision capability represents a paradigm shift away from brittle CSS selectors. However, the strictly interactive CLI interface acts as a gatekeeper, creating unnecessary friction for automated pipelines. Adding CLI param parsing will fully unlock its automated potential.
