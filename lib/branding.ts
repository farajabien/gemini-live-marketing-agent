/**
 * Branding Configuration for IdeaToVideo
 * 
 * Centralized branding assets and configuration.
 * Update paths here to change branding across the entire app.
 */

// ============================================================================
// Logo Assets
// ============================================================================

export const LOGO = {
  /** Square icon logo (for small spaces, favicons, watermarks) */
  icon: "/logos/ideatovideo-icon.png",
  
  /** Full horizontal logo with text */
  full: "/logos/ideatovideo-full-logo.png",
  
  /** Alt text for accessibility */
  alt: "IdeaToVideo",
} as const;

// ============================================================================
// Brand Colors
// ============================================================================

export const BRAND_COLORS = {
  /** Primary brand red */
  primary: "#dc2626",
  
  /** Primary with glow/shadow */
  primaryGlow: "rgba(220, 38, 38, 0.2)",
  
  /** Dark background */
  background: "#000000",
  
  /** Muted text color */
  muted: "#666666",
  
  /** White/light text */
  foreground: "#ffffff",
  
  /** Border colors */
  border: "rgba(255, 255, 255, 0.1)",
  borderLight: "rgba(255, 255, 255, 0.2)",
  
  /** Pro badge gradient */
  proGradient: "linear-gradient(to right, #dc2626, #b91c1c)",
} as const;

// ============================================================================
// Brand Text
// ============================================================================

export const BRAND_TEXT = {
  /** App name */
  name: "IdeaToVideo",
  
  /** Tagline */
  tagline: "Your Always-On AI Marketing Assistant",
  
  /** Short description */
  description: "Build authority and warm up your market daily.",
  
  /** Footer credit */
  credit: "Built with ❤️ by farajabien",
  
  /** Social handles */
  twitter: "@ideatovideo",
  
  /** Support email */
  supportEmail: "hello@fbien.com",
} as const;

// ============================================================================
// Watermark Configuration
// ============================================================================

export interface WatermarkConfig {
  enabled: boolean;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity: number;
  /** Size as percentage of video width */
  sizePercent: number;
  /** Padding from edge in pixels */
  padding: number;
  /** Use icon or full logo */
  logoType: "icon" | "full";
  /** Text to show alongside logo (optional) */
  text?: string;
}

export const WATERMARK_CONFIG: WatermarkConfig = {
  enabled: true,
  position: "bottom-right",
  opacity: 0.7,
  sizePercent: 10, // 10% of video width
  padding: 20,
  logoType: "icon",
  text: "IdeaToVideo",
};

/** Watermark config for free tier (more prominent) */
export const WATERMARK_FREE: WatermarkConfig = {
  enabled: true,
  position: "bottom-right",
  opacity: 0.85,
  sizePercent: 15,
  padding: 24,
  logoType: "icon",
  text: "Made with IdeaToVideo",
};

/** Watermark config for pro tier (subtle or disabled) */
export const WATERMARK_PRO: WatermarkConfig = {
  enabled: false, // Pro users get no watermark
  position: "bottom-right",
  opacity: 0.5,
  sizePercent: 8,
  padding: 16,
  logoType: "icon",
};

// ============================================================================
// FFmpeg Watermark Filter Generation
// ============================================================================

/**
 * Generate FFmpeg filter string for watermark overlay
 * @param videoWidth Video width in pixels
 * @param videoHeight Video height in pixels  
 * @param config Watermark configuration
 * @returns FFmpeg overlay filter string
 */
export function generateWatermarkFilter(
  videoWidth: number,
  videoHeight: number,
  config: WatermarkConfig
): string {
  if (!config.enabled) return "";

  const logoWidth = Math.round(videoWidth * (config.sizePercent / 100));
  
  // Calculate position based on config
  let x: string;
  let y: string;
  
  switch (config.position) {
    case "top-left":
      x = `${config.padding}`;
      y = `${config.padding}`;
      break;
    case "top-right":
      x = `main_w-overlay_w-${config.padding}`;
      y = `${config.padding}`;
      break;
    case "bottom-left":
      x = `${config.padding}`;
      y = `main_h-overlay_h-${config.padding}`;
      break;
    case "bottom-right":
    default:
      x = `main_w-overlay_w-${config.padding}`;
      y = `main_h-overlay_h-${config.padding}`;
      break;
  }

  // Scale logo and apply opacity
  // This assumes logo is input [1] in the FFmpeg command
  return `[1:v]scale=${logoWidth}:-1,format=rgba,colorchannelmixer=aa=${config.opacity}[watermark];[0:v][watermark]overlay=${x}:${y}`;
}

// ============================================================================
// Carousel Branding
// ============================================================================

export interface CarouselBrandingConfig {
  /** Show logo badge on slides */
  showBadge: boolean;
  /** Badge position */
  badgePosition: "top-left" | "top-right";
  /** Show logo or just text */
  badgeType: "logo" | "text" | "both";
  /** Badge background style */
  badgeStyle: "solid" | "glass" | "gradient";
}

export const CAROUSEL_BRANDING: CarouselBrandingConfig = {
  showBadge: true,
  badgePosition: "top-right",
  badgeType: "both",
  badgeStyle: "glass",
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get watermark config based on user plan
 */
export function getWatermarkConfig(planId?: string): WatermarkConfig {
  if (planId === "pro" || planId === "pro_max") {
    return WATERMARK_PRO;
  }
  return WATERMARK_FREE;
}

/**
 * Get the appropriate logo path
 */
export function getLogoPath(type: "icon" | "full" = "icon"): string {
  return type === "full" ? LOGO.full : LOGO.icon;
}
