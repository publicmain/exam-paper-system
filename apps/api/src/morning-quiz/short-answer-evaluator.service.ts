import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

/**
 * AI-assisted scoring for `short_answer` items.
 *
 * Background — `student.service.autoGradeScripts` currently does:
 *   if (questionType === 'short_answer') continue;  // never auto-graded
 * which means a 30-question paper with 10 short_answer items leaves the
 * teacher 10 manual decisions PER STUDENT. For Dan's class of ~40, that's
 * 400 manual scoring decisions per quiz. The morning-quiz program is
 * specifically designed for "near-zero teacher load", so this is the
 * single biggest source of remaining work.
 *
 * What this does — when called with (stem, studentAnswer, markScheme,
 * maxMarks), prompts Claude with a strict scoring rubric and parses a
 * suggested mark + 1-2 sentence justification. The result is stored on
 * AnswerScript with `awardedMarks` set + a `markerComment` prefixed
 * `[ai-suggest]` so the teacher can scan-confirm in batch instead of
 * starting from zero.
 *
 * Failures (no API key, JSON parse fail, network error) return null so
 * the caller can fall back to "manual review needed" without blowing up.
 */

export interface ShortAnswerInput {
  stem: string;
  studentAnswer: string;
  markScheme: string;
  maxMarks: number;
  /**
   * Optional reading passage. When provided, included in the AI prompt
   * (truncated to ~6k chars) so the grader can verify paragraph-letter
   * answers and paraphrase comprehension answers against the source
   * text. Critical for IELTS GT matching_information items where the
   * mark scheme is a single letter — without the passage the AI has
   * nothing to anchor "is this answer correct?" to.
   */
  passage?: string;
}

/**
 * Cap injected into the AI prompt. Cambridge IELTS GT Section 1 passages
 * land around 2.5–3.5k chars, the longest 0510 comprehension passages
 * around 4k. 6000 covers the headroom without blowing input tokens —
 * Sonnet at $3/MTok input × ~1.5k tokens for the passage = ~$0.005/call,
 * which matches the per-call budget assumed in autoGradeScripts comments.
 */
const PASSAGE_PROMPT_CHAR_CAP = 6000;

export interface ShortAnswerSuggestion {
  awardedMarks: number;
  reasoning: string;
  /** false when Claude itself flags the answer as ambiguous and asks for
   *  human review; the teacher dashboard surfaces this to bias attention
   *  toward these items. */
  confident: boolean;
}

@Injectable()
export class ShortAnswerEvaluatorService {
  private readonly logger = new Logger('ShortAnswerEvaluatorService');
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — short-answer suggestions will return null.',
      );
      this.client = null;
    } else {
      // Round-7 H35: explicit retry budget.
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  /** Returns null when the AI is unavailable or the response is
   *  unparseable. Caller should treat null as "no suggestion — leave
   *  for manual review". */
  async evaluate(input: ShortAnswerInput): Promise<ShortAnswerSuggestion | null> {
    if (!this.client) {
      // R15-followup-5: silent null on every grading call was a
      // production-invisible failure mode. If the API key gets rotated
      // or quota-exhausted, every short-answer student got 0/N with no
      // log signal. Warn loudly on every miss so operations notices.
      this.logger.warn(
        '[ai_grade_skipped] no Anthropic client — student answer not auto-graded; check ANTHROPIC_API_KEY',
      );
      return null;
    }
    if (!input.studentAnswer || !input.studentAnswer.trim()) {
      // Empty answers get 0 with high confidence — skip the API call.
      return {
        awardedMarks: 0,
        reasoning: '空白未作答 / Student left blank',
        confident: true,
      };
    }
    if (!input.markScheme || !input.markScheme.trim()) {
      // No reference key — can't grade. Caller falls back to manual.
      return null;
    }
    const system = `You are an English-as-a-second-language exam marker for a Singapore secondary school. You score short-answer items against a teacher-provided mark scheme.

Output ONLY a JSON object — no prose around it — matching:
{
  "awardedMarks": <integer 0..maxMarks>,
  "reasoning": "<1-2 short sentences referencing the mark scheme>",
  "confident": <true|false>
}

Rules:
- Be CONSISTENT with the mark scheme. If the scheme awards 1 mark for "X" and the student wrote a paraphrase that's clearly equivalent, give the mark.
- Spelling errors that don't change meaning: do not deduct on a 1-mark item; deduct 0.5 on a 2+ mark item.
- If the answer is partially correct, award partial marks proportional to mark scheme bullets covered.
- If the answer is irrelevant or off-topic, awardedMarks = 0.
- When a Reading passage is provided, treat the mark scheme as the canonical answer (e.g. "C" = paragraph C). The student answer is correct if it identifies the same paragraph / fact, EVEN IF they wrote the descriptive content of that paragraph instead of the letter, OR a paraphrase of the canonical answer that matches the passage.
- Set "confident": false ONLY when the mark scheme is ambiguous, the student's intent is unclear, or the answer is creative-but-unconventional.`;

    // Truncate the passage if huge so the prompt stays within budget.
    // Mark the truncation explicitly so the model doesn't try to grade
    // against a half-paragraph it thinks is complete.
    const passageBlock = (() => {
      const p = input.passage?.trim();
      if (!p) return '';
      if (p.length <= PASSAGE_PROMPT_CHAR_CAP) return `Reading passage:\n${p}\n\n`;
      return `Reading passage (truncated to first ${PASSAGE_PROMPT_CHAR_CAP} chars):\n${p.slice(0, PASSAGE_PROMPT_CHAR_CAP)}\n…[truncated]\n\n`;
    })();

    const user = `${passageBlock}Question stem:
${input.stem}

Mark scheme (max ${input.maxMarks} marks):
${input.markScheme}

Student answer:
${input.studentAnswer}

Respond with the JSON object now.`;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        // R10 follow-up — lock to temperature 0. Live testing showed the
        // same input ("Foxton" vs mark scheme "C", with passage in
        // context) sometimes scored 0 and sometimes 1 across calls, which
        // is unacceptable for a grading system. With temperature 0 the
        // model emits the same JSON for the same prompt, so two students
        // with identical answers get identical marks.
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = resp.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.warn(`No JSON in AI response: ${text.slice(0, 200)}`);
        return null;
      }
      const parsed = JSON.parse(match[0]);
      const raw = Number(parsed.awardedMarks);
      if (!Number.isFinite(raw)) return null;
      const clamped = Math.max(0, Math.min(input.maxMarks, Math.round(raw * 2) / 2));
      return {
        awardedMarks: clamped,
        reasoning: String(parsed.reasoning ?? '').slice(0, 500),
        confident: parsed.confident !== false,
      };
    } catch (err: any) {
      this.logger.error(`short-answer eval failed: ${err.message}`);
      return null;
    }
  }
}
