import { z } from "zod";

// Sub-scene schema for multi-visual sequences
export const SubSceneSchema = z.object({
  id: z.string(),
  visualPrompt: z.string(),
  duration: z.number(),
  imageUrl: z.string().optional(),
  videoClipUrl: z.string().optional(),
  operationId: z.string().optional(),
});

export const SceneSchema = z.object({
  id: z.string(),
  duration: z.number(),
  voiceover: z.string(),
  visualPrompt: z.string(),
  textOverlay: z.string().optional(),
  imageUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  videoClipUrl: z.string().optional(),
  // NEW: Multi-visual sequence support
  subScenes: z.array(SubSceneSchema).optional(),
});

export const MainSchema = z.object({
  plan: z.object({
    title: z.string(),
    scenes: z.array(SceneSchema),
    type: z.enum(["video", "carousel", "book"]),
    visualConsistency: z.string().optional(),
    style: z.string().optional(),
    visualMode: z.string().optional(),
    assetServerBaseUrl: z.string().optional(),
  }),
});

export type MainProps = z.infer<typeof MainSchema>;
