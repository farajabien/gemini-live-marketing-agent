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
            if (!collection || docId == null || docId === '') {
              throw new Error('tx: collection and document id are required');
            }
            await upsertDocument(collection, docId, data);
          },
          merge: async (data: any) => {
            if (!collection || docId == null || docId === '') {
              throw new Error('tx: collection and document id are required');
            }
            await upsertDocument(collection, docId, data);
          },
          delete: async () => {
            if (!collection || docId == null || docId === '') {
              throw new Error('tx: collection and document id are required');
            }
            await deleteDocument(collection, docId);
          },
        };
      },
    });
  },
}) as any;
