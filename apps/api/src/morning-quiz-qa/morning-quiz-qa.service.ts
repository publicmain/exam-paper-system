import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass, isAdminOrHead } from '../common/roles';

// Sonnet 4.6 list price (USD per 1M tokens). Matches AiQuestionGeneratorService.
const PRICE_INPUT_PER_M = 3;
const PRICE_OUTPUT_PER_M = 15;

const DEFAULT_MODEL = 'claude-sonnet-4-6';
// Bumped-up model used for reject-retry runs — same prompt, deeper review.
const STRICT_MODEL = 'claude-opus-4-6';

export type QaVerdict = 'pass' | 'needs_review' | 'reject' | 'pending';

export interface QaIssue {
  type:
    | 'answer_wrong'
    | 'answer_ambiguous'
    | 'unanswerable'
    | 'passage_contradicts'
    | 'question_ambiguous'
    | 'duplicate'
    | 'difficulty_mismatch'
    | 'typo'
    | 'format';
  severity: 'critical' | 'high' | 'medium' | 'low';
  questionRef: string;
  description: string;
  evidence: string;
  suggestedFix: string;
}

export interface QaReviewResult {
  verdict: QaVerdict;
  summary: string;
  issues: QaIssue[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

export interface ReviewablePaper {
  paperId: string;
  paperName: string;
  level: string; // 'ielts_authentic' | 'ielts_simplified' | 'olevel'
  mode: string; // 'passage_pick' | 'ai_quickpaper' | 'unknown'
  passageRef?: string | null;
  passageText: string | null;
  questions: Array<{
    sortOrder: number;
    type: string;
    marks: number;
    stem: string;
    options: Array<{ key: string; text: string }>;
    correctAnswer: string;
  }>;
}

/**
 * The system prompt is a single block that fully describes the auditor's
 * role, ranking criteria, and verdict thresholds. It is sent with
 * cache_control=ephemeral so subsequent calls within the 5-minute Anthropic
 * cache TTL pay only for the user message + tool response.
 */
const SYSTEM_PROMPT = `你是一位资深 IELTS / O-Level 英语考官,有 15 年雅思 Reading + 听力 + Writing 阅卷经验。
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

【Matching task 校准 — 不要把难度梯度误判为 ambiguity】
雅思 matching_features / matching_information / matching_headings 的设计意图就是
"学生需要在多个表述里区分细微差别"——若一句话**字面上**像两个选项都能套,但
**只要回到原文段落里能找到一个唯一支持的句子**,这就**不是** \`question_ambiguous\`,
也**不是** \`answer_ambiguous\`。判定 matching 题歧义的硬门槛:
- ✗ "字面像两个选项都通" → 不算歧义;
- ✗ "需要靠段落上下文才能区分" → 这就是 matching 的设计;
- ✗ "题干本身的描述与选项的字眼略有重叠" → 不算歧义;
- ✓ 必须是: **原文里完全没有任何一句话能比另一个选项更支持当前答案** → 才算
  \`answer_ambiguous\`。
对剑桥真题里的 matching 题(IELTS 7-15 各 Test 的 P3 等),除非你能引出原文一句
话明确推翻当前答案,**否则不要标 issue**;难度本身不是 issue。

verdict 决策规则(严格按此判定,不要主观放宽):
- 任意 1 个 critical → \`reject\` (不能给学生看)
- 0 critical 但有 ≥1 个 high 或 medium → \`needs_review\` (老师人工确认)
- 全部 low 或 0 issue → \`pass\` (可直接放给学生)

summary 字段:用 1-2 句中文给老师看,说明卷子最严重的问题或"未发现问题"。

【关键契约:summary 与 issues 的关系】
- summary 是高度概括的 1-2 句话(给老师扫一眼)。
- issues[] 是**详细列表**,每个 issue 包含 questionRef / evidence / suggestedFix。
- **禁止**把详细问题信息只写在 summary 里、issues[] 留空。
- 若 verdict 是 \`needs_review\` 或 \`reject\`,issues[] **必须**至少包含 1 项,
  且每一项的 description / evidence / suggestedFix 都要能独立读懂,不依赖 summary。
- 若 verdict 是 \`pass\`,issues[] 通常为空,但若你在 summary 里提到 "Q3 略 OK 但有
  小风险" 这种语义,就把它作为 \`severity: low\` 的 \`format\`/\`typo\` issue 列出来。
- 简而言之:**任何在 summary 里出现的具体题号 / 具体毛病,都必须在 issues[] 里
  有对应的条目**,否则就是违反契约。

所有 description / suggestedFix 用**中文**;evidence 字段保留**英文原文片段**,方便老师 Ctrl-F 定位。

最后:你**必须**通过 \`submit_review\` 工具返回结果,**不要**输出任何 markdown 或自由文本。`;

const REVIEW_TOOL: Anthropic.Tool = {
  name: 'submit_review',
  description: 'Submit the structured QA review for the paper. Always use this tool — never reply with free-form text.',
  input_schema: {
    type: 'object',
    required: ['overall_verdict', 'summary', 'issues'],
    properties: {
      overall_verdict: {
        type: 'string',
        enum: ['pass', 'needs_review', 'reject'],
        description: '基于发现 issue 的严重度按上文规则裁定的总体结论',
      },
      summary: {
        type: 'string',
        description: '1-2 句中文摘要,说明卷子最大问题或"未发现问题"',
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'severity', 'questionRef', 'description', 'evidence', 'suggestedFix'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'answer_wrong',
                'answer_ambiguous',
                'unanswerable',
                'passage_contradicts',
                'question_ambiguous',
                'duplicate',
                'difficulty_mismatch',
                'typo',
                'format',
              ],
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            questionRef: {
              type: 'string',
              description: "受影响的题号或 'passage' / 'all'",
            },
            description: { type: 'string', description: '中文,问题描述' },
            evidence: {
              type: 'string',
              description: '原文 / 题干 / 答案 key 的英文片段(≤30词)',
            },
            suggestedFix: { type: 'string', description: '中文,如何修正的建议' },
          },
        },
      },
    },
  },
};

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

