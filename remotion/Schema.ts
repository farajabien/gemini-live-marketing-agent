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
  operationId: z.string().optional(),
  isVerbatimLocked: z.boolean().optional(),
  sceneTitle: z.string().optional(),
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
    
    // Narrative Context Fields (The Strategy Hub)
    voice: z.string().optional(),
    problem: z.string().optional(),
    solution: z.string().optional(),
    coreMessage: z.string().optional(),
    positioningStatement: z.string().optional(),
    
    positioning: z.object({
      villain: z.string().optional(),
      hero: z.string().optional(),
      stakes: z.string().optional(),
      promise: z.string().optional(),
      mechanism: z.string().optional(),
      transformation: z.string().optional(),
      emotionalArc: z.string().optional(),
      contrast: z.object({ 
        before: z.string().optional(), 
        after: z.string().optional() 
      }).optional(),
    }).optional(),
    
    pillars: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      angles: z.array(z.string()).optional(),
    })).optional(),
  }).passthrough(),
});

export type MainProps = z.infer<typeof MainSchema>;
