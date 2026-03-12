/**
 * Custom Firestore React Hooks
 *
 * Easy-to-use hooks for common Firestore operations.
 * These hooks provide a clean API for interacting with Firestore from React components.
 */

import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Query,
  DocumentData,
  WhereFilterOp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase-config';

export interface QueryConstraints {
  where?: Array<{
    field: string;
    operator: WhereFilterOp;
    value: any;
  }>;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  limit?: number;
}

export interface UseCollectionResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseDocumentResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to subscribe to a Firestore collection with real-time updates
 */
export function useCollection<T = any>(
  collectionName: string,
  constraints?: QueryConstraints
): UseCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    try {
      let q: Query<DocumentData> = collection(db, collectionName);

      // Apply constraints
      const queryConstraints: any[] = [];

      if (constraints?.where) {
        constraints.where.forEach(({ field, operator, value }) => {
          queryConstraints.push(where(field, operator, value));
        });
      }

      if (constraints?.orderBy) {
        constraints.orderBy.forEach(({ field, direction }) => {
          queryConstraints.push(orderBy(field, direction));
        });
      }

      if (constraints?.limit) {
        queryConstraints.push(firestoreLimit(constraints.limit));
      }

      if (queryConstraints.length > 0) {
        q = query(q, ...queryConstraints);
      }

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          } as T));

          setData(docs);
          setIsLoading(false);
        },
        (err) => {
          console.error(`Error fetching collection ${collectionName}:`, err);
          setError(err as Error);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error(`Error setting up collection listener:`, err);
      setError(err as Error);
      setIsLoading(false);
    }
  }, [collectionName, JSON.stringify(constraints), refetchTrigger]);

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to subscribe to a single Firestore document with real-time updates
 */
export function useDocument<T = any>(
  collectionName: string,
  documentId: string | null
): UseDocumentResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    if (!documentId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error(`Error fetching document ${documentId}:`, err);
        setError(err as Error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId, refetchTrigger]);

  const refetch = () => setRefetchTrigger(prev => prev + 1);

  return { data, isLoading, error, refetch };
}

/**
 * Hook to get user-specific documents
 */
export function useUserCollection<T = any>(
  collectionName: string,
  userId: string | null,
  additionalConstraints?: Omit<QueryConstraints, 'where'>
): UseCollectionResult<T> {
  const constraints: QueryConstraints = {
    where: userId ? [{ field: 'userId', operator: '==', value: userId }] : undefined,
    ...additionalConstraints,
  };

  return useCollection<T>(collectionName, constraints);
}

/**
 * Mutation helpers for creating, updating, and deleting documents
 */

export async function createDocument<T>(
  collectionName: string,
  data: T,
  customId?: string
): Promise<string> {
  const id = customId || crypto.randomUUID();
  const docRef = doc(db, collectionName, id);

  await setDoc(docRef, {
    ...data,
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return id;
}

export async function updateDocument<T extends Record<string, any>>(
  collectionName: string,
  documentId: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db, collectionName, documentId);

  await updateDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  });
}

/**
 * Upsert a document (create or update)
 */
export async function upsertDocument<T extends Record<string, any>>(
  collectionName: string,
  documentId: string,
  data: T
): Promise<void> {
  if (!collectionName || !documentId) {
    throw new Error('upsertDocument: collection and documentId are required');
  }
  const docRef = doc(db, collectionName, documentId);
  const cleanData: Record<string, any> = { id: documentId, updatedAt: Date.now() };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) cleanData[k] = v;
  }
  await setDoc(docRef, cleanData, { merge: true });
}

export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<void> {
  const docRef = doc(db, collectionName, documentId);
  await deleteDoc(docRef);
}

/**
 * Batch operations
 */
export async function batchWrite(
  operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id: string;
    data?: any;
  }>
): Promise<void> {
  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = doc(db, op.collection, op.id);

    switch (op.type) {
      case 'create':
        batch.set(docRef, {
          ...op.data,
          id: op.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        break;
      case 'update':
        batch.update(docRef, {
          ...op.data,
          updatedAt: Date.now(),
        });
        break;
      case 'delete':
        batch.delete(docRef);
        break;
    }
  }

  await batch.commit();
}

/**
 * Hook for mutations with loading and error states
 */
export function useMutation<T = any>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = async (fn: () => Promise<T>): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fn();
      setIsLoading(false);
      return result;
    } catch (err) {
      console.error('Mutation error:', err);
      setError(err as Error);
      setIsLoading(false);
      return null;
    }
  };

  return { mutate, isLoading, error };
}