@Injectable()
export class MorningQuizQaService {
  private readonly logger = new Logger('MorningQuizQaService');
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — QA review service will skip with verdict=pending.',
      );
      this.client = null;
    } else {
      // Round-7 H35: explicit retry budget. QA loop is most exposed to
      // 529 jitter because it fires every batch-generate; without a
      // retry budget a single overload nukes the entire batch.
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  /**
   * Audit a paper. Pulls the paper + questions out of the DB, builds the
   * review prompt, calls Claude with tool_use forced to `submit_review`, then
   * persists the verdict + issues onto the paper. Returns the same blob the
   * teacher dashboard renders.
   *
   * Used by:
   *   - the post-generation hook in MorningQuizService.pickPassageAndCreatePaper
   *   - the post-generation hook in QuickPaperService.generate
   *   - the manual `re-run review` button on the teacher dashboard
   *
   * If ANTHROPIC_API_KEY is missing the call short-circuits to
   * verdict=pending (so dev / preview environments don't crash) and the
   * teacher dashboard surfaces a "review skipped" banner.
   */
  async reviewPaper(
    paperId: string,
    actor: ActorCtx,
    options?: { strict?: boolean },
  ): Promise<QaReviewResult> {
    const reviewable = await this.loadReviewable(paperId);
    if (!this.client) {
      // Mark explicitly so the dashboard can warn, then bail.
      await this.prisma.paper.update({
        where: { id: paperId },
        data: {
          qaReviewVerdict: 'pending',
          qaReviewSummary: 'AI 审核已跳过(ANTHROPIC_API_KEY 未配置)',
          qaReviewIssues: [],
          qaReviewedAt: new Date(),
          qaReviewModel: 'skipped',
        },
      });
      return {
        verdict: 'pending',
        summary: 'AI 审核已跳过(ANTHROPIC_API_KEY 未配置)',
        issues: [],
        model: 'skipped',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        elapsedMs: 0,
      };
    }

    const userText = this.buildUserMessage(reviewable);
    const model = options?.strict ? STRICT_MODEL : DEFAULT_MODEL;

    const t0 = Date.now();
    let resp: Anthropic.Message;
    try {
      resp = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        tools: [REVIEW_TOOL],
        tool_choice: { type: 'tool', name: 'submit_review' },
        messages: [{ role: 'user', content: userText }],
      });
    } catch (e: any) {
      throw new ServiceUnavailableException(
        `Claude QA review call failed: ${String(e?.message ?? e).slice(0, 240)}`,
      );
    }
    const elapsedMs = Date.now() - t0;

    const toolBlock = resp.content.find((b) => b.type === 'tool_use') as
      | Anthropic.ToolUseBlock
      | undefined;
    if (!toolBlock || toolBlock.name !== 'submit_review') {
      throw new ServiceUnavailableException(
        'Claude did not return a submit_review tool call.',
      );
    }
    const parsed = this.parseToolInput(toolBlock.input);

    let inputTokens = resp.usage.input_tokens ?? 0;
    let outputTokens = resp.usage.output_tokens ?? 0;

    // ── B1 fallback: when Claude returned a non-pass verdict but issues=[]
    // (a known Sonnet quirk where it stuffs all detail into the summary
    // and skips the structured array), do a second small Sonnet call to
    // back-fill the issues[] from the summary so the teacher dashboard
    // gets per-issue evidence quotes. We add the second-call tokens to
    // the cost so the audit log stays accurate.
    if (
      (parsed.verdict === 'needs_review' || parsed.verdict === 'reject') &&
      parsed.issues.length === 0 &&
      parsed.summary.trim().length > 0
    ) {
      try {
        const fallback = await this.fillIssuesFromSummary(
          parsed.verdict,
          parsed.summary,
          reviewable,
        );
        if (fallback.issues.length > 0) {
          parsed.issues = fallback.issues;
          inputTokens += fallback.inputTokens;
          outputTokens += fallback.outputTokens;
          this.logger.warn(
            `qa-review fallback paper=${paperId} ` +
              `summary→issues recovered ${fallback.issues.length} item(s) ` +
              `(extra tokens=${fallback.inputTokens}+${fallback.outputTokens})`,
          );
        }
      } catch (e: any) {
        // Fallback itself failed — keep the empty issues[] and let the
        // teacher dashboard fall back to summary-only display.
        this.logger.warn(
          `qa-review fallback failed paper=${paperId}: ${String(e?.message ?? e).slice(0, 200)}`,
        );
      }
    }

    const costUsd =
      (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) /
      1_000_000;

    const result: QaReviewResult = {
      verdict: parsed.verdict,
      summary: parsed.summary,
      issues: parsed.issues,
      model,
      inputTokens,
      outputTokens,
      costUsd: Math.round(costUsd * 10000) / 10000,
      elapsedMs,
    };

    await this.prisma.paper.update({
      where: { id: paperId },
      data: {
        qaReviewVerdict: result.verdict,
        qaReviewSummary: result.summary,
        qaReviewIssues: result.issues as any,
        qaReviewedAt: new Date(),
        qaReviewModel: model,
        qaReviewTokens: inputTokens + outputTokens,
        qaReviewCostUsd: result.costUsd,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.qa_review',
      entityType: 'Paper',
      entityId: paperId,
      ip: actor.ip ?? null,
      metadata: {
        verdict: result.verdict,
        issueCount: result.issues.length,
        critical: result.issues.filter((i) => i.severity === 'critical').length,
        model,
        inputTokens,
        outputTokens,
        costUsd: result.costUsd,
        elapsedMs,
        strict: !!options?.strict,
      },
    });

    this.logger.log(
      `qa-review paper=${paperId} verdict=${result.verdict} ` +
        `issues=${result.issues.length} model=${model} ` +
        `tokens=${inputTokens}+${outputTokens} $${result.costUsd.toFixed(4)} ${elapsedMs}ms`,
    );
    return result;
  }

  /**
   * Pull a paper + its question snapshots and shape it into the structure
   * the prompt builder expects. Pulled from snapshotContent / snapshotAnswer
   * because the *paper-time* state is what students will see — the source
   * Question row may have been edited since.
   */
  async loadReviewable(paperId: string): Promise<ReviewablePaper> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        component: { select: { code: true } },
        subject: { select: { code: true } },
        assignments: {
          select: {
            class: { select: { englishLevel: { select: { level: true } } } },
          },
          take: 1,
        },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: { select: { questionType: true } } },
        },
      },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });

    const cfg = (paper.config as Record<string, any> | null) ?? {};
    const passageRef: string | null = cfg.passageRef ?? null;
    const mode: string = cfg.mode ?? (cfg.quickPaper ? 'ai_quickpaper' : 'unknown');
    const englishLevel = paper.assignments[0]?.class?.englishLevel?.level ?? 'unknown';

    // For passage_pick mode, the passage text is duplicated across every
    // question's snapshotContent.passage (every IELTS Reading question
    // carries the full passage so it can render standalone). Lift it from
    // the first question that has a non-empty passage field.
    let passageText: string | null = null;

    const questions = paper.questions.map((pq) => {
      const content = (pq.snapshotContent as Record<string, any> | null) ?? {};
      const answer = (pq.snapshotAnswer as Record<string, any> | null) ?? {};
      const opts = (pq.snapshotOptions as Array<{ key: string; text: string; correct?: boolean }> | null) ?? [];
      if (passageText === null && typeof content.passage === 'string' && content.passage.length > 50) {
        passageText = content.passage;
      }
      const correctAnswer = this.extractCorrectAnswer(opts, answer);
      const stem =
        typeof content.stem === 'string' && content.stem.trim().length > 0
          ? content.stem
          : typeof content === 'string'
            ? String(content)
            : JSON.stringify(content).slice(0, 600);
      return {
        sortOrder: pq.sortOrder,
        type: pq.question.questionType,
        marks: pq.marks,
        stem,
        options: opts.map((o) => ({ key: o.key, text: o.text })),
        correctAnswer,
      };
    });

    return {
      paperId: paper.id,
      paperName: paper.name,
      level: englishLevel,
      mode,
      passageRef,
      passageText,
      questions,
    };
  }

  private extractCorrectAnswer(
    opts: Array<{ key: string; text: string; correct?: boolean }>,
    answer: Record<string, any> | null,
  ): string {
    if (Array.isArray(opts) && opts.some((o) => o.correct === true)) {
      const correctKey = opts.find((o) => o.correct === true);
      if (correctKey) return correctKey.key;
    }
    if (answer?.text && typeof answer.text === 'string') return answer.text;
    if (answer?.answer && typeof answer.answer === 'string') return answer.answer;
    if (typeof answer === 'string') return answer;
    return JSON.stringify(answer ?? {}).slice(0, 200);
  }

  buildUserMessage(p: ReviewablePaper): string {
    const passageBlock = p.passageText
      ? `== Passage ==\n${p.passageText}\n`
      : `== Passage ==\n(无独立 passage — 这是 AI 单题生成模式,每题自带迷你段落。请审核每题的内部一致性。)\n`;

    const questionLines = p.questions.map((q) => {
      const optBlock = q.options.length
        ? '\n' +
          q.options
            .map((o) => `   ${o.key}) ${o.text}`)
            .join('\n')
        : '';
      return `Q${q.sortOrder}. (${q.type}, ${q.marks}m) ${q.stem}${optBlock}\n   Correct: ${q.correctAnswer}`;
    });

    const meta = [
      `Class level: ${p.level}`,
      `Generation mode: ${p.mode}`,
      p.passageRef ? `Source passage ref: ${p.passageRef}` : null,
      `Question count: ${p.questions.length}`,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      passageBlock,
      `== Questions + Answer Key ==`,
      questionLines.join('\n\n'),
      `== Metadata ==`,
      meta,
      ``,
      `请用 submit_review 工具返回结构化结果。`,
    ].join('\n\n');
  }

  /** Validate + sanitize the tool input Claude returned. */
  parseToolInput(raw: any): {
    verdict: QaVerdict;
    summary: string;
    issues: QaIssue[];
  } {
    const verdictIn = String(raw?.overall_verdict ?? '').toLowerCase();
    const verdict: QaVerdict =
      verdictIn === 'pass' || verdictIn === 'needs_review' || verdictIn === 'reject'
        ? (verdictIn as QaVerdict)
        : 'needs_review';
    const summary = String(raw?.summary ?? '').slice(0, 600);
    const rawIssues = Array.isArray(raw?.issues) ? raw.issues : [];
    const issues: QaIssue[] = rawIssues
      .filter((it: any) => it && typeof it === 'object')
      .map((it: any) => ({
        type: this.normaliseIssueType(it.type),
        severity: this.normaliseSeverity(it.severity),
        questionRef: String(it.questionRef ?? '').slice(0, 60),
        description: String(it.description ?? '').slice(0, 800),
        evidence: String(it.evidence ?? '').slice(0, 600),
        suggestedFix: String(it.suggestedFix ?? '').slice(0, 600),
      }));

    // Defensive verdict reconciliation — Claude *should* obey the rules in
    // the prompt, but if it returns verdict=pass while listing a critical
    // issue, we override (we'd rather over-flag than ship a broken paper).
    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasHighOrMedium = issues.some(
      (i) => i.severity === 'high' || i.severity === 'medium',
    );
    let reconciled = verdict;
    if (hasCritical) reconciled = 'reject';
    else if (verdict === 'pass' && hasHighOrMedium) reconciled = 'needs_review';

    return { verdict: reconciled, summary, issues };
  }

  private normaliseIssueType(t: any): QaIssue['type'] {
    const allowed: QaIssue['type'][] = [
      'answer_wrong',
      'answer_ambiguous',
      'unanswerable',
      'passage_contradicts',
      'question_ambiguous',
      'duplicate',
      'difficulty_mismatch',
      'typo',
      'format',
    ];
    const v = String(t ?? '').toLowerCase();
    return (allowed as string[]).includes(v) ? (v as QaIssue['type']) : 'format';
  }

  private normaliseSeverity(s: any): QaIssue['severity'] {
    const v = String(s ?? '').toLowerCase();
    if (v === 'critical' || v === 'high' || v === 'medium' || v === 'low') {
      return v as QaIssue['severity'];
    }
    return 'medium';
  }

  /**
   * B1 fallback path. Re-call Sonnet with a tightly-scoped prompt that asks
   * it to convert the previously-emitted summary into a structured issues[]
   * array. Used only when the first review returned issues=[] but verdict
   * is needs_review or reject.
   *
   * Why it's safe to call again:
   *   - Same tool-use schema, so the response shape is identical.
   *   - Verdict is fixed in the call (the model only fills `issues`); we
   *     don't let Sonnet flip the verdict here.
   *   - Cheaper-than-original because the user message is short (just the
   *     summary + question list, not the full passage).
   */
  private async fillIssuesFromSummary(
    verdict: 'needs_review' | 'reject',
    summary: string,
    reviewable: ReviewablePaper,
  ): Promise<{ issues: QaIssue[]; inputTokens: number; outputTokens: number }> {
    if (!this.client) return { issues: [], inputTokens: 0, outputTokens: 0 };
    const tool: Anthropic.Tool = {
      name: 'submit_issues',
      description: 'Return ONLY the issues[] array — verdict and summary are fixed.',
      input_schema: {
        type: 'object',
        required: ['issues'],
        properties: {
          issues: {
            type: 'array',
            items: (REVIEW_TOOL.input_schema.properties as any).issues.items,
          },
        },
      },
    };
    const questionLines = reviewable.questions
      .map(
        (q) =>
          `Q${q.sortOrder}. ${q.stem.slice(0, 200)}` +
          (q.options.length ? ` [opts: ${q.options.map((o) => o.key).join('/')}]` : '') +
          ` (correct=${q.correctAnswer})`,
      )
      .join('\n');
    const userText =
      `先前的审核已经给出了 verdict=${verdict} 但漏了把 issues 填到结构化数组里。` +
      `请根据下面这条 summary 和题目列表,**只**回填 issues[] 数组(不要改 verdict / summary)。` +
      `每个 issue 必须包含 type / severity / questionRef / description / evidence / suggestedFix 六个字段。\n\n` +
      `Summary: ${summary}\n\n` +
      `Questions:\n${questionLines}\n\n` +
      `请用 submit_issues 工具返回结果。`;
    const resp = await this.client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1500,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'submit_issues' },
      messages: [{ role: 'user', content: userText }],
    });
    const block = resp.content.find((b) => b.type === 'tool_use') as
      | Anthropic.ToolUseBlock
      | undefined;
    if (!block || block.name !== 'submit_issues') {
      return {
        issues: [],
        inputTokens: resp.usage.input_tokens ?? 0,
        outputTokens: resp.usage.output_tokens ?? 0,
      };
    }
    const raw = (block.input as any)?.issues;
    const arr = Array.isArray(raw) ? raw : [];
    const issues: QaIssue[] = arr
      .filter((it: any) => it && typeof it === 'object')
      .map((it: any) => ({
        type: this.normaliseIssueType(it.type),
        severity: this.normaliseSeverity(it.severity),
        questionRef: String(it.questionRef ?? '').slice(0, 60),
        description: String(it.description ?? '').slice(0, 800),
        evidence: String(it.evidence ?? '').slice(0, 600),
        suggestedFix: String(it.suggestedFix ?? '').slice(0, 600),
      }));
    return {
      issues,
      inputTokens: resp.usage.input_tokens ?? 0,
      outputTokens: resp.usage.output_tokens ?? 0,
    };
  }

  // ─────────────────── Teacher dashboard helpers ───────────────────

  /**
   * List every paper whose verdict is `needs_review` or `reject` and that
   * a teacher hasn't yet acted on. Used by the schedule UI's "待复核" panel.
   */
  /**
   * IDOR check: a regular teacher may only act on a paper they own (paper.ownerId)
   * OR a paper assigned to a class they're enrolled in (non-student role).
   * admin / head_teacher always pass.
   */
  private async assertCanActOnPaper(paperId: string, actor: ActorCtx) {
    if (isAdminOrHead(actor.role)) return;
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: {
        ownerId: true,
        assignments: { select: { classId: true } },
      },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });
    if (paper.ownerId === actor.id) return;
    for (const a of paper.assignments) {
      if (await canActOnClass(this.prisma, actor, a.classId)) return;
    }
    throw new ForbiddenException({ code: 'not_your_paper' });
  }

  async listPending(actor?: ActorCtx) {
    // Round-7 C-F4 — also surface verdict=pending. The QA loop catches
    // its own errors and leaves verdict at the schema default ('pending')
    // so the paper isn't a black hole; that paper still needs a teacher to
    // either re-run review or push it through manually. Without this row in
    // the filter the teacher dashboard never showed those papers.
    const where: any = {
      qaReviewVerdict: { in: ['needs_review', 'reject', 'pending'] },
      qaTeacherAction: null,
      // Skip archived papers — those have either been teacher-rejected
      // already or thrown away by the retry loop. They are not the
      // teacher's problem any more.
      status: { not: 'archived' },
    };
    // IDOR gate: regular teachers see only papers they own or that are
    // assigned to a class they're enrolled in. admin / head_teacher see all.
    if (actor && !isAdminOrHead(actor.role)) {
      where.OR = [
        { ownerId: actor.id },
        {
          assignments: {
            some: {
              class: {
                enrollments: { some: { userId: actor.id, role: { not: 'student' } } },
              },
            },
          },
        },
      ];
    }
    return this.prisma.paper.findMany({
      where,
      orderBy: { qaReviewedAt: 'desc' },
      select: {
        id: true,
        name: true,
        qaReviewVerdict: true,
        qaReviewSummary: true,
        qaReviewIssues: true,
        qaReviewedAt: true,
        qaReviewModel: true,
        qaReviewRetries: true,
        qaReviewCostUsd: true,
        config: true,
      },
      take: 100,
    });
  }

  /** Fetch full review for the dashboard drilldown (passage + question rows). */
  async getReview(paperId: string, actor?: ActorCtx) {
    if (actor) await this.assertCanActOnPaper(paperId, actor);
    const reviewable = await this.loadReviewable(paperId);
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: {
        id: true,
        name: true,
        qaReviewVerdict: true,
        qaReviewSummary: true,
        qaReviewIssues: true,
        qaReviewedAt: true,
        qaReviewModel: true,
        qaReviewTokens: true,
        qaReviewCostUsd: true,
        qaReviewRetries: true,
        qaTeacherAction: true,
        qaTeacherActionAt: true,
      },
    });
    return { paper, reviewable };
  }

  async approve(paperId: string, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    await this.assertCanActOnPaper(paperId, actor);
    // Round-7 H13: wrap the paper.update + audit.log in a single tx so
    // we never end up with an approved paper without an audit row.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paper.update({
        where: { id: paperId },
        data: {
          qaTeacherAction: 'approved',
          qaTeacherActionAt: new Date(),
          qaTeacherActionBy: actor.id,
        },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'morning_quiz.qa_review.approve',
          entityType: 'Paper',
          entityId: paperId,
          ip: actor.ip ?? null,
        },
        tx,
      );
      return updated;
    });
  }

  async rejectByTeacher(paperId: string, actor: ActorCtx, reason?: string) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    await this.assertCanActOnPaper(paperId, actor);
    // Round-7 H13: tx-wrapped paper.update + audit.log.
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paper.update({
        where: { id: paperId },
        data: {
          qaTeacherAction: 'rejected',
          qaTeacherActionAt: new Date(),
          qaTeacherActionBy: actor.id,
          status: 'archived',
        },
      });
      await this.audit.log(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'morning_quiz.qa_review.reject',
          entityType: 'Paper',
          entityId: paperId,
          ip: actor.ip ?? null,
          metadata: { reason: reason ?? null },
        },
        tx,
      );
      return updated;
    });
  }
}
