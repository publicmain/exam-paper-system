import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * 错题本（2026-08-13 老师需求）。
 *
 * ## 为什么不是"每道错题都收"
 *
 * 全班每天约 34 份卷、每份 13-19 题,全收的话一周就是上千条。错题本
 * 一旦变成"又一个刷不完的长列表",学生打开一次就再也不打开了 ——
 * 我们已经在生词本上验证过这条:80 条到期未复习积压着没人动。
 * 所以这张表的第一设计目标是**短**,短到学生愿意从头看到尾。
 *
 * ## 四条收录规则（阈值的由来）
 *
 * 1. **空白不收**。这是最重要的一条。上线两周的数据:准时到的学生
 *    空白率 26.5%,迟到 20 分钟以上的高达 95.6%。空白是**行为问题**
 *    不是知识问题 —— 学生不是"不会",是"没写"。把空白塞进错题本,
 *    等于用一堆"你没写"淹掉真正值得复盘的那几道。空白率有它自己的
 *    指标盯着(技能画像、周报),不该混进来。
 *
 * 2. **同一题型重复错才收**（近 30 天同 taskType 错 ≥2 次）。
 *    偶尔错一道段落匹配是运气,连着错才是能力缺口。这条把
 *    "今天手滑"和"这类题我一直不行"分开 —— 后者才值得单独列出来。
 *
 * 3. **词义题一律收**（能提取出具体单词的）。它天然对应一个可行动的
 *    对象:那个单词。收进来的同时推给生词本,形成闭环。
 *
 * 4. **长答题（≥2 分）一律收**。老师批改时逐条写了评语,那条评语是
 *    整个流程里最贵的教学资产 —— 学生在成绩页看一眼就永远消失,
 *    是巨大的浪费。收进错题本,它就能被反复回看。
 *
 * 收录时**冻结快照**(题干/答案/评语/正确答案),因为卷子可能被改、
 * 分数可能被重判,而错题本必须能长期回看。
 */

/** 近 30 天内同题型错几次才算"反复错"。2 是刻意定低的 —— 一周只有
 *  4 场早测,每场每题型 3-4 道,阈值定高了整学期都触发不了。 */
const REPEAT_THRESHOLD = 2;
const REPEAT_WINDOW_DAYS = 30;

export type MistakeReasonKey = 'repeated_tasktype' | 'vocabulary' | 'long_answer';

export interface ScriptForCollect {
  submissionId: string;
  paperQuestionId: string;
  taskType: string;
  passageTitle: string;
  stem: string;
  studentAnswer: string;
  correctAnswer: string;
  markerComment: string;
  awarded: number;
  maxMarks: number;
}

/** 从题干里抽出被考的那个单词（词义题）。与 student-word.service 的
 *  extractQuotedWord 同口径:只认明确在问词义的题干,不猜。 */
