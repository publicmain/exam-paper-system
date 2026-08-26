import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { resolveWeeklyTrack } from './weekly-track';
import { levelPushesWordlist } from './level-registry';
import {
  buildClozeQuestion,
  buildMeaningQuestion,
  pickMeaningDistractors,
  pickWordDistractors,
  pickWordsForDay,
  seedFor,
  type VocabQuestionSpec,
} from './vocab-question';

/**
 * 给轻量两层的早测卷挂 2 道本周词汇题（2026-08-25 教师定）。
 *
 * ## 为什么这个服务存在（2026-08-26 全功能回归抓到的断链）
 *
 * 这个功能最初以手工脚本交付（scripts/attach-vocab-questions.ts），
 * 8/24 手跑了一次 —— 之后**周日自动出卷和每日兜底出卷从来没接**这条
 * 逻辑，8/25 起生成的卷子全都没有词汇题。功能实际断了两天，没有任何
 * 报警：出卷成功、卷子正常、只是"少了两道题"，这种静默缺失只有靠
 * 数据核对才能发现。
 *
 * 教训：**凡是"每天都要发生"的事，必须挂在自动路径上**，手工脚本只能
 * 是补救通道。现在三处接入：
 *   1. 周日 18:00 出完下周卷 → 立即给整周挂
 *   2. 每日 06:30 兜底出卷后 → 给当天挂
 *   3. 每日 06:45 独立保险 cron（本服务的 @Cron）—— 前两条哪条漏了
 *      都由它兜住（教师手工重出卷、force 重生成之后也靠它补）
 *
 * 幂等：snapshotContent.vocabTrack=true 标记，挂过的卷子跳过 ——
 * 三处重复调用无害。
 *
 * 设计理由见 vocab-question.ts 顶部：背单词此前没有回报，把它放进
 * 唯一 100% 生效的强制流程（早测）里。只动轻量两层（ielts_light /
 * ielts_simplified），其余三层学生时间已经很紧，教师明确不加。
 */
@Injectable()
export class VocabAttachService {
  private readonly logger = new Logger('VocabAttach');

  private static readonly TARGET_LEVELS = ['ielts_light', 'ielts_simplified'];

  constructor(private readonly prisma: PrismaService) {}

  /** 本周第几天（周一=0）—— 主线词按它轮转，一周内不重复。 */
  private dayIndexOf(dateIso: string): number {
    const d = new Date(`${dateIso}T00:00:00Z`);
    return (d.getUTCDay() + 6) % 7;
  }

