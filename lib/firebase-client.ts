"use client";

/**
 * Firebase Client Wrapper
 *
 * Client-side Firestore query hooks and transaction utilities.
 */

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
  QueryConstraint,
  DocumentData,
  CollectionReference,
  Query,
  Unsubscribe,
  writeBatch,
  WriteBatch,
  DocumentReference,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useEffect, useState, useCallback } from "react";
import { db, storage } from "./firebase-config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Type definitions
export interface FirestoreQuery {
  [alias: string]: {
    $?: {
      collection?: string; // Optional: specify different collection than the alias
      where?: Record<string, any>;
      order?: Record<string, "asc" | "desc">;
      limit?: number;
    };
    [subcollection: string]: any;
  } | null;
}

export interface QueryResult<T = any> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Parse where clause to Firestore where constraints
 */
function parseWhereClause(whereClause: Record<string, any>): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const [key, value] of Object.entries(whereClause)) {
    // Handle nested paths like "owner.id"
    if (key === "owner.id" || key === "owner") {
      constraints.push(where("userId", "==", value));
    } else if (key.includes(".")) {
      constraints.push(where(key, "==", value));
    } else {
      constraints.push(where(key, "==", value));
    }
  }

  return constraints;
}

/**
 * Parse order clause to Firestore orderBy constraints
 */
function parseOrderClause(
  orderClause: Record<string, "asc" | "desc">,
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const [field, direction] of Object.entries(orderClause)) {
    constraints.push(orderBy(field, direction));
  }

  return constraints;
}

/**
 * Build a Firestore query from a query config object
 */
function buildFirestoreQuery(
  collectionName: string,
  queryConfig?: {
    where?: Record<string, any>;
    order?: Record<string, "asc" | "desc">;
    limit?: number;
  },
): Query<DocumentData> {
  let q: Query<DocumentData> = collection(db, collectionName);

  if (!queryConfig) return q;

  const constraints: QueryConstraint[] = [];

  // Add where constraints
  if (queryConfig.where) {
    constraints.push(...parseWhereClause(queryConfig.where));
  }

  // Add orderBy constraints
  if (queryConfig.order) {
    constraints.push(...parseOrderClause(queryConfig.order));
  }

  // Add limit
  if (queryConfig.limit) {
    constraints.push(firestoreLimit(queryConfig.limit));
  }

  return query(q, ...constraints);
}

/**
 * Hook to query Firestore with real-time updates
 * Real-time Firestore query hook with snapshot listeners
 */
export function useFirestoreQuery<T = any>(
  queryObj: FirestoreQuery | null,
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryObj) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const unsubscribers: Unsubscribe[] = [];
    const results: Record<string, any[]> = {};

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Process each collection in the query
        for (const [alias, config] of Object.entries(queryObj)) {
          if (!config) continue;

          const queryConfig = config.$;
          const collectionName = queryConfig?.collection || alias;

          // Check if this is a simple query by ID
          let isDocQuery = false;
          let docId = null;
          if (
            queryConfig?.where?.id &&
            typeof queryConfig.where.id === "string" &&
            Object.keys(queryConfig.where).length === 1
          ) {
            isDocQuery = true;
            docId = queryConfig.where.id;
          }

          if (isDocQuery && docId) {
            const docRef = doc(db, collectionName, docId);
            const unsubscribe = onSnapshot(
              docRef,
              (snapshot) => {
                if (snapshot.exists()) {
                  results[alias] = [{ id: snapshot.id, ...snapshot.data() }];
                } else {
                  results[alias] = [];
                }
                setData({ ...results } as T);
                setIsLoading(false);
              },
              (err) => {
                console.error(
                  `Firebase Permission/Query Error on Doc [${collectionName}/${docId}]:`,
                  err.message,
                  err.code,
                );
                setError(err as Error);
                setIsLoading(false);
              },
            );
            unsubscribers.push(unsubscribe);
          } else {
            const firestoreQuery = buildFirestoreQuery(
              collectionName,
              queryConfig,
            );

            // Set up real-time listener
            const unsubscribe = onSnapshot(
              firestoreQuery,
              (snapshot) => {
                const docs = snapshot.docs.map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }));

                results[alias] = docs;
                setData({ ...results } as T);
                setIsLoading(false);
              },
              (err) => {
                const userId =
                  (db as any)._currentUser?.id || (db as any)._currentUser?.uid;
                console.error(
                  `Firebase Permission/Query Error [${collectionName}] (alias: ${alias}) for user [${userId}]:`,
                  err.message,
                  err.code,
                  {
                    where: queryConfig?.where,
                    config: queryConfig,
                  },
                );
                setError(err as Error);
                setIsLoading(false);
              },
            );

            unsubscribers.push(unsubscribe);
          }
        }
      } catch (err) {
        console.error("Error setting up query:", err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [JSON.stringify(queryObj)]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch a single document with real-time updates
 */
export function useFirestoreDoc<T = any>(
  collectionName: string,
  documentId: string | null,
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionName || !documentId) {
      setData(null);
      setIsLoading(false);
      return;
    }

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
      },
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  return { data, isLoading, error };
}

