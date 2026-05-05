# Block B7 — Merge Instructions

Owner: B7 agent (paper variants + WeChat notification stubs)
Touchpoints: schema.prisma, app.module.ts, lib/api.ts, App.tsx,
StudentTake.tsx, pdf.service.ts.

The integrator runs all of these together as a single merge. None of
the code in `apps/api/src/paper-variants/`, `apps/api/src/wechat-notify/`,
`apps/web/src/pages/VariantPreview.tsx`, or
`apps/api/prisma/path-b-fragments/b7.prisma` references this file at
runtime — it is purely a runbook.

---

## 1. Schema fragment

The file `apps/api/prisma/path-b-fragments/b7.prisma` adds:

* `enum NotificationEvent { paper_assigned, paper_marked, low_score }`
* `enum NotificationChannel { wechat_work, dingtalk, email }`
* `model PaperVariantAssignment` (id, assignmentId, studentId, seed,
  questionOrder Json, optionShuffles Json, generatedAt). Unique
  `(assignmentId, studentId)`.
* `model NotificationConfig` (id, event, channel, target Json,
  enabled, createdAt, updatedAt). Indexed on `(event, channel,
  enabled)`.
* `model NotificationLog` (id, configId?, event, channel, payload
  Json, httpStatus, error?, sentAt). Indexed on `(event, sentAt)`
  and `(configId, sentAt)`.

### To merge into `apps/api/prisma/schema.prisma`

Append the entire body of `b7.prisma` to the end of `schema.prisma`,
**then** add these two back-relation lines:

```prisma
// In `model PaperAssignment { ... }` — add this line:
variantAssignments PaperVariantAssignment[]

// In `model User { ... }` — add this line (named relation matches B7):
paperVariants PaperVariantAssignment[] @relation("PaperVariantStudent")
```

NotificationConfig and NotificationLog reference no existing model,
so no other back-relations are needed.

After concatenation, run `prisma generate` (no `db push`/`migrate`
in this block — those happen in the integration pass).

---

## 2. AppModule registration

Add the two new module imports to `apps/api/src/app.module.ts`:

```ts
// imports list — add these two:
import { PaperVariantsModule } from './paper-variants/paper-variants.module';
import { WechatNotifyModule } from './wechat-notify/wechat-notify.module';

// inside @Module({ imports: [...] }) — append these two lines:
PaperVariantsModule,
WechatNotifyModule,
```

That's the only edit to app.module.ts. Both modules already register
their own controllers / providers and export the relevant services
(PaperVariantsService, WechatNotifyService).

---

## 3. lib/api.ts additions

The frontend page `VariantPreview.tsx` deliberately calls fetch
directly so B7 doesn't have to touch the read-only `lib/api.ts`. At
integration time the integrator should add these helpers for
consistency:

```ts
// In apps/web/src/lib/api.ts inside the `api` object — append:

  // paper variants (teachers + students)
  generatePaperVariants: (data: { assignmentId: string; mode: 'shuffle_options'|'shuffle_questions'|'both' }) =>
    request('POST', '/paper-variants/generate-for-class', data),
  listPaperVariantsForAssignment: (assignmentId: string) =>
    request('GET', `/paper-variants/assignment/${assignmentId}`),
  getPaperVariantForStudent: (studentId: string, assignmentId: string) =>
    request('GET', `/paper-variants/student/${studentId}/assignment/${assignmentId}`),

  // wechat-notify (admin only)
  listNotifyConfigs: () => request('GET', '/wechat-notify/configs'),
  createNotifyConfig: (data: any) => request('POST', '/wechat-notify/configs', data),
  updateNotifyConfig: (id: string, data: any) => request('PATCH', `/wechat-notify/configs/${id}`, data),
  testNotifyConfig: (configId: string) => request('POST', `/wechat-notify/test/${configId}`),
  listNotifyLogs: (params: { event?: string; since?: string; limit?: number } = {}) =>
    request('GET', `/wechat-notify/logs${qs(params)}`),
```

(`qs` is the helper already in lib/api.ts.) After these are in,
`VariantPreview.tsx` can be simplified to use `api.*` instead of the
local `jsonFetch` shim — but that's optional polish.

---

## 4. App.tsx — route + nav

In `apps/web/src/App.tsx` add:

```tsx
// import:
import VariantPreviewPage from './pages/VariantPreview';

// inside the teacher nav block (after the existing NavLink rows):
{(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
  <NavLink to="/variants" label="Variants" />
)}

// inside the teacher <Routes> block (e.g. just before the `*` catchall):
<Route path="/variants" element={<VariantPreviewPage />} />
```

Students do not see this nav item (they live in the separate student
layout block above).

