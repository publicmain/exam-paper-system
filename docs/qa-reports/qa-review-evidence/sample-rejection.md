# QA Review Evidence — Rejection sample

**Status: DEFERRED — `ANTHROPIC_API_KEY` is unset on this machine, so we have not yet captured a real Claude API call against a deliberately-broken IELTS paper. The unit-test suite covers the same code path with a stubbed Anthropic client (see `apps/api/src/morning-quiz-qa/morning-quiz-qa.spec.ts`).**

To capture this evidence later:

1. Export a real `ANTHROPIC_API_KEY` (sk-ant-…) into the local shell.
2. Seed (or pick) an IELTS paper with a deliberately-broken question — e.g. annotated answer doesn't match passage, or the question references a fact that's not in the passage.
3. Run `curl -X POST http://localhost:4000/api/morning-quiz-qa/papers/<paperId>/review` with a teacher JWT, OR call `MorningQuizQaService.reviewPaper` directly from a one-off script.
4. Capture:
   - The exact `userText` we sent (use `console.log(userText)` inside `reviewPaper` temporarily).
   - The full Anthropic response (verdict, summary, issues array).
   - The token usage + cost line printed by the service logger.
5. Paste all three into the `## Run` section of this file, plus a one-paragraph comment at the bottom explaining whether the review caught the deliberate flaw.

## Acceptance criteria for this evidence run

- `verdict` MUST be `reject`.
- The issues array MUST contain at least one entry whose `severity` is `critical`.
- The `evidence` field of the offending issue MUST quote the passage / question text that proves the flaw.
- Cost MUST be < $0.30 for a single 13-question paper (sanity check on token budget).

## Sample paper to use (suggested)

The cleanest reproducer is to take any real Cambridge IELTS Test 1 passage already in the bank and:

1. Pick its Q3 (a typical short-answer year/number question).
2. Edit `paperQuestion.snapshotAnswer` to set `text` to a value that does NOT appear in the passage — e.g. swap "1894" for "1844".
3. Trigger review and confirm the AI flags `answer_wrong` with `severity=critical`.

## Run

(empty — to be populated when the API key is configured)

## Notes

- Until this is populated, the QA service is exercised by the offline mock suite. That suite covers the verdict reconciliation logic, the prompt construction, and the schema-sanitisation paths. It does NOT exercise Claude's actual reasoning — that's specifically what this evidence file is for.
