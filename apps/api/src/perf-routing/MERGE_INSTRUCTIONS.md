# B4 — Perf-routing merge instructions

This block adds **per-class topic-mastery routing** for the AI generator.
It is *purely additive* — no existing model, schema field, or controller is
changed. There is **no Prisma migration** required.

---

## 1. Module registration

`apps/api/src/app.module.ts` — add the import + `imports` entry alongside
the other modules. Order doesn't matter; keep it next to `ClassesModule`
for readability.

```ts
import { PerfRoutingModule } from './perf-routing/perf-routing.module';

@Module({
  imports: [
    // …
    ClassesModule,
    StudentModule,
    PerfRoutingModule,   // <-- add
  ],
  // …
})
```

No provider changes; the module already declares its own `PrismaService`.

---

## 2. Front-end `lib/api.ts` additions

Add these methods to the `api` object in `apps/web/src/lib/api.ts`. The
inline `fetch` helpers in `AiGenWithPerf.tsx` are placeholders — once
this PR lands, replace them with these:

```ts
  // perf-routing (teachers + admin)
  perfWeakTopics: (classId: string, subjectId?: string, limit?: number) =>
    request('GET', `/perf-routing/class/${classId}/weak-topics${qs({ subjectId, limit })}`),
  perfPreviewPrompt: (data: {
    classId: string; subjectId?: string; basePrompt: string; limit?: number;
  }) => request('POST', '/perf-routing/preview-prompt', data),
```

Then in `AiGenWithPerf.tsx`, delete the local `perfWeakTopics` and
`perfPreviewPrompt` helpers and swap call sites for `api.perfWeakTopics(…)`
and `api.perfPreviewPrompt(…)`.

---

## 3. Route registration & nav link (`App.tsx`)

```tsx
import AiGenWithPerfPage from './pages/AiGenWithPerf';

// inside the teacher Routes block:
<Route
  path="/ai-generate-perf"
  element={
    user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
      <AiGenWithPerfPage />
    ) : (
      <Navigate to="/" replace />
    )
  }
/>
```

And in the nav (gated to teachers + above):

```tsx
{(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
  <NavLink to="/ai-generate-perf" label="AI (class-targeted)" />
)}
```

Note: the existing `/ai-generate` page is admin/head-only because it
spends Anthropic budget. The new page **also** spends budget (it calls
the same `POST /api/ai/generate-questions` under the hood, which is
gated to admin/head_teacher). If you want to surface it to plain
teachers, you must first relax the role gate on
`apps/api/src/ai/ai.controller.ts::generateQuestions` — leave that
decision to the budget owner. Until then, `/ai-generate-perf` is best
shown only to admin/head_teacher despite the perf-routing endpoint
itself accepting `teacher`.

---

## 4. Files added

```
apps/api/src/perf-routing/
  perf-routing.module.ts
  perf-routing.controller.ts
  perf-routing.service.ts
  MERGE_INSTRUCTIONS.md           (this file)
apps/api/prisma/path-b-fragments/
  b4.prisma                        (informational, no schema changes)
apps/web/src/pages/
  AiGenWithPerf.tsx
tests/blackbox/
  b4-perf-routing.sh
```

---

## 5. Authorization checklist

| Endpoint                                      | Guard          | Roles                              | Notes |
| --------------------------------------------- | -------------- | ---------------------------------- | ----- |
| `GET /perf-routing/class/:id/weak-topics`     | `AuthGuard`    | `admin`, `head_teacher`, `teacher` | Read-only aggregation; no PII beyond topic names + counts. |
| `POST /perf-routing/preview-prompt`           | `AuthGuard`    | `admin`, `head_teacher`, `teacher` | Read-only — assembles a string, does NOT call AI. No money spent. |

Global `AuthGuard` is already wired via `APP_GUARD` in `app.module.ts`,
so the `@UseGuards(AuthGuard)` on the controller is redundant but matches
the convention used by other controllers (e.g. `papers`). Both
endpoints carry the `@Roles('admin','head_teacher','teacher')` decorator.

