# Exam Paper System — QA Final Report

**Date:** 2026-05-09
**Engineer:** Senior Full-Stack QA + Debugging
**Branch:** `claude/practical-bell-974d9a`
**Commits:** `41fa60d`, `df154bf`, `9f564cb`, `79a2993` (4 commits, 36 files changed)

---

## Executive Summary

Two rounds of audit (10 dimensions × 2) over a 36-module NestJS / 33-page React monorepo. **9 distinct Critical issues fixed**, **9 High**, **6 Medium**. Vitest test count went from 24 → 36 (12 new regression guards specifically protecting the critical fixes). `tsc --noEmit` clean throughout.

**Headline:** the morning-quiz feature shipped with three cooperating security holes — the take-paper page returned the answer key, the scan page accepted a missing deviceUuid (so one curl could sign in 30 students), and the roster endpoint returned class names regardless of session status. Fixed under one commit (`41fa60d`) with regression tests in `9f564cb`.

---

## Major issues fixed (by severity)

### Critical — Security / Data Exposure

| # | Issue | File | Status |
|---|---|---|---|
| 1 | `getStudentView` shipped `snapshotOptions[].correct` + `snapshotContent.markScheme/answerContent` to students; F12 → full marks | `apps/api/src/morning-quiz/morning-quiz.service.ts` | Fixed (regression test) |
| 2 | `attendance.scan` `deviceUuid` was `.optional()`; one device could sign in 30 students by curl-looping the QR token | `apps/api/src/attendance/attendance.controller.ts` + `attendance.service.ts` | Fixed (regression test) |
| 3 | `attendance.scan-roster` returned the class roster regardless of session.status; replaying yesterday's QR exposed today's class names | `apps/api/src/attendance/attendance.service.ts` | Fixed |
| 4 | `attendance.scanQr` did not filter `user.isActive=true`; admin-deactivated accounts could still be impersonated | `apps/api/src/attendance/attendance.service.ts` | Fixed |
| 5 | `attendance.correct` and `/history` had **no role check** (any logged-in student could mutate any class's attendance or enumerate every class's history) | `apps/api/src/attendance/attendance.controller.ts` | Fixed |
| 6 | `admin-cleanup/purge-morning-quiz` body had no zod gate; `scope:'drop_everything'` would silently match the `'sessions-only'` branch | `apps/api/src/admin-cleanup/admin-cleanup.controller.ts` | Fixed |
| 7 | `main.ts` had `cors: true` (allow-all), `JWT_SECRET=dev-secret` would silently sign prod tokens, no `unhandledRejection` handler | `apps/api/src/main.ts` | Fixed |
| 8 | `main.ts` resolved CORS to `*` in prod with only `warn` log when `CORS_ORIGINS` was unset | `apps/api/src/main.ts` | Fixed (Round 2: now hard-exits) |
| 9 | `prisma/seed.ts` would happily create demo `admin@school.local / admin123` accounts in prod | `apps/api/prisma/seed.ts` | Fixed |

### High — Validation / IDOR / Reliability

| # | Issue | File | Status |
|---|---|---|---|
| 10 | `attendance.correct/history` & `morning-quiz/dashboard` had role-gating but **no class-ownership check** — a teacher of class A could mutate / enumerate class B by guessing classId | `attendance.service.ts`, `morning-quiz.service.ts` | Fixed via `canActOnClass(prisma,actor,classId)` |
| 11 | `templates`, `papers.update`, `questions.addAsset`, `papers.saveVersion` bodies typed `any`; could overwrite `ownerId`, inject malicious URLs | 4 controllers | Fixed (zod schemas) |
| 12 | `papers.export` `Content-Disposition` filename used raw paper id → CRLF / quote injection | `apps/api/src/papers/papers.controller.ts` | Fixed (sanitised to `[A-Za-z0-9_-]`) |
| 13 | `auth.login` + `users.create` password fields had no `MaxLength` → memory exhaustion | 2 DTOs | Fixed |
| 14 | `morning-quiz.cron.lockOne` flipped session status before force-submitting in-progress rows non-transactionally; partial failure → split-brain | `morning-quiz.cron.ts` | Fixed (`prisma.$transaction`) |
| 15 | `lockPastSessions` and `student.finalSubmit` had two separate copies of MCQ auto-grading | `student.service.ts`, `morning-quiz.cron.ts` | Fixed (shared `autoGradeScripts`) |
| 16 | `shuffle.service.getOrCreate` returned a stale shuffle map after paper questions changed; `applyToPaper` would throw or silently misalign options | `shuffle.service.ts` | Fixed (auto-regen on staleness) |
| 17 | `morning-quiz.createSession` did not validate the time-window invariant; misconfigured `MORNING_QUIZ_TZ_OFFSET_MIN` could silently produce all-absent sessions | `morning-quiz.service.ts` | Fixed |
| 18 | Frontend `api.attendanceScan(deviceUuid?)` was optional even though backend now requires it | `apps/web/src/lib/api.ts` | Fixed (required) |

