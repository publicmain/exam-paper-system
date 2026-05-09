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
}

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
    if (!this.client) return null;
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
- Set "confident": false ONLY when the mark scheme is ambiguous, the student's intent is unclear, or the answer is creative-but-unconventional.`;

    const user = `Question stem:
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
