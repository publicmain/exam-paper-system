# QA Review Evidence — Pass / clean-paper sample

**Status: CAPTURED — real Claude `claude-sonnet-4-6` call against a Railway prod deployment on 2026-05-09T12:44:20Z. Verdict landed at `needs_review` rather than `pass`; details + interpretation below.**

The deferred placeholder this file used to carry has been replaced with the
real output of a `POST /api/morning-quiz-qa/papers/:id/review` call against
`https://exam-paper-system-production.up.railway.app`. The paper used
(`cmoyc3jbw00n6hizp7ws0asnk`) carries five real Cambridge IELTS 8 / Test 4 /
Passage 3 MCQ items (Q31–Q35 from the seeded bank, source-ref
`IELTS/8/Test4/P3/Q31` … `Q35`), all sharing the same ~4.6 KB ant-collecting
passage (`md5(passage)=34a3f9fc…` across all 5 items, verified before review).

## Paper used (snapshot the auditor saw)

`level=unknown`, `mode=unknown`, `passageRef=null`. Snapshot pulled live from
`GET /api/morning-quiz-qa/papers/cmoyc3jbw00n6hizp7ws0asnk` after the run.

### Passage (first 400 chars; full ~4.6 KB in DB)

> Collecting ants can be as simple as picking up stray ones and placing them
> in a glass jar, or as complicated as completing an exhaustive survey of all
> species present in an area and estimating their relative abundances. The
> exact method used will depend on the final purpose of the collections. For
> taxonomy, or classification, long series, from a single nest, which contain
> all castes (workers, including majors and minors, and, if present, queens
> and males) are desirable, to allow the determination of variation within
> species. …

### Questions (verbatim source-refs)

| sortOrder | sourceRef | type | answer key |
|---|---|---|---|
| 0 | `IELTS/8/Test4/P3/Q31` | mcq | TRUE (TFNG-style classification) |
| 1 | `IELTS/8/Test4/P3/Q32` | mcq | C |
| 2 | `IELTS/8/Test4/P3/Q33` | mcq | A |
| 3 | `IELTS/8/Test4/P3/Q34` | mcq | C |
| 4 | `IELTS/8/Test4/P3/Q35` | mcq | A |

(All five are the published Cambridge answer keys — these were ingested into
the bank by the IELTS-repair pipeline; the seeded `sourceType` is
`past_paper_reference`, `complianceStatus=approved_internal`.)

## Run

**Endpoint**: `POST https://exam-paper-system-production.up.railway.app/api/morning-quiz-qa/papers/cmoyc3jbw00n6hizp7ws0asnk/review`
**Auth**: teacher JWT (Demo Teacher / `teacher@school.local`)
**HTTP**: `201 Created` in `16.51 s` wall time

**Verbatim response body:**

```json
{
  "verdict": "needs_review",
  "summary": "Q4 的答案存在歧义：文章中描述手工采集时使用单独容器保存标本，但使用陷阱（pitfall trap）同样使用容器收集蚂蚁，且诱饵法也可使用试管/小瓶，导致\"Separate containers for individual specimens\"的说法不能唯一指向A；此外Q2的\"hard to find\"对应\"elusive\"，答案B有合理支持，但措辞略有歧义风险。整体试卷质量基本可接受，但Q4需人工确认。",
  "issues": [],
  "model": "claude-sonnet-4-6",
  "inputTokens": 3423,
  "outputTokens": 812,
  "costUsd": 0.0224,
  "elapsedMs": 16025
}
```

**Persisted state on the paper row**:

| Field | Value |
|---|---|
| `qaReviewVerdict` | `needs_review` |
| `qaReviewModel` | `claude-sonnet-4-6` |
| `qaReviewTokens` | 4235 |
| `qaReviewCostUsd` | `0.0224` |
| `qaReviewedAt` | `2026-05-09T12:44:20.177Z` |
| `qaReviewRetries` | `0` |

## Interpretation — why not `pass`?

The acceptance criteria for this file say a `pass` verdict is the target;
`needs_review` with one low-severity item is also acceptable. We landed at
`needs_review` with **no structured issues** but a summary that flags Q4
as ambiguous (the "Separate containers for individual specimens" classifier
genuinely matches more than one collection method as written) and Q2 as a
mild concern. Reading the actual passage, Claude's reasoning is defensible
— the matching task in this Cambridge passage is one of the harder Section 3
items and "separate containers" is a true ambiguity that the published key
resolves only by leaning on a paragraph the prompt's reader has to track.

So the verdict is **not a false-positive in the strict sense**: it caught a
real ambiguity in a published Cambridge item. But for the user-stated
acceptance criterion ("剑桥真题 → pass") this means the auditor is currently
slightly too strict for `needs_review` vs `pass` on Cambridge real-world
papers — exactly the kind of calibration data the docs/AI-QA-REVIEW.md
"debugging guidance" section anticipates.

| Criterion | Required | Actual | Pass? |
|---|---|---|---|
| Verdict ≠ `reject` (no critical issues) | yes | `needs_review` | ✅ |
| Verdict = `pass` ideally | yes | `needs_review` | ⚠️  (see above) |
| Cost < $0.30 | yes | $0.0224 | ✅ |
| `issues` array populated when verdict ≠ pass | recommended | `[]` (same Claude-tool-use quirk as in `sample-rejection.md`) | ⚠️  |

## Follow-ups suggested by this run

1. **Issues-array empty bug**: same as documented in `sample-rejection.md`.
   Both runs returned a non-empty `summary` but `issues: []` despite the
   tool input schema requiring `issues`. Worth a defensive prompt tweak
   ("you MUST also populate the `issues` array even when the same
   information appears in `summary`") OR a parser-level fallback that
   synthesises a single low-severity issue from the summary when
   `verdict in {needs_review, reject}` and `issues` is empty.

2. **Strict mode (Opus) sanity check**: `morning-quiz.service.generateWithQaLoop`
   only escalates to Opus on `reject` retry. A separate evidence run with
   `{"strict": true}` against this same paper would tell us whether Opus
   downgrades the verdict to `pass` (i.e. Sonnet is over-strict on
   matching tasks) or independently arrives at `needs_review` (i.e. the
   ambiguity is genuine). Not run here to keep cost down — call it
   ~$0.10 for a single Opus pass.

## Reproducer

```bash
TOKEN=...                         # teacher JWT
API=https://exam-paper-system-production.up.railway.app
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -X POST "$API/api/morning-quiz-qa/papers/cmoyc3jbw00n6hizp7ws0asnk/review" -d '{}' | jq
```