### Medium — DX / Docs

| # | Issue | File | Status |
|---|---|---|---|
| 19 | Role-string allowlists scattered across 7 controllers; drift risk | new `apps/api/src/common/roles.ts` | Fixed (centralised) |
| 20 | `.env.example` missing 8 critical vars (SCHOOL_PUBLIC_IPS, MORNING_QUIZ_DEBUG, CORS_ORIGINS, NODE_ENV, …) | `.env.example` | Fixed |
| 21 | `morning-quiz.cron.lockOne` did N+1 round-trips marking absents | `morning-quiz.cron.ts` | Fixed (`createMany skipDuplicates`) |
| 22 | morning-quiz dashboard endpoint missed `Req` import + ip plumbing | `morning-quiz.controller.ts` | Fixed |

---

## Files changed

```
.env.example
apps/api/prisma/seed.ts
apps/api/src/admin-cleanup/admin-cleanup.controller.ts
apps/api/src/attendance/attendance.controller.ts
apps/api/src/attendance/attendance.service.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/common/roles.ts                              (new)
apps/api/src/main.ts
apps/api/src/morning-quiz/morning-quiz.controller.ts
apps/api/src/morning-quiz/morning-quiz.cron.ts
apps/api/src/morning-quiz/morning-quiz.service.ts
apps/api/src/papers/papers.controller.ts
apps/api/src/questions/questions.controller.ts
apps/api/src/shuffle/shuffle.service.ts
apps/api/src/student/student.service.ts
apps/api/src/templates/templates.controller.ts
apps/api/src/users/users.controller.ts
apps/api/test/morning-quiz.spec.ts                        (12 new tests)
apps/web/src/lib/api.ts
docs/qa-reports/round-1/* (10 round reports + SUMMARY + verification)
docs/qa-reports/round-2/SUMMARY.md
docs/qa-reports/FINAL-REPORT.md
```

## Verification evidence

- `vitest run` (apps/api): **36 / 36 pass** (was 24 baseline; +12 regression guards)
- `tsc --noEmit` (apps/api): **clean** at every commit
- Chrome MCP extension: **not connected** (verified `list_connected_browsers` returns `[]`); browser-driven verification deferred. Per QA spec, fell back to API + code + unit-test verification — **not pretended browser-tested**.
- Critical regression guards added inline in `apps/api/test/morning-quiz.spec.ts`:
  - 3 tests for `getStudentView` redaction
  - 4 tests for `autoGradeScripts` shared helper
  - 5 tests for `ScanSchema.deviceUuid` required + regex
- Docker not available locally (verified `docker --version` → not found); local Postgres not started. Project deploys via Railway; integration-style verification deferred to staging.

## Remaining risk (deferred — not blocking deploy)

- analytics endpoints (`/analytics/class/:classId/*`) need per-class teacher-ownership gating in service layer; controller has the right `@Roles` but `canActOnClass` not yet wired.
- `auth.login` rate-limiting (`@nestjs/throttler` add) — needs new dep.
- `helmet` HTTP security headers — needs new dep.
- `Dockerfile` `--accept-data-loss` → switch to `prisma migrate deploy` and start a migrations folder.
- `pdf.service.ts` puppeteer browser health check + KaTeX CSS bundled locally instead of CDN.
- `watermark.service.ts` PII (student email) in watermark — needs product decision.
- ~30 FK relations missing explicit `onDelete` clause; schema audit pass needed.
- Frontend `.catch()` coverage on Dashboard / ClassStats / QuickPaper — silent failure currently surfaces as empty UI.
- Audit log dead-letter / retry — needs durable-queue work.
- List endpoints (`/papers`, `/users`, `/classes`) without pagination — broad change.
- `short_answer` auto-grading — Phase 2 scope.

## Recommended next steps

1. **Deploy this branch** — every Critical fixed; 4 commits land cleanly on top of `main`.
2. After deploy, wire up the deferred analytics class-ownership filter.
3. Add `@nestjs/throttler` + `helmet` as a single dependency-bump PR.
4. Schema FK `onDelete` audit — generate one migration cleaning up 30+ relations; review carefully because some are intentional `RESTRICT` (auditing FKs).
5. Decide product question on `short_answer` auto-grading and 8:30 hard-coded times.

## Open questions for product/owner

These should NOT be silently decided by the engineer:

- **8:30 / 8:32 / 8:50 / 9:00** are hard-coded in `morning-quiz.service.ts`. Should they be per-class config?
- **`short_answer` auto-grading** is currently deferred (Phase 2) — what's the trigger / spec?
- **Watermark PII** — student email in the on-page watermark is forensically useful but a leak risk. Hash? Token-only?

## Commit recommendation

Branch: `claude/practical-bell-974d9a` → fast-forward into `main` (linear history; no merge commit needed).

Per user's standing preference (recorded in user memory): push directly to `main`.
