/**
 * Firebase Transaction Helper
 *
 * Provides a similar API to InstantDB's tx for easier migration.
 * This is a lightweight wrapper around Firebase client operations.
 */

import { upsertDocument, deleteDocument } from '@/hooks/use-firestore';

/**
 * Transaction builder for Firebase
 * Mimics InstantDB's tx API for easier migration
 */
export const tx = new Proxy({}, {
  get: (_target, collection: string) => {
    return new Proxy({}, {
      get: (_target2, docId: string) => {
        return {
          update: async (data: any) => {
            await upsertDocument(collection, docId, data);
          },
          merge: async (data: any) => {
            await upsertDocument(collection, docId, data);
          },
          delete: async () => {
            await deleteDocument(collection, docId);
          },
        };
      },
    });
  },
}) as any;