  /**
   * 给某一天的轻量层卷子挂词汇题。幂等，可安全重复调用。
   * 返回挂了几道（0 = 都挂过了或没有目标场次）。
   */
  async attachForDate(dateIso: string): Promise<{ attached: number; problems: string[] }> {
    const problems: string[] = [];
    let attached = 0;
    const dayStart = new Date(`${dateIso}T00:00:00.000Z`);
    const at = new Date(`${dateIso}T00:30:00Z`); // 早测挂钟（08:30 SGT）
    const dayIdx = this.dayIndexOf(dateIso);

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { date: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } },
      select: { id: true, level: true, paperAssignment: { select: { paperId: true } } },
    });

    for (const s of sessions) {
      if (!VocabAttachService.TARGET_LEVELS.includes(s.level)) continue;
      if (!levelPushesWordlist(s.level)) {
        problems.push(`${s.level}: 词表推送未开`);
        continue;
      }
      const paperId = s.paperAssignment.paperId;
      const track = resolveWeeklyTrack(s.level, at);
      if (!track?.items.length) {
        // 周日 author 下周词表是人工流程 —— 词表缺失必须喊出来，
        // 否则又是一次静默断链
        problems.push(`${s.level}: 本周没有主线词表`);
        continue;
      }

      const existing = await this.prisma.paperQuestion.findMany({
        where: { paperId },
        select: { id: true, sortOrder: true, marks: true, snapshotContent: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (existing.some((q) => (q.snapshotContent as { vocabTrack?: boolean })?.vocabTrack)) {
        continue; // 幂等：挂过了
      }
      if (!existing.length) {
        problems.push(`${s.level}: 卷子没有题（还没出卷？）`);
        continue;
      }

      const picked = pickWordsForDay(track.items, dayIdx, 2);
      const allWords = track.items.map((i) => i.word.toLowerCase());
      const entries = await this.prisma.dictEntry.findMany({
        where: { word: { in: allWords } },
        select: { word: true, translation: true },
      });
      const byWord = new Map(entries.map((e) => [e.word.toLowerCase(), e.translation ?? '']));
      const pool = entries
        .map((e) => ({ word: e.word, translation: e.translation ?? '' }))
        .filter((e) => e.translation);

      const specs: VocabQuestionSpec[] = [];
      const seed = seedFor(dateIso, s.level);
      const w1 = picked[0];
      if (w1) {
        const t1 = {
          word: w1.word,
          context: w1.context,
          translation: byWord.get(w1.word.toLowerCase()) ?? '',
        };
        const q1 = buildClozeQuestion(
          t1,
          pickWordDistractors(t1.word, t1.translation, pool, seed),
          seed,
        );
        if (q1) specs.push(q1);
        else problems.push(`${s.level}: ${w1.word} 出不了填空题`);
      }
      const w2 = picked[1] ?? picked[0];
      if (w2) {
        const t2 = {
          word: w2.word,
          context: w2.context,
          translation: byWord.get(w2.word.toLowerCase()) ?? '',
        };
        if (!t2.translation) {
          problems.push(`${s.level}: ${w2.word} 词典无释义`);
        } else {
          const q2 = buildMeaningQuestion(t2, pickMeaningDistractors(t2, pool, seed * 3), seed * 3);
          if (q2) specs.push(q2);
        }
      }
      if (!specs.length) {
        problems.push(`${s.level}: 一道也没出成`);
        continue;
      }

      const sample = await this.prisma.paperQuestion.findFirst({
        where: { paperId },
        select: {
          question: { select: { subjectId: true, componentId: true, createdById: true } },
        },
      });
      if (!sample) {
        problems.push(`${s.level}: 找不到同卷题目定 subject`);
        continue;
      }
      const maxOrder = existing.reduce((m, q) => Math.max(m, q.sortOrder), 0);

      for (const [i, spec] of specs.entries()) {
        const q = await this.prisma.question.create({
          data: {
            subjectId: sample.question.subjectId,
            componentId: sample.question.componentId,
            createdById: sample.question.createdById,
            questionType: 'mcq',
            marks: 1,
            estimatedTimeMin: 0.5,
            difficulty: 2,
            // 自撰词汇题 —— 版权铁律 original_school
            sourceType: 'original_school',
            status: 'active',
            content: {
              stem: spec.stem,
              taskType: spec.taskType,
              vocabTrack: true,
              headword: spec.headword,
            },
            answerContent: { text: spec.answerKey },
            options: spec.options as unknown as object,
          },
          select: { id: true },
        });
        await this.prisma.paperQuestion.create({
          data: {
            paperId,
            questionId: q.id,
            sortOrder: maxOrder + i + 1,
            marks: 1,
            snapshotContent: {
              stem: spec.stem,
              taskType: spec.taskType,
              vocabTrack: true,
              headword: spec.headword,
              vocabQtype: spec.qtype,
            },
            snapshotAnswer: { text: spec.answerKey },
            snapshotOptions: spec.options as unknown as object,
          },
        });
        attached++;
      }
      this.logger.log(`attached ${specs.length} vocab questions: ${dateIso} ${s.level}`);
    }

    if (problems.length) {
      this.logger.warn(`vocab attach ${dateIso}: ${problems.join(' | ')}`);
    }
    return { attached, problems };
  }

  /** 给一整周（周一起 5 个上学日）挂。周日出卷后调用。 */
  async attachForWeek(weekStartIso: string): Promise<number> {
    let total = 0;
    const monday = new Date(`${weekStartIso}T00:00:00Z`);
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      total += (await this.attachForDate(d)).attached;
    }
    return total;
  }
}
