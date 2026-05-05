# Blackbox regression suite — student-take slice

Five bash scripts that hit the deployed Railway API end-to-end. Each script
isolates its test data with a `tN-` prefix so you can run them in parallel
against the same database without collision. Re-running is safe — every
script timestamps its records.

| File | Slice | Last clean run |
| :-- | :-- | :-- |
| `t1-classes.sh` | Class CRUD + bulk roster + role visibility | 15/15 PASS |
| `t2-submissions.sh` | Open / autosave / resume / submit / lock | 14/14 PASS |
| `t3-autograde.sh` | MCQ auto-grade correctness (incl. edge cases) | 12/12 PASS |
| `t4-authz.sh` | Adversarial authz: cross-student, cross-class, JWT tamper, role escalation | 23/23 PASS |
| `t5-concurrency.sh` | Race conditions: parallel open / autosave / submit / roster | 7/7 PASS |

## Why this exists

The student-foundation slice (commit d22f6c8 — `feat(student): foundation`)
was originally pushed without integration tests. A 5-agent blackbox audit
caught **4 CRITICAL authz holes plus 2 HIGH bugs**:

- Students could read every question's `markScheme`, `answerContent`, and
  `correct` flag — `/api/questions/*` had no role guard.
- Students could `PATCH /api/papers/:id`, download answer-key PDFs, and
  create paper version snapshots — `/api/papers/*` had no role guard.
- `PATCH /student/.../scripts` accepted a `paperQuestionId` from any other
  paper (cross-paper write), and surfaced bogus ids as 500 (Prisma FK).
- `POST /submit` had a read-then-update race; two concurrent calls both
  succeeded with different `submittedAt` timestamps.

All fixes shipped in commit `d1c1c9e`. These scripts are the regression
guard going forward — run them before merging anything that touches:

- `apps/api/src/student/`
- `apps/api/src/classes/`
- `apps/api/src/papers/papers.controller.ts`
- `apps/api/src/questions/questions.controller.ts`
- `apps/api/src/common/auth.guard.ts`

## Usage

```bash
# Run a single slice
bash tests/blackbox/t4-authz.sh

# Run all five in parallel (each uses its own prefix; no collision)
for f in tests/blackbox/t*.sh; do bash "$f" > "/tmp/$(basename "$f" .sh).log" 2>&1 & done
wait
grep -E 'SUMMARY|PASS=|FAIL=' /tmp/t*.log
```

`BASE` env var overrides the default Railway URL:
```bash
BASE=http://localhost:4000 bash tests/blackbox/t4-authz.sh
```

## Caveats

- These hit **production** by default. The prefixed test data accumulates
  in the prod DB; periodically clean up via SQL (`DELETE FROM "User" WHERE
  email LIKE 't%-stu-%@example.com'` etc.) or add a teardown endpoint.
- `t3-autograde.sh` seeds a few MCQs into the question bank because the
  pre-existing seed papers have `snapshotOptions: null`. Those seeded
  questions persist after the run; harmless but visible in /questions.
- Tests assume the seed admin (`admin@school.local` / `admin123`) exists.
- Railway zero-downtime deploys can serve old code briefly while a new
  container builds. Wait ~2-3 min after `git push` before re-running.