export function extractVocabWord(stem: string): string {
  const s = stem ?? '';
  const asksAboutWord =
    (/\bwhat does\b/i.test(s) && /\b(suggest|mean|means|imply|convey)\b/i.test(s)) ||
    /\bthe word\s*['‘’"“”]/i.test(s);
  if (!asksAboutWord) return '';
  const m = s.match(/['‘’"“”]([A-Za-z][A-Za-z'’-]{1,30})['‘’"“”]/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * 判定一条答题记录该不该进错题本。纯函数,可测。
 * 返回 null = 不收；否则返回命中的规则。
 */
export function shouldCollect(
  s: { studentAnswer: string; awarded: number; maxMarks: number; stem: string },
  repeatCount: number,
): MistakeReasonKey | null {
  // 满分不收 —— 错题本只装错的
  if (s.awarded >= s.maxMarks) return null;
  // 规则 1：空白不收（行为问题，不是知识问题）
  if (!s.studentAnswer.trim()) return null;
  // 规则 3：词义题一律收（可直接推进生词本）
  if (extractVocabWord(s.stem)) return 'vocabulary';
  // 规则 4：长答题一律收（老师评语是最贵的资产）
  if (s.maxMarks >= 2) return 'long_answer';
  // 规则 2：同题型近期反复错
  if (repeatCount + 1 >= REPEAT_THRESHOLD) return 'repeated_tasktype';
  return null;
}

@Injectable()
export class MistakeService {
  private readonly log = new Logger(MistakeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 判分完成后从一份答卷里采集错题。幂等（唯一键 student+submission+question）。
   * best-effort：采集失败绝不能影响已经写好的分数。
   */
  async collectFromSubmission(submissionId: string, quizDay: string): Promise<{ added: number }> {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        scripts: {
          select: {
            paperQuestionId: true,
            textAnswer: true,
            selectedOption: true,
            awardedMarks: true,
            markerComment: true,
            paperQuestion: {
              select: {
                marks: true,
                snapshotContent: true,
                overrideContent: true,
                snapshotAnswer: true,
                overrideAnswer: true,
              },
            },
          },
        },
      },
    });
    if (!sub) return { added: 0 };

    // 该生近 30 天各题型的**真实错题次数** —— 规则 2 的依据。
    //
    // ⚠️ 这里必须查 AnswerScript 而不是查已收录的 MistakeEntry。
    // 2026-08-13 首次回填时踩到:原实现用"已收录条数"当计数,而规则 2 又
    // 规定第一次错不收 —— 于是计数永远停在 0,阈值永远达不到,形成死锁。
    // 表现是 119 条回填全部来自 O-Level 的长答/词义题(那两条规则不依赖
    // 计数),而 IELTS 的 47 道段落匹配错题一条都没进来。
    // 计数问的是"他错过几次",不是"我们收过几次",两者不能混。
    const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 86400_000);
    const prior = await this.prisma.$queryRaw<Array<{ taskType: string; n: number }>>`
      SELECT COALESCE(
               COALESCE(pq."overrideContent", pq."snapshotContent")->>'taskType',
               'unknown'
             ) AS "taskType",
             COUNT(*)::int AS n
      FROM "AnswerScript" sc
      JOIN "StudentSubmission" s2 ON s2.id = sc."submissionId"
      JOIN "PaperQuestion" pq ON pq.id = sc."paperQuestionId"
      WHERE s2."studentId" = ${sub.studentId}
        AND s2.id <> ${sub.id}            -- 不含当前这份，否则"第一次错"就已达阈值
        AND sc."awardedMarks" IS NOT NULL
        AND sc."awardedMarks" < pq.marks
        AND COALESCE(sc."textAnswer", sc."selectedOption", '') <> ''
        AND sc."updatedAt" >= ${since}
      GROUP BY 1`;
    const priorByType = new Map(prior.map((p) => [p.taskType, Number(p.n)]));

    let added = 0;
    for (const sc of sub.scripts) {
      if (sc.awardedMarks == null) continue; // 还没判的跳过
      const content = (sc.paperQuestion.overrideContent ?? sc.paperQuestion.snapshotContent) as any;
      const answerObj = (sc.paperQuestion.overrideAnswer ?? sc.paperQuestion.snapshotAnswer) as any;
      const taskType = String(content?.taskType ?? content?.questionType ?? 'unknown');
      const stem = String(content?.stem ?? '');
      const studentAnswer = (sc.textAnswer ?? sc.selectedOption ?? '').trim();
      const maxMarks = Number(sc.paperQuestion.marks ?? 1);
      const awarded = Number(sc.awardedMarks);

      const reason = shouldCollect(
        { studentAnswer, awarded, maxMarks, stem },
        priorByType.get(taskType) ?? 0,
      );
      // 计数必须**在收录判定之后、continue 之前**递增：同一份卷里连错
      // 两道同类型时，第二道才算得上"反复错"。放在 continue 之后就会
      // 重演上面那个死锁（不收 → 不计数 → 永远不收）。
      if (awarded < maxMarks && studentAnswer) {
        priorByType.set(taskType, (priorByType.get(taskType) ?? 0) + 1);
      }
      if (!reason) continue;

      const correctAnswer =
        typeof answerObj === 'string' ? answerObj : String(answerObj?.text ?? '');
      try {
        await this.prisma.mistakeEntry.create({
          data: {
            studentId: sub.studentId,
            submissionId: sub.id,
            paperQuestionId: sc.paperQuestionId,
            taskType,
            passageTitle: String(content?.passageTitle ?? '').slice(0, 200),
            stem: stem.slice(0, 400),
            studentAnswer: studentAnswer.slice(0, 1000),
            correctAnswer: correctAnswer.slice(0, 1000),
            markerComment: (sc.markerComment ?? '').slice(0, 1000),
            awarded,
            maxMarks,
            vocabWord: extractVocabWord(stem),
            reason,
            quizDay,
          },
        });
        added++;
      } catch (e: any) {
        if (e?.code !== 'P2002') {
          this.log.warn(`mistake collect failed ${sub.id}/${sc.paperQuestionId}: ${e?.message}`);
        }
      }
    }
    return { added };
  }

  /** 学生的错题本。默认只给未解决的，按最近优先。 */
  async listForStudent(studentId: string, opts?: { includeResolved?: boolean; limit?: number }) {
    const rows = await this.prisma.mistakeEntry.findMany({
      where: {
        studentId,
        ...(opts?.includeResolved ? {} : { resolved: false }),
      },
      orderBy: [{ createdAt: 'desc' }],
      // 默认只给 30 条。回填三周后弱生有 58 条（叶书瑞）—— 一次性
      // 摊开只会让他直接关掉。顶部的"哪类题错得最多"统计才是弱生
      // 真正该看的（我该练什么），逐条是给中等生用的。
      take: Math.min(opts?.limit ?? 30, 200),
    });
    const total = await this.prisma.mistakeEntry.count({ where: { studentId, resolved: false } });
    // 按题型统计 —— 回答"我到底哪类题一直错"
    const byType = await this.prisma.mistakeEntry.groupBy({
      by: ['taskType'],
      where: { studentId, resolved: false },
      _count: true,
      orderBy: { _count: { taskType: 'desc' } },
    });
    return {
      total,
      byTaskType: byType.map((t) => ({ taskType: t.taskType, count: t._count })),
      entries: rows,
    };
  }

  /** 学生标记「已弄懂」。错题本必须能清空，否则只会一直变长。 */
  async resolve(studentId: string, id: string, resolved: boolean) {
    const r = await this.prisma.mistakeEntry.updateMany({
      where: { id, studentId },
      data: { resolved, resolvedAt: resolved ? new Date() : null },
    });
    return { updated: r.count };
  }
}
