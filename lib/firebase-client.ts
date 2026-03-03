"use client";

/**
 * Firebase Client Wrapper
 *
 * Provides a similar API to InstantDB for querying Firestore.
 * This wrapper maintains compatibility with existing code patterns.
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
} from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { db } from './firebase-config';

// Type definitions
export interface FirestoreQuery {
  [collection: string]: {
    $?: {
      where?: Record<string, any>;
      order?: Record<string, 'asc' | 'desc'>;
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
 * Parse InstantDB-style where clause to Firestore where constraints
 */
function parseWhereClause(whereClause: Record<string, any>): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const [key, value] of Object.entries(whereClause)) {
    // Handle nested paths like "owner.id"
    if (key === 'owner.id' || key === 'owner') {
      constraints.push(where('userId', '==', value));
    } else if (key.includes('.')) {
      constraints.push(where(key, '==', value));
    } else {
      constraints.push(where(key, '==', value));
    }
  }

  return constraints;
}

/**
 * Parse InstantDB-style order clause to Firestore orderBy constraints
 */
function parseOrderClause(orderClause: Record<string, 'asc' | 'desc'>): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const [field, direction] of Object.entries(orderClause)) {
    constraints.push(orderBy(field, direction));
  }

  return constraints;
}

/**
 * Build a Firestore query from InstantDB-style query object
 */
function buildFirestoreQuery(
  collectionName: string,
  queryConfig?: {
    where?: Record<string, any>;
    order?: Record<string, 'asc' | 'desc'>;
    limit?: number;
  }
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
 * Compatible with InstantDB's useQuery pattern
 */
export function useFirestoreQuery<T = any>(
  queryObj: FirestoreQuery | null
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
        for (const [collectionName, config] of Object.entries(queryObj)) {
          if (!config) continue;

          const queryConfig = config.$;
          
          // Check if this is a simple query by ID
          let isDocQuery = false;
          let docId = null;
          if (queryConfig?.where?.id && typeof queryConfig.where.id === 'string' && Object.keys(queryConfig.where).length === 1) {
            isDocQuery = true;
            docId = queryConfig.where.id;
          }

          if (isDocQuery && docId) {
            const docRef = doc(db, collectionName, docId);
            const unsubscribe = onSnapshot(
              docRef,
              (snapshot) => {
                if (snapshot.exists()) {
                  results[collectionName] = [{ id: snapshot.id, ...snapshot.data() }];
                } else {
                  results[collectionName] = [];
                }
                setData({ ...results } as T);
                setIsLoading(false);
              },
              (err) => {
                console.error(`Firebase Permission/Query Error on Doc [${collectionName}/${docId}]:`, err.message, err.code);
                setError(err as Error);
                setIsLoading(false);
              }
            );
            unsubscribers.push(unsubscribe);
          } else {
            const firestoreQuery = buildFirestoreQuery(collectionName, queryConfig);

            // Set up real-time listener
            const unsubscribe = onSnapshot(
              firestoreQuery,
              (snapshot) => {
                const docs = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                }));

                results[collectionName] = docs;
                setData({ ...results } as T);
                setIsLoading(false);
              },
              (err) => {
                console.error(`Firebase Permission/Query Error [${collectionName}]:`, err.message, err.code);
                setError(err as Error);
                setIsLoading(false);
              }
            );

            unsubscribers.push(unsubscribe);
          }
        }
      } catch (err) {
        console.error('Error setting up query:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [JSON.stringify(queryObj)]);

  return { data, isLoading, error };
}

/**
 * Hook to fetch a single document with real-time updates
 */
export function useFirestoreDoc<T = any>(
  collectionName: string,
  documentId: string | null
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!documentId) {
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
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  return { data, isLoading, error };
}

/**
 * Transaction builder compatible with InstantDB's tx pattern
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
      this.batch.set(docRef, { ...data, id: documentId, userId: userId }, { merge: true });
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
      if (data.owner) {
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
    this.operations.forEach(op => op());

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
 * Execute multiple operations in a batch (compatible with InstantDB transact)
 */
export async function transact(operations: Array<{
  collection: string;
  id: string;
  action: 'set' | 'update' | 'delete';
  data?: any
}>) {
  const batch = writeBatch(db);

  for (const op of operations) {
    const docRef = doc(db, op.collection, op.id);

    switch (op.action) {
      case 'set':
        const userId = op.data?.userId || op.data?.owner;
        batch.set(docRef, { ...op.data, id: op.id, userId }, { merge: true });
        break;
      case 'update':
        const updateData = { ...op.data };
        if (op.data?.owner) {
          updateData.userId = op.data.owner;
        }
        batch.update(docRef, updateData);
        break;
      case 'delete':
        batch.delete(docRef);
        break;
    }
  }

  await batch.commit();
}

/**
 * Generate a unique ID (compatible with InstantDB's id())
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Export main interface compatible with InstantDB
 */
export const firebaseDb = {
  useQuery: useFirestoreQuery,
  useDoc: useFirestoreDoc,
  transact,
  createTransaction,
  id: generateId,
};
