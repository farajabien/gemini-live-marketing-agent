/**
 * ID Generation Utility
 *
 * Simple wrapper for generating unique IDs.
 */

export function generateId(): string {
  return crypto.randomUUID();
}

// Re-export as `id` for convenience
export const id = generateId;