**Not enforced** (deliberately): per-class membership. A teacher in
class A can call the endpoint with class B's id and see B's weakest
topics. This matches the existing `ClassesService.list()` behavior for
admins/heads but is more permissive than `myClasses()` for plain
teachers. Rationale: the data exposed (topic codes + aggregate scores)
is non-sensitive — it doesn't reveal individual student names or
scores. If you want to tighten this, add a check in the service:

```ts
const member = await this.prisma.classEnrollment.findFirst({
  where: { classId, userId: actor.id },
});
if (!member && actor.role !== 'admin' && actor.role !== 'head_teacher') {
  throw new ForbiddenException('not enrolled in this class');
}
```

…and pass `@CurrentUser()` into the controller methods.

---

## 6. Test script

`tests/blackbox/b4-perf-routing.sh` — round-trip on a Railway deploy
using admin + a fresh class. Tests:

- 401 with no auth, 401/403 as student
- 200 + array shape on happy path
- `augmentedPrompt` + `weakTopics` keys on preview
- 404 on unknown classId, 400 on invalid limit / empty body

Run with:
```
API=https://exam-paper-system-production.up.railway.app bash tests/blackbox/b4-perf-routing.sh
```

The script does **not** seed answer-script data; it accepts an empty
`weakTopics` array as a valid response when the class has no submissions
yet. To exercise the non-empty path, run `t1-classes.sh` + `t2-submissions.sh`
+ `t3-autograde.sh` first against the same classId.

---

## 7. Integration note — should the AI generator know about classId?

**Recommendation: yes, eventually — but not in this PR.**

Today, the AI generator (`apps/api/src/ai/ai-question-generator.service.ts`)
takes `{ syllabusCode, topicCode, count, difficulty?, questionType?, multiPart? }`
and routes the model entirely off `topicCode`. The prompt assembly
function builds a string from those args (see lines ~870-895).

The class-targeting in this PR works by *guiding the human* to pick
weak topicCodes, not by telling the AI directly. This is a deliberate
choice for v0:

- Zero risk to budget — we don't change the per-call cost or the
  prompt structure.
- Zero risk to existing teachers using `/ai-generate` without class data.
- Easy to back out if the mastery signal turns out to be noisy.

**If/when you want native integration**, the cleanest path is:

1. **Add `classId?: string` to `GenerateQuestionsInput`** in
   `ai-question-generator.service.ts`.
2. **In the service**, if `classId` is present, call
   `PerfRoutingService.weakTopicsForClass({ classId, subjectId })`
   *before* assembling the prompt, then either:
   - **Soft hint (low risk):** append the same "Focus on these weak topics"
     block from `previewPrompt` to the system prompt, leaving topicCode
     routing unchanged.
   - **Hard route (higher impact):** if the request did *not* specify
     `topicCode`, pick the lowest-mastery topic with
     `sampleSize >= MIN_SAMPLE` (default 5) and use that as the
     effective topicCode. Surface the chosen topic in the response so
     the teacher knows what they targeted.
3. **Wire `PerfRoutingModule` into `AiModule`** as an import, then
   inject `PerfRoutingService` into the generator.

The reason I'm not doing this now: it would force a change in
`apps/api/src/ai/`, which is owned by another agent in this parallel
build. Once B1+B3 land and the AI module is stable, this is a 30-line
change in `ai-question-generator.service.ts` with no schema impact.

---

## 8. Constraints honoured

- ✓ No `npm install` / `prisma db push` / `git commit`
- ✓ `@Roles(...)` on every controller method (via class-level decorator)
- ✓ Uses only existing schema fields: `AnswerScript.autoCorrect`,
  `AnswerScript.awardedMarks` (read but not relied on), `Question.primaryTopicId`
- ✓ No imports from B1 (`marker/`) or B3 (`quality-feedback/`) directories
- ✓ Did not modify `schema.prisma`, `app.module.ts`, `lib/api.ts`,
  `App.tsx`, `auth.guard.ts`, or any read-only module dir
