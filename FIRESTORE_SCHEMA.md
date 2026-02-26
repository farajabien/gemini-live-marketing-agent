# Firestore Schema Documentation

This document describes the Firestore database schema for the IdeaToVideo application, migrated from InstantDB.

## Collections Overview

The application uses 14 main collections:

1. `users` - User accounts and authentication
2. `videoPlans` - Video content plans and metadata
3. `voices` - Available voice options for TTS
4. `series` - Video series metadata
5. `episodes` - Individual episodes within a series
6. `narratives` - Founder narratives and positioning
7. `seriesNarratives` - Narrative configurations for series
8. `contentPieces` - Generated content pieces
9. `brandPositioning` - Brand positioning data
10. `contentPillars` - Content strategy pillars
11. `contentDrafts` - Draft content for review
12. `files` - File storage metadata

---

## Collection Schemas

### 1. users
**Path:** `/users/{userId}`

**Description:** User accounts with quota tracking and plan information.

**Fields:**
```typescript
{
  id: string;                    // User ID (matches auth UID)
  email?: string;                // User email (nullable for guests)
  imageURL?: string;             // Profile image URL
  planId?: string;               // 'free' | 'pro'
  type?: string;                 // 'user' | 'guest'
  lifetimeGenerations?: number;  // Total generations (never resets)
  monthlyGenerations?: number;   // Monthly generations (resets monthly)
  generationResetDate?: number;  // UTC timestamp of last reset
}
```

**Indexes:**
- `email` (unique)

**Subcollections:**
- `linkedGuestUsers/{guestId}` - Guest users linked to primary account

---

### 2. videoPlans
**Path:** `/videoPlans/{planId}`

**Description:** Individual video plans with scenes, voiceover, and rendering metadata.

**Fields:**
```typescript
{
  id: string;
  userId: string;                   // Owner reference
  title: string;
  tone?: string;
  scenes: Scene[];                  // JSON array of scene objects
  type?: string;                    // 'video' | 'carousel'
  status?: string;                  // 'draft' | 'pending' | 'rendering' | 'completed'
  voiceId?: string;                 // Gemini voice name for TTS
  thumbnailUrl?: string;
  thumbnailPrompt?: string;
  visualConsistency?: string;
  videoUrl?: string;
  visualMode?: string;              // 'image' | 'broll'
  duration?: number;                // Total duration in seconds
  createdAt: number;                // Timestamp

  // Content settings
  style?: string;                   // ContentStyle
  audience?: string;                // TargetAudience
  goal?: string;                    // ContentGoal
  outputFormat?: string;            // OutputFormat

  // Verbatim mode
  verbatimMode?: boolean;
  verbatimTone?: string;            // 'calm' | 'neutral' | 'confident'
  originalScript?: string;

  // Strategy & Context
  problem?: string;
  solution?: string;
  voice?: string;                   // 'calm' | 'sharp' | 'reflective' | 'blunt'
  pillars?: any[];                  // JSON content pillars
  socialMetadata?: object;          // JSON captions and hashtags
  postedAt?: number;

  // Content tagging
  contentTags?: object;             // JSON angle and tone metadata

  // Performance tracking
  metrics?: object;                 // JSON performance metrics

  // Cost tracking
  totalCost?: number;

  // Relationships
  narrativeId?: string;             // Link to narrative
  sourceContentPieceId?: string;    // Link to source content
}
```

**Indexes:**
- Composite: `(userId, createdAt DESC)`
- Composite: `(userId, status, createdAt DESC)`
- Composite: `(narrativeId, createdAt DESC)`

---

### 3. voices
**Path:** `/voices/{voiceId}`

**Description:** Available voice options for text-to-speech generation.

**Fields:**
```typescript
{
  id: string;
  voice_id: string;         // Unique voice identifier
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: string[];        // JSON array
}
```

**Indexes:**
- `voice_id` (unique)

**Access:** Read-only via client, write via Admin SDK only

---

### 4. series
**Path:** `/series/{seriesId}`

**Description:** Video series with episode tracking.

**Fields:**
```typescript
{
  id: string;
  userId: string;               // Owner reference
  title: string;
  tagline?: string;
  megaPrompt: string;           // Original user input
  formalizedJson: object;       // JSON SeriesMetadata
  visualConsistency: string;    // Character/style guide
  episodeCount: number;
  status: string;               // 'draft' | 'generating' | 'complete'
  createdAt: number;
  updatedAt: number;
  totalCost?: number;
  seriesNarrativeId?: string;   // Link to series narrative
}
```

**Indexes:**
- Composite: `(userId, createdAt DESC)`

**Subcollections:**
- `episodes/{episodeId}` - Episodes within the series

---

