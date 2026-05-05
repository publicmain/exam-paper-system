import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * Per-class topic mastery score.
 *
 *  - mastery is in [0, 1]. 0 = the class got every relevant question wrong;
 *    1 = perfect. We compute it as the mean of `autoCorrect` (cast to 0/1)
 *    across answer scripts whose paperQuestion.question.primaryTopicId
 *    matches AND whose submission belongs to a student enrolled in the class.
 *
 *  - sampleSize is the number of answer scripts that contributed. A small
 *    sample (say <5) is statistically noisy — the caller should surface
 *    that to the user. We don't filter low-sample rows out at this layer
 *    because the AI generator may still want them, and the controller
 *    consumer can decide.
 *
 * What about structured / hand-marked items? `autoCorrect` is null for
 * non-MCQ scripts (it is only filled by the auto-grader on submit). We
 * intentionally use only auto-graded MCQ data here — it is the only
 * mastery signal that exists today without depending on B1's marker
 * workflow output. When B1 lands, we can extend this to use
 * `awardedMarks / paperQuestion.marks` for structured items.
 */
export interface WeakTopicRow {
  topicId: string;
  topicCode: string;
  topicName: string;
  mastery: number;     // 0..1, lower = weaker
  sampleSize: number;  // # of scripts contributing
}

interface WeakTopicsOpts {
  classId: string;
  subjectId?: string;
  limit?: number;
}

@Injectable()
export class PerfRoutingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute per-topic mastery for a class, ranked weakest-first.
   *
   * Implementation note: we lean on Prisma's relational query API rather
   * than raw SQL so this stays portable across SQLite (test) and Postgres
   * (prod). The aggregation is done in-memory after a single bulk fetch
   * — fine for current data volumes (a class has O(students × papers ×
   * questions) scripts, easily under 10k rows).
   */
  async weakTopicsForClass(opts: WeakTopicsOpts): Promise<WeakTopicRow[]> {
    const { classId, subjectId } = opts;
    const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 10;

    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('class not found');

    // Pull every auto-graded script for any submission whose student is
    // enrolled (as a student, not teacher) in this class. We narrow with
    // a where on the chained relations so the DB does the join, not us.
    const scripts = await this.prisma.answerScript.findMany({
      where: {
        autoCorrect: { not: null },
        submission: {
          student: {
            classEnrollments: { some: { classId, role: 'student' } },
          },
        },
        paperQuestion: {
          question: {
            primaryTopicId: { not: null },
            ...(subjectId ? { subjectId } : {}),
          },
        },
      },
      select: {
        autoCorrect: true,
        paperQuestion: {
          select: {
            question: {
              select: {
                primaryTopicId: true,
                primaryTopic: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    type Acc = { id: string; code: string; name: string; sum: number; count: number };
    const byTopic = new Map<string, Acc>();
    for (const s of scripts) {
      const t = s.paperQuestion.question.primaryTopic;
      if (!t) continue;
      const acc = byTopic.get(t.id) ?? { id: t.id, code: t.code, name: t.name, sum: 0, count: 0 };
      acc.sum += s.autoCorrect ? 1 : 0;
      acc.count += 1;
      byTopic.set(t.id, acc);
    }

    const rows: WeakTopicRow[] = Array.from(byTopic.values()).map((a) => ({
      topicId: a.id,
      topicCode: a.code,
      topicName: a.name,
      mastery: a.count > 0 ? a.sum / a.count : 0,
      sampleSize: a.count,
    }));

    // Sort weakest-first. Tie-break by larger sampleSize so a 0/10 topic
    // outranks a 0/2 topic (both 0.0 mastery, but the larger sample is
    // a more confident signal).
    rows.sort((a, b) => {
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return b.sampleSize - a.sampleSize;
    });
    return rows.slice(0, limit);
  }

  /**
   * Returns the augmented prompt that the AI generator would use, given
   * a class's weakest topics. We don't actually call the AI here — this
   * endpoint is for inspection so the teacher (or an integrator) can
   * preview what is going to be sent.
   *
   * Format keeps the original prompt intact and appends a structured
   * "Focus on these weak topics" block. The generator currently keys
   * off topicCode/syllabusCode, so the appendix is informational unless
   * the caller chooses one of the listed topicCodes for the actual call.
   */
  async previewPrompt(input: {
    classId: string;
    subjectId?: string;
    basePrompt: string;
    limit?: number;
  }): Promise<{ augmentedPrompt: string; weakTopics: WeakTopicRow[] }> {
    const weak = await this.weakTopicsForClass({
      classId: input.classId,
      subjectId: input.subjectId,
      limit: input.limit ?? 5,
    });

    const base = (input.basePrompt ?? '').trim();
    if (weak.length === 0) {
      // No data for this class — return base prompt unchanged so the
      // caller can detect "no signal" by comparing length.
      return { augmentedPrompt: base, weakTopics: [] };
    }

    const lines = weak.map(
      (w) =>
        `  - ${w.topicCode} ${w.topicName} ` +
        `(mastery ${(w.mastery * 100).toFixed(0)}% over ${w.sampleSize} script${w.sampleSize === 1 ? '' : 's'})`,
    );
    const appendix =
      `\n\nFocus on these weak topics for this class — historic mastery is below class average:\n` +
      lines.join('\n');

    return {
      augmentedPrompt: base + appendix,
      weakTopics: weak,
    };
  }
}
