/**
 * IdeaToVideo Visual Identity Constants
 * 
 * BRAND-DEFINING VISUAL MOAT:
 * Our signature look is stylized, animated visuals (2D or 3D) - NEVER realistic or live-action.
 * Think "Instadoodle for founders" - instantly recognizable animated style.
 * 
 * This creates a visual identity that becomes synonymous with IdeaToVideo,
 * making every video instantly recognizable as ours.
 */

/**
 * CORE VISUAL STYLE CONSTRAINT
 * This is our brand signature - non-negotiable across all generations
 */
export const VISUAL_STYLE_CONSTRAINT = `
VISUAL STYLE CONSTRAINT (MANDATORY - BRAND SIGNATURE):
Create a stylized, animated, illustrated visual.
Use flat 2D, magazine-style, cartoon illustration, OR fully animated 3D style.
Bold colors, clean outlines, simple geometric shapes.
Characters must be animated/illustrated (NOT realistic humans).

APPROVED STYLES (Our Visual Identity):
- Flat 2D illustration with bold colors
- Magazine-style editorial illustration
- Motion-graphic animated style
- Abstract vector art with clean lines
- Minimalist cartoon characters (2D or 3D animated)
- Infographic-style layouts
- Hand-drawn sketch aesthetic
- Paper-cut or collage style
- Animated 3D characters (Pixar-style, stylized 3D, cartoon 3D)
- 3D motion graphics

STRICTLY FORBIDDEN (Never Our Brand):
- Photorealistic renders (2D or 3D)
- Real human faces, portraits, or detailed realistic people
- Cinematic/DSLR photography aesthetics
- Live-action footage or film style
- Stock photo style
- Hyperrealistic imagery
- Realistic 3D renders that mimic reality
- Real-world photography

CHARACTER LANGUAGE:
- 2D: Symbolic stick figures, abstract icons, simplified cartoon silhouettes
- 3D: Fully animated stylized characters (like Pixar, cartoon 3D, chibi style)
- NOT realistic humans with detailed facial features
- Consistent character design across all scenes

ANIMATION PRINCIPLE:
Whether 2D or 3D, visuals must be ANIMATED/ILLUSTRATED - never realistic or live-action.
Think: Animation studio output, not AI-generated movie scenes.

CONSISTENCY RULE:
Every scene in this content must use the SAME illustration/animation style, color palette, and character design.
This creates our signature "IdeaToVideo look."
`;

/**
 * NEGATIVE PROMPT
 * Block realism and live-action at the API level
 */
export const NEGATIVE_PROMPT = "photorealistic, realism, realistic photography, real humans, human faces, detailed realistic faces, portraits, cinematic lighting, DSLR camera, film photography, stock photo, stock image, hyperrealistic, realistic 3D render, real world locations, movie scene, live-action, realistic skin, realistic hair, realistic textures";

/**
 * PROMPT TEMPLATE
 * Enforces our visual brand across all scene descriptions
 */
export const SCENE_PROMPT_TEMPLATE = `
A stylized animated illustration showing {main_subject} {action} in {setting}, 
{time_of_day}, with {color_palette}, in {flat 2D / animated 3D / cartoon} style, 
{composition}, clean and stylized
`;

/**
 * THUMBNAIL STYLE CONSTRAINT
 * Special constraint for thumbnails/covers
 */
export const THUMBNAIL_STYLE_CONSTRAINT = `
${VISUAL_STYLE_CONSTRAINT}

THUMBNAIL-SPECIFIC REQUIREMENTS:
- Eye-catching flat illustration, editorial style, or animated 3D look
- Bold, contrasting color palette for social media visibility
- Simple geometric composition (rule of thirds)
- Stylized animated characters (2D or 3D) and clean shapes
- Text-friendly negative space for overlays
- Instantly recognizable as "IdeaToVideo style"

Create a thumbnail prompt that:
1. Uses flat 2D illustration, editorial style, or stylized animated 3D
2. Includes specific visual elements and bold colors
3. Describes animated/illustrated characters (NOT realistic humans)
4. Specifies clean composition

NEVER suggest: realistic photography, photorealistic 3D, live-action, cinematic film, stock photos
`;

