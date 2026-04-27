import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface PaperValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalMarksActual: number;
  estimatedTimeMin: number;
  topicCoverage: Array<{ topicId: string; topicName: string; questionCount: number; marks: number }>;
  difficultySpread: Record<string, number>;
}

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(paperId: string): Promise<PaperValidation> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      include: {
        questions: {
          include: { question: { include: { primaryTopic: true, assets: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!paper) {
      return { ok: false, errors: ['Paper not found'], warnings: [], totalMarksActual: 0, estimatedTimeMin: 0, topicCoverage: [], difficultySpread: {} };
    }

    if (paper.questions.length === 0) {
      errors.push('Paper has no questions.');
    }

    const totalMarksActual = paper.questions.reduce((s, q) => s + q.marks, 0);
    if (Math.abs(totalMarksActual - paper.totalMarksTarget) / Math.max(1, paper.totalMarksTarget) > 0.05) {
      warnings.push(`Total marks ${totalMarksActual} vs target ${paper.totalMarksTarget} (>5% deviation).`);
    }

    const estimatedTimeMin = paper.questions.reduce((s, q) => s + q.question.estimatedTimeMin, 0);
    if (Math.abs(estimatedTimeMin - paper.durationMin) / Math.max(1, paper.durationMin) > 0.15) {
      warnings.push(`Estimated time ${estimatedTimeMin.toFixed(0)}min vs duration ${paper.durationMin}min (>15% deviation).`);
    }

    // Topic coverage
    const cov = new Map<string, { topicId: string; topicName: string; questionCount: number; marks: number }>();
    for (const pq of paper.questions) {
      const t = pq.question.primaryTopic;
      if (!t) continue;
      const e = cov.get(t.id) ?? { topicId: t.id, topicName: t.name, questionCount: 0, marks: 0 };
      e.questionCount++;
      e.marks += pq.marks;
      cov.set(t.id, e);
    }

    // Difficulty spread
    const diff: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (const pq of paper.questions) {
      const d = pq.question.difficulty;
      if (d <= 2) diff.easy += pq.marks;
      else if (d === 3) diff.medium += pq.marks;
      else diff.hard += pq.marks;
    }

    // LaTeX / asset hints
    for (const pq of paper.questions) {
      const c = (pq.overrideContent ?? pq.snapshotContent) as any;
      if (typeof c?.stem === 'string' && c.stem.includes('\\') && !/\$.*\$/.test(c.stem)) {
        // possibly raw LaTeX without $..$ delimiters
        warnings.push(`Q${pq.sortOrder + 1}: LaTeX may be missing $...$ delimiters.`);
      }
      if (pq.question.assets.length === 0 && /\bdiagram\b|\bfigure\b/i.test(c?.stem ?? '')) {
        warnings.push(`Q${pq.sortOrder + 1}: mentions diagram but no asset attached.`);
      }
    }

    return {
      ok: errors.length === 0,
      errors, warnings,
      totalMarksActual,
      estimatedTimeMin,
      topicCoverage: Array.from(cov.values()),
      difficultySpread: diff,
    };
  }
}
