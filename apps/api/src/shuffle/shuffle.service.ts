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

/**
 * 按「学生 + 卷子」确定性地算出乱序 —— getOrCreate（落库）与 peek（只读）共用，
 * 保证两条路径给出的是同一份。
 */
export function computeShuffle(
  studentId: string,
  paperId: string,
  paperQuestions: Array<{ id: string; snapshotOptions: unknown; question: { questionType: string } }>,
): ShuffleMap {
  const seedHex = createHash('sha256').update(`${studentId}.${paperId}`).digest('hex').slice(0, 16);
  const rng = mulberry32(seedFromHex(seedHex));
  const questionOrder = fisherYates(paperQuestions.map((_, i) => i), rng);
  const optionOrders: Record<string, number[]> = {};
  for (const pq of paperQuestions) {
    if (pq.question.questionType !== 'mcq') continue;
    const options = (pq.snapshotOptions as unknown[] | null) ?? [];
    if (!Array.isArray(options) || options.length < 2) continue;
    // Key by paperQuestionId so the answer-grading path can resolve directly
    // off AnswerScript.paperQuestionId without a join back to Question.
    optionOrders[pq.id] = fisherYates(options.map((_, i) => i), rng);
  }
  return { seed: seedHex, questionOrder, optionOrders };
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

    const { seed: seedHex, questionOrder, optionOrders } = computeShuffle(studentId, paperId, paperQuestions);

    await this.prisma.questionShuffleMap.upsert({
      where: { studentId_paperId: { studentId, paperId } },
      update: {},
      create: { studentId, paperId, seed: seedHex, questionOrder, optionOrders },
    });

    return { seed: seedHex, questionOrder, optionOrders };
  }

  /**
   * **只读**地拿这名学生这份卷子的乱序（审计 S08）。
   *
   * 乱序是确定性的（种子 = sha256(studentId.paperId)），库里那一行只是缓存：
   *   · 有一行且仍然有效 → 用它（与 getOrCreate 返回的一样）；
   *   · 没有、或已经过期 → 在内存里按同一个种子算出来，**不写库、不删旧行**。
   * 之后作答 / 交卷走 getOrCreate 时落库的会是同一份（同种子、同一份卷子），
   * 所以学生看到的顺序与判分时反查的顺序一致。答题页的 GET 因此不再隐式写库，
   * 教师只读视角可以打开。
   */
  async peek(studentId: string, paperId: string): Promise<ShuffleMap> {
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, snapshotOptions: true, question: { select: { questionType: true } } },
    });
    if (paperQuestions.length === 0) return { seed: '', questionOrder: [], optionOrders: {} };
    const existing = await this.prisma.questionShuffleMap.findUnique({
      where: { studentId_paperId: { studentId, paperId } },
    });
    if (existing) {
      const cached = existing.optionOrders as Record<string, number[]>;
      const stillValid =
        existing.questionOrder.length === paperQuestions.length &&
        paperQuestions.every((pq) => {
          if (pq.question.questionType !== 'mcq') return true;
          const order = cached[pq.id];
          if (!order) return true;
          const opts = Array.isArray(pq.snapshotOptions) ? pq.snapshotOptions : [];
          return order.length === opts.length;
        });
      if (stillValid) return { seed: existing.seed, questionOrder: existing.questionOrder, optionOrders: cached };
    }
    return computeShuffle(studentId, paperId, paperQuestions);
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

  /**
   * 正向：原始 index → 学生**这次看到的位置**。
   *
   * 恢复未交卷的答案要用它。库里存的是原始 key（保存时反查过一次，判分
   * 才对得上答案），而学生屏幕上的选项被打乱且重新标了 A/B/C/D —— 直接
   * 把原始 key 发回前端，高亮的会是另一个选项（P8.5 实测：学生点了
   * 「the school」，恢复后亮的是「the harbour」）。
   *
   * 返回 null 表示这题没打乱（非 MCQ 或没有 map 行），照原样用即可。
   */
  mapOptionIndex(map: ShuffleMap, paperQuestionId: string, originalIndex: number): number | null {
    const order = map.optionOrders[paperQuestionId];
    if (!order) return null;
    const displayed = order.indexOf(originalIndex);
    return displayed < 0 ? null : displayed;
  }
}
