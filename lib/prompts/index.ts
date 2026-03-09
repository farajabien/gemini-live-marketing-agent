/**
 * Centralized AI prompts for video generation
 * 
 * This module exports all prompt templates used in the application.
 * Benefits:
 * - Easy A/B testing of prompts
 * - Centralized prompt versioning
 * - Clear separation of concerns
 */

export { VISUAL_PROMPTS, SUB_SCENE_INSTRUCTIONS } from './visual-prompts';
export { SCRIPT_PROMPTS } from './script-prompts';

/**
 * Replace {{VISUAL_STYLE_CONSTRAINT}} placeholders with actual constraint
 */
export function injectStyleConstraint(prompt: string, constraint: string): string {
  return prompt.replace(/\{\{VISUAL_STYLE_CONSTRAINT\}\}/g, constraint);
}
