# QA Review Evidence — Pass sample

**Status: DEFERRED — `ANTHROPIC_API_KEY` is unset on this machine, so we have not yet captured a real Claude API call against a clean Cambridge IELTS paper. The offline test suite covers the surrounding plumbing.**

To capture this evidence later:

1. Export a real `ANTHROPIC_API_KEY` (sk-ant-…) into the local shell.
2. Pick an unmodified Cambridge IELTS passage from the bank — e.g. `IELTS/8/Test1/P1` if it's been ingested.
3. Build a paper from it via `pickPassageAndCreatePaper('IELTS','AUTH', …)` or via the morning-quiz batch generator.
4. Confirm the resulting `qaReviewVerdict` is `pass` (or `needs_review` with only `low`-severity items — the absolute false-positive baseline).
5. Capture verdict + summary + token usage + cost into the `## Run` section below.

## Acceptance criteria for this evidence run

- `verdict` MUST be `pass`. (`needs_review` with one `low` item is also acceptable; `needs_review` with `high`/`medium` is a false positive — investigate before relying on the gate.)
- Cost MUST be < $0.30.
- If Claude returns ≥1 `medium` issue, document why (could be a real but minor flaw in our bank, OR Claude over-flagging — both are useful data points).

## Run

(empty — to be populated when the API key is configured)

## Notes

- A non-zero false-positive rate is acceptable as long as it's not above ~1 in 5 papers. Higher than that means the prompt is being over-strict and we should add an example of a clean paper to the system prompt's few-shot context.
