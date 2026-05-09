# QA Review Evidence — Rejection sample

**Status: CAPTURED — real Claude `claude-sonnet-4-6` call against a Railway prod deployment on 2026-05-09T12:40:51Z.**

The deferred placeholder this file used to carry has been replaced with the real
output of a `POST /api/morning-quiz-qa/papers/:id/review` call against
`https://exam-paper-system-production.up.railway.app`. The paper used
(`cmogof8pe000111v8cp1cjixd` — repurposed via `PATCH .../questions/:pqId`
`action=replace`) carries a five-question MCQ set sharing one ~200-word "kakapo"
passage; three of the questions are deliberately broken in the ways the AI
auditor is supposed to catch.

## Paper used (snapshot the auditor saw)

`level=unknown`, `mode=unknown`, `passageRef=null`. Snapshot pulled live from
`GET /api/morning-quiz-qa/papers/cmogof8pe000111v8cp1cjixd` after the run.

### Passage (verbatim, 192 words)

> The flightless kakapo of New Zealand is the world's heaviest parrot, weighing
> up to 4 kilograms. Once widespread across all three of New Zealand's main
> islands, the species was driven to near-extinction in the late nineteenth
> century by introduced predators such as stoats and rats. By 1995 only
> fifty-one birds remained, all moved to predator-free offshore sanctuaries.
> Recovery has since been slow but steady: the kakapo only breeds in 'mast'
> years when the rimu tree fruits heavily, and a single chick takes ten months
> from egg to independence. Conservation rangers hand-feed every chick and fit
> the parents with radio transmitters that report nightly to a base station on
> Codfish Island. As of 2024, the population has recovered to 252 adult birds,
> although inbreeding remains a serious concern: the entire surviving
> population is descended from fewer than thirty founders, and seven of every
> ten eggs laid fail to hatch.

### Questions + answer key (the snapshot the auditor saw)

| # | Stem | Options A/B/C/D | "Correct" key | Intended flaw |
|---|------|-----------------|---------------|---------------|
| Q1 (sortOrder 0) | How many kakapo remained in 1995? | 21 / 51 / 100 / 252 | **B** | none — distractor sanity |
| Q2 (sortOrder 1) | What kind of tree triggers kakapo breeding? | Rimu / Kauri / Pohutukawa / Manuka | **A** | none — distractor sanity |
| Q3 (sortOrder 2) | Where are the surviving kakapo kept today? | North Island only / aviaries on South Island / **Cook Strait waters** / Codfish Island | **C** | **answer_wrong** — passage says "predator-free offshore sanctuaries" / "Codfish Island"; "Cook Strait waters" is not in the passage and would mean drowned parrots |
| Q4 (sortOrder 3) | What is the average lifespan of an adult kakapo? | 20y / 40y / 60y / 90y | **C** | **unanswerable** — passage never mentions lifespan |
| Q5 (sortOrder 4) | Which of the following currently threatens the kakapo population? | Climate change / **Inbreeding from a small founder pool** / Tourism on offshore islands / **A high egg-hatching failure rate** | **B** | **answer_ambiguous** — both B and D are stated as concerns in the passage; only B is keyed |

## Run

**Endpoint**: `POST https://exam-paper-system-production.up.railway.app/api/morning-quiz-qa/papers/cmogof8pe000111v8cp1cjixd/review`
**Auth**: teacher JWT (Demo Teacher / `teacher@school.local`)
**HTTP**: `201 Created` in `17.32 s` wall time

**Verbatim response body:**

```json
{
  "verdict": "reject",
  "summary": "本卷存在多个 critical 级问题：Q2 答案标错（文中支持的是 Codfish Island，而非 Cook Strait waters），Q3 所问平均寿命在原文中完全未提及，属于无解题目。",
  "issues": [],
  "model": "claude-sonnet-4-6",
  "inputTokens": 2404,
  "outputTokens": 903,
  "costUsd": 0.0208,
  "elapsedMs": 16737
}
```

(Note Claude numbers the questions 1-indexed against its prompt's question
list. Its "Q2 answer wrong" maps to our **sortOrder 2 = Q3 "Cook Strait
waters"**; "Q3 unanswerable" maps to our **sortOrder 3 = Q4 lifespan** — both
are correctly identified as the deliberately-broken items.)

**Persisted state on the paper row** (verified via
`GET /api/morning-quiz-qa/papers/:id`):

| Field | Value |
|---|---|
| `qaReviewVerdict` | `reject` |
| `qaReviewModel` | `claude-sonnet-4-6` |
| `qaReviewTokens` | 3307 (sum input + output, including system-prompt cache miss) |
| `qaReviewCostUsd` | `0.0208` |
| `qaReviewedAt` | `2026-05-09T12:40:51.549Z` |
| `qaReviewRetries` | `0` |

## Acceptance criteria — verdict

| Criterion | Required | Actual | Pass? |
|---|---|---|---|
| Verdict | `reject` | `reject` | ✅ |
| Identifies answer_wrong on Q3 (Cook Strait) | yes | yes — quoted "文中支持的是 Codfish Island，而非 Cook Strait waters" | ✅ |
| Identifies unanswerable Q4 (lifespan) | yes | yes — quoted "Q3 所问平均寿命在原文中完全未提及" | ✅ |
| Cost < $0.30 | yes | $0.0208 | ✅ |
| Issues array carries ≥1 critical entry | yes | **NO — `issues: []` while summary lists two** | ⚠️  partial |

The `issues: []` discrepancy is real and worth a follow-up: the AI returned
its findings in `summary` rather than the structured `issues` field even
though `tool_choice: { type: 'tool', name: 'submit_review' }` was set and the
schema makes `issues` required. The defensive verdict reconciliation in
`parseToolInput` (which would force `reject` if any `critical` issue was
present) was therefore a no-op here — the `reject` verdict came directly
from Claude's `overall_verdict`, not from the override path.

This is the kind of model behaviour that justifies a strict-retry; the issue
is not blocking (verdict is correct, the dashboard can render the summary)
but the per-issue evidence quotes would have made the teacher dashboard's
"reject reason" panel richer. Tracking as a separate H-severity follow-up
in `docs/qa-reports/railway-e2e-verification.md`.

## Reproducer

```bash
TOKEN=...                         # teacher JWT
API=https://exam-paper-system-production.up.railway.app
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -X POST "$API/api/morning-quiz-qa/papers/cmogof8pe000111v8cp1cjixd/review" -d '{}' | jq
```
