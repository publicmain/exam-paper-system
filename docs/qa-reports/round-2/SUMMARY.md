# Round 2 — Summary (10 stricter dimensions)

Audit method: 4 parallel Explore agents covering R1+R4 (edge+regression),
R2+R5 (cross-module+lifecycle), R7+R10 (contract+E2E), and
R3+R6+R8+R9 (role-journey+UI+PDF+production).

## Round 1 fixes — regression check
**Clean.** No regression detected by any agent. Vitest 36/36 still green.
Specifically verified:
- `getStudentView` redaction preserves IELTS `headingsBank` / `wordBank`.
- `lockOne` transaction is atomic; cron tick remains idempotent.
- ScanSchema `deviceUuid` regex accepts UUID v4 + `fallback-…`.

## New issues fixed this round

| # | Severity | Area | Issue | Files |
|---|----|----|----|----|
| 1 | High | Auth | `attendance/correct` did not check that the teacher actually teaches the target session's class — class-level IDOR | `attendance.service.ts` |
| 2 | High | Auth | `attendance/history` endpoint had only role-level gating; same IDOR — a teacher of class A could enumerate every attendance row for class B by passing classId | `attendance/{controller,service}.ts` |
| 3 | High | Auth | `morning-quiz/sessions/:id/dashboard` — same: a teacher could read another class's morning-quiz dashboard | `morning-quiz/{controller,service}.ts` |
| 4 | High | Production | `main.ts` resolved CORS to `*` in prod with only a `warn` log when `CORS_ORIGINS` was unset | `main.ts` |
| 5 | High | Reliability | `shuffle.service.getOrCreate` returned a stale shuffle map when the paper had questions added/removed since the map was minted, causing `applyToPaper` length-mismatch throws or silent half-permutations | `shuffle/shuffle.service.ts` |
| 6 | Medium | Reliability | `morning-quiz.createSession` did not validate the time-window invariant (attendanceStart < attendanceEnd < lateCutoff < quizEnd) — a misconfigured `MORNING_QUIZ_TZ_OFFSET_MIN` would silently produce a session where every scan falls into the absent branch | `morning-quiz.service.ts` |
| 7 | Medium | Contract | Frontend `api.ts` typed `attendanceScan(...deviceUuid?)` as optional even though backend now requires it; future caller could drop the field and fail at runtime | `web/src/lib/api.ts` |
| 8 | Medium | Production | `prisma/seed.ts` would happily create demo `admin@school.local / admin123` accounts if accidentally run in prod; added `NODE_ENV=production && ALLOW_PROD_SEED=true` hard guard | `prisma/seed.ts` |
| 9 | Medium | Docs | `.env.example` was missing 8 critical variables (SCHOOL_PUBLIC_IPS, SCHOOL_IP_BYPASS, MORNING_QUIZ_DEBUG, CORS_ORIGINS, NODE_ENV, MORNING_QUIZ_TZ_OFFSET_MIN, AI_IMAGE_STORAGE_PATH, ALLOW_PROD_SEED) | `.env.example` |
| 10 | Medium | DX | Centralised class-ownership helper `canActOnClass(prisma, actor, classId)` so authZ logic is one place, not scattered | `common/roles.ts` |

## Deferred to follow-up (out of scope this round)

- analytics service per-class teacher-ownership filter — broader refactor
  in `analytics.service.ts` not yet wired through controller layer.
- `watermark.service.ts` PII (student email) in watermark text — design
  decision needed (keep for forensics? hash? token-only?).
- `Dockerfile` `--accept-data-loss` — needs schema-history work.
- `pdf.service.ts` puppeteer browser health check + KaTeX local CSS.
- `/auth/login` rate-limiting (`@nestjs/throttler` add).
- `helmet` HTTP headers.
- 30+ FK `onDelete` audit pass.

## Verification
- vitest: **36/36** (regression guards green).
- tsc --noEmit: clean.
- Chrome MCP: still unavailable — verification is unit-test + code review.
