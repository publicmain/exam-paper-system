# B3 — AI Question Quality Feedback (merge instructions)

This module is built behind a **fragment**: `apps/api/prisma/path-b-fragments/b3.prisma`.
Until the integrator concatenates that fragment into `schema.prisma` and
re-runs `prisma generate`, the new `questionQualitySignal` model is invisible
to the Prisma client. The service code therefore uses one `as any` cast on
each `prisma.questionQualitySignal.*` callsite — **drop those casts as part
of the merge** so we get full type safety back.

This file is the integrator's checklist. Order is roughly the order
you should apply the changes in.

---

## 1. Schema fragment

Append this block to `apps/api/prisma/schema.prisma`, after the existing
`TeacherReview` model. **Also add the back-relation field on `Question`**
(see step 1b).

```prisma
// ============================================================
// Block B3 — AI question quality feedback loop
// ============================================================

enum QuestionQualitySignalType {
  approved
  rejected
  edited
  answered_correct
  answered_wrong
  skipped
}

model QuestionQualitySignal {
  id           String                    @id @default(cuid())
  questionId   String
  question     Question                  @relation(fields: [questionId], references: [id], onDelete: Cascade)
  signalType   QuestionQualitySignalType
  weight       Float                     @default(0)
  meta         Json?
  recordedById String?
  recordedAt   DateTime                  @default(now())

  @@index([questionId, recordedAt])
  @@index([signalType, recordedAt])
}
```

### 1b. Back-relation on Question

Inside the `model Question { ... }` block in `schema.prisma`, add the
following relation array (placement: anywhere in the relation list, e.g.
right after `usageLogs QuestionUsageLog[]`):

```prisma
  qualityFeedbackSignals QuestionQualitySignal[]
```

Without this back-relation Prisma will fail to validate the schema because
the `QuestionQualitySignal.question` relation has no opposite side.

### 1c. Migration

```bash
cd apps/api
npx prisma migrate dev --name b3_quality_feedback
# or for a Railway/prod deploy:
npx prisma migrate deploy
```

After migration, **drop the `as any` casts** in
`apps/api/src/quality-feedback/quality-feedback.service.ts`:

- `(this.prisma as any).questionQualitySignal.create(...)`  →  `this.prisma.questionQualitySignal.create(...)`
- `(this.prisma as any).questionQualitySignal.findMany(...)` →  `this.prisma.questionQualitySignal.findMany(...)`

Five callsites in total — search the file for `as any`.

---

## 2. Module registration (app.module.ts)

Add the import and register the module:

```ts
import { QualityFeedbackModule } from './quality-feedback/quality-feedback.module';
```

In the `imports: [...]` array (alphabetical-ish order, place after `ReviewModule`):

```ts
ReviewModule,
QualityFeedbackModule,
ClassesModule,
StudentModule,
```

The module exports `QualityFeedbackService`, so once it's in `imports`,
`ReviewModule` / `StudentModule` / future `MarkerModule` can inject the
service without re-providing it (re-export via `@Global()` if desired,
but for now standard injection through `imports: [QualityFeedbackModule]`
on each consuming module is enough).

---

## 3. Frontend api.ts methods

Add these to the `export const api = { ... }` object in
`apps/web/src/lib/api.ts`:

```ts
  // quality feedback (admin / teacher)
  qualityLogSignal: (questionId: string, data: { signalType: string; meta?: any }) =>
    request('POST', `/quality/question/${questionId}/signal`, data),
  qualityQuestionScore: (questionId: string) =>
    request('GET', `/quality/question/${questionId}/score`),
  qualityTopicLeaderboard: (topicId: string, limit?: number) =>
    request('GET', `/quality/topic/${topicId}/leaderboard${limit ? `?limit=${limit}` : ''}`),
  qualityAiPromptSuggestions: (topicId: string) =>
    request('GET', `/quality/ai-prompt-suggestions?topicId=${encodeURIComponent(topicId)}`),
```

`QualityFeedback.tsx` already imports `api.qualityTopicLeaderboard` and
`api.qualityAiPromptSuggestions`, so without this step the page won't
compile.

---

