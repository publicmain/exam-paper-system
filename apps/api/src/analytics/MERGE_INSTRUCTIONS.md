# B2 — Class statistics + wrong-answer dashboard — merge instructions

This feature is **read-only**.  No Prisma schema changes, no migrations.
Three things need to be wired up by the integrator:

1. Register `AnalyticsModule` in `apps/api/src/app.module.ts`.
2. Add four `api.*` methods + four routes in `apps/web/src/lib/api.ts` and
   `apps/web/src/App.tsx`.
3. Add nav links for the two new pages.

The owners of `app.module.ts`, `api.ts`, and `App.tsx` need to make these
changes — B2 deliberately does not touch them.

---

## 1. Register `AnalyticsModule`

In `apps/api/src/app.module.ts`:

```ts
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    // …existing modules…
    AnalyticsModule,
  ],
  // …
})
export class AppModule {}
```

That's the only API-side wiring.  The controller is mounted at
`/api/analytics/*` thanks to the global `api` prefix in `main.ts`.

---

## 2. Frontend `api` client methods

In `apps/web/src/lib/api.ts`, add inside the `api = { … }` object:

```ts
  // analytics (teachers + heads + admins)
  classOverview: (classId: string) =>
    request('GET', `/analytics/class/${classId}/overview`),
  paperWrongAnswers: (paperId: string) =>
    request('GET', `/analytics/paper/${paperId}/wrong-answers`),
  classTopicMastery: (classId: string, paperId?: string) =>
    request('GET', `/analytics/class/${classId}/topic-mastery${paperId ? `?paperId=${encodeURIComponent(paperId)}` : ''}`),
  studentHistory: (studentId: string) =>
    request('GET', `/analytics/student/${studentId}/history`),
```

The two new pages currently fetch with their own inline helpers (because
B2 doesn't touch `api.ts`).  After you add the helpers above, the pages
will keep working as-is, and you can optionally swap their inline
`getJson()` calls for `api.classOverview(...)` etc. — same shapes.

---

## 3. App.tsx routes + nav

In `apps/web/src/App.tsx`, import the two pages near the other page imports:

```ts
import ClassStatsPage from './pages/ClassStats';
import WrongAnswerDashboardPage from './pages/WrongAnswerDashboard';
```

Then inside the **teacher / head / admin** layout `<Routes>` block (the
non-student branch around line 92), add two routes:

```tsx
<Route path="/analytics/classes" element={<ClassStatsPage />} />
<Route path="/analytics/wrong-answers" element={<WrongAnswerDashboardPage />} />
```

And add two `<NavLink>` entries inside the `<nav>` block (around line 68):

```tsx
<NavLink to="/analytics/classes" label="Class Stats" />
<NavLink to="/analytics/wrong-answers" label="Wrong Answers" />
```

These should appear for `teacher`, `head_teacher`, and `admin` (i.e. any
non-student) — no extra role gate is needed in the nav because the
backend will 401 students who somehow reach the URL.

---

## Authorization model — current state and future tightening

Every analytics endpoint is gated by `@Roles('admin', 'head_teacher', 'teacher')`
at the controller class level.  Students are 401'd at the AuthGuard.

**Per-class teacher membership is intentionally NOT enforced for MVP.**
Any teacher can currently read any class's analytics.  Rationale:

- Schools in Phase 1 are small (one or two teaching staff), and head
  teachers want full visibility.
- The teacher↔class relationship lives in `ClassEnrollment` with role
  `class_teacher` or `subject_teacher`, but several other features
  (Papers, Questions) currently treat all teachers equivalently, so
  tightening only Analytics would give an inconsistent experience.

**To tighten this in Phase 2**, add a guard inside `AnalyticsService`:

```ts
private async assertTeacherOfClass(classId: string, actor: ActorCtx) {
  if (actor.role === 'admin' || actor.role === 'head_teacher') return;
  const enrolled = await this.prisma.classEnrollment.findFirst({
    where: { classId, userId: actor.id, role: { in: ['class_teacher', 'subject_teacher'] } },
  });
  if (!enrolled) throw new ForbiddenException('not a teacher of this class');
}
```

Then call it from `classOverview`, `classTopicMastery`, and
(for paper-level) derive the class set via `paperAssignment.findMany`.

For `studentHistory`, the equivalent is "is the caller a teacher of any
class the student is enrolled in?".

The blackbox test (`b2-analytics.sh`) currently asserts the **MVP**
behaviour — cross-class teacher access returns 200 — so when you tighten
this, flip that one assertion to 403.

---

## Files this feature owns

| Path | Purpose |
| --- | --- |
| `apps/api/src/analytics/analytics.module.ts` | Module wiring |
| `apps/api/src/analytics/analytics.controller.ts` | Routes + role gate |
| `apps/api/src/analytics/analytics.service.ts` | Aggregation logic |
| `apps/api/src/analytics/dto.ts` | Response shapes |
| `apps/api/src/analytics/MERGE_INSTRUCTIONS.md` | This file |
| `apps/api/prisma/path-b-fragments/b2.prisma` | Empty — no schema changes |
| `apps/web/src/pages/ClassStats.tsx` | Class statistics page |
| `apps/web/src/pages/WrongAnswerDashboard.tsx` | Wrong-answer dashboard page |
| `tests/blackbox/b2-analytics.sh` | Blackbox tests |

## Endpoints

| Method | URL | Roles | Returns |
| --- | --- | --- | --- |
| GET | `/api/analytics/class/:classId/overview` | admin/head/teacher | `ClassOverviewDto` |
| GET | `/api/analytics/paper/:paperId/wrong-answers` | admin/head/teacher | `WrongAnswerDashboardDto` |
| GET | `/api/analytics/class/:classId/topic-mastery?paperId=…` | admin/head/teacher | `TopicMasteryDto` |
| GET | `/api/analytics/student/:studentId/history` | admin/head/teacher | `StudentHistoryDto` |
