# Round 9 — PDF / Document Generation

## Findings (mostly DEFERRED — not blocking and require larger refactor)
- `pdf.service.ts:121` `page.close().catch(()=>{})` swallows errors silently.
  Long-running process accumulates leaked pages → eventual Chrome OOM.
- `pdf.service.ts:15` global Browser instance has no health check; if
  Chrome crashes mid-day, all subsequent renders 500.
- `templates.ts:115` KaTeX CSS loaded from `cdn.jsdelivr.net` → external
  dependency on every render.
- `watermark.service.ts:172` watermark text contains `studentEmail` (PII).
  If watermarked PDF is leaked, exposure is more than necessary.
- `templates.ts:30,39` KaTeX failures degrade silently to `<code>` block —
  teacher won't notice broken formulas in answer key.

## Status: deferred to Round 2 — refactoring PDF pipeline mid-audit risks
test-coverage gap (no PDF integration tests in vitest). Filed as separate
follow-up.

## Files changed: (none)
