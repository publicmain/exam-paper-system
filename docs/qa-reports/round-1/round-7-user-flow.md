# Round 7 — User Flow (teacher schedule → student submit → dashboard)

## Path traced
1. Teacher → POST `/morning-quiz/batch` or `/batch-generate` to schedule
   week. ✓ AuthGuard + role check.
2. Cron (`MorningQuizCron.tick`, every minute) → activates session
   T-30s before `attendanceStart`. ✓ Idempotent `updateMany`.
3. Student scans QR → GET `/attendance/scan-roster` (roster preview),
   POST `/attendance/scan` (typed name + deviceUuid → scan token).
4. Take page → GET `/morning-quiz/sessions/:id` (paper view, redacted).
5. Autosave answers → PATCH `/morning-quiz/sessions/:id/answer`.
6. Submit → POST `/morning-quiz/sessions/:id/submit` → `student.finalSubmit`.
7. Cron lock at `quizEnd` → force-submit any in-progress + mark absents.
8. Teacher → GET `/morning-quiz/sessions/:id/dashboard` for results.

## Issues found this round
- **Critical (FIXED)**: step 4 leaked snapshotOptions[].correct →
  `getStudentView` redaction.
- **Critical (FIXED)**: step 3 deviceUuid optional → required.
- **Critical (FIXED)**: roster pre-leak → `session.status==='active'` gate.
- **High (FIXED)**: cron lock not transactional → `prisma.$transaction`.
- **High**: step 1 `batchGenerate` makes N×M Anthropic calls per request
  — no rate limit, no per-user budget cap visible. **DEFERRED**.

## Status: 4 fixes applied (covered in batch 1 commit 41fa60d).
