import { init, id } from "@instantdb/react";
import schema from "@/instant.schema";

// ID for app: jibu-delivery
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;

/**
 * InstantDB client initialization
 *
 * Note: InstantDB uses localStorage and IndexedDB for caching query results.
 * If you encounter JSON parse errors, use the storage utilities from @/lib/storage-utils
 * to clear corrupted storage.
 *
 * The useStorageInit hook in app layout handles automatic error recovery.
 */
// Mock for E2E testing
const isE2E = process.env.NEXT_PUBLIC_IS_E2E === "true";

const db = isE2E
  ? {
      useAuth: () => ({
        isLoading: false,
        user: { id: "mock-user-id", email: "[EMAIL_ADDRESS]", isGuest: false },
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
  : init({ appId: APP_ID, schema });

export { db, id, APP_ID };
