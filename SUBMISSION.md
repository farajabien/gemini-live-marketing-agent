# IdeaToVideo — Narrative Intelligence Platform

## Project Summary

IdeaToVideo is a **Narrative Intelligence Platform** that transforms brand positioning into an AI-powered content engine. Built with Google Gemini, it captures strategic narratives through an 8-step wizard, generates content aligned to your positioning with AI-powered tagging, and tracks performance to optimize what works.

- **Category:** Marketing Intelligence & Content Generation
- **Tech:** Google Gemini API, Google Veo 3.1 (video), Firebase, Next.js 16
- **Key Features:**
  - Strategic narrative capture with AI analysis
  - Content angle generation (25+ angles per narrative)
  - Auto-tagging of generated content
  - Performance tracking (24h/7d metrics)
  - AI-powered video generation with FFmpeg rendering

## Architecture

**Stack:**
- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS
- **Database**: Firebase Firestore (with security rules & composite indexes)
- **AI**: Google Gemini 2.0 Flash (text), Gemini 3 Pro (images), Veo 3.1 (video), Gemini TTS (voice)
- **Video**: FFmpeg-based rendering with scene caching
- **Payments**: PayPal Checkout SDK
- **Deployment**: Vercel (with custom serverless configuration)

## Deployment

- **Status**: Production-ready
- **Platform**: Vercel (Next.js optimized)
- **Build**: Passing (all TypeScript checks complete)
- **Configuration**: `vercel.json` with 5min timeout for video processing

## Demo Video

- [demo-video.mp4](demo-video.mp4): <4-minute walkthrough showing real-time multimodal features and pitching the solution

## Spin-up Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/farajabien/gemini-live-marketing-agent
   cd gemini-live-marketing-agent
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Required variables:
   - Firebase credentials (7 variables)
   - Firebase Admin SDK (3 variables)
   - Gemini API key
   - PayPal credentials (4 variables)

4. **Run development server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

5. **Build for production:**
   ```bash
   pnpm build
   pnpm start
   ```

## Key Technical Achievements

1. **Narrative Intelligence System**: Custom AI pipeline using Gemini for positioning extraction, angle generation, and narrative strength scoring (0-100 metrics)

2. **FFmpeg Video Rendering**: Replaced Remotion with FFmpeg for faster, more scalable video generation with scene caching

3. **Performance Optimization**:
   - Parallel image generation (83% faster)
   - Parallel audio synthesis (75% faster)
   - Scene-level caching for instant re-renders

4. **Firebase Integration**: Firebase Firestore with 182-line security rules and 14 composite indexes

5. **Production-Ready**: Full TypeScript strict mode, passing build, Vercel deployment configuration

## Findings & Learnings

- **Gemini Multimodal**: Seamless integration of text, image, and video generation in single workflow
- **Veo 3.1 Video**: AI-generated video clips add professional motion to static content
- **Narrative-First Approach**: Strategic positioning beats random content generation
- **Performance Matters**: Aggressive optimization (parallel processing, caching) crucial for UX
- **Firebase Firestore**: Excellent real-time capabilities with robust security model

---

Built with Google Gemini, Veo 3.1, and Firebase
