import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI-assisted scoring for `short_answer` items.
 *
 * Background — a morning-quiz paper has up to ~12 short_answer items, and
 * a class of ~30 students sits one every day. Grading each (student,
 * question) pair with its own Claude call meant ~200 API calls fired into
 * a 5-minute window at 09:00 — enough to trip the Anthropic per-minute
 * rate limit, and each call re-shipped the whole reading passage.
 *
 * R15-followup-20 — three cost/throughput levers, all in `evaluateBatch`:
 *
 *   1. BATCH — one call grades ALL of a student's short answers for a
 *      paper. The passage and rubric ship once instead of once per item.
 *
 *   2. MODEL — grading ("does this answer match the mark scheme, 0..N
 *      marks") is a constrained, temperature-0 comparison task, so it
 *      runs on Haiku by default (≈3× cheaper than Sonnet). Override via
 *      ANTHROPIC_GRADER_MODEL — kept separate from ANTHROPIC_MODEL so
 *      paper generation / QA stay on the stronger model.
 *
 *   3. PROMPT CACHE — the rubric + passage are identical for every
 *      student on the same paper, so they form a cache-control prefix.
 *      The first student in the 09:00 sweep writes the cache; the rest
 *      (within the 5-min TTL) read it at ~10% input price.
 *
 * Failures (no API key, JSON parse fail, network/429) return null so the
 * caller falls back to "leave for manual review" without blowing up.
 */

/** Canonical per-item grading verdict. */
export interface ShortAnswerSuggestion {
  awardedMarks: number;
  reasoning: string;
  /** false when Claude itself flags the answer as ambiguous and asks for
   *  human review; the teacher dashboard surfaces this to bias attention
   *  toward these items. */
  confident: boolean;
}

/** One short-answer item inside a batch. `id` is the caller's correlation
 *  key (the AnswerScript id) — echoed back so the caller can map verdicts
 *  to scripts without relying on array order. */
export interface BatchGradeItem {
  id: string;
  stem: string;
  studentAnswer: string;
  markScheme: string;
  maxMarks: number;
}

export interface BatchGradeInput {
  /** The reading passage shared by every item. Shipped once; cached. */
  passage?: string;
  items: BatchGradeItem[];
}

/**
 * Cap injected into the AI prompt. Cambridge IELTS GT Section 1 passages
 * land around 2.5–3.5k chars, the longest 0510 comprehension passages
 * around 4k. 6000 covers the headroom without blowing input tokens.
 */
const PASSAGE_PROMPT_CHAR_CAP = 6000;

@Injectable()
export class ShortAnswerEvaluatorService {
  private readonly logger = new Logger('ShortAnswerEvaluatorService');
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    // Dedicated grader model — defaults to Haiku (cheap, plenty for a
    // temperature-0 mark-scheme comparison). Deliberately NOT
    // ANTHROPIC_MODEL: that one drives paper generation / QA, which want
    // the stronger Sonnet/Opus. Set ANTHROPIC_GRADER_MODEL on Railway to
    // override (e.g. bump to Sonnet if grading accuracy ever regresses).
    this.model = process.env.ANTHROPIC_GRADER_MODEL || 'claude-haiku-4-5';
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — short-answer suggestions will return null.',
      );
      this.client = null;
    } else {
      // Round-7 H35: explicit retry budget. maxRetries also smooths a
      // transient 429 — with batching the call volume is low enough that
      // the SDK's exponential backoff absorbs the rare collision.
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  /**
   * Grade a batch of short-answer items in ONE Claude call.
   *
   * Returns a Map keyed by item id. On total failure (no client, network
   * error, unparseable response) returns null — the caller treats every
   * item as "no verdict → manual review". An individual item missing
   * from the returned Map means the model skipped it; the caller also
   * routes that to manual review.
   */
  async evaluateBatch(
    input: BatchGradeInput,
  ): Promise<Map<string, ShortAnswerSuggestion> | null> {
    const out = new Map<string, ShortAnswerSuggestion>();
    // Blank answers are an unambiguous 0 — score them locally, never
    // spend an API call (or a slot in the prompt) on them.
    const needApi: BatchGradeItem[] = [];
    for (const it of input.items) {
      if (!it.studentAnswer || !it.studentAnswer.trim()) {
        out.set(it.id, {
          awardedMarks: 0,
          reasoning: '空白未作答 / Student left blank',
          confident: true,
        });
        continue;
      }
      if (!it.markScheme || !it.markScheme.trim()) {
        // No reference key — can't grade. Leave out of the Map so the
        // caller routes it to manual review.
        continue;
      }
      needApi.push(it);
    }
    if (needApi.length === 0) return out;

    if (!this.client) {
      // R15-followup-5 — a silent null on every grading call was a
      // production-invisible failure mode. Warn loudly so ops notices a
      // rotated / quota-exhausted key.
      this.logger.warn(
        '[ai_grade_skipped] no Anthropic client — batch not auto-graded; check ANTHROPIC_API_KEY',
      );
      return null;
    }

    const system = `You are an English-as-a-second-language exam marker for a Singapore secondary school. You score short-answer items against a teacher-provided mark scheme.

You will receive a JSON array of items, each with: id, stem, markScheme, maxMarks, studentAnswer.

Output ONLY a JSON array — no prose around it — with one object per input item:
[{ "id": "<echo the item id>", "awardedMarks": <integer 0..maxMarks>, "reasoning": "<1-2 short sentences referencing the mark scheme>", "confident": <true|false> }]

Rules:
- Be CONSISTENT with the mark scheme. If the scheme awards 1 mark for "X" and the student wrote a paraphrase that's clearly equivalent, give the mark.
- Spelling errors that don't change meaning: do not deduct on a 1-mark item; deduct 0.5 on a 2+ mark item.
- If the answer is partially correct, award partial marks proportional to mark scheme bullets covered.
- If the answer is irrelevant or off-topic, awardedMarks = 0.
- When a Reading passage is provided, treat the mark scheme as the canonical answer (e.g. "C" = paragraph C). The student answer is correct if it identifies the same paragraph / fact, EVEN IF they wrote the descriptive content of that paragraph instead of the letter, OR a paraphrase of the canonical answer that matches the passage.
- Set "confident": false ONLY when the mark scheme is ambiguous, the student's intent is unclear, or the answer is creative-but-unconventional.
- You MUST return exactly one object per input item, echoing each id verbatim.`;

    // Truncate the passage if huge so the prompt stays within budget.
    // Mark the truncation explicitly so the model doesn't grade against
    // a half-paragraph it thinks is complete.
    const passageText = (() => {
      const p = input.passage?.trim();
      if (!p) return '';
      if (p.length <= PASSAGE_PROMPT_CHAR_CAP) return `Reading passage:\n${p}`;
      return `Reading passage (truncated to first ${PASSAGE_PROMPT_CHAR_CAP} chars):\n${p.slice(
        0,
        PASSAGE_PROMPT_CHAR_CAP,
      )}\n…[truncated]`;
    })();

    // System prompt as content blocks so the rubric (+ passage) form a
    // cache-control prefix: identical for every student on this paper,
    // so the 09:00 sweep pays the full input price once and reads the
    // rest from cache at ~10%. cache_control sits on the LAST stable
    // block — it caches everything up to and including itself.
    //
    // `as any` on the blocks mirrors ai.service.ts — the pinned SDK
    // version's TextBlockParam type doesn't surface `cache_control`,
    // but the API accepts it; the established codebase workaround is
    // to cast at the call site.
    const systemBlocks: Array<Record<string, unknown>> = [
      { type: 'text', text: system },
    ];
    if (passageText) {
      systemBlocks.push({ type: 'text', text: passageText });
    }
    systemBlocks[systemBlocks.length - 1].cache_control = { type: 'ephemeral' };

    const userPayload = needApi.map((it) => ({
      id: it.id,
      stem: it.stem,
      markScheme: it.markScheme,
      maxMarks: it.maxMarks,
      studentAnswer: it.studentAnswer,
    }));

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        // ~80 output tokens per verdict; 2500 covers a 12-item O-Level
        // paper with headroom. Haiku's output ceiling is far above this.
        max_tokens: 2500,
        // Lock to 0 — two students with identical answers must get
        // identical marks, and a regrade must reproduce the same score.
        temperature: 0,
        system: systemBlocks as any,
        messages: [
          {
            role: 'user',
            content: `Grade these ${userPayload.length} item(s). Respond with the JSON array now.\n\n${JSON.stringify(
              userPayload,
            )}`,
          },
        ],
      });
      const text = resp.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        this.logger.warn(`No JSON array in AI response: ${text.slice(0, 200)}`);
        return null;
      }
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) {
        this.logger.warn('AI response JSON was not an array');
        return null;
      }
      const byId = new Map(needApi.map((it) => [it.id, it]));
      for (const row of parsed) {
        const id = String(row?.id ?? '');
        const item = byId.get(id);
        if (!item) continue; // hallucinated / unknown id — ignore
        const raw = Number(row?.awardedMarks);
        if (!Number.isFinite(raw)) continue; // skip → caller manual-reviews
        const clamped = Math.max(
          0,
          Math.min(item.maxMarks, Math.round(raw * 2) / 2),
        );
        out.set(id, {
          awardedMarks: clamped,
          reasoning: String(row?.reasoning ?? '').slice(0, 500),
          confident: row?.confident !== false,
        });
      }
      return out;
    } catch (err: any) {
      this.logger.error(`batch short-answer eval failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Single-item convenience wrapper around `evaluateBatch` — used by the
   * teacher-facing POST /morning-quiz/ai-grade/short-answer tool, which
   * grades one answer a teacher is hand-checking. Returns null on the
   * same failure conditions as the batch path.
   */
  async evaluate(input: {
    stem: string;
    studentAnswer: string;
    markScheme: string;
    maxMarks: number;
    passage?: string;
  }): Promise<ShortAnswerSuggestion | null> {
    const result = await this.evaluateBatch({
      passage: input.passage,
      items: [
        {
          id: '_single',
          stem: input.stem,
          studentAnswer: input.studentAnswer,
          markScheme: input.markScheme,
          maxMarks: input.maxMarks,
        },
      ],
    });
    if (result === null) return null;
    return result.get('_single') ?? null;
  }
}
