# B5 — Admin Syllabus CRUD — Merge Instructions

This module adds admin-only CRUD endpoints + a frontend page for onboarding
new ExamBoards / Subjects / SyllabusComponents / Topics via the web. It
replaces the previous workflow of editing `apps/api/src/reference/syllabi/topics-*.ts`
files and re-deploying.

## Schema changes

**None.** All four tables already exist in `schema.prisma` (ExamBoard, Subject,
SyllabusComponent, Topic). The corresponding fragment file
`apps/api/prisma/path-b-fragments/b5.prisma` is intentionally empty (comment-only).

## Files added (owned by B5)

```
apps/api/src/admin-syllabus/
  admin-syllabus.controller.ts
  admin-syllabus.module.ts
  admin-syllabus.service.ts
  dto.ts
  MERGE_INSTRUCTIONS.md           (this file)

apps/web/src/pages/SyllabusAdmin.tsx

apps/api/prisma/path-b-fragments/b5.prisma   (no schema additions)

tests/blackbox/b5-syllabus.sh
```

---

## 1. Backend — register the module

Add to `apps/api/src/app.module.ts`:

```ts
import { AdminSyllabusModule } from './admin-syllabus/admin-syllabus.module';

@Module({
  imports: [
    // ...existing imports...
    ReferenceModule,
    AdminSyllabusModule,         // <— ADD HERE (after ReferenceModule)
    // ...rest...
  ],
})
export class AppModule {}
```

The `AuditModule` is already `@Global()` so `AuditService` is auto-available.
`PrismaService` is provided locally inside `AdminSyllabusModule` (mirrors the
pattern in `ReferenceModule` / `SourcesModule`).

---

## 2. Frontend — register the API methods

Add these methods to the `api` object in `apps/web/src/lib/api.ts` (place
them near the other admin sections, e.g. after the `sources` block):

```ts
// admin syllabus (admin only)
adminCreateExamBoard: (data: { code: string; name: string }) =>
  request('POST', '/admin-syllabus/exam-boards', data),
adminCreateSubject: (data: {
  examBoardId: string; code: string; name: string; level: string;
}) => request('POST', '/admin-syllabus/subjects', data),
adminCreateComponent: (data: { subjectId: string; code: string; name: string }) =>
  request('POST', '/admin-syllabus/components', data),
adminCreateTopic: (data: {
  componentId: string; parentTopicId?: string | null; code: string;
  name: string; sortOrder?: number;
}) => request('POST', '/admin-syllabus/topics', data),
adminUpdateTopic: (id: string, data: any) =>
  request('PATCH', `/admin-syllabus/topics/${id}`, data),
adminDeleteTopic: (id: string) =>
  request('DELETE', `/admin-syllabus/topics/${id}`),
adminImportSyllabus: (data: any) =>
  request('POST', '/admin-syllabus/import', data),
```

---

## 3. Frontend — register the route + nav link

In `apps/web/src/App.tsx`:

### 3a. Import the page

```ts
import SyllabusAdminPage from './pages/SyllabusAdmin';
```

### 3b. Add the nav link (admin-only — mirrors the `/sources` pattern)

Inside the nav block, alongside `{user.role === 'admin' && <NavLink to="/sources" label="Sources" />}`:

```tsx
{user.role === 'admin' && <NavLink to="/syllabus" label="Syllabus" />}
```

### 3c. Add the route (admin-only — guarded same as `/sources`)

Inside the `<Routes>` block:

```tsx
<Route
  path="/syllabus"
  element={user.role === 'admin' ? <SyllabusAdminPage /> : <Navigate to="/" replace />}
/>
```

The route guard plus the `@Roles('admin')` guard on the controller mean the
page is unreachable from the SPA *and* the API rejects requests from any
non-admin role. Defense in depth.

---

## 4. Verifying the merge

1. `npx tsc --noEmit` (from `apps/api`) — must be clean.
2. `npx tsc --noEmit` (from `apps/web`) — must be clean.
3. Run the blackbox: `bash tests/blackbox/b5-syllabus.sh` — all PASS.
4. Smoke: log in as admin → `/syllabus` should render. Log in as
   head_teacher / teacher → no nav link, direct visit redirects to `/`.

No `npm install`, `prisma db push`, or `prisma migrate` is required — schema
is unchanged.

---

## 5. Endpoint reference

| Method | Path                                | Role  | Body                                                                                        |
| ------ | ----------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| POST   | /api/admin-syllabus/exam-boards     | admin | `{ code, name }`                                                                            |
| POST   | /api/admin-syllabus/subjects        | admin | `{ examBoardId, code, name, level }`                                                        |
| POST   | /api/admin-syllabus/components      | admin | `{ subjectId, code, name }`                                                                 |
| POST   | /api/admin-syllabus/topics          | admin | `{ componentId, parentTopicId?, code, name, sortOrder? }`                                   |
| PATCH  | /api/admin-syllabus/topics/:id      | admin | `{ name?, code?, parentTopicId?, sortOrder? }`                                              |
| DELETE | /api/admin-syllabus/topics/:id      | admin | —                                                                                           |
| POST   | /api/admin-syllabus/import          | admin | `{ boardCode, boardName?, subjectCode, subjectName, level, components:[{code,name,topics[]}] }` |

Read endpoints (`GET /api/exam-boards`, `/subjects`, `/components`, `/topics`)
are untouched and remain open to any authenticated user.

---

## 6. Behaviour notes

- **Unique constraint conflicts** (duplicate exam-board code, duplicate
  subject (board,code,level), duplicate component code per subject, duplicate
  topic code per component) are mapped from Prisma `P2002` to **HTTP 409**.
- **Delete topic with referenced questions** is mapped to **HTTP 409** with
  a body that lists the four counts (`primaryQuestions`, `questionLinks`,
  `questionItemLinks`, `children`). It must NOT 500. The service does the
  count *before* attempting `prisma.topic.delete`, so the `onDelete: NoAction`
  FK is never exercised in the happy path. Defensive `P2003 / P2014` mapping
  is in place as a safety net.
- **Reparent guard**: cannot point a topic at itself, cannot move it to a
  different component, cannot create a cycle (parent walk + cycle check).
- **Bulk import** is wrapped in `prisma.$transaction` and is idempotent —
  re-running the same payload upserts every row by code (no duplicates).
- **Audit trail**: every successful mutation writes an `AuditLog` row with
  action prefix `admin_syllabus.*`.
