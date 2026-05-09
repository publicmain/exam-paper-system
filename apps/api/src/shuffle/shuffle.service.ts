import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';

/**
 * Mulberry32 — small deterministic PRNG seeded from a 32-bit integer.
 * Returns a function producing floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromHex(hex: string): number {
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface ShuffleMap {
  seed: string;
  questionOrder: number[];
  /** keyed by paperQuestionId → permuted array of original option indices */
  optionOrders: Record<string, number[]>;
}

@Injectable()
export class ShuffleService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(studentId: string, paperId: string): Promise<ShuffleMap> {
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, snapshotOptions: true, question: { select: { questionType: true } } },
    });
    if (paperQuestions.length === 0) {
      return { seed: '', questionOrder: [], optionOrders: {} };
    }

    const existing = await this.prisma.questionShuffleMap.findUnique({
      where: { studentId_paperId: { studentId, paperId } },
    });
    if (existing) {
      // If the paper has been edited (questions added / removed) since the
      // shuffle map was minted, the cached questionOrder / optionOrders are
      // stale: applyToPaper would throw on length mismatch and any MCQ
      // whose pq.id is missing from optionOrders silently skips shuffle.
      // We regenerate from scratch in that case rather than serving a
      // stale half-permutation that could surface the wrong question to
      // the student.
      const cached = existing.optionOrders as Record<string, number[]>;
      const stillValid =
        existing.questionOrder.length === paperQuestions.length &&
        paperQuestions.every((pq) => {
          if (pq.question.questionType !== 'mcq') return true;
          const order = cached[pq.id];
          if (!order) return true; // non-shuffled MCQ is fine — see line 78
          const opts = Array.isArray(pq.snapshotOptions) ? pq.snapshotOptions : [];
          return order.length === opts.length;
        });
      if (stillValid) {
        return {
          seed: existing.seed,
          questionOrder: existing.questionOrder,
          optionOrders: cached,
        };
      }
      // Drop the stale row before falling through to the regenerate path.
      await this.prisma.questionShuffleMap.delete({
        where: { studentId_paperId: { studentId, paperId } },
      });
    }

    const seedHex = createHash('sha256')
      .update(`${studentId}.${paperId}`)
      .digest('hex')
      .slice(0, 16);
    const rng = mulberry32(seedFromHex(seedHex));

    const indices = paperQuestions.map((_, i) => i);
    const questionOrder = fisherYates(indices, rng);

    const optionOrders: Record<string, number[]> = {};
    for (const pq of paperQuestions) {
      if (pq.question.questionType !== 'mcq') continue;
      const options = (pq.snapshotOptions as unknown[] | null) ?? [];
      if (!Array.isArray(options) || options.length < 2) continue;
      const ids = options.map((_, i) => i);
      // Key by paperQuestionId so the answer-grading path can resolve directly
      // off AnswerScript.paperQuestionId without a join back to Question.
      optionOrders[pq.id] = fisherYates(ids, rng);
    }

    await this.prisma.questionShuffleMap.upsert({
      where: { studentId_paperId: { studentId, paperId } },
      update: {},
      create: { studentId, paperId, seed: seedHex, questionOrder, optionOrders },
    });

    return { seed: seedHex, questionOrder, optionOrders };
  }

  /**
   * Apply a shuffle map to (already-fetched) paper questions for delivery.
   * Reorders the array per questionOrder and reorders snapshotOptions for MCQs.
   * Returns a new array — does not mutate input.
   */
  applyToPaper<Q extends { id: string; snapshotOptions: unknown; question: { questionType: string } }>(
    paperQuestions: Q[],
    map: ShuffleMap,
  ): Q[] {
    if (map.questionOrder.length !== paperQuestions.length) {
      throw new Error(
        `Shuffle map size mismatch: map=${map.questionOrder.length} paper=${paperQuestions.length}`,
      );
    }
    return map.questionOrder.map((origIdx) => {
      const pq = paperQuestions[origIdx];
      const order = map.optionOrders[pq.id];
      if (!order || pq.question.questionType !== 'mcq') return pq;
      const options = (pq.snapshotOptions as unknown[] | null) ?? [];
      if (!Array.isArray(options)) return pq;
      const reordered = order.map((i) => options[i]);
      return { ...pq, snapshotOptions: reordered };
    });
  }

  /**
   * Reverse a student's MCQ option pick (the index they saw) back to the
   * original index in snapshotOptions, so existing auto-grading can compare
   * against the stored answer key. Returns null when the question was not
   * shuffled (non-MCQ or no map row).
   */
  unmapOptionIndex(map: ShuffleMap, paperQuestionId: string, displayedIndex: number): number | null {
    const order = map.optionOrders[paperQuestionId];
    if (!order) return null;
    if (displayedIndex < 0 || displayedIndex >= order.length) return null;
    return order[displayedIndex];
  }
}
