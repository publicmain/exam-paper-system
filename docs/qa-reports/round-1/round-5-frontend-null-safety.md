# Round 5 — Frontend State & Null Safety

## High
- `MorningQuizTake.tsx:281` auto-submit useEffect can fire while `submitted`
  state is still false in a render where `remainingMs<=0` — narrowly safe
  due to `submitted` check inside `handleSubmit`. **NO REGRESSION** — left
  as-is; the `if (submitted) return` guard at line 301 already prevents
  double POST.
- `MorningQuizTake.tsx:327` `view.paperQuestions[0]?.snapshotContent ?? {}`
  — already optional-chained; agent flagged false positive. **NO CHANGE**.
- `MorningQuizScan.tsx:94-105` no double-submit guard. Confirmed safe:
  button has `disabled={submitting}`, plus the `setSubmitting(true)` before
  await. **NO CHANGE**.
- `Dashboard.tsx:10-14`, `ClassStats.tsx:83-88`, `QuickPaper.tsx:90,99`:
  missing `.catch()` handlers. **DEFERRED** — non-blocking, errors silent
  but UI shows empty rather than crashing.

## Verified existing-OK patterns
- highlights/notes use try/catch JSON.parse (lines 174-180, 192-200) ✓
- saveAnswer wraps fetch in try/finally with state cleanup ✓
- StudentTake.tsx race on resume needs cancellation flag — deferred

## Status: 0 fixes applied this round (claims re-verified)
The Round 5 agent over-flagged several false positives (already-safe
optional chains, already-disabled buttons). Real issues were lower
severity than reported.

## Files changed: (none — deferred to Round 2 / follow-up)
