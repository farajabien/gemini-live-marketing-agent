# AI Browser Subagent: E2E Testing & Demo Automation

This guide outlines how the AI-driven `browser_subagent` operates, its underlying dependencies, and how you can implement a similar architecture within `mycontext` for real testing, automated app demos, and extracting voice-over scripts.

## How the AI Browser Subagent Works

The `browser_subagent` is an autonomous AI actor that controls a real browser instance. Unlike traditional test scripts (like Cypress or Selenium) that rely on brittle CSS selectors, the AI agent "sees" the page and interacts with it like a human.

### Core Loop
1. **Perception**: The agent captures screenshots and parses the DOM structure.
2. **Reasoning**: It uses an LLM (such as Gemini) to understand the UI context and decide the next action based on its high-level goal (e.g., "Create a new CyniToast campaign").
3. **Execution**: It calculates exact element coordinates and injects native mouse clicks, scrolling, and keyboard events.
4. **Recording**: The entire session is automatically recorded into a video file (WebP or MP4), which serves as a visual audit.

## Building This for `mycontext` (Dependencies)

To build a similar real-testing and demo-generation feature into `mycontext`, you will need:

1. **Browser Automation Framework**
   - **Playwright** (Recommended): Provides robust multi-tab support, context isolation, and built-in video recording.
   - **Puppeteer**: An alternative for Chromium-based automation.
2. **Vision-Capable LLM**
   - **Google Gemini 1.5 Pro/Flash**: Essential for analyzing screenshots to find where to click if DOM parsing isn't enough.
3. **Agent Orchestration loop**
   - A reactive framework (like LangChain, AutoGen, or a custom state loop) to handle the `Observe -> Think -> Act` loop.
4. **Virtual Displays (for CI/CD)**
   - `Xvfb` (X virtual framebuffer) if running tests in headless Linux CI environments where a display isn't available but you want headed-like rendering.

## Revolutionary Use Cases

By saving the full flow of the AI interacting with the app, you unlock capabilities beyond just testing:

### 1. Automated Demo Engine
Instead of manually recording screen captures for marketing, the AI can perform a "perfect run" of your application. The resulting video recording can be handed directly to a video editor or used on a landing page.

### 2. Voice-Over Script Extraction
As the AI fills out forms and reads generated content (like the AI-generated scripts in your app), it can output a JSON file containing the exact text on the screen. This text can be mapped to timestamps in the video, creating an instant voice-over (VO) script.
- *Bonus*: Pipe this VO script into an AI voice generator to automatically narrate the recorded demo!

### 3. Resilient QA Testing
The AI adapts to UI changes. If you move the "Submit" button from the left to the right, or change its color, the AI still finds it. This eliminates the maintenance burden of constantly fixing broken E2E test selectors.

---
*Concept documented for mycontext integrations.*