/**
 * Transaction builder for Firestore batch writes
 */
export class FirestoreTransaction {
  private batch: WriteBatch;
  private operations: Array<() => void> = [];

  constructor() {
    this.batch = writeBatch(db);
  }

  /**
   * Create or update a document
   */
  set(collectionName: string, documentId: string, data: any) {
    const docRef = doc(db, collectionName, documentId);
    this.operations.push(() => {
      // Standardize on userId, but support owner for compatibility
      const userId = data.userId || data.owner;
      this.batch.set(
        docRef,
        { ...data, id: documentId, userId: userId },
        { merge: true },
      );
    });
    return this;
  }

  /**
   * Update a document (partial)
   */
  update(collectionName: string, documentId: string, data: any) {
    const docRef = doc(db, collectionName, documentId);
    this.operations.push(() => {
      // If owner is being updated, ensure userId is also updated
      const updateData = { ...data };
      if (data.owner !== undefined) {
        updateData.userId = data.owner;
      }
      this.batch.update(docRef, updateData);
    });
    return this;
  }

  /**
   * Delete a document
   */
  delete(collectionName: string, documentId: string) {
    const docRef = doc(db, collectionName, documentId);
    this.operations.push(() => {
      this.batch.delete(docRef);
    });
    return this;
  }

  /**
   * Commit all operations
   */
  async commit() {
    // Execute all operations
    this.operations.forEach((op) => op());

    // Commit the batch
    await this.batch.commit();
  }
}

/**
 * Create a transaction builder
 */
export function createTransaction() {
  return new FirestoreTransaction();
}

/**
 * Execute multiple operations in a Firestore batch
 */
export async function transact(
  operations: Array<{
    collection: string;
    id: string;
    action: "set" | "update" | "delete";
    data?: any;
  }>,
) {
  const batch = writeBatch(db);

  for (const op of operations) {
    if (!op?.collection || !op?.id) {
      throw new Error("transact: each operation must have collection and id");
    }
    const docRef = doc(db, op.collection, op.id);

    switch (op.action) {
      case "set":
        const userId = op.data?.userId ?? op.data?.owner;
        const setData: Record<string, any> = { id: op.id };
        if (userId !== undefined) setData.userId = userId;
        for (const [k, v] of Object.entries(op.data || {})) {
          if (v !== undefined) setData[k] = v;
        }
        batch.set(docRef, setData, { merge: true });
        break;
      case "update":
        const updateData: Record<string, any> = {};
        for (const [k, v] of Object.entries(op.data || {})) {
          if (v !== undefined) updateData[k] = v;
        }
        if (op.data?.owner !== undefined) updateData.userId = op.data.owner;
        batch.update(docRef, updateData);
        break;
      case "delete":
        batch.delete(docRef);
        break;
    }
  }

  await batch.commit();
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Upload a file to Firebase Storage
 */
export async function uploadFile(
  path: string,
  file: File | Blob,
  opts?: { contentType?: string },
) {
  const storageRef = ref(storage, path);
  const metadata = opts?.contentType
    ? { contentType: opts.contentType }
    : undefined;
  await uploadBytes(storageRef, file, metadata);
  return { path };
}

/**
 * Get a public URL for a Firebase Storage file synchronously
 */
export function getFileUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (path.startsWith("data:")) return path;

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return path;

  // Format: https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?alt=media
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/**
 * Export Firebase client interface
 */
export const firebaseDb = {
  useQuery: useFirestoreQuery,
  useDoc: useFirestoreDoc,
  transact,
  createTransaction,
  id: generateId,
};
