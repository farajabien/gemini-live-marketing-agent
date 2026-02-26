# Firebase Migration - Complete Package

This migration package contains everything needed to migrate the IdeaToVideo application from InstantDB to Firebase Firestore.

## 📦 What's Included

### Configuration Files
- **`lib/firebase-config.ts`** - Firebase client SDK initialization
- **`firestore.rules`** - Security rules for all collections
- **`firestore.indexes.json`** - Composite indexes for optimized queries
- **`.env.example`** - Updated with Firebase environment variables

### Database Wrappers
- **`lib/firebase-client.ts`** - Client-side wrapper compatible with InstantDB API
- **`lib/firebase-admin.ts`** - Server-side Admin SDK wrapper
- **`lib/db/firebase-series.ts`** - Updated series helpers for Firestore

### React Hooks
- **`hooks/use-firestore.ts`** - Custom Firestore hooks (useCollection, useDocument, etc.)
- **`hooks/use-firebase-auth.ts`** - Firebase Authentication hook compatible with useAuth

### Documentation
- **`FIRESTORE_SCHEMA.md`** - Complete schema documentation for all 14 collections
- **`MIGRATION_GUIDE.md`** - Step-by-step migration guide with examples
- **`FIREBASE_MIGRATION_README.md`** - This file

### Scripts
- **`scripts/validate-migration.ts`** - Validation script to verify migration success

---

## 🚀 Quick Start

### 1. Firebase Setup (15 minutes)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database and Authentication
3. Download service account credentials
4. Update `.env.local` with Firebase credentials (see `.env.example`)

### 2. Deploy Security Rules (5 minutes)

```bash
firebase init firestore
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 3. Code Migration (Variable - depends on codebase size)

Follow the patterns in `MIGRATION_GUIDE.md`:

**Authentication:**
```typescript
// Change import
import { useAuth } from "@/hooks/use-firebase-auth";
```

**Client Queries:**
```typescript
// OLD
const { data } = db.useQuery({ videoPlans: { $: { where: { "owner.id": userId } } } });

// NEW
const { data } = useCollection('videoPlans', {
  where: [{ field: 'userId', operator: '==', value: userId }]
});
```

**Server Queries:**
```typescript
// OLD
import { adminDb } from "@/lib/instant-admin";

// NEW
import { adminDb } from "@/lib/firebase-admin";
// API is similar, see MIGRATION_GUIDE.md for details
```

### 4. Validate Migration (5 minutes)

```bash
npx tsx scripts/validate-migration.ts
```

---

## 📊 Migration Status

### Core Infrastructure ✅
- [x] Firebase configuration
- [x] Security rules
- [x] Composite indexes
- [x] Environment variables

### Database Layer ✅
- [x] Client wrapper
- [x] Admin wrapper
- [x] Custom hooks
- [x] Series helpers

### Authentication ✅
- [x] Firebase Auth integration
- [x] Anonymous sign-in
- [x] Token verification

### Documentation ✅
- [x] Schema documentation
- [x] Migration guide
- [x] Code examples

### Validation ✅
- [x] Migration validation script
- [x] Test cases included

---

## 🏗️ Architecture Overview

### Collections (14 total)

```
users/
├── {userId}
└── linkedGuestUsers/{guestId}

videoPlans/{planId}
voices/{voiceId}
series/{seriesId}/
  └── episodes/{episodeId}
episodes/{episodeId}

narratives/{narrativeId}/
├── contentPieces/{pieceId}
├── brandPositioning/{positioningId}
├── contentPillars/{pillarId}
└── contentDrafts/{draftId}

