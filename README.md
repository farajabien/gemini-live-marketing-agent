# 🎬 IdeaToVideo — The Narrative Intelligence Platform

**Turn your brand narrative into an AI-powered content engine that learns what works and gets smarter over time.**

IdeaToVideo is not a video editor. It's a **Narrative Intelligence System** that:
1. **Captures your brand positioning** through an 8-step strategic wizard
2. **Generates content aligned to your narrative** with AI-powered tagging
3. **Tracks what performs** with 24h/7d metrics on every piece of content
4. **Suggests improvements** based on actual performance data

## 🎯 The Core Job

**Old Way**: Write content → Hope it performs → Guess what to post next
**New Way**: Define narrative → Generate tagged content → Track performance → Let AI learn what works

**You get:**
- A strategic narrative foundation (not just random content ideas)
- Auto-tagged content mapped to your positioning (pain, outcome, mechanism, etc.)
- Performance intelligence (which angles actually convert)
- AI refinement suggestions (based on what's working)

## 🚀 The Promise

Define your narrative once. Generate content forever. Track what works. Get smarter over time.


## 🎨 Visual Brand Identity

**The IdeaToVideo Animated Style** — Our signature visual moat that makes every video instantly recognizable.

### Our Brand Promise: Animated, Never Realistic

Think **"Instadoodle for founders"** — stylized, animated visuals that create instant brand recognition. Whether 2D or 3D, every IdeaToVideo creation is animated/illustrated, never photorealistic or live-action.

### ✅ Approved Visual Styles (Our Signature)

- **Flat 2D Illustration**: Bold colors, clean outlines, magazine editorial style
- **Motion Graphics**: Abstract shapes, vector art, infographic aesthetics
- **Animated 3D**: Pixar-style characters, stylized cartoon 3D, chibi designs
- **Hand-Drawn Aesthetics**: Sketch style, paper-cut, collage visuals
- **Minimalist Cartoons**: Symbolic stick figures, abstract icons, simple silhouettes

### ❌ Forbidden Styles (Never Our Brand)

- **Photorealistic imagery** (whether 2D or 3D)
- **Real human faces** or detailed realistic portraits
- **Cinematic/DSLR photography** style
- **Live-action footage** or film aesthetics
- **Stock photos** or realistic 3D renders
- **Hyperrealistic imagery** of any kind

### Character Design Philosophy

**2D Approach**: Symbolic stick figures, abstract icons, simplified cartoon silhouettes
**3D Approach**: Fully animated stylized characters (Pixar-style, cartoon 3D) — NOT realistic humans
**Core Rule**: Animated/illustrated whether 2D or 3D — never realistic or live-action

### Why This Matters

1. **Instant Recognition**: Every video screams "Made with IdeaToVideo"
2. **Brand Consistency**: Same visual language across all user content
3. **Creative Safety**: Avoids uncanny valley and hyperrealism
4. **Market Differentiation**: Stands out from realistic AI generation tools
5. **Style Flexibility**: Allows 2D OR 3D animation trends while maintaining brand moat

### Technical Implementation

All visual generation enforces these constraints through:
- **Style guardrails** in [lib/constants.ts](lib/constants.ts)
- **Negative prompts** blocking realism at API level
- **Consistency templates** ensuring unified style per video
- **B-Roll constraints** keeping motion graphics animated (not live-action)

**See**: [lib/constants.ts](lib/constants.ts) for complete brand identity constants and enforcement logic.

## 🧠 Narrative Intelligence System (New!)

### 1. Strategic Narrative Capture
**8-Step Wizard** that extracts your complete brand positioning:
- Who are you helping? (audience specificity)
- What does their current reality look like? (pain state)
- What is their expensive pain? (problem clarity)
- What is this costing them? (stakes)
- What is your unique mechanism? (solution differentiation)
- What does life look like after? (outcome vision)
- Who do they become? (identity shift)
- What is your brand voice? (tone consistency)

**AI Analysis:** Automatically extracts villain, hero, stakes, promise, mechanism, and before/after contrast from your answers.

**Narrative Strength Scoring:** Get 0-100 scores on:
- Specificity (how clear is your audience?)
- Emotional Clarity (how visceral is the pain/relief?)
- Tension Strength (how urgent is the problem?)
- Contrast Score (how vivid is the transformation?)

### 2. Content Angle Generation
AI extracts **25+ specific content angles** from your narrative:
- **Pain Angles** (5): Different ways to talk about the problem
- **Cost Angles** (5): Ways to frame consequences of inaction
- **Mechanism Angles** (5): Ways to explain your unique approach
- **Identity Angles** (5): Ways to frame who they become
- **Outcome Angles** (5): Specific results to highlight

### 3. Auto-Content Tagging
Every video you generate is automatically tagged with:
- **Primary Angle**: Pain-focused | Cost-focused | Mechanism-focused | Identity-focused | Outcome-focused
- **Specific Angles**: Matched to your 25+ narrative angles
- **Hook Type**: Question | Bold Statement | Storytelling | Statistics | Contrarian | Problem-Solution
- **Emotional Tone**: Urgent | Aspirational | Educational | Confrontational | Empowering | Reflective

### 4. Performance Tracking
Mark content as "Posted" and track:
- **24-hour metrics**: Views, likes, shares, saves, comments
- **7-day metrics**: Full performance snapshot
- **Boosted vs Organic**: Track paid vs organic performance
- **Platform**: TikTok, LinkedIn, Instagram, etc.
- **Video URL**: Link directly to published content

### 5. AI Insights (Coming Soon)
- Analyze which angles perform best
- Detect which hooks convert
- Suggest narrative refinements based on data
- Auto-prioritize high-performing content types

## 🛠 Content Generation Features

*   **Narrative-Driven Generation**: All content aligned to your strategic positioning
*   **Prompt Enrichment Pipeline**: Automatically enriches simple user ideas into high-detail AI prompts using a "Who, What, Where, When, How, Style" mnemonic.
*   **Three-Tier System**: Free (1 video), Pro ($19/mo - 20 videos), Pro Max ($49/mo - 20 videos with B-roll).
*   **AI B-Roll Generation (Pro Max)**: Generate cinematic AI video clips (4-8s per scene) using Google Veo 3.1 instead of static images.
*   **Content Compilation**: Automatically converts long-form text (PRDs, READMEs, Docs) into structured marketing scenes (Hook → Context → Points → CTA).
*   **Educational Marketing Style**: Generates clean, conceptual "explainer video" visuals and consistent AI voiceovers.
*   **One-Click Distribution**: Export as vertical videos (TikTok/Reels) or high-quality carousels (LinkedIn/IG).
*   **Native AI Visuals**: High-quality imagery generated directly via Google Gemini (no external stock fallbacks).
*   **PayPal Integration**: Secure subscription payments for Pro and Pro Max tiers.
*   **Voice Selection**: Choose from 30+ professional AI voices to match your content tone.

## 🏗 Architecture

### Data Model

**Core Entities:**
- **`narratives`**: Strategic brand positioning with AI-extracted insights
  - Wizard inputs (audience, currentState, problem, costOfInaction, solution, afterState, identityShift, voice)
  - AI positioning (villain, hero, stakes, promise, mechanism, contrast)
  - Content angles (painAngles, costAngles, mechanismAngles, identityAngles, outcomeAngles)
  - Narrative strength metrics (specificityScore, emotionalClarity, tensionStrength, contrastScore)
  - Version history (last 10 edits tracked)

- **`videoPlans`**: Generated content pieces
  - Content tags (primaryAngle, specificAngles, hookType, emotionalTone)
  - Performance metrics (posted, postedAt, platform, videoUrl, metrics24h, metrics7d, boosted, organic)
  - Links to parent narrative

- **`brandPositioning`**: Legacy positioning entity (maintained for backward compatibility)
- **`contentPillars`**: Generated from narrative angles
- **`contentDrafts`**: Marketing content suggestions

### Content Intelligence Pipeline

```
User fills 8-step wizard
  ↓
analyzeNarrative() extracts positioning + angles + strength
  ↓
Saved to narratives entity with all metadata
  ↓
User generates content from narrative
  ↓
autoTagContent() analyzes video script + maps to narrative angles
  ↓
Video saved with contentTags + empty metrics structure
  ↓
User marks as "Posted"
  ↓
24h/7d metrics tracked manually (TikTok API integration planned)
  ↓
AI analyzes performance data (coming soon)
  ↓
Suggests narrative refinements based on what works
```

### Key Files

- **`firestore.rules`**: Firebase security rules for all collections
- **`firestore.indexes.json`**: Composite indexes for optimized queries
- **`lib/firebase-admin.ts`**: Firebase Admin SDK wrapper for server-side operations
- **`lib/firebase-client.ts`**: Firebase client wrapper with real-time subscriptions
- **`lib/marketing/narrative-intelligence.ts`**: AI positioning extraction + angle generation + strength scoring
- **`lib/marketing/content-tagging.ts`**: Auto-tagging logic for generated content
- **`lib/ai/persistence.ts`**: Video plan saving with auto-tagging
- **`components/narrative/NarrativeOverviewScreen.tsx`**: Editable narrative dashboard
- **`components/narrative/NarrativeSection.tsx`**: Inline editing component
- **`components/narrative/StrengthGauge.tsx`**: Circular progress visualization
- **`components/dashboard/ProjectCard.tsx`**: Content cards with tags + metrics display
- **`app/actions/marketing.ts`**: Server actions for narrative CRUD + regeneration

## 🛠 Tech Stack

*   **Frontend**: Next.js 16 (App Router), TailwindCSS, Shadcn UI.
*   **Database**: Firebase Firestore (Real-time database with security rules and composite indexes).
*   **AI**:
    *   **Text**: Google Gemini (`gemini-2.0-flash`).
    *   **Narrative Intelligence**: Custom pipeline using Gemini for positioning extraction, angle generation, and scoring.
    *   **Content Tagging**: AI-powered analysis matching content to narrative angles.
    *   **Images**: Google GenAI SDK (`gemini-3-pro-image-preview` - 2K Resolution).
    *   **Video (B-Roll)**: Google Veo 3.1 (`veo-3.1-generate-preview` - AI-generated video clips).
    *   **Voice**: Gemini TTS.
*   **Video Rendering**: Remotion (Server-side MP4 generation with React-based composition).
*   **Payments**: PayPal Checkout SDK (`@paypal/checkout-server-sdk`, `@paypal/react-paypal-js`).
*   **Styling**: Custom modern aesthetics with dark mode default.

## ⚡ Performance Optimizations

IdeaToVideo has been aggressively optimized for speed without compromising quality:

### Current Pipeline Performance
- **Script Generation**: ~30s (Gemini 2.0 Flash)
- **Image Generation**: ~45s (parallel processing of 10 scenes)
- **Audio Generation**: ~30-45s (parallel TTS with retry logic)
- **Video Rendering**: ~6.5 min (Remotion server-side)
- **Total**: ~8-9 minutes for a complete 2-minute video

### Key Optimizations Implemented
1. **Parallel Image Generation**: Reduced from 4.5 min → 45s (83% faster) using `Promise.allSettled()`
2. **Parallel Audio Generation**: Reduced from 2-3 min → 30-45s (75% faster) with batch processing
3. **Remotion Encoding**: Optimized FFmpeg settings (ultrafast preset, zerolatency tune, CRF 28)
4. **Scene Transitions**: Reduced audio buffer from 2s → 0.5s for tighter pacing
5. **Text Overlays**: Removed to keep visuals clean (captions can be added post-export)

### Future Consideration: Remotion Lambda
For users requiring faster rendering at scale, **Remotion Lambda** integration is planned as a future enhancement. This would reduce rendering time from ~6.5 min to 1-2 min by leveraging AWS Lambda's parallel processing, at a cost of ~$0.05-0.15 per video.

Currently, the local rendering approach is optimized for cost-effectiveness while maintaining high quality output.

## 🏁 Getting Started

### 1. Clone & Install
```bash
git clone <repo-url>
cd gemini-live-marketing-agent
pnpm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in your API keys:
```bash
cp .env.example .env.local
```

Required environment variables:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_firebase_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_paypal_client_id_here
```

**Note:** Remotion requires Chrome/Chromium to be installed on your system for video generation.

### 3. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

## 🧪 Testing Guide

### Create Test Users

Use the admin endpoint to create test users with specific plan tiers:

```bash
# Create Pro Max test user
curl -X POST http://localhost:3000/api/admin/create-test-user \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your_strong_secret_key" \
  -d '{
    "email": "promax@test.com",
    "planId": "pro_max",
    "displayName": "Pro Max Tester"
  }'

# Create Pro test user
curl -X POST http://localhost:3000/api/admin/create-test-user \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your_strong_secret_key" \
  -d '{
    "email": "pro@test.com",
    "planId": "pro",
    "displayName": "Pro Tester"
  }'

# List all users
curl http://localhost:3000/api/admin/create-test-user \
  -H "x-admin-secret: your_strong_secret_key"
```

### Test Pro Max B-Roll Flow

1. **Sign in** with Pro Max test user
2. **Navigate** to `/generate`
3. **Select Visual Style**: Choose "AI B-Roll Clips" (should be enabled for Pro Max users)
4. **Create a video plan** with your content
5. **Wait for generation**: 
   - Images generate first (30-60s)
   - B-roll clips generate in background (2-5 minutes per clip)
   - Progress shown on success screen
6. **Verify assets**:
   - Check that `videoClipUrl` fields are populated in database
   - Verify clips are stored in InstantDB storage under `broll/${planId}/${index}.mp4`
7. **Generate final video**: Should use clip concatenation pipeline
8. **Download & verify**: Video should have smooth motion (no static images)

...existing code...

## 📄 Documentation

*   **[TESTING_GUIDE.md](./TESTING_GUIDE.md)**: Comprehensive testing workflows and edge cases.
*   **[paypal-integration-guide.md](./paypal-integration-guide.md)**: PayPal setup and subscription flow.

## 🔮 Roadmap

### ✅ Completed (V1)
*   [x] Carousel Generation
*   [x] Video Storyboard Generation
*   [x] Server-Side Image Generation (Gemini Native)
*   [x] **Voiceover**: Gemini TTS Integration with Voice Selection
*   [x] **Video Export**: Server-side Remotion MP4 generation
*   [x] **AI B-Roll Clips**: Google Veo 3.1 video generation (Pro Max users)
*   [x] **PayPal Integration**: Pro and Pro Max subscriptions
*   [x] **Test Infrastructure**: Admin endpoints for test user creation
*   [x] **Performance Optimizations**: Parallel processing, aggressive rendering optimizations

### ✅ Completed (Narrative Intelligence V1)
*   [x] **Strategic Narrative Wizard**: 8-step wizard to capture complete brand positioning
*   [x] **AI Positioning Extraction**: Automatic extraction of villain, hero, stakes, promise, mechanism
*   [x] **Content Angle Generation**: AI generates 25+ specific content angles from narrative
*   [x] **Narrative Strength Scoring**: 0-100 scores on specificity, emotional clarity, tension, contrast
*   [x] **Editable Narrative Dashboard**: View and edit all strategic inputs with inline editing
*   [x] **Version History**: Track last 10 narrative edits with timestamps
*   [x] **Regenerate Positioning**: Re-run AI analysis after editing narrative
*   [x] **Auto-Content Tagging**: Every generated video tagged with angle, hook type, emotional tone
*   [x] **Performance Metrics Schema**: 24h/7d metrics tracking structure in database
*   [x] **Content Tags Display**: Video cards show primary angle and hook type
*   [x] **Posted Status Toggle**: Mark videos as posted via dashboard menu

### 🚧 In Progress (Narrative Intelligence V2)
*   [ ] **Metrics Input UI**: Manual form to input 24h/7d performance metrics
*   [ ] **Performance Dashboard**: Visualize which angles/hooks perform best
*   [ ] **AI Insight Engine**: Analyze performance data and suggest narrative refinements
*   [ ] **Auto-Angle Suggestions**: AI suggests which angles to create next based on performance
*   [ ] **TikTok API Integration**: Auto-fetch metrics from posted content
*   [ ] **A/B Testing Framework**: Test different angles/hooks systematically

### 🎯 Planned Features
*   [ ] **🎬 Episodes — Serial Narrative Feature** ([docs/EPISODES_FEATURE.md](./docs/EPISODES_FEATURE.md)):
    *   [ ] Mega-prompt intake for series creation
    *   [ ] Script generation for all episodes
    *   [ ] Individual episode script editing
    *   [ ] One-by-one or batch video generation
    *   [ ] Series dashboard with episode management
    *   [ ] Download series as ZIP file
*   [ ] **Advanced Features**:
    *   [ ] Background music
    *   [ ] Custom branding/watermarks
    *   [ ] Multi-language support
    *   [ ] Remotion Lambda (cloud rendering for 1-2 min turnaround)
    *   [ ] Multi-platform publishing (schedule to TikTok, LinkedIn, Instagram directly)

## 🎯 Key Features

### Visual Mode Selection

Choose between two visual generation modes when creating content:

- **Static Images** (Free & Pro): High-quality AI-generated images (2K resolution via Gemini)
  - Perfect for educational content and carousels
  - Fast generation (30-60 seconds)
  - Professional polish without motion
  
- **AI B-Roll Clips** (Pro Max Only): Cinematic video clips generated via Google Veo 3.1
  - 4-8 second duration per scene
  - Portrait format (9:16) optimized for social media
  - Professional motion content
  - Async generation with background polling

### Voice Selection

Choose from 30+ professional AI voices powered by Gemini:
- **Zephyr**: Bright and engaging
- **Puck**: Upbeat and lively
- **Kore**: Firm and authoritative
- **...+ 27 more voices**

### Video Pipeline

1. **Script Generation**: Gemini AI creates scene-by-scene scripts
2. **Visual Generation**: 
   - **Image Mode**: High-quality vertical images (1080x1920) using Imagen
   - **B-Roll Mode** (Pro Max): AI-generated video clips (4-8s) using Veo 3.1
3. **Voiceover Synthesis**: Gemini generates natural-sounding audio
4. **Video Compilation**: Remotion combines visuals + audio into MP4
   - Image mode: Slideshow with timed transitions
   - B-Roll mode: Advanced clip concatenation with normalization
5. **Download**: Production-ready video file or assets ZIP

### Export Options

- **Video Type + Audio**: Full MP4 video (1080x1920, H.264)
- **Video Type (No Audio)**: ZIP with video clips/images + audio files + script
- **Carousel Type**: ZIP with images + script

### Watermark Behavior

- **Free Tier**: Watermark overlay on all videos
- **Pro & Pro Max**: No watermark, clean professional exports

---
*Built with ❤️ by farajabien*
