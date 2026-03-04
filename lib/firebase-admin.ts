/**
 * Firebase Admin SDK Wrapper
 *
 * Server-side Firebase operations for API routes and server components.
 * Replaces InstantDB Admin SDK functionality.
 */

import { initializeApp, getApps, cert, type ServiceAccount, App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK
let adminApp: App;
let adminAuth: Auth;
let firestoreAdminDb: Firestore;
let adminStorage: ReturnType<typeof getStorage>;

function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Parse the private key - handle both escaped and unescaped newlines
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const serviceAccountProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const targetProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccountProjectId;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    if (!targetProjectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing Firebase Admin credentials. Please set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY'
      );
    }

    const serviceAccount: ServiceAccount = {
      projectId: serviceAccountProjectId,
      clientEmail,
      privateKey,
    };

    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: targetProjectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    adminApp = getApps()[0];
  }

  adminAuth = getAuth(adminApp);
  firestoreAdminDb = getFirestore(adminApp);
  adminStorage = getStorage(adminApp);

  return { app: adminApp, auth: adminAuth, db: firestoreAdminDb, storage: adminStorage };
}

// Lazy initialization - only initialize when first accessed
let app: App | null = null;
let auth: Auth | null = null;
let firestoreDb: Firestore | null = null;

function ensureInitialized() {
  if (!app) {
    const result = initializeFirebaseAdmin();
    app = result.app;
    auth = result.auth;
    firestoreDb = result.db;
  }
  return { app, auth, db: firestoreDb, storage: adminStorage };
}

// Helper to get firestore db
function getDb(): Firestore {
  ensureInitialized();
  return firestoreDb!;
}

/**
 * Query builder compatible with InstantDB Admin query pattern
 */
interface AdminQueryConfig {
  where?: Record<string, any>;
  order?: Record<string, 'asc' | 'desc'>;
  limit?: number;
}

interface AdminQuery {
  [collection: string]: {
    $?: AdminQueryConfig;
    [subcollection: string]: any;
  };
}

/**
 * Execute a query against Firestore
 */
async function executeQuery(queryObj: AdminQuery): Promise<any> {
  ensureInitialized();
  const results: Record<string, any[]> = {};

  for (const [collectionName, config] of Object.entries(queryObj)) {
    if (!config) continue;

    const queryConfig = config.$;
    let collectionRef = getDb().collection(collectionName);
    let query: FirebaseFirestore.Query = collectionRef;

    if (queryConfig) {
      // Apply where clauses
      if (queryConfig.where) {
        for (const [field, value] of Object.entries(queryConfig.where)) {
          const targetField = (field === 'owner.id' || field === 'owner') ? 'userId' : field;
          query = query.where(targetField, '==', value);
        }
      }

      // Apply order by
      if (queryConfig.order) {
        for (const [field, direction] of Object.entries(queryConfig.order)) {
          query = query.orderBy(field, direction === 'desc' ? 'desc' : 'asc');
        }
      }

      // Apply limit
      if (queryConfig.limit) {
        query = query.limit(queryConfig.limit);
      }
    }

    // Execute query
    const snapshot = await query.get();
    results[collectionName] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Handle subcollections if specified
    for (const [key, subConfig] of Object.entries(config)) {
      if (key === '$') continue;

      // For each document, fetch the subcollection
      const docsWithSub = await Promise.all(
        results[collectionName].map(async (doc) => {
          const subCollectionRef = getDb()
            .collection(collectionName)
            .doc(doc.id)
            .collection(key);

          const subSnapshot = await subCollectionRef.get();
          const subDocs = subSnapshot.docs.map(subDoc => ({
            id: subDoc.id,
            ...subDoc.data(),
          }));

          return {
            ...doc,
            [key]: subDocs,
          };
        })
      );

      results[collectionName] = docsWithSub;
    }
  }

  return results;
}

/**
 * Transaction operation interface
 */
interface TransactionOperation {
  collection: string;
  id: string;
  action: 'set' | 'update' | 'delete';
  data?: any;
}

/**
 * Execute a batch transaction
 */