---

## 5. Routes (full list — for the gateway)

Mounted under `app.setGlobalPrefix('api')`:

| Method | Path                                                                | Roles                                  |
|--------|---------------------------------------------------------------------|----------------------------------------|
| POST   | `/api/paper-variants/generate-for-class`                            | admin, head_teacher, teacher           |
| GET    | `/api/paper-variants/assignment/:assignmentId`                      | admin, head_teacher, teacher           |
| GET    | `/api/paper-variants/student/:studentId/assignment/:assignmentId`   | admin, head_teacher, teacher, student* |
| GET    | `/api/wechat-notify/configs`                                        | admin                                  |
| POST   | `/api/wechat-notify/configs`                                        | admin                                  |
| PATCH  | `/api/wechat-notify/configs/:id`                                    | admin                                  |
| POST   | `/api/wechat-notify/test/:configId`                                 | admin                                  |
| GET    | `/api/wechat-notify/logs?event=&since=&limit=`                      | admin                                  |

\* The student-facing GET narrows inside the handler:
`student` role only succeeds when `:studentId` matches the
authenticated user. Staff roles are unrestricted.

---

## 6. Integration note — StudentTake.tsx

`StudentTake.tsx` is owned by another track. **Do not modify it
inside B7.** When the integrator wires variant rendering, the
proposed change is:

```tsx
// Inside StudentTake.tsx, after `const subFull = await api.getStudentSubmission(sub.id);`
// add a best-effort variant lookup. If the assignment has no variants
// generated, fall back to the canonical paper order.

let variant: { questionOrder: string[]; optionShuffles: Record<string, Record<string,string>> } | null = null;
try {
  variant = await api.getPaperVariantForStudent(user.id, sub.assignmentId);
} catch {
  // 404 = no variant for this student/assignment yet. That's fine —
  // we render the canonical order.
  variant = null;
}

// Then in the render loop, replace
//   paper.questions.map((pq, i) => ...)
// with the variant-aware version:

const orderedPqs = variant?.questionOrder?.length
  ? variant.questionOrder
      .map(id => paper.questions.find(pq => pq.id === id))
      .filter(Boolean)
  : paper.questions;

orderedPqs.map((pq, i) => {
  const map = variant?.optionShuffles?.[pq.id];
  const opts = pq.snapshotOptions ?? pq.question?.options;
  // Relabel options if a shuffle map exists for this pq.
  const renderedOpts = (map && Array.isArray(opts))
    ? opts.map(o => ({ ...o, displayKey: map[o.key] ?? o.key }))
        .sort((a, b) => a.displayKey.localeCompare(b.displayKey))
    : opts;
  // ...render `renderedOpts`. Crucial: when the student selects an
  // option, save the ORIGINAL `o.key` (not displayKey), so the
  // server-side mark-scheme comparison is unchanged.
})
```

Two correctness points the integrator must keep in mind:

1. **Selected-option payload is still the original key.** The
   server-side auto-grader in `student.service.ts → finalSubmit`
   compares `script.selectedOption` against the `options[].correct`
   flag. If we sent the displayKey ("C") instead of the original
   key ("A") the auto-grade would silently break. Always send
   `o.key`, never `o.displayKey`.

2. **Variant lookup must be authenticated as the student.** The
   handler enforces `user.id === :studentId` for the student role,
   so calling with the logged-in student's `user.id` is the only
   shape that works.

---

## 7. Integration note — pdf.service.ts

`pdf.service.ts` is owned by the PDF track. **Do not modify it
inside B7.** When the integrator wires per-student PDF export, the
proposed change is:

```ts
// Add a new optional param to PdfService.exportPaper:
async exportPaper(
  paperId: string,
  type: 'paper' | 'answer_key' = 'paper',
  studentId?: string,        // NEW — undefined => no variant applied
  assignmentId?: string,     // NEW — required when studentId is set
): Promise<Buffer> {

  // Existing paper lookup stays exactly as it is.
  const paper = await this.prisma.paper.findUnique({ ... });

  // NEW: load variant when this is a per-student export.
  let variant = null;
  if (studentId && assignmentId) {
    variant = await (this.prisma as any).paperVariantAssignment.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
  }

  // When a variant exists, reorder paper.questions to match
  // variant.questionOrder, and for each MCQ apply
  // variant.optionShuffles[pq.id] to relabel options before
  // passing the questions array to renderPaperHtml.
  if (variant) {
    const order: string[] = variant.questionOrder ?? [];
    const byId = new Map(paper.questions.map(pq => [pq.id, pq]));
    paper.questions = order
      .map(id => byId.get(id))
      .filter(Boolean) as typeof paper.questions;
    for (const pq of paper.questions) {
      const map = (variant.optionShuffles ?? {})[pq.id];
      if (map && Array.isArray(pq.snapshotOptions)) {
        pq.snapshotOptions = (pq.snapshotOptions as any[])
          .map(o => ({ ...o, key: map[o.key] ?? o.key }))
          .sort((a, b) => a.key.localeCompare(b.key));
      }
    }
  }

  // ... rest of exportPaper unchanged.
}
```

