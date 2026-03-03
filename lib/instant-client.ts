/**
 * Database Client - Migrated to Firebase
 *
 * This file now re-exports Firebase Firestore functionality.
 * Kept for backward compatibility with existing imports.
 */

import { useFirestoreQuery, useFirestoreDoc, generateId } from "@/lib/firebase-client";

// Mock for E2E testing
const isE2E = process.env.NEXT_PUBLIC_IS_E2E === "true";

const db = isE2E
  ? {
      useAuth: () => ({
        isLoading: false,
        user: { id: "mock-user-id", email: "test@example.com", isGuest: false },
        error: null,
      }),
      useQuery: () => ({ isLoading: false, error: null, data: {} }),
      auth: {
        signOut: async () => {},
        signInAsGuest: async () => {},
        sendMagicCode: async () => {},
        signInWithMagicCode: async () => {},
      },
    } as any
  : {
      useQuery: useFirestoreQuery,
      useDoc: useFirestoreDoc,
      // Note: useAuth is now in hooks/use-auth.ts
    };

// Generate unique IDs
const id = generateId;

// Legacy export for compatibility
const APP_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

export { db, id, APP_ID };