async function executeTransaction(operations: TransactionOperation[]): Promise<void> {
  ensureInitialized();
  const batch = getDb().batch();

  for (const op of operations) {
    const docRef = getDb().collection(op.collection).doc(op.id);

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
 * Transaction builder for InstantDB-style tx API
 */
class TransactionBuilder {
  private operations: TransactionOperation[] = [];

  [collection: string]: any;

  constructor() {
    // Create a proxy to handle dynamic collection names
    return new Proxy(this, {
      get(target, prop: string) {
        if (prop in target) {
          return (target as any)[prop];
        }

        return new Proxy({}, {
          get(_, docId: string) {
            const createProxyOp = (collection: string, docId: string, action: 'set' | 'update' | 'delete', data: any = {}) => {
              const op: any = { collection, id: docId, action, data };
              
              op.link = (linkData: any) => {
                op.data = { ...op.data, ...linkData };
                if (linkData.owner) {
                  op.data.userId = linkData.owner;
                }
                return op;
              };
              
              op.unlink = (unlinkFields: any = {}) => {
                return op;
              };
              
              return op;
            };

            return {
              update: (data: any) => createProxyOp(prop, docId, 'update', data),
              set: (data: any) => createProxyOp(prop, docId, 'set', data),
              delete: () => createProxyOp(prop, docId, 'delete'),
              link: (linkData: any) => createProxyOp(prop, docId, 'update').link(linkData),
              unlink: () => createProxyOp(prop, docId, 'update').unlink()
            };
          }
        });
      },
    });
  }

  getOperations(): TransactionOperation[] {
    return this.operations;
  }
}

/**
 * Create transaction operations
 */
function createTx() {
  return new TransactionBuilder();
}

/**
 * Verify an authentication token
 */
async function verifyAuthToken(token: string) {
  try {
    const { auth: initializedAuth } = ensureInitialized();
    if (!initializedAuth) throw new Error("Auth failed to initialize");

    // Fix Audience Mismatch: Initialize a lightweight app just for auth if needed
    const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    
    let authInstance = initializedAuth;
    if (clientProjectId && adminProjectId && clientProjectId !== adminProjectId) {
       let clientApp;
       try {
         clientApp = getApps().find(a => a.name === 'clientAuthApp') || 
                     initializeApp({ projectId: clientProjectId }, 'clientAuthApp');
       } catch (e) {
         clientApp = getApps().find(a => a.name === 'clientAuthApp');
       }
       if (clientApp) {
         authInstance = getAuth(clientApp);
       }
    }

    const decodedToken = await authInstance.verifyIdToken(token);
    return {
      id: decodedToken.uid,
      email: decodedToken.email,
      ...decodedToken,
    };
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

/**
 * Create a custom token for a user
 */
async function createCustomToken(uid: string): Promise<string> {
  return await adminAuth.createCustomToken(uid);
}

/**
 * Get a user by ID
 */
async function getUserById(uid: string) {
  try {
    const userRecord = await adminAuth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Export admin interface compatible with InstantDB Admin SDK
 */
export const adminDb = {
  query: executeQuery,
  transact: async (operations: any | any[]) => {
    const converted: TransactionOperation[] = [];
    const opsArray = Array.isArray(operations) ? operations : [operations];

    for (const op of opsArray) {
      if (typeof op === 'object' && op !== null && op.collection && op.id) {
        converted.push(op as TransactionOperation);
      }
    }

    if (converted.length > 0) {
      await executeTransaction(converted);
    }
  },
  auth: {
    verifyToken: verifyAuthToken,
    createCustomToken,
    getUser: getUserById,
  },
  storage: {
    uploadFile: async (path: string, buffer: Buffer | Uint8Array, opts?: { contentType?: string }) => {
      ensureInitialized();
      const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
      const file = bucket.file(path);
      await file.save(buffer, {
        metadata: { contentType: opts?.contentType }
      });
      return { path };
    },
    getDownloadUrl: async (path: string) => {
      if (path.startsWith('http')) return path;
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
    }
  },
  tx: createTx(),
  get db() {
    ensureInitialized();
    return firestoreDb!;
  },
};

/**
 * Firestore server-side helpers
 */
export const serverDb = {
  collection: (name: string) => {
    ensureInitialized();
    return getDb().collection(name);
  },
  doc: (collectionName: string, docId: string) => {
    ensureInitialized();
    return getDb().collection(collectionName).doc(docId);
  },
  batch: () => {
    ensureInitialized();
    return getDb().batch();
  },
  FieldValue,
};

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// Export with lazy initialization
export const db = {
  get instance() {
    ensureInitialized();
    return firestoreDb!;
  },
};

export const adminAuthExport = {
  get instance() {
    ensureInitialized();
    return auth!;
  },
};

export const appExport = {
  get instance() {
    ensureInitialized();
    return app!;
  },
};

export { FieldValue };
export { generateId as id };
