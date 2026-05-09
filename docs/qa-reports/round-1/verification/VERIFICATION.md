# Round 1 Verification

## Method
- Chrome MCP extension: NOT connected (verified via `list_connected_browsers` → `[]`).
- Per QA spec: fall back to API + code + unit-test verification. Browser
  pass deferred to Round 2 if extension comes online before deploy.

## Vitest regression guards added

`apps/api/test/morning-quiz.spec.ts` (12 new tests, all green):

### Critical #1 — getStudentView answer-key redaction (3 tests)
- `strips correct flag from snapshotOptions` — every option in the
  redacted output lacks `.correct`.
- `strips markScheme + answerContent from snapshotContent` — both stripped,
  legitimate fields (passage, stem) preserved.
- `passes through null/non-object snapshotContent unchanged` — covers the
  short_answer + IELTS-passage edge cases.

### Medium — autoGradeScripts shared helper (4 tests)
- 0 marks for empty pick.
- Full marks for correct MCQ.
- short_answer skipped (Phase 2).
- Falls back to `question.options` when snapshotOptions null.

### Critical #2 — deviceUuid required + regex (5 tests)
- Accepts UUID v4.
- Accepts documented `fallback-…` form.
- Rejects missing field (this is the regression guard).
- Rejects SQL-injection-shaped string.
- Rejects too-short.

## Final state
- vitest: **36 / 36 passing** (was 24 baseline).
- tsc --noEmit: clean.

## Items NOT verified this round
- Critical #3 (fetchRoster active-gate): no integration test infra
  available; verified via code review only.
- Critical #4-#5 (attendance correct/history role checks): code-review
  only.
- CORS / JWT prod hardening: needs running server; will re-verify in
  Phase 7 if Chrome MCP comes online.

## Deployed-state assumption
- Railway prod: not separately probed. Verification of live deploy
  happens after final push (out of QA scope today).