### 5. episodes
**Path:** `/episodes/{episodeId}`
**Also:** `/series/{seriesId}/episodes/{episodeId}` (subcollection)

**Description:** Individual episodes within a series.

**Fields:**
```typescript
{
  id: string;
  seriesId: string;             // Parent series reference
  episodeNumber: number;
  title: string;
  script: string;               // Verbatim narration text
  visualPrompts: string[];      // JSON array
  status: string;               // 'draft' | 'script_ready' | 'generating' | 'complete' | 'failed'
  videoPlanId?: string;         // Link to video plan
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;            // Duration in seconds
  createdAt: number;
  updatedAt: number;
  totalCost?: number;
}
```

**Indexes:**
- Composite: `(seriesId, episodeNumber ASC)`
- Composite: `(seriesId, createdAt DESC)`

---

### 6. narratives
**Path:** `/narratives/{narrativeId}`

**Description:** Founder narratives and brand positioning.

**Fields:**
```typescript
{
  id: string;
  userId: string;               // Owner reference
  title: string;

  // Wizard answers (strategic inputs)
  audience?: string;
  currentState?: string;
  problem?: string;
  costOfInaction?: string;
  solution?: string;
  afterState?: string;
  identityShift?: string;
  voice?: string;               // 'calm' | 'sharp' | 'reflective' | 'blunt'

  // Legacy fields (backward compatibility)
  theMoment?: string;
  thePain?: string;
  failedSolutions?: string;
  yourBelief?: string;
  yourApproach?: string;
  idealUser?: string;
  desiredChange?: string;
  founderVoice?: string;

  // AI-extracted positioning
  aiPositioning?: object;       // JSON villain, hero, stakes, etc.

  // Content angles
  angles?: object;              // JSON pain, cost, mechanism angles

  // Narrative quality metrics
  narrativeStrength?: object;   // JSON quality scores

  // Version history
  versions?: array;             // JSON version history

  // Legacy AI fields
  synthesizedNarrative?: string;
  narrativeAngles?: string[];   // JSON
  oneLiner?: string;
  problemStatement?: string;

  // Metadata
  status: string;               // 'wizard' | 'active' | 'archived'
  currentWizardStep?: number;
  createdAt: number;
  updatedAt: number;
  totalCost?: number;
}
```

**Indexes:**
- Composite: `(userId, createdAt DESC)`
- Composite: `(userId, status, createdAt DESC)`

**Subcollections:**
- `contentPieces/{pieceId}` - Content pieces for this narrative
- `brandPositioning/{positioningId}` - Brand positioning data
- `contentPillars/{pillarId}` - Content pillars
- `contentDrafts/{draftId}` - Draft content

---

### 7. seriesNarratives
**Path:** `/seriesNarratives/{narrativeId}`

**Description:** Narrative configurations for video series.

**Fields:**
```typescript
{
  id: string;
  userId: string;               // Owner reference
  title: string;
  genre: string;
  worldSetting: string;
  conflictType: string;
  protagonistArchetype: string;
  centralTheme: string;
  narrativeTone: string;
  visualStyle: string;
  episodeHooks: string;

  // AI processed
  characterDynamics?: object;   // JSON
  plotBeats?: object;           // JSON

  createdAt: number;
  updatedAt: number;
  totalCost?: number;
}
```

**Indexes:**
- Composite: `(userId, createdAt DESC)`

---

### 8. contentPieces
**Path:** `/contentPieces/{pieceId}`
**Also:** `/narratives/{narrativeId}/contentPieces/{pieceId}` (subcollection)

**Description:** Generated content pieces from narratives.

**Fields:**
```typescript
{
  id: string;
  narrativeId: string;          // Parent narrative reference
  title: string;
  body: string;
  angle?: string;
  format: string;               // 'linkedin-post' | 'x-post' | 'thread' | etc.
  hook?: string;
  callToAction?: string;
  status: string;               // 'suggested' | 'approved' | 'rejected' | 'edited' | 'published'
  editedBody?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}
```

**Indexes:**
- Composite: `(narrativeId, createdAt DESC)`
- Composite: `(narrativeId, status, createdAt DESC)`

---

### 9. brandPositioning
**Path:** `/brandPositioning/{positioningId}`
**Also:** `/narratives/{narrativeId}/brandPositioning/{positioningId}` (subcollection)

**Description:** Brand positioning data for narratives.