## 4. Route + nav link in App.tsx

Import the page (top of `App.tsx`):

```ts
import QualityFeedbackPage from './pages/QualityFeedback';
```

Add the nav link inside the teacher header (next to the existing Review
link). Visibility: admin + head_teacher (teachers see only the dashboard
view, but route is still allowed by the controller — keep the link
admin-only to avoid clutter):

```tsx
{(user.role === 'admin' || user.role === 'head_teacher') && (
  <NavLink to="/quality" label="Quality" />
)}
```

Add the route inside the teacher `<Routes>`:

```tsx
<Route
  path="/quality"
  element={
    user.role === 'admin' || user.role === 'head_teacher' ? (
      <QualityFeedbackPage />
    ) : (
      <Navigate to="/" replace />
    )
  }
/>
```

---

## 5. Downstream injection points (HOOKS — wire these AFTER merge)

These are the **in-process** callsites. None of them live in B3 — wiring
them is the integrator's job because they touch files this agent does NOT
own (`review.service.ts`, `student.service.ts`, marker module from B1).

In every case: inject `QualityFeedbackService` via the module's
constructor and call `qualityFeedback.logSignal(...)`. **Wrap each call in
try/catch** so a feedback-write failure never aborts the primary action
(approve/reject/submit/mark must succeed even if the signal log fails).

### 5a. `apps/api/src/review/review.service.ts` — `approve()`

After the QuestionItem is mirrored into the Question table and the
mirrored Question id is known. Pseudo-code:

```ts
// after `await this.prisma.question.create(...)` (or upsert) inside approve()
try {
  await this.qualityFeedback.logSignal(
    mirroredQuestion.id,
    'approved',
    { id: actor.id, role: actor.role },
    {
      reviewItemId: itemId,
      source: item.source,                  // 'past_paper' | 'ai_generated' | 'manual'
      suggestedTopicCode: item.suggestedTopicCode ?? null,
    },
  );
} catch (e) {
  console.error('[quality] failed to log approved signal', e);
}
```

### 5b. `apps/api/src/review/review.service.ts` — `reject()`

There is no mirrored Question for a rejected item, so log against the
`questionItemId`'s already-mirrored sibling if any. If the item has
**never** been approved, log against the QuestionItem id will fail
(no Question row). Recommended approach: only log a `rejected` signal
when there IS a previously-mirrored Question (e.g. re-rejecting after
edit). For first-time rejection of a never-approved item, store nothing
— a missing approval is itself the negative signal at the topic level.

```ts
// inside reject(), AFTER you've fetched the QuestionItem with its
// `questionId` (= mirrored Question id, may be null)
if (item.questionId) {
  try {
    await this.qualityFeedback.logSignal(
      item.questionId,
      'rejected',
      { id: actor.id, role: actor.role },
      { reviewItemId: itemId, reason: reason ?? null },
    );
  } catch (e) {
    console.error('[quality] failed to log rejected signal', e);
  }
}
```

(Optional: when `item.questionId` is null but a teacher still rejects an
AI-generated item, log against the underlying Question if `source ===
'ai_generated'` and an mirrored Question already exists in
`Question.where({ provenanceTag: ... })`. Out of scope for B3 day-1.)

### 5c. Post-approval edit hook — `questions.service.ts` `update()` (or wherever)

If the integrator wants to capture the `edited` signal (a teacher edits an
already-approved AI question), insert at the bottom of `update()` in
`apps/api/src/questions/questions.service.ts` — but **only when**
`question.sourceType === 'ai_generated'` or
`question.provenanceTag === 'ai_quick_paper'`, otherwise every routine
metadata edit becomes a negative signal:

```ts
const wasAiSourced =
  before.sourceType === 'ai_generated' ||
  before.provenanceTag === 'ai_quick_paper';
if (wasAiSourced) {
  try {
    await this.qualityFeedback.logSignal(
      id,
      'edited',
      { id: userId, role: 'teacher' },
      { editedFields: Object.keys(dto) },
    );
  } catch (e) {
    console.error('[quality] failed to log edited signal', e);
  }
}
```

Note: `questions.service.ts` is on this agent's "MUST NOT touch" list, so
the integrator must add this themselves.