Plus a new controller route in PapersController, e.g.
`GET /api/papers/:id/export-for-student?studentId=...&assignmentId=...`,
gated to `@Roles('admin','head_teacher','teacher')`.

Note for the integrator: per-student answer keys must use the
relabeled option keys when echoing the correct answer back, otherwise
the answer key contradicts the printed paper. Apply the same
transform on `pq.snapshotAnswer` for MCQ when surfacing.

---

## 8. Integration note — `WechatNotifyService.fire()` call sites

`WechatNotifyModule` exports `WechatNotifyService`. To wire actual
event firings:

* **paper_assigned** — in `apps/api/src/student/student.service.ts`,
  inject `WechatNotifyService` and at the end of
  `assignPaperToClass`, call:
  ```ts
  this.notify.fire('paper_assigned', { paperId, classId: body.classId, assignmentId: created.id });
  ```
  (await it OR fire-and-forget — fire-and-forget is fine because
  dispatch errors are already swallowed inside fire()).
* **paper_marked** — in `apps/api/src/marker/marker.service.ts` (B1),
  at the end of the score-script handler when the submission flips
  to `marked`, call:
  ```ts
  this.notify.fire('paper_marked', { submissionId });
  ```
* **low_score** — in `student.service.ts → finalSubmit`, after the
  totalScore is computed, optionally call:
  ```ts
  if (totalScore != null && maxScore > 0 && totalScore / maxScore < 0.5) {
    this.notify.fire('low_score', { submissionId, totalScore, maxScore });
  }
  ```

The integrator picks the threshold (0.5 above is a placeholder).
None of these call sites raise on failure — `fire()` swallows.

---

## 9. Authorization checklist

| Endpoint                                                              | Roles allowed                         | Extra narrow inside handler                      |
|-----------------------------------------------------------------------|---------------------------------------|--------------------------------------------------|
| POST `/api/paper-variants/generate-for-class`                         | admin, head_teacher, teacher          | none                                             |
| GET `/api/paper-variants/assignment/:assignmentId`                    | admin, head_teacher, teacher          | none                                             |
| GET `/api/paper-variants/student/:studentId/assignment/:assignmentId` | admin, head_teacher, teacher, student | student → reject if `user.id !== :studentId`     |
| GET `/api/wechat-notify/configs`                                      | admin                                 | none                                             |
| POST `/api/wechat-notify/configs`                                     | admin                                 | none                                             |
| PATCH `/api/wechat-notify/configs/:id`                                | admin                                 | none                                             |
| POST `/api/wechat-notify/test/:configId`                              | admin                                 | reject when config.enabled === false             |
| GET `/api/wechat-notify/logs`                                         | admin                                 | none                                             |

The controller-level `@Roles(...)` is enforced by the global
`AuthGuard` (already wired in app.module.ts as APP_GUARD). No new
guard is needed.

Black-box authz coverage in `tests/blackbox/b7-variants.sh`:
* V4b — student trying to read peer's variant → expect 403.
* N6 — non-admin trying to create notification config → expect
  401/403.
* N7 — no auth header on /wechat-notify/configs → expect 401.

---

## 10. Test script

`tests/blackbox/b7-variants.sh` covers:

1. Class + 5-student roster setup (re-uses an existing paper from the
   admin's paper list — falls back gracefully if none is available).
2. **V1**: generate-for-class returns `studentsProcessed=5`.
3. **V2**: 5 unique seeds (no two students share a seed).
4. **V3**: re-running generate-for-class is deterministic — the seeds
   from the second run match the first run exactly.
5. **V4**: a student can fetch their own variant.
6. **V4b**: a student fetching a peer's variant → 403 (authz fence).
7. **N1..N3**: notification config CRUD round-trip (create → list →
   PATCH disable).
8. **N4**: test-fire on a `noop://` stub returns `httpStatus=0`
   (no real HTTP made).
9. **N5**: GET `/wechat-notify/logs` surfaces the noop log row.
10. **N6**: non-admin (student token) cannot mutate notification
    configs.
11. **N7**: missing auth header → 401.

Run with: `API=https://exam-paper-system-production.up.railway.app bash tests/blackbox/b7-variants.sh`
