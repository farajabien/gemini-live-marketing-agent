/**
 * Firebase Transaction Helper
 *
 * Proxy-based transaction builder for Firestore.
 * Usage: tx.collectionName[documentId].update({ field: value })
 */

import { upsertDocument, deleteDocument } from '@/hooks/use-firestore';

/**
 * Transaction builder for Firestore client-side operations
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
