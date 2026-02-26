# Gemini Live Marketing Agent — Submission Artifacts

## Project Summary

Gemini Live Marketing Agent is a next-generation AI agent for immersive, real-time marketing content creation. Built for the Gemini Live Agent Challenge, it leverages Google Gemini's multimodal capabilities, Google GenAI SDK, and Google Cloud. The agent generates marketing assets (copy, visuals, video, voiceover) in a single, interleaved output, supporting real-time voice interaction and interruption.

- **Category:** Creative Storyteller (with Live Agent features)
- **Tech:** Google GenAI SDK, Gemini API, Google Cloud
- **Features:** Multimodal input/output, real-time voice, asset generation, interleaved responses

## Architecture Diagram

![Architecture Diagram](architecture-diagram.png)

- Gemini API (Text/Image/Audio/Video) → Google Cloud Backend → Next.js Frontend
- Remotion for video rendering
- InstantDB for real-time data

## Deployment Proof

- Backend hosted on Google Cloud Run
- API calls to Gemini and Vertex AI
- [deployment-proof.mp4](deployment-proof.mp4): Screen recording of GCP console and logs

## Demo Video

- [demo-video.mp4](demo-video.mp4): <4-minute walkthrough showing real-time multimodal features and pitching the solution

## Spin-up Instructions

1. Clone the repo:
   ```bash
   git clone https://github.com/farajabien/gemini-live-marketing-agent
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Fill in your Gemini, InstantDB, PayPal keys
   ```
4. Start the app:
   ```bash
   pnpm dev
   ```

## Findings & Learnings

- Multimodal Gemini models enable seamless, creative marketing workflows.
- Real-time voice and image generation unlock new user experiences.
- Google Cloud simplifies scalable deployment and integration.

---

> For the Gemini Live Agent Challenge, 2026. #GeminiLiveAgentChallenge
