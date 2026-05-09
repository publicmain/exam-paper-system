# Morning Quiz · AI QA Review

Every IELTS / O-Level paper that the morning-quiz batch generator produces — both the **passage_pick** path (pulls a real Cambridge passage from the bank) and the **AI quickpaper** path (Claude authors fresh questions) — must clear an AI QA review before students see it. The review is run by `MorningQuizQaService` against Anthropic's Claude Sonnet 4.6 with `tool_use` forced to a `submit_review` tool.

This document is the source of truth for the prompt, the schema, the verdict semantics, the retry rules, and the teacher workflow.

---

## 1. Why a QA layer at all?

We caught two distinct classes of bug in production over the past months:

1. **Passage-pick mode** — historical Cambridge ingestion sometimes preserves a question whose answer is annotated wrongly (typos in the answer key cell, OCR drift on `Test1/P3/Q9`). The student sees a defective question and our auto-grader marks them wrong.
2. **AI quickpaper mode** — Claude occasionally writes a question whose answer is undefined (the mini-passage doesn't actually contain the fact the question asks for) or whose phrasing allows two equally valid answers.

Both are silent failures: tests pass, types compile, the paper renders. Only a human re-reading the whole paper would catch them. We can't put a human in the loop every Sunday night, so we put Claude in the loop — and only escalate to the teacher when Claude flags something.

---

## 2. State machine

```
                                        ┌─────────────────┐
 batchGenerateForWeek loop iteration ──▶│ generator (1)   │
                                        └─────────────────┘
                                                 │ paperId
                                                 ▼
                                        ┌─────────────────┐
                                        │ qaReview.review │   ← Claude tool_use
                                        │ Paper           │     submit_review
                                        └─────────────────┘
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼                              ▼                              ▼
          verdict = pass            verdict = needs_review            verdict = reject
                  │                              │                              │
       paper goes live            paper goes live + amber badge      archive paper
       (qa fields = pass)         in teacher dashboard               regenerate (attempt+1)
                                  needs teacher click to             upgrade model to Opus
                                  approve OR regenerate              after attempt 1
                                                                     │
                                                              cap = 2 retries (3 total)
                                                              → final paper handed to
                                                              teacher with retry_exhausted
                                                              audit log line
```

The state machine lives in `MorningQuizService.generateWithQaLoop` (`apps/api/src/morning-quiz/morning-quiz.service.ts`). The review itself lives in `MorningQuizQaService.reviewPaper` (`apps/api/src/morning-quiz-qa/morning-quiz-qa.service.ts`).

---

## 3. Verdict semantics

| verdict        | what it means                                                                | who acts on it                                          |
|----------------|------------------------------------------------------------------------------|---------------------------------------------------------|
| `pass`         | 0 issues OR only `low`-severity issues (typos that don't block comprehension)| nobody — paper is live                                  |
| `needs_review` | ≥1 `high`/`medium` but no `critical`                                         | teacher must click 批准 or 驳回 in the dashboard        |
| `reject`       | ≥1 `critical` issue (wrong answer, ambiguous answer, unanswerable question)  | system auto-archives + regenerates (max 2 retries)      |
| `pending`      | review hasn't run yet, or `ANTHROPIC_API_KEY` is unset                       | dashboard surfaces a banner; no student delivery        |

**Defensive override**: even if Claude returns `verdict=pass` while the issue list contains a `critical`-severity item, the service forces the verdict to `reject`. We'd rather over-flag than ship a broken paper. See `parseToolInput` — there's a unit test for this exact case (`reconciles inconsistent verdicts: pass with critical issue → reject`).

---

## 4. Issue taxonomy

| type                  | severity (default) | trigger                                                            |
|-----------------------|--------------------|--------------------------------------------------------------------|
| `answer_wrong`        | critical           | answer key has no support in the passage / answer is plain wrong   |
| `answer_ambiguous`    | critical           | multiple defensible answers, but only one in the key               |
| `unanswerable`        | critical           | question asks something the passage doesn't address                |
| `passage_contradicts` | high               | passage contradicts itself or known facts                          |
| `question_ambiguous`  | high               | wording allows multiple readings                                   |
| `duplicate`           | medium             | two questions test the same point                                  |
| `difficulty_mismatch` | medium             | difficulty far outside the level's expected band                   |
| `typo`                | low                | spelling/grammar slip that doesn't impede understanding            |
| `format`              | low                | option labels misaligned, blank line drift, etc.                   |

Severity is a *suggestion* from Claude. The service trusts whatever severity it returns (after enum-sanitising), then runs the verdict reconciliation rule above on top. The teacher can always disagree and approve/reject manually.

---

## 5. The system prompt (verbatim)

```
你是一位资深 IELTS / O-Level 英语考官,有 15 年雅思 Reading + 听力 + Writing 阅卷经验。
你的任务是审核一份刚生成的英语试卷,挑出文章、题目、答案中的所有问题。

审核维度(按严重度由高到低):

1. **答案错误 (critical)** : 标记的"正确答案"在文章里找不到唯一支持,或者根本就是错的
2. **答案歧义 (critical)** : 题干允许多个合理答案,但答案 key 只标了一个
3. **题目无解 (critical)** : 题目问的内容文章根本没提到
4. **事实矛盾 (high)** : 文章内部前后矛盾、与常识严重冲突
5. **题目歧义 (high)** : 题目本身措辞不清,学生可能理解多种意思
6. **重复题 (medium)** : 两道题考点完全相同
7. **难度异常 (medium)** : 题目难度明显高于/低于该 level 应有水平
8. **语法/拼写错误 (low)** : 文章或题目有 typo / 语法错误(不影响理解的不报)
9. **格式问题 (low)** : 选项编号错乱、空行错位等

工作步骤:
- 先通读整段 passage,记下关键论点、时间线、数字、否定词的位置;
- 然后逐题独立判断,不要被"前面对了所以这题也可能对"的偏见影响;
- 判断每一题时,**必须**回到原文找证据,evidence 字段引用原文片段(限 30 词以内);
- "看起来 OK"不是结论,必须给出推理;
- 找不到问题就明说"通过",不要凑数。

verdict 决策规则(严格按此判定,不要主观放宽):
- 任意 1 个 critical → `reject` (不能给学生看)
- 0 critical 但有 ≥1 个 high 或 medium → `needs_review` (老师人工确认)
- 全部 low 或 0 issue → `pass` (可直接放给学生)

summary 字段:用 1-2 句中文给老师看,说明卷子最严重的问题或"未发现问题"。
所有 description / suggestedFix 用**中文**;evidence 字段保留**英文原文片段**,方便老师 Ctrl-F 定位。

最后:你**必须**通过 `submit_review` 工具返回结果,**不要**输出任何 markdown 或自由文本。
```

The system block is sent with `cache_control: { type: 'ephemeral' }` so the next call within the 5-minute Anthropic cache TTL only pays for the user message.

---

## 6. Tool schema (verbatim)

```jsonc
{
  "name": "submit_review",
  "description": "Submit the structured QA review for the paper. Always use this tool — never reply with free-form text.",
  "input_schema": {
    "type": "object",
    "required": ["overall_verdict", "summary", "issues"],
    "properties": {
      "overall_verdict": {
        "type": "string",
        "enum": ["pass", "needs_review", "reject"]
      },
      "summary":  { "type": "string" },
      "issues": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["type", "severity", "questionRef",
                       "description", "evidence", "suggestedFix"],
          "properties": {
            "type": {
              "type": "string",
              "enum": ["answer_wrong","answer_ambiguous","unanswerable",
                       "passage_contradicts","question_ambiguous","duplicate",
                       "difficulty_mismatch","typo","format"]
            },
            "severity": {
              "type": "string",
              "enum": ["critical","high","medium","low"]
            },
            "questionRef":  { "type": "string" },
            "description": { "type": "string" },
            "evidence":    { "type": "string" },
            "suggestedFix":{ "type": "string" }
          }
        }
      }
    }
  }
}
```

`tool_choice: { type: 'tool', name: 'submit_review' }` forces the response into the tool — no free-form text path is allowed.

---

## 7. Model selection + cost

| pass | model            | reason                                                   |
|------|------------------|----------------------------------------------------------|
| 1st  | Claude Sonnet 4.6| good price/perf, 200K-token context (one IELTS passage + 13 Qs is < 5K) |
| retry| Claude Opus 4.6  | stricter — different model means a second pair of eyes  |

Sonnet 4.6 list price (USD per 1M tokens): **input $3 / output $15**. A typical passage_pick paper (one ~800-word passage, 13 questions, ~20-30 issues if everything's broken) costs **$0.05 – $0.20 per review**. The full ledger lives in `AuditLog` rows with `action='morning_quiz.qa_review'`.

A 5-day × 6-class run = 30 reviews ≈ **$1.50 – $6 per Sunday**. If a teacher hits 🔬 严格审核 manually that's another ~$0.30 each.

---

## 8. Teacher workflow

1. **Sunday night**, head_teacher runs `生成下周 5 套早测` from `/morning-quiz/schedule`.
2. The batch generator runs the QA loop on every paper. UI returns immediately — review happens inline so a long-running review blocks that single paper but not the rest.
3. Teacher visits `/morning-quiz/qa-review` (top-right link from schedule page).
4. Each row has a colored badge:
   - 🟢 `pass` — won't appear in the queue (it's already cleared)
   - 🟡 `needs_review` — teacher decides
   - 🔴 `reject` — system already retried and gave up; teacher must manually fix or kill
5. Click a row to see: the AI summary, the per-issue breakdown (color-coded by severity), the original passage, and every question with its answer key highlighted.
6. Three buttons:
   - **✓ 批准放行** — paper goes live, `qaTeacherAction='approved'`
   - **✕ 驳回** — paper is archived (status=archived), won't be assigned to a student
   - **🔄 重新审核 / 🔬 严格审核** — re-runs Claude (Sonnet/Opus) without regenerating the paper

---

## 9. Database schema additions

`Paper` model gains:

```
qaReviewVerdict      String?  @default("pending")  // pass | needs_review | reject | pending
qaReviewSummary      String?
qaReviewIssues       Json?
qaReviewedAt         DateTime?
qaReviewModel        String?
qaReviewTokens       Int?
qaReviewCostUsd      Float?
qaReviewRetries      Int      @default(0)
qaTeacherAction      String?              // approved | rejected | edited
qaTeacherActionAt    DateTime?
qaTeacherActionBy    String?
```

No new tables — review history is reconstructed by joining `Paper.qaReview*` with `AuditLog` rows whose `action='morning_quiz.qa_review'`.

---

## 10. Debugging

- **A specific paper got the wrong verdict?** Re-run review from the dashboard with 🔬 严格审核 (Opus). If Opus and Sonnet disagree, eyeball the passage manually — Claude is occasionally wrong.
- **Cost dashboard?** Sum `metadata.costUsd` across `auditLog WHERE action='morning_quiz.qa_review' AND createdAt > now()-interval '30d'`.
- **Token usage too high?** The system prompt is ~1.5K tokens cached, the user message is the whole passage (~5-7K), and the tool response is ~200-2K. Per-review cost scales with issue count, not passage length.
- **Want to suppress review for one paper (e.g. a manual hand-edited paper)?** There's no flag yet — manually mark `qaTeacherAction='approved'` in DB. If this becomes common, add a `skipQaReview` config flag on the paper-create call.
- **Local dev with no API key?** `ANTHROPIC_API_KEY` unset → service short-circuits to verdict=`pending` and the dashboard surfaces a banner. The whole stack still works, just without QA gating.

---

## 11. What the QA review does NOT do

- **Doesn't regrade student submissions** — that's `marker.service`. QA review is pre-delivery only.
- **Doesn't edit the paper** — only flags issues. Teacher can hand-edit a question on the existing paper-edit page if they want to keep the paper instead of regenerating.
- **Doesn't run on hand-curated papers** — only on papers produced by `pickPassageAndCreatePaper` or `QuickPaperService.generate` via the morning-quiz batch flow.
- **Doesn't review listening/writing content yet** — the prompt is written for reading-comprehension style passages. Adding listening would mean changing `loadReviewable` to surface transcript metadata.
