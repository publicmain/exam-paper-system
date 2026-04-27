import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GenerationConfigDto } from './dto';
import { Question, QuestionStatus, QuestionType } from '@prisma/client';

// Deterministic seeded RNG so same seed → same paper
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function() {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface DifficultyBuckets {
  easy: number;
  medium: number;
  hard: number;
}

export interface GenerationResult {
  questions: Question[];
  totalMarks: number;
  estimatedTimeMin: number;
  warnings: string[];
  seed: number;
}

@Injectable()
export class GenerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect obviously infeasible configurations before hitting the DB.
   */
  preflight(config: GenerationConfigDto): string[] {
    const warnings: string[] = [];

    let mixMarks = 0;
    for (const m of config.questionMix) {
      if (m.count != null && m.marksEach != null) mixMarks += m.count * m.marksEach;
      else if (m.targetMarks != null) mixMarks += m.targetMarks;
    }
    if (mixMarks > 0 && Math.abs(mixMarks - config.totalMarks) / config.totalMarks > 0.2) {
      warnings.push(
        `Question mix targets approximately ${mixMarks} marks but total is ${config.totalMarks}. Consider adjusting.`,
      );
    }

    // Time vs marks sanity
    const ratio = config.durationMin / config.totalMarks;
    if (ratio < 0.5) {
      warnings.push(
        `Duration (${config.durationMin}min) is short for ${config.totalMarks} marks; students may not finish.`,
      );
    } else if (ratio > 2.5) {
      warnings.push(
        `Duration (${config.durationMin}min) seems generous for ${config.totalMarks} marks.`,
      );
    }

    return warnings;
  }

  async generate(config: GenerationConfigDto): Promise<GenerationResult> {
    const warnings = this.preflight(config);
    const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
    const rng = mulberry32(seed);

    // Resolve topic filter expansion: if a parent topic is selected, include all descendants
    const expandedTopicIds = await this.expandTopicFilter(config.topicFilter ?? []);

    // Recently used questions to exclude
    const excludeIds = new Set(config.excludeQuestionIds ?? []);
    if (config.excludeRecentDays && config.excludeRecentDays > 0) {
      const cutoff = new Date(Date.now() - config.excludeRecentDays * 86400e3);
      const recent = await this.prisma.questionUsageLog.findMany({
        where: { usedAt: { gte: cutoff } }, select: { questionId: true },
      });
      for (const r of recent) excludeIds.add(r.questionId);
    }

    // Pull candidate pool once: subject + component + topic + status active
    const where: any = {
      subjectId: config.subjectId,
      status: QuestionStatus.active,
      ...(config.componentId && { componentId: config.componentId }),
      ...(expandedTopicIds.length > 0 && {
        OR: [
          { primaryTopicId: { in: expandedTopicIds } },
          { topics: { some: { topicId: { in: expandedTopicIds } } } },
        ],
      }),
    };
    let pool = await this.prisma.question.findMany({
      where, include: { topics: true, primaryTopic: true, component: true, assets: true },
    });
    pool = pool.filter(q => !excludeIds.has(q.id));

    if (pool.length === 0) {
      throw new BadRequestException('No questions match the given subject / component / topic filter.');
    }

    const dist: DifficultyBuckets = {
      easy: config.difficultyDist?.easy ?? 0.4,
      medium: config.difficultyDist?.medium ?? 0.4,
      hard: config.difficultyDist?.hard ?? 0.2,
    };

    const selected: Question[] = [];
    const usedIds = new Set<string>();

    for (const slot of config.questionMix) {
      const filtered = pool.filter(q => q.questionType === (slot.type as QuestionType) && !usedIds.has(q.id));
      if (filtered.length === 0) {
        warnings.push(`No ${slot.type} questions available in the selected scope.`);
        continue;
      }

      // Sub-pool by difficulty buckets (1-2 easy, 3 medium, 4-5 hard)
      const easy = filtered.filter(q => q.difficulty <= 2);
      const medium = filtered.filter(q => q.difficulty === 3);
      const hard = filtered.filter(q => q.difficulty >= 4);

      shuffleInPlace(easy, rng);
      shuffleInPlace(medium, rng);
      shuffleInPlace(hard, rng);

      if (slot.count != null && slot.marksEach != null) {
        const counts = this.splitByDist(slot.count, dist);
        for (const [bucket, cnt] of Object.entries(counts) as Array<[keyof DifficultyBuckets, number]>) {
          const src = bucket === 'easy' ? easy : bucket === 'medium' ? medium : hard;
          for (let i = 0; i < cnt && src.length > 0; i++) {
            const q = src.shift()!;
            usedIds.add(q.id);
            selected.push(q);
          }
        }
        const stillNeed = slot.count - selected.filter(s => s.questionType === slot.type).length;
        if (stillNeed > 0) {
          const fallback = [...easy, ...medium, ...hard];
          for (let i = 0; i < stillNeed && fallback.length > 0; i++) {
            const q = fallback.shift()!;
            if (usedIds.has(q.id)) continue;
            usedIds.add(q.id);
            selected.push(q);
          }
        }
      } else if (slot.targetMarks != null) {
        let acc = 0;
        const target = slot.targetMarks;
        const flatPool = shuffleInPlace([...easy, ...medium, ...hard], rng);
        for (const q of flatPool) {
          if (acc >= target) break;
          if (acc + q.marks > target * 1.15) continue;
          if (usedIds.has(q.id)) continue;
          usedIds.add(q.id);
          selected.push(q);
          acc += q.marks;
        }
        if (acc < target * 0.85) {
          warnings.push(`Could not hit ${target} marks for ${slot.type}: reached ${acc}.`);
        }
      } else {
        warnings.push(`Slot ${slot.type} has neither count nor targetMarks; skipped.`);
      }
    }

    if (selected.length === 0) {
      throw new BadRequestException('Generation produced 0 questions; broaden filters.');
    }

    const totalMarks = selected.reduce((s, q) => s + q.marks, 0);
    const estimatedTimeMin = selected.reduce((s, q) => s + q.estimatedTimeMin, 0);

    if (totalMarks > config.totalMarks * 1.1 || totalMarks < config.totalMarks * 0.9) {
      warnings.push(`Achieved ${totalMarks} marks vs target ${config.totalMarks} (>10% deviation).`);
    }
    if (estimatedTimeMin > config.durationMin * 1.2) {
      warnings.push(`Estimated time ${estimatedTimeMin.toFixed(0)}min exceeds duration ${config.durationMin}min.`);
    }

    return { questions: selected, totalMarks, estimatedTimeMin, warnings, seed };
  }

  /**
   * Find a single replacement question matching the same topic / type / marks / difficulty.
   */
  async findReplacement(opts: {
    paperId: string;
    questionId: string;
    excludeIds?: string[];
  }) {
    const orig = await this.prisma.question.findUnique({
      where: { id: opts.questionId }, include: { topics: true },
    });
    if (!orig) throw new BadRequestException('Original question not found');

    const paper = await this.prisma.paper.findUnique({ where: { id: opts.paperId } });
    if (!paper) throw new BadRequestException('Paper not found');

    const exclude = new Set([opts.questionId, ...(opts.excludeIds ?? [])]);
    const otherInPaper = await this.prisma.paperQuestion.findMany({
      where: { paperId: opts.paperId }, select: { questionId: true },
    });
    for (const o of otherInPaper) exclude.add(o.questionId);

    const topicIds = orig.topics.map(t => t.topicId);
    if (orig.primaryTopicId) topicIds.push(orig.primaryTopicId);

    const pool = await this.prisma.question.findMany({
      where: {
        subjectId: orig.subjectId,
        questionType: orig.questionType,
        marks: orig.marks,
        difficulty: orig.difficulty,
        status: QuestionStatus.active,
        id: { notIn: Array.from(exclude) },
        ...(topicIds.length > 0 && {
          OR: [
            { primaryTopicId: { in: topicIds } },
            { topics: { some: { topicId: { in: topicIds } } } },
          ],
        }),
      },
      take: 10,
      include: { primaryTopic: true, component: true, topics: { include: { topic: true } } },
    });
    return pool;
  }

  private async expandTopicFilter(topicIds: string[]): Promise<string[]> {
    if (topicIds.length === 0) return [];
    const seen = new Set<string>(topicIds);
    let frontier = topicIds;
    while (frontier.length > 0) {
      const children = await this.prisma.topic.findMany({
        where: { parentTopicId: { in: frontier } },
        select: { id: true },
      });
      const next: string[] = [];
      for (const c of children) {
        if (!seen.has(c.id)) { seen.add(c.id); next.push(c.id); }
      }
      frontier = next;
    }
    return Array.from(seen);
  }

  private splitByDist(n: number, dist: DifficultyBuckets): DifficultyBuckets {
    const easy = Math.round(n * dist.easy);
    const medium = Math.round(n * dist.medium);
    const hard = Math.max(0, n - easy - medium);
    return { easy, medium, hard };
  }
}