**Fields:**
```typescript
{
  id: string;
  narrativeId: string;          // One-to-one with narrative
  villain: string;
  hero: string;
  transformation: string;
  corePromise: string;
  pricingNarrative?: string;
  emotionalArc?: string;
  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**
- `narrativeId` (unique)

---

### 10. contentPillars
**Path:** `/contentPillars/{pillarId}`
**Also:** `/narratives/{narrativeId}/contentPillars/{pillarId}` (subcollection)

**Description:** Content strategy pillars.

**Fields:**
```typescript
{
  id: string;
  narrativeId: string;
  title: string;                // e.g., "Chaos vs Clarity"
  description?: string;
  angles: string[];             // JSON array of content angles
  status: string;               // 'active' | 'archived'
  createdAt: number;
}
```

**Indexes:**
- Composite: `(narrativeId, status, createdAt DESC)`

---

### 11. contentDrafts
**Path:** `/contentDrafts/{draftId}`
**Also:** `/narratives/{narrativeId}/contentDrafts/{draftId}` (subcollection)

**Description:** Draft content for review and scheduling.

**Fields:**
```typescript
{
  id: string;
  narrativeId: string;
  pillarId?: string;
  angle: string;
  title: string;

  // Generated content
  slides: object[];             // JSON array
  visualPrompts: string[];      // JSON array
  captions: object;             // JSON { tiktok, linkedin }

  // Status
  status: string;               // 'draft' | 'generating' | 'review' | 'scheduled' | 'posted'
  scheduledFor?: number;
  postedAt?: number;

  // Linked media
  videoPlanId?: string;

  createdAt: number;
  updatedAt: number;
}
```

**Indexes:**
- Composite: `(narrativeId, status, createdAt DESC)`
- Composite: `(narrativeId, createdAt DESC)`

---

### 12. files
**Path:** `/files/{fileId}`

**Description:** File storage metadata.

**Fields:**
```typescript
{
  id: string;
  path: string;                 // Unique file path
  url: string;                  // Storage URL
}
```

**Indexes:**
- `path` (unique)

---

## Relationships & Data Modeling

### One-to-Many Relationships

1. **User → VideoPlans**
   - Field: `videoPlans.userId`
   - Query: `where('userId', '==', userId)`

2. **User → Series**
   - Field: `series.userId`
   - Query: `where('userId', '==', userId)`

3. **Series → Episodes**
   - Field: `episodes.seriesId`
   - Query: `where('seriesId', '==', seriesId)`
   - Also available as subcollection: `/series/{seriesId}/episodes/{episodeId}`

4. **User → Narratives**
   - Field: `narratives.userId`
   - Query: `where('userId', '==', userId)`

5. **Narrative → ContentPieces**
   - Field: `contentPieces.narrativeId`
   - Query: `where('narrativeId', '==', narrativeId)`
   - Also available as subcollection: `/narratives/{narrativeId}/contentPieces/{pieceId}`

### One-to-One Relationships

1. **Narrative → BrandPositioning**
   - Field: `brandPositioning.narrativeId` (unique)
   - Query: `where('narrativeId', '==', narrativeId).limit(1)`

### Cascade Deletes

The following cascade delete behaviors should be implemented via Cloud Functions:

1. Delete Series → Delete all Episodes
2. Delete Narrative → Delete all ContentPieces
3. Delete Narrative → Delete BrandPositioning
4. Delete Narrative → Delete all ContentPillars
5. Delete Narrative → Delete all ContentDrafts

---

## Migration Notes

### Key Differences from InstantDB

1. **No Built-in Links:** Firestore doesn't have InstantDB's link syntax. Use document references or foreign key fields.

2. **Manual Cascade Deletes:** Implement cascade deletes using Cloud Functions (Firestore triggers).

3. **Subcollections:** Some relationships use subcollections for better organization and automatic cleanup.

4. **Indexes:** Composite indexes must be created manually or via `firestore.indexes.json`.

5. **JSON Fields:** Fields that were `i.json()` in InstantDB are stored as objects/arrays in Firestore.

### Query Translation Examples

**InstantDB:**
```typescript
db.useQuery({
  videoPlans: {
    $: {
      where: { "owner.id": userId },
      order: { createdAt: "desc" },
      limit: 50,
    },
  },
});
```

**Firestore:**
```typescript
useCollection('videoPlans', {
  where: [{ field: 'userId', operator: '==', value: userId }],
  orderBy: [{ field: 'createdAt', direction: 'desc' }],
  limit: 50,
});
```

---

## Security Rules

All collections are protected by Firestore Security Rules in `firestore.rules`:

- Users can only read/write their own data
- `userId` field is used for ownership validation
- Voices collection is read-only
- Files collection allows authenticated read/write

---

## Indexes

All required composite indexes are defined in `firestore.indexes.json`.

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

---

## Cost Optimization

1. **Limit Query Results:** Always use `.limit()` on queries
2. **Use Subcollections:** For frequently accessed related data
3. **Cache Client-Side:** Utilize Firestore's offline persistence
4. **Batch Operations:** Use `writeBatch()` for multiple writes
5. **Optimize Listeners:** Unsubscribe from real-time listeners when components unmount
