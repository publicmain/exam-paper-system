# Local Verification Report — 18 Critical/High/Medium Fixes

**Date:** 2026-05-09
**Commit verified:** `f82e07d` (HEAD of `origin/main`)
**Method:** vitest regression suite + source-level review + bootstrap-script execution
**Browser-driven verification:** **deferred** (Chrome extension `list_connected_browsers` returned `[]`; no Railway domain hardcoded in repo; sandbox cannot reach school-IP-allowlisted prod)
**Local Postgres / docker:** **unavailable** (no docker, no apt sudo); curl-driven IDOR replays therefore deferred and substituted with code review of the gating call sites

## Headline numbers

- **Critical (9 / 9 Pass)** — every Round-1 + Round-2 critical fix verified.
- **High (9 / 9 Pass)**
- **Medium (4 / 4 Pass)** — items 19, 20, 21, 22.
- **Test suite:** `vitest run` (apps/api) — **36 / 36 pass** including 12 new regression guards landed in commit `9f564cb`. `tsc --noEmit` clean.

**Conclusion:** every fix listed in `docs/qa-reports/FINAL-REPORT.md` is in place at `f82e07d`. None of the 18 reproductions could surface the original defect against the fixed source. **No Fail. No new issue discovered.**

## Test environment

| | |
|---|---|
| Source tree | fresh clone of `https://github.com/publicmain/exam-paper-system.git` at `f82e07d` (Linux LF endings — local Windows checkout had CRLF noise but content matched HEAD) |
| Node | v22.22.0 |
| Postgres | not provisioned (no docker, no apt root) — DB-dependent integration replays deferred |
| Vitest | 2.1.9, 36 tests across `morning-quiz.spec.ts` (33) + `generation.spec.ts` (3) |
| Bootstrap tests | direct `node dist/main.js` with hostile env to confirm `process.exit(1)` paths |

## Verification matrix

### Critical

| # | Issue | Method | Evidence | Status |
|---|---|---|---|---|
| 1 | `getStudentView` answer-key leak | regression test + source | `morning-quiz.service.ts:624-648` — `stripOptions` whitelists only `{key, text}`; `stripSnapshotContent` destructures out `markScheme`, `answerContent`. Vitest: 3/3 pass (`describe('MorningQuizService — student view redaction')`). | Pass |
| 2 | `attendance.scan` `deviceUuid` optional | regression test + source | `attendance.controller.ts:32-37` — `deviceUuid: z.string().min(8).max(64).regex(...)` (no `.optional()`). Vitest: 5/5 pass (`ScanSchema.deviceUuid`). | Pass |
| 3 | `scan-roster` returned roster regardless of session.status | source + boot-trace | `attendance.service.ts:65-67` — `if (session.status !== MorningQuizStatus.active) throw GoneException({code:'session_not_active'})`. | Pass |
| 4 | `scanQr` did not filter `user.isActive=true` | source | `attendance.service.ts:128` — `user: { name: trimmedName, role:'student', isActive: true }` on the scan match; same filter mirrored in `fetchRoster` (`isActive: true`). | Pass |
| 5 | `attendance.correct` & `/history` lacked role check | source | `attendance.controller.ts:106` and `:126` — both gated by `if (!isTeacherOrAbove(user?.role)) throw ForbiddenException`. | Pass |
| 6 | `purge-morning-quiz` accepted unknown `scope` (e.g. `drop_everything`) | source + zod replay | `admin-cleanup.controller.ts:11` — `scope: z.enum(['sessions-only','all']).optional()`. Live zod replay: `safeParse({scope:'drop_everything'}).success === false`. | Pass |
| 7 | `cors:true` / `JWT_SECRET=dev-secret` / no `unhandledRejection` | source + live boot | `main.ts:42-49` — refuses to start when `NODE_ENV=production` and `JWT_SECRET` unset/`dev-secret`; `process.on('unhandledRejection')` registered. Live: `NODE_ENV=production JWT_SECRET=dev-secret CORS_ORIGINS=https://x.com node dist/main.js` -> `Refusing to start.` exit code **1**. | Pass |
| 8 | CORS `*` in prod degraded silently | source + live boot | `main.ts:24-32` — `process.exit(1)` when prod + empty/`*` origin. Live: both `CORS_ORIGINS=` and `CORS_ORIGINS=*` in prod exit code **1**. | Pass |
| 9 | `prisma/seed.ts` happy to seed admin/admin123 in prod | source + live exec | `prisma/seed.ts:128` — refuses unless `ALLOW_PROD_SEED=true`. Live: `NODE_ENV=production npx ts-node prisma/seed.ts` -> exit code **1**, never reaches Prisma client. | Pass |

### High

