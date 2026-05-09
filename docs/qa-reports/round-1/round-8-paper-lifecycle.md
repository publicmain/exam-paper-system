# Round 8 — Paper Lifecycle

## Path traced
- Generate (`POST /papers/generate`, `quick-paper.service`, AI batch)
  → Paper + PaperQuestion[] + snapshot.
- PaperAssignment (`POST /papers/:id/assign` or auto-bound by morning-quiz
  `createSession`).
- Student render: redacted via `student.service.redactForStudent` (paper
  detail) and morning-quiz inline redaction (FIXED this round).
- AnswerScript upserts; finalSubmit transitions in_progress→submitted with
  `updateMany` race lock.
- Marker (`/marker/queue`, `/marker/submission/:id/score`) for structured
  questions.
- Lock at session end → `morning-quiz.cron.lockOne` (now transactional).
- Cleanup: `admin-cleanup.purgeMorningQuizData` (zod-validated this round).

## Issues found this round
- **Critical (FIXED)**: getStudentView leaked answer keys.
- **High (FIXED)**: `papers.export` Content-Disposition header used raw
  paper id → CRLF injection / path traversal.
- **High (FIXED)**: papers.update body `any`; could overwrite ownerId.
- **High (FIXED)**: questions.addAsset body `any`; URL not validated.
- **Medium**: `papers.generate` no idempotency key — refresh duplicates.
  **DEFERRED**.
- **Medium**: PDF export has 60s puppeteer timeout but no per-request
  cancellation when client disconnects. **DEFERRED**.

## Status: 4 fixes applied.
