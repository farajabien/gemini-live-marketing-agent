/**
 * Firebase Admin SDK Wrapper
 *
 * Server-side Firebase operations for API routes and server components.
 */

import { initializeApp, getApps, cert, type ServiceAccount, App, deleteApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialize Firebase Admin SDK
let adminApp: App;
let adminAuth: Auth;
let firestoreAdminDb: Firestore;
let adminStorage: ReturnType<typeof getStorage>;

async function initializeFirebaseAdmin() {
  const serviceAccountProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const targetProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccountProjectId;

  if (getApps().length > 0) {
    const existingApp = getApps()[0];
    if (existingApp.options.projectId !== targetProjectId) {
      console.warn(`[Firebase Admin] Project ID mismatch (Existing: ${existingApp.options.projectId}, Target: ${targetProjectId}). Deleting app for re-init.`);
      await deleteApp(existingApp);
    }
  }

  if (getApps().length === 0) {
    // Parse the private key - handle both escaped and unescaped newlines
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
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
    console.log(`[Firebase Admin] Initialized App ${adminApp.name} for project: ${targetProjectId} (Service Account: ${serviceAccountProjectId})`);
  } else {
    adminApp = getApps()[0];
    console.log(`[Firebase Admin] Reusing existing App: ${adminApp.name} (Project: ${adminApp.options.projectId})`);
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

async function ensureInitialized() {
  if (!app) {
    const result = await initializeFirebaseAdmin();
    app = result.app;
    auth = result.auth;
    firestoreDb = result.db;
  }
  return { app, auth, db: firestoreDb, storage: adminStorage };
}

// Helper to get firestore db - ASYNC
async function getDb(): Promise<Firestore> {
  const { db } = await ensureInitialized();
  return db!;
}

/**
 * Query builder for Firestore queries
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
    const db = await getDb();
    const results: Record<string, any[]> = {};

    for (const [collectionName, config] of Object.entries(queryObj)) {
        if (!config) continue;

        const queryConfig = config.$;
        let collectionRef = db.collection(collectionName);
        let query: FirebaseFirestore.Query = collectionRef;

        if (queryConfig) {
            // Optimization: If querying by ID and it's the only constraint, use direct document access
            if (queryConfig.where && queryConfig.where.id && Object.keys(queryConfig.where).length === 1 && !queryConfig.order && !queryConfig.limit) {
                const docId = queryConfig.where.id;
                const docSnap = await collectionRef.doc(docId).get();
                if (docSnap.exists) {
                    results[collectionName] = [{
                        id: docSnap.id,
                        ...docSnap.data(),
                    }];
                } else {
                    results[collectionName] = [];
                }
                
                // Still need to handle subcollections for the ID lookup result
                await handleSubcollections(collectionName, config, results, db);
                continue; 
            }

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
        await handleSubcollections(collectionName, config, results, db);
    }

    return results;
}

/**
 * Extracted subcollection handler
 */
async function handleSubcollections(collectionName: string, config: any, results: any, db: FirebaseFirestore.Firestore) {
    for (const [key, subConfig] of Object.entries(config)) {
        if (key === '$') continue;

        const docsWithSub = await Promise.all(
            results[collectionName].map(async (doc: any) => {
                const subCollectionRef = db
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
  const db = await getDb();
  const projectId = (app?.options as any)?.projectId || 'unknown';
  console.log(`[Transaction] Starting batch for ${operations.length} ops in project: ${projectId}`);
  const batch = db.batch();

  for (const op of operations) {
    const docRef = db.collection(op.collection).doc(op.id);

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
 * Transaction builder for Firestore batch operations
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
    const { auth: initializedAuth } = await ensureInitialized();
    if (!initializedAuth) throw new Error("Auth failed to initialize");

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
  const { auth: currentAuth } = await ensureInitialized();
  return await currentAuth!.createCustomToken(uid);
}

/**
 * Get a user by ID
 */
async function getUserById(uid: string) {
  try {
    const { auth: currentAuth } = await ensureInitialized();
    const userRecord = await currentAuth!.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Export Firebase Admin interface
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
      const { storage: currentStorage } = await ensureInitialized();
      const bucket = currentStorage!.bucket();
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
    // This getter is tricky because it's now async. 
    // We should probably remove it or make it throw if not initialized
    if (!firestoreDb) throw new Error("Firestore not initialized. Await getDb() or adminDb.query instead.");
    return firestoreDb;
  },
};

/**
 * Firestore server-side helpers
 */
export const serverDb = {
  collection: async (name: string) => {
    const db = await getDb();
    return db.collection(name);
  },
  doc: async (collectionName: string, docId: string) => {
    const db = await getDb();
    return db.collection(collectionName).doc(docId);
  },
  batch: async () => {
    const db = await getDb();
    return db.batch();
  },
  FieldValue,
};

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

export { FieldValue };
export { generateId as id };
