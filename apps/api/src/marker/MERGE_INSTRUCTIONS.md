# B1 Marker Workflow — Merge Instructions

This module is built as a self-contained Path-B fragment. The integrator
needs to perform the following copy-paste-ready merges into files I was not
allowed to touch directly.

---

## 1. Schema additions

Append the contents of `apps/api/prisma/path-b-fragments/b1.prisma` into
`apps/api/prisma/schema.prisma`, AND apply the two back-relation edits below
to existing models so Prisma compiles.

### 1a. New model — `MarkerAssignment`

Append this block at the bottom of `schema.prisma` (or in the Block 1
"Student-side" section, doesn't matter):

```prisma
model MarkerAssignment {
  id           String            @id @default(cuid())
  submissionId String            @unique // one active claim per submission
  submission   StudentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  markerId     String
  marker       User              @relation("MarkerAssignmentMarker", fields: [markerId], references: [id])
  claimedAt    DateTime          @default(now())
  releasedAt   DateTime?
  // 'active' while marker is grading; 'released' after they hand it back.
  status       String            @default("active")

  @@index([markerId, status])
  @@index([submissionId, status])
}
```

### 1b. Back-relation on `StudentSubmission`

Inside the existing `model StudentSubmission { ... }` block, add ONE line
in the relations section (next to `scripts AnswerScript[]`):

```prisma
  markerAssignments MarkerAssignment[]
```

### 1c. Back-relation on `User`

Inside the existing `model User { ... }` block, add ONE line at the bottom
of the relations section:

```prisma
  markerAssignments MarkerAssignment[] @relation("MarkerAssignmentMarker")
```

After these three edits, run:

```bash
cd apps/api
npx prisma format
npx prisma generate
npx prisma db push   # or `prisma migrate dev` if you're using migrations
```

---

## 2. Register MarkerModule in `app.module.ts`

Add the import:

```ts
import { MarkerModule } from './marker/marker.module';
```

Add to the `@Module({ imports: [...] })` array (after `StudentModule` is the
natural spot, since marker depends on submissions):

```ts
    StudentModule,
    MarkerModule,
```

No other wiring needed — `MarkerService` declares `PrismaService` as a
provider in its module, and the global `AuthGuard` is already in
`APP_GUARD` so `@UseGuards(AuthGuard)` is belt-and-braces (matches the
papers controller pattern).

---

## 3. Add API client methods to `apps/web/src/lib/api.ts`

Add the following entries inside the `export const api = { ... }` object
(natural place: just after the `// review queue` block):

```ts
  // marker workflow (admin / head_teacher / teacher)
  markerQueue: (params: any = {}) => request('GET', `/marker/queue${qs(params)}`),
  markerSubmission: (id: string) => request('GET', `/marker/submissions/${id}`),
  markerClaim: (submissionId: string) =>
    request('POST', '/marker/claim', { submissionId }),
  markerRelease: (submissionId: string) =>
    request('POST', '/marker/release', { submissionId }),
  markerScoreScript: (scriptId: string, data: { awardedMarks: number; markerComment?: string | null }) =>
    request('PATCH', `/marker/scripts/${scriptId}`, data),
  markerFinalize: (submissionId: string) =>
    request('POST', `/marker/finalize/${submissionId}`),
```

The Marker pages are written to fall back to raw `fetch()` if these
helpers aren't present, so the pages will keep working pre-merge — but the
TS types will be cleaner once these are in.

---

## 4. Add routes to `apps/web/src/App.tsx`

### 4a. Imports

Add near the other page imports:

```ts
import MarkerQueuePage from './pages/MarkerQueue';
import MarkerScriptPage from './pages/MarkerScript';
```

### 4b. Routes

Inside the teacher-layout `<Routes>` block (i.e. NOT the student
sub-routes), add the following two routes — gate them on
`teacher | head_teacher | admin`:

```tsx
          <Route
            path="/marker"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MarkerQueuePage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/marker/:submissionId"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MarkerScriptPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
```

### 4c. Navigation link

Inside the teacher-layout `<nav>` block (right after the `Templates` nav
link is a good place), add:

```tsx
              <NavLink to="/marker" label="Marker" />
```

It can be visible to all teacher-tier users (no role gate around it),
matching `/papers` and `/questions`.

---

## 5. Notes on `AnswerScript`

`AnswerScript` already carries `awardedMarks`, `markerComment`,
`markedById`, `markedAt`. **No schema edit is needed** there. I considered
adding a `markedAt` index for "recent marker activity" dashboards, but
that's premature; skipping.

---

## 6. After-merge sanity check

```bash
cd apps/api && npx tsc --noEmit          # should be clean
cd apps/web && npx tsc --noEmit          # should be clean
cd tests/blackbox && API=<deployed-url> bash b1-marker.sh
```

If `b1-marker.sh` reports `B3: SKIP` because no 2nd marker user existed,
the integrator can pre-seed a head_teacher user via the seed script and
re-run. The race-condition guard is the most important regression test in
B1; please don't merge B1 without seeing B3 PASS at least once.