/**
 * VIDEO CONSISTENCY GUIDE TEMPLATE
 * Ensures same style/characters across all scenes in a video
 */
export const VIDEO_CONSISTENCY_TEMPLATE = `
Define a consistent visual style guide for this entire video:

CHARACTER DESIGN:
- Age, gender, clothing, signature traits
- Style: 2D illustrated OR 3D animated (specify which)
- MUST be stylized/animated (stick figure, icon, cartoon, Pixar-style 3D)
- NEVER realistic human features or live-action

VISUAL STYLE:
- Specific style: flat 2D, editorial, vector art, animated 3D, motion graphics, etc.
- Color palette (e.g., "warm oranges and blues", "pastel tones", "bold primary colors")
- Line weight and detail level (for 2D) or rendering style (for 3D)

SETTING CONSISTENCY:
- Indoor/Outdoor environment descriptions
- Background elements and patterns
- Lighting mood (warm, cool, neutral) - stylized, not realistic

This guide ensures every scene maintains the same animated/illustrated style and character design,
creating a cohesive "IdeaToVideo signature look" - whether 2D or 3D, always animated/stylized.
`;

/**
 * MOTION STYLE CONSTRAINT (Pro Max B-Roll)
 * Motion scenes must be animated/illustrated, not live-action
 */
export const MOTION_STYLE_CONSTRAINT = `
${VISUAL_STYLE_CONSTRAINT}

MOTION-SPECIFIC REQUIREMENTS:
Motion = animated illustrations/characters in movement, NOT live-action video.

APPROVED:
- Animated explainer video style
- Motion graphics (2D or 3D)
- Illustrated characters in motion
- Animated 3D scenes (Pixar-style, stylized cartoon 3D)
- 2D character animation

FORBIDDEN:
- AI-generated live-action movie scenes
- Realistic human actors or people
- Cinematic film footage
- Photorealistic 3D that mimics reality

Animated motion (2D or 3D) maintains our visual brand identity.
The key: ANIMATED/STYLIZED, never realistic or live-action.
`;

/**
 * BRAND IDENTITY SUMMARY
 * Quick reference for the IdeaToVideo visual signature
 */
export const BRAND_VISUAL_IDENTITY = {
  signature: "Stylized animated visuals (2D or 3D) - never realistic or live-action",
  think: "Instadoodle for founders and SaaS content",
  approvedStyles: [
    "Flat 2D illustration",
    "Magazine editorial style",
    "Motion graphics (2D/3D)",
    "Vector art",
    "Minimalist cartoons",
    "Infographics",
    "Hand-drawn sketches",
    "Animated 3D (Pixar-style, stylized)",
    "Cartoon 3D characters"
  ],
  forbiddenStyles: [
    "Photorealistic (2D or 3D)",
    "Real human faces",
    "Cinematic photography",
    "Stock photos",
    "Realistic 3D renders",
    "Live-action footage",
    "Hyperrealistic imagery"
  ],
  characterStyle: "2D: Symbolic/cartoon | 3D: Animated stylized (NOT realistic humans)",
  animationPrinciple: "Animated/illustrated whether 2D or 3D - never realistic or live-action",
  consistencyRule: "Same style, same character language, same color palette per video",
  outcome: "Every IdeaToVideo creation is instantly recognizable by its signature animated style"
} as const;

/**
 * SEAMLESS CAROUSEL HINT
 * Encourages Gemini to create visual continuity between slides
 */
export const SEAMLESS_CAROUSEL_HINT = `
VISUAL CONTINUITY (CAROUSEL MODE):
Ensure objects, patterns, or background elements touch the left and right edges of the frame.
This creates a "flowy" experience where visuals appear to continue from one slide to the next when swiping.
Use consistent horizons and matching color gradients at the boundaries.
`;

/**
 * STYLE ENFORCEMENT WRAPPER
 * Automatic wrapper for all scene prompts (non-editable by users)
 */
export function wrapWithStyleConstraint(sceneContent: string): string {
  return `STYLE:
Stylized, animated, illustrated.
Flat/magazine/cartoon style OR animated 3D.
Bold colors, clean outlines.
Animated 2D or 3D allowed.
No realism/live-action.

NEGATIVE PROMPT:
${NEGATIVE_PROMPT}

SCENE:
${sceneContent}`;
}
