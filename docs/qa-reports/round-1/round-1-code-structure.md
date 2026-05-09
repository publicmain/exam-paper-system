# Round 1 — Code Structure

## Findings
- `apps/api/src/morning-quiz/morning-quiz.service.ts` (818 LOC) — service is the
  largest in the project; mixes 5 concerns (CRUD, batch schedule, AI batch,
  student view, dashboard, cancel). Acceptable for v1, refactor candidate.
- **Duplicate logic**: `lockPastSessions` (cron) and `finalSubmit` (student
  service) both implemented MCQ auto-grading — drift risk.
  **Status: FIXED** — extracted `autoGradeScripts()` shared helper.
- **Cron not transactional**: `lockOne` flips status before force-submitting
  in-progress rows; partial failure → split-brain.
  **Status: FIXED** — wrapped in `prisma.$transaction`.
- **N+1 in absent-roster**: per-student `findUnique` + `create`; 30 students
  → 60 round-trips per session.
  **Status: FIXED** — switched to `createMany({ skipDuplicates: true })`.

## Severity summary
| Severity | Count | Fixed |
|---|---|---|
| High     | 2 | 2 |
| Medium   | 1 | 1 |

## Files changed
- `apps/api/src/student/student.service.ts` — exported `autoGradeScripts`
- `apps/api/src/morning-quiz/morning-quiz.cron.ts` — transactional lockOne
