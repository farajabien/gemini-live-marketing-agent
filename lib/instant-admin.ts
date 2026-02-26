/**
 * Admin Database Client - Migrated to Firebase
 *
 * This file now re-exports Firebase Admin SDK functionality.
 * Kept for backward compatibility with existing imports.
 */

import { adminDb, generateId, serverDb } from "@/lib/firebase-admin";

// Re-export for compatibility
export { adminDb, serverDb };
export { generateId as id };
