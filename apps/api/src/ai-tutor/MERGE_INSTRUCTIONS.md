# Block B9 — AI tutor chat: integrator merge guide

This module is implemented as a path-B fragment. The integrator must apply
the changes below to bring it into the running system. None of these edits
can be made from inside the fragment because they touch files owned by the
schema / app / web shells.

---

## 1. Prisma schema

Append `apps/api/prisma/path-b-fragments/b9.prisma` into
`apps/api/prisma/schema.prisma`.

Then add **back-relations** on the existing models so the FKs in b9
compile cleanly:

```prisma
// in model User { ... }
tutorSessions TutorSession[]

// in model StudentSubmission { ... }
tutorSessions TutorSession[]

// in model PaperQuestion { ... }
tutorSessions TutorSession[]
```

After concatenation, run:

```
npx prisma format
npx prisma generate
npx prisma migrate dev -n b9_tutor
```

(or `prisma db push` for the dev DB if not using migrations yet).

Schema notes:

- `TutorSession.submissionId` and `paperQuestionId` are both **optional**
  with `onDelete: SetNull`. Deliberate: the chat history is the durable
  record of cost spend, and a deleted submission must not cascade-wipe
  audit data.
- `TutorMessage.costUsd` is set **only on assistant messages**. Student
  rows leave it null.

---

## 2. Wire the module into `app.module.ts`

Add the import and module entry:

```ts
import { AiTutorModule } from './ai-tutor/ai-tutor.module';

@Module({
  imports: [
    // ...existing modules...
    AiTutorModule,
  ],
  // ...
})
export class AppModule {}
```

No need to register a separate guard or interceptor — the global
`APP_GUARD = AuthGuard` already covers `/ai-tutor/*` routes, and the
controller has explicit `@Roles(...)` on every handler.

---

## 3. `apps/web/src/lib/api.ts` — add tutor methods

Append to the `api = { ... }` object:

```ts
// ai tutor (B9)
createTutorSession: (data: { submissionId?: string; paperQuestionId?: string }) =>
  request('POST', '/ai-tutor/sessions', data),
getTutorSession: (id: string) =>
  request('GET', `/ai-tutor/sessions/${id}`),
sendTutorMessage: (sessionId: string, content: string) =>
  request('POST', `/ai-tutor/sessions/${sessionId}/messages`, { content }),
tutorUsage: (params: { from?: string; to?: string } = {}) =>
  request('GET', `/ai-tutor/usage${qs(params)}`),
```

`StudentTutor.tsx` currently inlines a small `request()` helper because
it cannot edit `lib/api.ts` from the fragment. After integration, replace
the inline `request(...)` calls with the new `api.*` methods. (The page
will still work as-is — replacement is purely a tidy-up.)

---

## 4. `apps/web/src/App.tsx` — student route + nav

Inside the `if (user.role === 'student') { ... }` branch, two changes:

### 4a. Add the route

```tsx
import StudentTutorPage from './pages/StudentTutor';

<Routes>
  <Route path="/student" element={<StudentHomePage />} />
  <Route path="/student/take/:assignmentId" element={<StudentTakePage />} />
  <Route path="/student/tutor" element={<StudentTutorPage />} />   {/* NEW */}
  <Route path="*" element={<Navigate to="/student" replace />} />
</Routes>
```

The page reads `?submissionId=...` from the URL — link it from the
StudentTake submitted-state CTA, e.g.

```tsx
<Link to={`/student/tutor?submissionId=${submission.id}`} className="btn btn-ghost">
  Ask AI tutor
</Link>
```

### 4b. Optional nav link in the student header

In the `<header>` block of the student layout (next to "📝 My Papers"):

```tsx
<Link to="/student" className="font-bold text-lg">📝 My Papers</Link>
<Link to="/student/tutor" className="text-sm text-gray-600 hover:text-gray-900">AI Tutor</Link>
```

(Without a `submissionId` query param the page shows a friendly "Missing
submissionId" message — the link is mainly useful as a deep-link target
from the student's submitted submission view.)

---

## 5. Environment variables

Add to deploy environment (Railway):

| Var | Default | Notes |
| --- | --- | --- |
| `TUTOR_DAILY_USD_PER_STUDENT_CAP` | `0.50` | Per-student daily $ cap. Set lower in test envs (e.g. `0.05`) so the b9-tutor.sh `T4` cap test fires deterministically. |
| `ANTHROPIC_API_KEY` | (existing) | Already used by `ai/`. The tutor reuses it. If unset, tutor returns deterministic stub replies at $0 cost. |
| `ANTHROPIC_MODEL` | (existing) | Already used by `ai/`. Default `claude-sonnet-4-6`. |

---

## 6. Verify

After deploy:

```
bash tests/blackbox/b9-tutor.sh
```

Expected: T1, T2, T2b, T3, T5, T5b, T6, T7, T8 PASS. T4 PASS if the cap
is low enough to trip in <=8 calls; SKIPPED otherwise (e.g. prod cap of
$0.50). T2b PASS confirms the markScheme is not leaked verbatim.

---

## 7. Files this fragment owns

- `apps/api/src/ai-tutor/` — module, controller, service, this doc
- `apps/api/prisma/path-b-fragments/b9.prisma`
- `apps/web/src/pages/StudentTutor.tsx`
- `tests/blackbox/b9-tutor.sh`

This fragment **did not modify**: `schema.prisma`, `app.module.ts`,
`lib/api.ts`, `App.tsx`, `auth.guard.ts`, `student/`, `ai/`, `papers/`,
`questions/`, `common/`. Each integration step above is the minimum the
integrator must apply.