### 5d. `apps/api/src/student/student.service.ts` — `finalSubmit()` (MCQ auto-grade)

After the autoScore is computed by walking each AnswerScript, log a
signal per MCQ AnswerScript that has `autoCorrect != null`. The walk
already exists; just append the log inside it:

```ts
// inside the loop that sets autoCorrect on each script
const isCorrect = script.autoCorrect === true;
if (script.selectedOption == null) {
  await this.qualityFeedback.logSignal(
    paperQuestion.questionId,
    'skipped',
    { id: studentId, role: 'student' },
    { submissionId, paperQuestionId: paperQuestion.id },
  ).catch(e => console.error('[quality]', e));
} else {
  await this.qualityFeedback.logSignal(
    paperQuestion.questionId,
    isCorrect ? 'answered_correct' : 'answered_wrong',
    { id: studentId, role: 'student' },
    {
      submissionId,
      paperQuestionId: paperQuestion.id,
      selectedOption: script.selectedOption,
    },
  ).catch(e => console.error('[quality]', e));
}
```

### 5e. Marker (B1) finalize — structured-question signals

When B1's marker module finalizes a script (sets `awardedMarks` and
`markedAt` on an AnswerScript whose paperQuestion's underlying Question
is `questionType === 'structured' | 'short_answer' | 'essay'`), compute
the ratio and log:

```ts
const ratio = (script.awardedMarks ?? 0) / paperQuestion.marks;
const sig = ratio >= 0.5 ? 'answered_correct' : 'answered_wrong';
await this.qualityFeedback.logSignal(
  paperQuestion.questionId,
  sig,
  { id: markerId, role: 'teacher' },
  {
    submissionId: script.submissionId,
    paperQuestionId: paperQuestion.id,
    awardedMarks: script.awardedMarks,
    marks: paperQuestion.marks,
    ratio,
  },
).catch(e => console.error('[quality]', e));
```

Threshold (50%) is a heuristic — adjust if the school cares about the
distinction between "no marks at all" vs "partial credit but failed".

---

## 6. Authz checklist

All B3 endpoints sit under `@Roles('admin', 'head_teacher', 'teacher')`,
i.e. **no student access** at any tier. There is no per-class scoping
because quality signals describe the **question bank**, which is already
teacher/admin-only via `QuestionsController`.

| Endpoint                                               | admin | head_teacher | teacher | student |
|--------------------------------------------------------|-------|--------------|---------|---------|
| `POST /api/quality/question/:id/signal`                | ✅    | ✅           | ✅      | ❌      |
| `GET  /api/quality/question/:id/score`                 | ✅    | ✅           | ✅      | ❌      |
| `GET  /api/quality/topic/:topicId/leaderboard`         | ✅    | ✅           | ✅      | ❌      |
| `GET  /api/quality/ai-prompt-suggestions?topicId=`     | ✅    | ✅           | ✅      | ❌      |

The frontend nav link is gated additionally to `admin` + `head_teacher`
(teachers can hit the routes via the API but won't see the menu — keeps
the dashboard from cluttering for line teachers who don't tune AI
prompts).

The blackbox test `tests/blackbox/b3-feedback.sh` includes E1/E2 to
confirm 401 on no-auth requests. Cross-role denial is covered globally by
`tests/blackbox/t4-authz.sh` once the route exists — no need to add a
duplicate student-deny test here.

---

## 7. Untyped client calls (post-merge cleanup)

After step 1c (`prisma generate`), grep the codebase:

```bash
grep -rn "as any).questionQualitySignal" apps/api/src
```

Expect **5 hits, all in `quality-feedback.service.ts`**. Drop the cast
on each. After the casts are dropped, `npx tsc --noEmit` should pass
clean against the new model.

---

## 8. Test script

```bash
BASE=https://exam-paper-system-production.up.railway.app \
  bash tests/blackbox/b3-feedback.sh
```

The test assumes:
- admin login `admin@school.local / admin123` works (already used by t4)
- at least one Question with a `primaryTopicId` exists in the bank

Both hold on the live Railway DB after Phase 1 seed.
