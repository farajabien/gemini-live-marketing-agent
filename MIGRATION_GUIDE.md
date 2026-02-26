# Firebase Migration Guide

This guide walks through the complete migration process from InstantDB to Firebase for the IdeaToVideo application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Firebase Setup](#phase-1-firebase-setup)
3. [Phase 2: Code Migration](#phase-2-code-migration)
4. [Phase 3: Testing](#phase-3-testing)
5. [Phase 4: Deployment](#phase-4-deployment)
6. [Rollback Plan](#rollback-plan)

---

## Prerequisites

Before starting the migration, ensure you have:

- [ ] Firebase project created (https://console.firebase.google.com)
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Service account credentials downloaded from Firebase Console
- [ ] Backup of current InstantDB data (if needed)

---

## Phase 1: Firebase Setup

### Step 1.1: Configure Firebase Project

1. **Create Firebase Project:**
   ```bash
   firebase login
   firebase projects:list
   # Note your project ID
   ```

2. **Enable Required Services:**
   - Firestore Database
   - Firebase Authentication
   - Firebase Storage (if needed)

3. **Download Service Account Credentials:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely (DO NOT commit to git)

### Step 1.2: Update Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in Firebase credentials:
   ```env
   # Firebase Configuration
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

   # Firebase Admin SDK
   FIREBASE_ADMIN_PROJECT_ID=your_project_id
   FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
   ```

### Step 1.3: Deploy Security Rules and Indexes

1. **Initialize Firebase in your project:**
   ```bash
   firebase init firestore
   # Select existing project
   # Use existing firestore.rules
   # Use existing firestore.indexes.json
   ```

2. **Deploy rules and indexes:**
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   ```

3. **Verify deployment:**
   - Check Firebase Console → Firestore Database → Rules
   - Check Firebase Console → Firestore Database → Indexes

---

## Phase 2: Code Migration

### Step 2.1: Update Authentication

**Files to update:**

1. **Update `hooks/use-auth.ts`:**
   ```typescript
   // Change import
   // OLD: import { useAuth } from "@/hooks/use-auth";
   // NEW: import { useAuth } from "@/hooks/use-firebase-auth";
   ```

   Or create an alias:
   ```typescript
   // In hooks/use-auth.ts
   export { useFirebaseAuth as useAuth } from './use-firebase-auth';
   ```

### Step 2.2: Update Client-Side Queries

**Pattern 1: Simple useQuery replacement**

**OLD (InstantDB):**
```typescript
import { db } from "@/lib/instant-client";

const { data, isLoading, error } = db.useQuery({
  videoPlans: {
    $: {
      where: { "owner.id": userId },
      order: { createdAt: "desc" },
      limit: 50,
    },
  },
});
```

**NEW (Firebase):**
```typescript
import { useCollection } from "@/hooks/use-firestore";

const { data: videoPlans, isLoading, error } = useCollection('videoPlans', {
  where: [{ field: 'userId', operator: '==', value: userId }],
  orderBy: [{ field: 'createdAt', direction: 'desc' }],
  limit: 50,
});

// Access data as: videoPlans (array) instead of data.videoPlans
```

**Pattern 2: Multiple collections**

**OLD (InstantDB):**
```typescript
const { data } = db.useQuery({
  videoPlans: { $: { where: { "owner.id": userId } } },
  series: { $: { where: { "owner.id": userId } } },
});
```

**NEW (Firebase):**
```typescript
const { data: videoPlans } = useCollection('videoPlans', {
  where: [{ field: 'userId', operator: '==', value: userId }],
});

const { data: series } = useCollection('series', {
  where: [{ field: 'userId', operator: '==', value: userId }],
});
```

### Step 2.3: Update Server-Side Queries

**Pattern 1: Admin query**

**OLD (InstantDB):**
```typescript
import { adminDb } from "@/lib/instant-admin";

const queryResult = await adminDb.query({
  videoPlans: {
    $: { where: { id: planId } },
    owner: {},
  },
});
const plan = queryResult.videoPlans?.[0];
```

**NEW (Firebase):**
```typescript
import { adminDb } from "@/lib/firebase-admin";

const queryResult = await adminDb.query({
  videoPlans: {
    $: { where: { id: planId } },
  },
});
const plan = queryResult.videoPlans?.[0];

// Note: Need to fetch owner separately or use joins
```

### Step 2.4: Update Transactions

**OLD (InstantDB):**
```typescript
import { db, tx } from "@/lib/instant-admin";

await db.transact([
  tx.series[seriesId].update(seriesData),
  tx.episodes[episodeId].update(episodeData),
]);
```

**NEW (Firebase):**
```typescript
import { batchWrite } from "@/hooks/use-firestore";

await batchWrite([
  { type: 'update', collection: 'series', id: seriesId, data: seriesData },
  { type: 'update', collection: 'episodes', id: episodeId, data: episodeData },
]);
```

### Step 2.5: Update Auth Token Verification

**OLD (InstantDB - API routes):**
```typescript
import { init } from "@instantdb/admin";

const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });
const authUser = await db.auth.verifyToken(token);
```

**NEW (Firebase):**
```typescript
import { adminDb } from "@/lib/firebase-admin";

const authUser = await adminDb.auth.verifyToken(token);
```

---

## Phase 3: Testing

### Step 3.1: Unit Testing

Test individual components:

1. **Test authentication flow:**
   ```bash
   # Sign in as guest
   # Verify user document created
   # Check token generation
   ```

2. **Test queries:**
   ```bash
   # Create test data
   # Verify queries return correct data
   # Test real-time updates
   ```

3. **Test transactions:**
   ```bash
   # Test batch writes
   # Verify atomicity
   ```

### Step 3.2: Integration Testing

1. **Test complete user flows:**
   - [ ] User sign-in/sign-out
   - [ ] Create video plan
   - [ ] Create series with episodes
   - [ ] Generate content from narrative
   - [ ] Update and delete operations

2. **Test edge cases:**
   - [ ] Concurrent updates
   - [ ] Large batch operations
   - [ ] Network failures
   - [ ] Auth token expiration

### Step 3.3: Performance Testing

1. **Query performance:**
   ```bash
   # Measure query response times
   # Compare with InstantDB baseline
   # Optimize slow queries
   ```

2. **Write performance:**
   ```bash
   # Test batch write limits
   # Measure transaction times
   ```

---

## Phase 4: Deployment

### Step 4.1: Staged Rollout

1. **Deploy to staging environment:**
   ```bash
   # Set up staging Firebase project
   # Deploy code with Firebase configuration
   # Run full test suite
   ```

2. **Enable feature flag:**
   ```typescript
   // Add environment variable
   NEXT_PUBLIC_USE_FIREBASE=true

   // In code
   const useFirebase = process.env.NEXT_PUBLIC_USE_FIREBASE === 'true';
   ```

3. **Monitor staging:**
   - Check error logs
   - Monitor query performance
   - Verify all features work

### Step 4.2: Production Deployment

1. **Data migration (if needed):**
   ```bash
   # Run data migration script
   npm run migrate-data
   ```

2. **Deploy to production:**
   ```bash
   # Update environment variables
   # Deploy Next.js app
   vercel --prod
   ```

3. **Monitor production:**
   - Watch Firebase Console for errors
   - Monitor application logs
   - Check user feedback

---

## Phase 5: Cleanup

After successful migration and verification (1-2 weeks):

1. **Remove InstantDB dependencies:**
   ```bash
   npm uninstall @instantdb/react @instantdb/admin
   ```

2. **Remove old files:**
   ```bash
   rm lib/instant-client.ts
   rm lib/instant-admin.ts
   rm lib/db/series.ts
   ```

3. **Remove old environment variables:**
   - Remove `NEXT_PUBLIC_INSTANT_APP_ID`
   - Remove `INSTANT_APP_ADMIN_TOKEN`

---

## Rollback Plan

If critical issues are discovered:

### Quick Rollback (within 24 hours)

1. **Revert environment variables:**
   ```bash
   # Switch back to InstantDB credentials
   # Set NEXT_PUBLIC_USE_FIREBASE=false
   ```

2. **Redeploy previous version:**
   ```bash
   vercel rollback
   ```

### Full Rollback (after 24 hours)

1. **Restore code:**
   ```bash
   git revert <migration-commit>
   git push
   ```

2. **Redeploy:**
   ```bash
   vercel --prod
   ```

---

## Common Issues and Solutions

### Issue 1: "Missing or insufficient permissions"

**Cause:** Firestore security rules blocking access

**Solution:**
1. Check security rules in Firebase Console
2. Verify `userId` field is set correctly
3. Check authentication token

### Issue 2: "Index not found"

**Cause:** Composite index not created

**Solution:**
1. Click the link in the error message to create index
2. Or deploy indexes: `firebase deploy --only firestore:indexes`
3. Wait for index creation (can take several minutes)

### Issue 3: "Auth token expired"

**Cause:** Firebase tokens expire after 1 hour

**Solution:**
1. Implement token refresh logic
2. Use `onIdTokenChanged` listener
3. Store refresh token and renew before expiry

### Issue 4: "Subcollection not found"

**Cause:** Data structure mismatch

**Solution:**
1. Verify collection paths
2. Check if using top-level or subcollection
3. Update query paths accordingly

---

## Migration Checklist

Use this checklist to track migration progress:

### Setup
- [ ] Firebase project created
- [ ] Service account credentials downloaded
- [ ] Environment variables configured
- [ ] Security rules deployed
- [ ] Indexes deployed

### Code Migration
- [ ] Authentication updated
- [ ] Client-side queries migrated
- [ ] Server-side queries migrated
- [ ] Transactions updated
- [ ] Database helpers updated

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks acceptable
- [ ] All features working

### Deployment
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Monitoring set up
- [ ] Backup strategy in place

### Cleanup
- [ ] Old dependencies removed
- [ ] Old files deleted
- [ ] Documentation updated
- [ ] Team trained on new system

---

## Support and Resources

- **Firestore Documentation:** https://firebase.google.com/docs/firestore
- **Migration Script:** `scripts/validate-migration.ts`
- **Schema Documentation:** `FIRESTORE_SCHEMA.md`
- **Firebase Console:** https://console.firebase.google.com

---

## Migration Timeline

**Estimated total time: 2-4 weeks**

- **Week 1:** Setup, code migration, initial testing
- **Week 2:** Integration testing, performance optimization
- **Week 3:** Staging deployment, user acceptance testing
- **Week 4:** Production deployment, monitoring, cleanup
