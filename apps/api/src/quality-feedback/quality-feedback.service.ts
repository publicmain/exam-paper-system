import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Signal types match the QuestionQualitySignalType enum in
 * `prisma/path-b-fragments/b3.prisma`. Until that fragment is merged into
 * `schema.prisma`, the generated Prisma client does not know about
 * `questionQualitySignal` — the calls below are typed as `any` to compile.
 * After integration, drop the `as any` casts (see MERGE_INSTRUCTIONS.md).
 */
export type SignalType =
  | 'approved'
  | 'rejected'
  | 'edited'
  | 'answered_correct'
  | 'answered_wrong'
  | 'skipped';

const VALID_SIGNALS: SignalType[] = [
  'approved',
  'rejected',
  'edited',
  'answered_correct',
  'answered_wrong',
  'skipped',
];

/** Default per-signal weight. See b3.prisma comment block for rationale. */
const DEFAULT_WEIGHTS: Record<SignalType, number> = {
  approved: 1.0,
  rejected: -2.0,
  edited: -0.5,
  answered_correct: 0.2,
  answered_wrong: -0.2,
  skipped: -0.1,
};

@Injectable()
export class QualityFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist a single signal row.
   * - questionId must already exist (FK throws otherwise).
   * - meta is opaque JSON; callers stash subtopicCode, awardedMarks/marks
   *   ratio, edited-field list, etc.
   */
  async logSignal(
    questionId: string,
    signalType: SignalType,
    actor: { id: string | null; role?: string | null },
    meta?: Record<string, unknown>,
  ) {
    if (!VALID_SIGNALS.includes(signalType)) {
      throw new BadRequestException(`Unknown signalType: ${signalType}`);
    }
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException('Question not found');

    const weight = DEFAULT_WEIGHTS[signalType];
    // Cast to any until the b3 fragment is merged and the Prisma client
    // re-generated — see MERGE_INSTRUCTIONS.md "Untyped client calls".
    const created = await (this.prisma as any).questionQualitySignal.create({
      data: {
        questionId,
        signalType,
        weight,
        meta: (meta ?? null) as any,
        recordedById: actor.id ?? null,
      },
    });
    return created;
  }

  /**
   * Aggregate quality score for a single question.
   * score = sum(signal.weight). Returns counts per signalType so the UI
   * can show a breakdown next to the bare number.
   */
  async questionScore(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { id: true, primaryTopicId: true, marks: true, difficulty: true },
    });
    if (!question) throw new NotFoundException('Question not found');

    const rows: Array<{ signalType: SignalType; weight: number }> = await (
      this.prisma as any
    ).questionQualitySignal.findMany({
      where: { questionId },
      select: { signalType: true, weight: true },
    });

    const counts: Record<SignalType, number> = {
      approved: 0,
      rejected: 0,
      edited: 0,
      answered_correct: 0,
      answered_wrong: 0,
      skipped: 0,
    };
    let score = 0;
    for (const r of rows) {
      counts[r.signalType] = (counts[r.signalType] ?? 0) + 1;
      score += r.weight;
    }
    return {
      questionId,
      score: Number(score.toFixed(3)),
      totalSignals: rows.length,
      counts,
    };
  }

  /**
   * Per-topic leaderboard. Returns top N (highest score) and bottom N
   * (lowest score) Questions whose primaryTopicId = topicId.
   * `limit` is per side, defaults 10.
   */
  async topicLeaderboard(topicId: string, limit = 10) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, code: true, name: true },
    });
    if (!topic) throw new NotFoundException('Topic not found');

    // Pull all Questions on this topic (primary or via QuestionTopic) and
    // their signal sums in two queries. For a Phase-1 school with thousands
    // of questions per topic this is fine; if it ever grows we'd push the
    // sum into raw SQL.
    const questions = await this.prisma.question.findMany({
      where: {
        OR: [
          { primaryTopicId: topicId },
          { topics: { some: { topicId } } },
        ],
      },
      select: {
        id: true,
        marks: true,
        difficulty: true,
        questionType: true,
        sourceType: true,
        provenanceTag: true,
      },
    });
    if (questions.length === 0) {
      return { topic, top: [], bottom: [] };
    }

    const ids = questions.map((q) => q.id);
    const signals: Array<{ questionId: string; signalType: SignalType; weight: number }> =
      await (this.prisma as any).questionQualitySignal.findMany({
        where: { questionId: { in: ids } },
        select: { questionId: true, signalType: true, weight: true },
      });

    const byQid = new Map<string, { score: number; total: number; counts: Record<SignalType, number> }>();
    for (const id of ids) {
      byQid.set(id, {
        score: 0,
        total: 0,
        counts: {
          approved: 0,
          rejected: 0,
          edited: 0,
          answered_correct: 0,
          answered_wrong: 0,
          skipped: 0,
        },
      });
    }
    for (const s of signals) {
      const slot = byQid.get(s.questionId);
      if (!slot) continue;
      slot.score += s.weight;
      slot.total += 1;
      slot.counts[s.signalType] = (slot.counts[s.signalType] ?? 0) + 1;
    }

    const enriched = questions.map((q) => {
      const slot = byQid.get(q.id)!;
      return {
        questionId: q.id,
        marks: q.marks,
        difficulty: q.difficulty,
        questionType: q.questionType,
        sourceType: q.sourceType,
        provenanceTag: q.provenanceTag,
        score: Number(slot.score.toFixed(3)),
        totalSignals: slot.total,
        counts: slot.counts,
      };
    });

    const sortedDesc = [...enriched].sort((a, b) => b.score - a.score);
    const top = sortedDesc.slice(0, limit);
    const bottom = [...enriched]
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);

    return { topic, top, bottom };
  }

  /**
   * AI-prompt suggestions: text snippets the next AI-generation prompt
   * should include for this topic. Strategy:
   *   - If average score across the topic is strongly negative AND
   *     answered_correct > answered_wrong on the bottom slice, flag
   *     "tone is too academic / questions confusing students despite
   *     being technically correct".
   *   - If answered_correct >> answered_wrong overall, flag "too easy".
   *   - If answered_wrong >> answered_correct overall, flag "too hard".
   *   - If reject:approve ratio > 0.3, flag "AI output quality on this
   *     topic is below the bar — prefer past-paper grounding".
   *   - If editCount > approveCount * 0.5, flag "approved questions
   *     needed heavy edits — refine wording".
   *
   * Returns a flat string[] of plain-English snippets the caller can
   * splice into a prompt template. Empty array means "no calibration
   * signal yet, default prompt is fine".
   */
  async aiPromptSuggestions(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, code: true, name: true },
    });
    if (!topic) throw new NotFoundException('Topic not found');

    const questions = await this.prisma.question.findMany({
      where: {
        OR: [
          { primaryTopicId: topicId },
          { topics: { some: { topicId } } },
        ],
      },
      select: { id: true },
    });
    const ids = questions.map((q) => q.id);
    if (ids.length === 0) {
      return { topic, suggestions: [], stats: null };
    }

    const signals: Array<{ signalType: SignalType; weight: number }> = await (
      this.prisma as any
    ).questionQualitySignal.findMany({
      where: { questionId: { in: ids } },
      select: { signalType: true, weight: true },
    });

    const counts: Record<SignalType, number> = {
      approved: 0,
      rejected: 0,
      edited: 0,
      answered_correct: 0,
      answered_wrong: 0,
      skipped: 0,
    };
    let totalScore = 0;
    for (const s of signals) {
      counts[s.signalType] = (counts[s.signalType] ?? 0) + 1;
      totalScore += s.weight;
    }

    const suggestions: string[] = [];

    const studentTotal = counts.answered_correct + counts.answered_wrong + counts.skipped;
    if (studentTotal >= 5) {
      const correctRatio = counts.answered_correct / studentTotal;
      const wrongRatio = counts.answered_wrong / studentTotal;
      if (correctRatio >= 0.85) {
        suggestions.push(
          `Questions on topic "${topic.code} ${topic.name}" have been answered correctly ${Math.round(correctRatio * 100)}% of the time — generate harder variants (push difficulty +1, add more reasoning steps).`,
        );
      } else if (wrongRatio >= 0.6) {
        suggestions.push(
          `Questions on topic "${topic.code} ${topic.name}" are answered wrong ${Math.round(wrongRatio * 100)}% of the time — generate easier variants (drop difficulty 1, simplify wording, add a worked-example pattern).`,
        );
      }
      if (counts.skipped / studentTotal >= 0.25) {
        suggestions.push(
          `Students skip ${Math.round((counts.skipped / studentTotal) * 100)}% of questions on topic "${topic.code} ${topic.name}" — wording may be intimidating; prefer concrete numerical setups over abstract phrasing.`,
        );
      }
    }

    const reviewTotal = counts.approved + counts.rejected;
    if (reviewTotal >= 5) {
      const rejectRatio = counts.rejected / reviewTotal;
      if (rejectRatio >= 0.3) {
        suggestions.push(
          `Reject rate on topic "${topic.code} ${topic.name}" is ${Math.round(rejectRatio * 100)}% — AI output is below bar; ground each question in a real past-paper stem and copy the marking style verbatim.`,
        );
      }
      if (counts.approved > 0 && counts.edited / counts.approved >= 0.5) {
        suggestions.push(
          `Teachers edit ${Math.round((counts.edited / counts.approved) * 100)}% of approved questions on "${topic.code} ${topic.name}" — refine wording before generation: shorter stems, exam-board phrasing, no first-person.`,
        );
      }
    }

    if (signals.length >= 10 && totalScore < 0) {
      suggestions.push(
        `Aggregate quality score for "${topic.code} ${topic.name}" is negative (${totalScore.toFixed(1)} across ${signals.length} signals) — review existing rejected examples in the bank before generating more.`,
      );
    }

    return {
      topic,
      suggestions,
      stats: {
        totalSignals: signals.length,
        totalScore: Number(totalScore.toFixed(3)),
        counts,
      },
    };
  }
}