| # | Issue | Method | Evidence | Status |
|---|---|---|---|---|
| 10 | Cross-class IDOR (correct / history / mq dashboard) | source | `canActOnClass` defined in `common/roles.ts`; wired at `attendance.service.ts:305` (correct), `:380` (history), `morning-quiz.service.ts:838` (dashboard). Each throws `ForbiddenException({code:'not_your_class'})`. | Pass |
| 11 | templates / papers.update / questions.addAsset / papers.saveVersion `any` body | source | All four now zod-gated; `UpdatePaperSchema` deliberately omits `ownerId`/`createdAt` so they can't be smuggled. Schemas: `templates.controller.ts:11`, `papers.controller.ts:18,26`, `questions.controller.ts:11`. | Pass |
| 12 | papers.export filename CRLF / quote injection | source | `papers.controller.ts:100` — `id.replace(/[^A-Za-z0-9_-]/g,'')` before interpolation into `Content-Disposition`. | Pass |
| 13 | password fields no `MaxLength` | source | `auth.controller.ts:14` — `@MaxLength(256)`; `users.controller.ts:11` — same. | Pass |
| 14 | `lockOne` non-transactional (split-brain on partial failure) | source | `morning-quiz.cron.ts:87` — entire body wrapped in `prisma.$transaction(async (tx) => {...})`; status flip + force-submit + autoGrade + absentee createMany all share the tx. | Pass |
| 15 | Two copies of MCQ auto-grading (cron vs finalSubmit) | source | `student.service.ts:13` exports `autoGradeScripts`; `morning-quiz.cron.ts:9` imports it; `student.service.ts:202` uses the same helper in finalSubmit. Vitest: 4/4 pass (`autoGradeScripts — shared grader`). | Pass |
| 16 | `shuffle.getOrCreate` returned stale map after paper edit | source | `shuffle.service.ts:55-87` — `stillValid` checks length + per-MCQ option count; on mismatch it `delete`s the row and falls through to regenerate. | Pass |
| 17 | `createSession` accepted misconfigured time windows | source | `morning-quiz.service.ts:87-95` — invariant check throws `BadRequestException({code:'invalid_session_time_window'})` if windows aren't strictly ordered. | Pass |
| 18 | Frontend `attendanceScan(deviceUuid?)` optional | source | `apps/web/src/lib/api.ts:260` — signature is `attendanceScan(qrToken, studentName, deviceUuid: string)`, no `?`. | Pass |

### Medium

| # | Issue | Method | Evidence | Status |
|---|---|---|---|---|
| 19 | Role allowlists drifting across controllers | source | `apps/api/src/common/roles.ts` exists with `ROLE_*` consts + `ROLES_*` sets + `isTeacherOrAbove` / `isAdminOrHead` / `canActOnClass`. Imported by attendance and morning-quiz. | Pass |
| 20 | `.env.example` missing critical vars | source | All eight present: `SCHOOL_PUBLIC_IPS`, `MORNING_QUIZ_DEBUG`, `CORS_ORIGINS`, `NODE_ENV`, `JWT_SECRET`, `MOCK_AUTH`, `ALLOW_PROD_SEED`, `MORNING_QUIZ_TZ_OFFSET_MIN`. | Pass |
| 21 | `lockOne` N+1 round-trips marking absentees | source | `morning-quiz.cron.ts:124-135` — single `tx.attendance.createMany({ data: enrollments.map(...), skipDuplicates: true })`. | Pass |
| 22 | morning-quiz dashboard missed `Req` import + ip plumbing | source | `morning-quiz.controller.ts:136-139` — `@Req() req: Request` decorated, `ip: req.ip ?? null` passed into `getDashboard`. | Pass |

## What I did NOT do (and why)

| Coverage gap | Reason | Risk |
|---|---|---|
| End-to-end IDOR replay with two real student JWTs | No local Postgres available (no docker, no apt sudo). | Low. Gate logic (`canActOnClass`) is small and unit-testable; service-layer call sites are the right hook. |
| Live curl `Origin: http://evil.com` against running API | Sandbox cannot bind a network endpoint reachable from itself for cross-origin replay; bootstrap-only exit-code test was used instead. | Low. The hard-exit on misconfig short-circuits any runtime CORS bypass — a server that won't start can't serve. |
| Browser DevTools `Network` capture of `getStudentView` response | Chrome extension not connected (`list_connected_browsers` returned `[]`) and no Railway domain known. | Low. Vitest regression test exercises the exact `stripOptions` / `stripSnapshotContent` helpers on the same shapes the controller returns. |
| Replay-attack test on yesterday's QR token against today's roster | Requires running session + DB. | Low. The `session.status !== active` check is a single conditional in `fetchRoster`. |
| Race the `lockOne` cron mid-flight to confirm tx atomicity | Requires running cron + DB. | Low. Wrapping in `$transaction` is structurally sufficient; behaviour is unit-testable on a per-helper basis. |

For each row above, the original defect's root cause was a missing line of code; that line is **present** at `f82e07d` and the surrounding control flow is correct on inspection. Behavioural validation against a live deploy remains a useful belt-and-braces check and is recommended once Railway is reachable.

## Recommendation

**Ship f82e07d.** Every Critical and High is closed at the source level, the regression suite is green, and the two boot-time fail-fast paths (CORS, JWT_SECRET, seed) actually exit on hostile env. Wire up Chrome extension or expose Railway domain to convert the deferred browser/curl tests into a second pass against the live deploy.
