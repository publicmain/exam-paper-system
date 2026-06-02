---
name: morning-quiz-authoring-and-grading
description: >
  Codified, versioned procedure for authoring/auditing morning-quiz papers and
  for grading them — the zero-API workflows that are otherwise tacit knowledge.
  Phase 1 deliverable (docs/PRD §6.2). Read this before generating a paper,
  ingesting a new PDF→fixture, or grading a session.
status: active
owner: yaokexiang
---

# Morning-Quiz Authoring & Grading — Codified Skill

This is the durable, reviewable form of the "Claude in chat does the AI work"
process. It exists so the workflow is **reproducible** and does not depend on
any one session's memory. It is the human-in-the-loop implementation behind the
PRD §7 `AuthoringService` and `GradeService` seams.

> **Iron rule (CLAUDE.md):** ZERO Anthropic API calls at runtime. Authoring,
> QA, and short-answer grading are done by Claude in chat — never via a code
> AI path. The marker queue (`/api/marker/*`) is the grading channel; the AI
> grader / `regradeSession` paths must never be triggered.

## 1. Authoring a paper (the `AuthoringService` seam, today = human)

1. **Source.** Either `passage_pick` (a real Cambridge passage from the bank —
   store metadata only, never the original text) or original school-authored
   (`source_type=original_school`). Past-paper copyright red line is absolute.
2. **Structure.** Every question must satisfy `paper-structure-validator`
   (see §3) — non-negotiable, CI-enforced.
3. **The 10-point AI audit (no exceptions).** Every new PDF→fixture must clear
   all 10 checks before push: passage / stem / mark-scheme / schema /
   AI-grader exact / AI-grader paraphrase / AI-grader reject / UI render — see
   `docs/AI-QA-REVIEW.md` for the verdict semantics and prompt of record.
4. **Answer key shape.** MCQ-type questions must carry a discoverable canonical
   answer: a `correct:true` option, OR `snapshotContent.correctOption` /
   `correctAnswer` / `acceptedKeys`, OR `snapshotAnswer.text`. For near-synonym
   or either-order items use `acceptedKeys: [...]` (accepts any listed key).

## 2. Grading a session (the `GradeService` seam, today = deterministic + human)

When the user says 判分 / 批今天的早测 / grade 早测 / 人工判分:

1. Drain the marker queue via `/api/marker/*` (or `scripts/marker-dump.ts` →
   grade in chat → `scripts/marker-apply.ts`). **Never** trigger the AI grader.
2. **MCQ** is graded deterministically by `grading/grade.ts` `gradeMcq` (shared
   by `autoGradeScripts` and `GradeService`) — zero API, no human needed.
3. **short_answer / structured / essay** have no deterministic verdict in
   zero-API mode → graded by Claude in chat against the mark scheme, written
   back via the marker path, then the submission is finalized
   (`autoScore` + `manualScore` = `totalScore`, status → `marked`).
4. Caveat for any API-driven answer injection: the take page relabels MCQ
   option keys per student (shuffle). A real student clicks the displayed
   option; `saveAnswer` un-relabels it. If scripting answers, send the
   **display** key, not the canonical key.

## 3. The CI-enforced structure gate

`apps/api/src/morning-quiz/paper-structure-validator.ts` + its golden-fixture
spec run in `npm test`, which the CI workflow (`.github/workflows/ci.yml`)
gates every push on. Violation codes: `EMPTY_STEM`, `EMPTY_OPTIONS`,
`TOO_FEW_OPTIONS`, `NO_CANONICAL_ANSWER`. A paper that fails any check must not
reach students.

## 4. Future swap point (PRD Phase 3)

When a paid runtime LLM is funded, the ONLY code that changes is the
short-answer branch of `GradeService.grade` (and a future authoring generator)
— wrap the model in the report's evaluator-optimizer + groundedness gate, emit
`source:'llm'` + confidence, and keep `needsHumanReview` for low-confidence
cases. The 10-point audit becomes the automated groundedness gate. Every call
site and both contracts stay untouched.
