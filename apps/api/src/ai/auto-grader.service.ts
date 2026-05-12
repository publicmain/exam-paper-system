import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AuditService } from '../audit/audit.service';

/**
 * F11 — AI cost tracking wrapper around Claude calls used by the
 * short-answer auto-grader path.
 *
 * Why a separate service from short-answer-evaluator.service:
 *   - That file lives in morning-quiz/ which Wave-2 API-MQ owns; the
 *     cost-tracking emission has to happen on every call regardless of
 *     which evaluator path is taken in the future (essay grading,
 *     diagram comparison, etc.) so it sits one level up.
 *   - AuditLog rows here are per Claude call (not per submission), so a
 *     single short_answer item that runs the AI grader is one audit row
 *     and a single submission grading 10 items emits 10 rows.
 *
 * Cost model: Claude 3.5 Sonnet (the current default) is $3/MTok input
 * and $15/MTok output. Both are env-configurable so a future model
 * swap (Opus 4.x, Haiku, etc.) doesn't require redeploys to keep the
 * cost numbers honest. Inputs are dollars-per-million-tokens.
 *
 * Existing call signature: gradeShortAnswer(input) → suggestion|null.
 * The existing `autoGradeScripts` function in student.service.ts takes
 * an `AiShortAnswerGrader` interface — this service satisfies that
 * interface, so callers that want cost-tracked grading can inject this
 * service instead of the bare evaluator. Callers that don't change
 * stay on the bare evaluator path; nothing breaks.
 */

const DEFAULT_INPUT_USD_PER_MTOK = 3;
const DEFAULT_OUTPUT_USD_PER_MTOK = 15;

export interface AutoGradeShortAnswerInput {
  stem: string;
  studentAnswer: string;
  markScheme: string;
  maxMarks: number;
  passage?: string;
  /** Identity surfaces in the audit metadata. Optional so callers in
   *  test contexts can omit. */
  submissionId?: string;
  paperQuestionId?: string;
}

export interface AutoGradeShortAnswerSuggestion {
  awardedMarks: number;
  reasoning: string;
  confident: boolean;
}

@Injectable()
export class AutoGraderService {
  private readonly logger = new Logger('AutoGraderService');
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly inputUsdPerMTok: number;
  private readonly outputUsdPerMTok: number;

  constructor(private readonly audit: AuditService) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.inputUsdPerMTok = Number.isFinite(Number(process.env.AI_COST_INPUT_USD_PER_MTOK))
      ? Number(process.env.AI_COST_INPUT_USD_PER_MTOK)
      : DEFAULT_INPUT_USD_PER_MTOK;
    this.outputUsdPerMTok = Number.isFinite(Number(process.env.AI_COST_OUTPUT_USD_PER_MTOK))
      ? Number(process.env.AI_COST_OUTPUT_USD_PER_MTOK)
      : DEFAULT_OUTPUT_USD_PER_MTOK;
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — AutoGraderService.evaluate() returns null.',
      );
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  /** Compute USD cost from token counts. Public so callers can reuse
   *  the same cost model for budget UI without duplicating constants. */
  computeCostUsd(inputTokens: number, outputTokens: number): number {
    const inCost = (inputTokens / 1_000_000) * this.inputUsdPerMTok;
    const outCost = (outputTokens / 1_000_000) * this.outputUsdPerMTok;
    // Round to 6 dp — sub-cent precision is enough for per-call rows and
    // keeps the audit JSON readable.
    return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
  }

  /**
   * Conforms to the `AiShortAnswerGrader` interface in
   * student.service.ts (the same `evaluate` shape that
   * `autoGradeScripts` already expects), so this service can be passed
   * in wherever the bare ShortAnswerEvaluatorService is used today —
   * call sites stay identical.
   */
  async evaluate(input: AutoGradeShortAnswerInput): Promise<AutoGradeShortAnswerSuggestion | null> {
    if (!this.client) return null;
    if (!input.studentAnswer || !input.studentAnswer.trim()) {
      return {
        awardedMarks: 0,
        reasoning: '空白未作答 / Student left blank',
        confident: true,
      };
    }
    if (!input.markScheme || !input.markScheme.trim()) return null;

    const system = `You are an English-as-a-second-language exam marker. Score the student's answer against the mark scheme.\n\nOutput ONLY a JSON object: {\"awardedMarks\": <int 0..maxMarks>, \"reasoning\": \"...\", \"confident\": <bool>}.\n\nRules:\n- Award the mark for clear paraphrases of the canonical answer.\n- Partial answers earn proportional partial marks.\n- Off-topic → 0.\n- Set confident=false only when ambiguous.`;

    const passageBlock = input.passage?.trim()
      ? `Reading passage:\n${input.passage.slice(0, 6000)}\n\n`
      : '';
    const user = `${passageBlock}Question:\n${input.stem}\n\nMark scheme (max ${input.maxMarks}):\n${input.markScheme}\n\nStudent answer:\n${input.studentAnswer}\n\nRespond with JSON.`;

    const t0 = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = false;
    let errorCode: string | undefined;
    let result: AutoGradeShortAnswerSuggestion | null = null;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });
      inputTokens = (resp as any).usage?.input_tokens ?? 0;
      outputTokens = (resp as any).usage?.output_tokens ?? 0;
      const text = resp.content
        .map((c: any) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        errorCode = 'no_json';
      } else {
        const parsed = JSON.parse(match[0]);
        const raw = Number(parsed.awardedMarks);
        if (Number.isFinite(raw)) {
          const clamped = Math.max(0, Math.min(input.maxMarks, Math.round(raw * 2) / 2));
          result = {
            awardedMarks: clamped,
            reasoning: String(parsed.reasoning ?? '').slice(0, 500),
            confident: parsed.confident !== false,
          };
          success = true;
        } else {
          errorCode = 'unparseable_marks';
        }
      }
    } catch (err: any) {
      errorCode = err?.status ? `http_${err.status}` : err?.name ?? 'unknown';
      this.logger.error(`short-answer eval failed: ${err.message ?? err}`);
    }

    const durationMs = Date.now() - t0;
    const costUsd = this.computeCostUsd(inputTokens, outputTokens);

    // F11 — fire-and-forget audit emission. Per spec, log every call
    // (success or failure) so the admin cost dashboard sees every spend.
    // Try/catch around the await so an audit-table outage never breaks a
    // grading call.
    try {
      await this.audit.log({
        actorId: 'system',
        actorRole: 'system',
        action: 'ai.grade.short_answer',
        entityType: 'AnswerScript',
        entityId: input.submissionId ?? 'unknown',
        metadata: {
          submissionId: input.submissionId ?? null,
          paperQuestionId: input.paperQuestionId ?? null,
          model: this.model,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs,
          success,
          ...(errorCode ? { errorCode } : {}),
        },
      });
    } catch (e: any) {
      this.logger.warn(`audit emission failed for ai.grade.short_answer: ${e?.message ?? e}`);
    }

    return result;
  }
}
