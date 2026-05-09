# Round 1 — Summary

## Issues fixed (Critical / High this round)

| # | Severity | Area | Issue | File |
|---|----|----|----|----|
| 1 | Critical | Security | `getStudentView` shipped `snapshotOptions[].correct` + `snapshotContent.markScheme/answerContent` to students (F12 → full marks) | `morning-quiz/morning-quiz.service.ts` |
| 2 | Critical | Auth | `deviceUuid` was `.optional()` → 1 device could sign in 30 students via curl | `attendance/attendance.controller.ts` |
| 3 | Critical | Auth | `fetchRoster` did not require `session.status='active'` → roster of any class leakable with stale QR | `attendance/attendance.service.ts` |
| 4 | Critical | Auth | `attendance.scanQr` did not filter `isActive=true` users | `attendance/attendance.service.ts` |
| 5 | Critical | Auth | `attendance/correct` + `/history` had **no role check** (any student could mutate / enumerate) | `attendance/attendance.controller.ts` |
| 6 | Critical | Validation | `admin-cleanup/purge-morning-quiz` body had no zod gate; `scope:'drop_everything'` would silently match `'sessions-only'` branch | `admin-cleanup/admin-cleanup.controller.ts` |
| 7 | Critical | Production | CORS = `true` (allow-all); `JWT_SECRET=dev-secret` would silently sign prod tokens; no `unhandledRejection` handler | `main.ts` |
| 8 | High | Validation | `templates`, `papers.update`, `questions.addAsset`, `papers.saveVersion` bodies typed `any` | 4 controllers |
| 9 | High | Security | `papers.export` `Content-Disposition` filename used raw paper id (CRLF / path traversal vector) | `papers/papers.controller.ts` |
|10 | High | Validation | `auth.login` + `users.create` password fields had no `MaxLength` | 2 DTOs |
|11 | Medium | Race safety | `morning-quiz.cron.lockOne` flipped session status before force-submitting in-progress rows in non-transactional way; partial failure → split-brain | `morning-quiz/morning-quiz.cron.ts` |
|12 | Medium | DRY | `lockPastSessions` and `finalSubmit` had two copies of MCQ auto-grading | `student/student.service.ts`, `morning-quiz/morning-quiz.cron.ts` |
|13 | Medium | DX | Role-string allowlists scattered across 7 controllers, drift risk | `common/roles.ts` (new) |

## Files changed
- `apps/api/src/admin-cleanup/admin-cleanup.controller.ts`
- `apps/api/src/attendance/attendance.controller.ts`
- `apps/api/src/attendance/attendance.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/common/roles.ts` (new)
- `apps/api/src/main.ts`
- `apps/api/src/morning-quiz/morning-quiz.cron.ts`
- `apps/api/src/morning-quiz/morning-quiz.service.ts`
- `apps/api/src/papers/papers.controller.ts`
- `apps/api/src/questions/questions.controller.ts`
- `apps/api/src/student/student.service.ts`
- `apps/api/src/templates/templates.controller.ts`
- `apps/api/src/users/users.controller.ts`

## Verification
- `vitest run` → 24/24 pass (no regression)
- `tsc --noEmit` → clean
- Browser verification: Chrome MCP not connected — verified via API code
  analysis + types instead.

## Remaining risk (deferred to Round 2)
- Cross-class authZ for analytics + morning-quiz dashboard
- Login rate-limiting (`@nestjs/throttler`)
- Helmet HTTP headers
- List endpoints pagination
- Audit log dead-letter / retry
- Schema FK `onDelete` audit (~30 FKs missing explicit clause)
- Frontend `.catch()` coverage on Dashboard / ClassStats / QuickPaper
- PDF pipeline browser health check + KaTeX local CSS
- short_answer auto-grading — Phase 2 (open question for product)

## Open questions for product/owner (do NOT decide)
- 8:30 attendance start hard-coded — should this be per-class config?
- short_answer auto-grading: deferred to Phase 2 — what's the trigger?

## Commit
- `41fa60d` — fix(qa-r1): plug answer-key leak + tighten morning-quiz/auth/admin gates