seriesNarratives/{narrativeId}
contentPieces/{pieceId}
brandPositioning/{positioningId}
contentPillars/{pillarId}
contentDrafts/{draftId}
files/{fileId}
```

### Key Relationships

- **User → VideoPlans** (1:many via `userId`)
- **User → Series** (1:many via `userId`)
- **Series → Episodes** (1:many via `seriesId` + subcollection)
- **User → Narratives** (1:many via `userId`)
- **Narrative → Content** (1:many via subcollections)

---

## 🔧 Key Features

### 1. InstantDB-Compatible API

The migration maintains API compatibility where possible:

```typescript
// Similar query patterns
db.useQuery(...) → useCollection(...)
db.transact(...) → batchWrite(...)
db.auth → Firebase Auth
```

### 2. Real-Time Updates

All hooks support real-time Firestore listeners:

```typescript
const { data, isLoading } = useCollection('videoPlans');
// Automatically updates when data changes
```

### 3. Batch Operations

Efficient batch writes for multiple operations:

```typescript
await batchWrite([
  { type: 'create', collection: 'series', id, data },
  { type: 'update', collection: 'episodes', id, data },
]);
```

### 4. Security

Comprehensive security rules:
- Users can only access their own data
- `userId` field enforced on all writes
- Voices collection is read-only
- Admin operations via Admin SDK only

### 5. Performance

Optimized with composite indexes:
- Fast queries on common patterns
- Efficient sorting and filtering
- Indexed foreign keys

---

## 📝 Migration Checklist

### Pre-Migration
- [ ] Review `FIRESTORE_SCHEMA.md`
- [ ] Review `MIGRATION_GUIDE.md`
- [ ] Backup existing InstantDB data (if needed)
- [ ] Create Firebase project

### Setup
- [ ] Install Firebase CLI
- [ ] Configure Firebase project
- [ ] Update environment variables
- [ ] Deploy security rules
- [ ] Deploy indexes

### Code Changes
- [ ] Update authentication imports
- [ ] Migrate client-side queries
- [ ] Migrate server-side queries
- [ ] Update transaction patterns
- [ ] Update database helpers

### Testing
- [ ] Run validation script
- [ ] Test authentication flow
- [ ] Test CRUD operations
- [ ] Test real-time updates
- [ ] Performance testing

### Deployment
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production
- [ ] Monitor for issues

### Cleanup
- [ ] Remove InstantDB dependencies
- [ ] Delete old files
- [ ] Update documentation

---

## 🐛 Troubleshooting

### Common Issues

**"Missing or insufficient permissions"**
- Check security rules are deployed
- Verify `userId` field is set correctly
- Ensure user is authenticated

**"Index not found"**
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Wait 5-10 minutes for index creation
- Or click the auto-generated link in the error

**"Auth token expired"**
- Implement token refresh
- Use `getIdToken(user, true)` to force refresh

**Slow queries**
- Check if indexes are deployed
- Review query patterns
- Consider denormalization for frequently accessed data

---

## 📚 Additional Resources

### Firebase Documentation
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)

### Migration Files
- `FIRESTORE_SCHEMA.md` - Complete schema reference
- `MIGRATION_GUIDE.md` - Detailed migration steps
- `scripts/validate-migration.ts` - Validation script

### Firebase Console
- [Firebase Console](https://console.firebase.google.com)
- [Firestore Database](https://console.firebase.google.com/project/_/firestore)
- [Authentication](https://console.firebase.google.com/project/_/authentication)

---

## 🎯 Next Steps

1. **Review Documentation**
   - Read `FIRESTORE_SCHEMA.md` to understand the data model
   - Read `MIGRATION_GUIDE.md` for step-by-step instructions

2. **Set Up Firebase**
   - Create project
   - Configure authentication
   - Deploy rules and indexes

3. **Start Migration**
   - Begin with authentication
   - Migrate queries incrementally
   - Test thoroughly

4. **Validate**
   - Run validation script
   - Test all features
   - Monitor performance

5. **Deploy**
   - Stage deployment first
   - Production deployment
   - Monitor and optimize

---

## 💡 Tips for Success

1. **Incremental Migration**
   - Migrate one feature at a time
   - Test after each change
   - Keep InstantDB as fallback initially

2. **Use Feature Flags**
   - Toggle between InstantDB and Firebase
   - A/B test in production
   - Gradual rollout

3. **Monitor Everything**
   - Watch Firebase Console for errors
   - Monitor query performance
   - Track costs

4. **Optimize Early**
   - Use `.limit()` on all queries
   - Implement pagination
   - Cache frequently accessed data

5. **Plan for Scale**
   - Consider Firestore limits (1MB docs, 500 writes/sec)
   - Use subcollections for large datasets
   - Implement proper error handling

---

## 📞 Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review Firebase Console error logs
3. Run the validation script for diagnostics
4. Consult Firebase documentation

---

## ✨ Benefits of Firebase

### Compared to InstantDB

**Pros:**
- ✅ Mature, battle-tested platform
- ✅ Excellent documentation
- ✅ Rich ecosystem of tools
- ✅ Integrated with Google Cloud
- ✅ Strong security features
- ✅ Real-time updates
- ✅ Offline support
- ✅ Generous free tier

**Considerations:**
- ⚠️ More complex setup
- ⚠️ Manual index management
- ⚠️ No built-in relationships
- ⚠️ Requires more boilerplate

---

## 🎉 You're Ready!

This migration package provides everything you need to successfully migrate from InstantDB to Firebase. Start with the `MIGRATION_GUIDE.md` and follow the steps carefully.

Good luck with your migration! 🚀
