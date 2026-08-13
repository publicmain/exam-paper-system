import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  cleanMarkerComment,
  cleanStem,
  humanizeAnswer,
  translateAnswerLetter,
} from './mistake-humanize';

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
/** SGT 自然日（YYYY-MM-DD）。练习的"隔天"判定必须按新加坡日历日。 */
export function sgtDayOf(d: Date): string {
  return new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 练习一次后的新状态。纯函数，可测。
 *
 * 销账规则（v2，替代纯自报的「已弄懂」）：
 *   做对 → streak 从 0 升 1；**隔天**再做对 → 2 → 自动销账。
 *   同一天内反复做对不叠加 —— 刚看完答案马上重做是短时记忆，不算掌握。
 *   做错 → streak 归零。
 * 这是 FSRS 的极简版：错题量级小（人均几十条），两点确认足够，
 * 不需要完整的记忆曲线调度。
 */
export function nextPracticeState(
  prev: { correctStreak: number; lastPracticedAt: Date | null },
  correct: boolean,
  now: Date,
): { correctStreak: number; resolved: boolean } {
  if (!correct) return { correctStreak: 0, resolved: false };
  const today = sgtDayOf(now);
  const lastDay = prev.lastPracticedAt ? sgtDayOf(prev.lastPracticedAt) : null;
  let streak = prev.correctStreak;
  if (streak <= 0) streak = 1;
  else if (lastDay !== today) streak += 1;
  return { correctStreak: streak, resolved: streak >= 2 };
}

/**
 * 练习时的作答方式，由题型决定：
 *   tfng   —— 固定三键（TRUE/FALSE/NOT GIVEN 或 YES/NO/NOT GIVEN）
 *   letters —— 段落字母键（从原文的 "Paragraph X" 标记推出来）
 *   reveal —— 主观题：想好再翻卡，自评对错（无 AI，Anki 模式）
 */
export function practiceKindOf(taskType: string, passage: string): {
  kind: 'tfng' | 'letters' | 'reveal';
  options: string[];
} {
  if (taskType === 'true_false_not_given') return { kind: 'tfng', options: ['TRUE', 'FALSE', 'NOT GIVEN'] };
  if (taskType === 'yes_no_not_given') return { kind: 'tfng', options: ['YES', 'NO', 'NOT GIVEN'] };
  // 只有段落匹配（答案=段落字母）能从原文推选项。matching_headings 的
  // 答案是标题编号（i–x），跟段落字母不是一套体系，走 snapshotOptions
  // 或翻卡兜底。
  if (taskType === 'matching_information') {
    const letters = [...new Set([...passage.matchAll(/Paragraph\s+([A-Z])\b/g)].map((m) => m[1]))];
    if (letters.length >= 3) return { kind: 'letters', options: letters.sort() };
  }
  return { kind: 'reveal', options: [] };
}

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
            // 收录时就清洗：原始题干前 400 字常常全是答题须知，真正的
            // 问题被截掉（8 分 summary 题实测正好断在 "…ageing popul"）。
            // 存清洗后的，600 字上限绰绰有余；原始题干在 PaperQuestion
            // 里永远可查（本表存了 paperQuestionId）。
            stem: (cleanStem(stem) || stem).slice(0, 600),
            studentAnswer: studentAnswer.slice(0, 1000),
            // 2000 而不是 1000：8 分 summary 的 mark scheme 是
            // CONTENT POINTS + STYLE + MODEL 三段，1000 正好把末尾的
            // MODEL 范文切掉，而范文恰恰是学生最该照着看的东西。
            correctAnswer: correctAnswer.slice(0, 2000),
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

  /**
   * 学生的错题本。
   *
   * 出口处把「给老师判分用的东西」翻成「学生看得懂的东西」（见
   * mistake-humanize）：题干剥掉答题须知、mark scheme 拆成要点并抽出
   * 范文。数据库保留原文 —— 老师复核判分依据时仍要看完整 mark scheme。
   */
  async listForStudent(studentId: string, opts?: { includeResolved?: boolean; limit?: number }) {
    const rows = await this.prisma.mistakeEntry.findMany({
      where: {
        studentId,
        ...(opts?.includeResolved ? {} : { resolved: false }),
      },
      orderBy: [{ quizDay: 'desc' }, { createdAt: 'desc' }],
      // 全量给（上限 200 兜底）。之前默认 30 条踩过坑：标题写 58、
      // 列表只有 30，学生数不出来另外 28 条在哪。加载多少显示多少，
      // 分批渲染是前端的事。
      take: Math.min(opts?.limit ?? 200, 200),
    });
    const total = await this.prisma.mistakeEntry.count({ where: { studentId, resolved: false } });
    // 按题型统计 —— 回答"我到底哪类题一直错"
    const byType = await this.prisma.mistakeEntry.groupBy({
      by: ['taskType'],
      where: { studentId, resolved: false },
      _count: true,
      orderBy: { _count: { taskType: 'desc' } },
    });

    // 解析/证据句存在 PaperQuestion 的 answer JSON 里（explanation /
    // evidence 字段，出卷时或事后补写）。**读取时** join 而不是收录时
    // 冻结 —— 解析是后补的、还会改，冻结快照只该冻学生的作答现场。
    const extras = await this.answerExtras(rows.map((r) => r.paperQuestionId));

    // 同一天内：长答题（老师评语）在前，词义题次之，客观题最后 ——
    // 最贵的内容不能被字母卡埋掉。
    const reasonRank = { long_answer: 0, vocabulary: 1, repeated_tasktype: 2 } as const;
    rows.sort((a, b) =>
      a.quizDay !== b.quizDay
        ? b.quizDay.localeCompare(a.quizDay)
        : (reasonRank[a.reason] ?? 9) - (reasonRank[b.reason] ?? 9),
    );

    return {
      total,
      byTaskType: byType.map((t) => ({ taskType: t.taskType, count: t._count })),
      entries: rows.map((r) => {
        const { points, model } = humanizeAnswer(r.correctAnswer);
        const extra = r.paperQuestionId ? extras.get(r.paperQuestionId) : undefined;
        return {
          ...r,
          /** 只留真正在问的那句话 */
          stem: cleanStem(r.stem) || r.stem,
          /** 判断题：字母翻译回 TRUE/FALSE/NOT GIVEN */
          correctAnswer: translateAnswerLetter(r.taskType, r.correctAnswer),
          /** 客观题的判分流水（"段3:B,正解 F。同上。"）不给学生看 */
          markerComment: cleanMarkerComment(r.markerComment, r.maxMarks),
          /** 答案要点（已去掉 MP1/①/判分指令） */
          answerPoints: points.map((p) => translateAnswerLetter(r.taskType, p)),
          /** 范文，长答题才有 */
          answerModel: model,
          /** 为什么是这个答案（中文，手写） */
          explanation: extra?.explanation ?? '',
          /** 原文里的证据句 */
          evidence: extra?.evidence ?? '',
        };
      }),
    };
  }

  /** 从 PaperQuestion answer JSON 批量取 explanation/evidence。 */
  private async answerExtras(paperQuestionIds: Array<string | null>) {
    const ids = [...new Set(paperQuestionIds.filter((x): x is string => !!x))];
    const map = new Map<string, { explanation: string; evidence: string }>();
    if (!ids.length) return map;
    const pqs = await this.prisma.paperQuestion.findMany({
      where: { id: { in: ids } },
      select: { id: true, snapshotAnswer: true, overrideAnswer: true },
    });
    for (const pq of pqs) {
      const a = (pq.overrideAnswer ?? pq.snapshotAnswer) as any;
      if (a && typeof a === 'object') {
        map.set(pq.id, {
          explanation: String(a.explanation ?? ''),
          evidence: String(a.evidence ?? ''),
        });
      }
    }
    return map;
  }

  /**
   * 今日待练队列。带原文 —— 段落匹配/判断题离开原文没法真正重做，
   * 这是错题本从「档案馆」变「训练场」的关键（content JSON 里每道题
   * 都存了完整 passage，直接下发）。
   *
   * 选题顺序：从没练过的优先（correctStreak 0 → 1），同级里新错的
   * 优先 —— 记忆还热，证据句读得进去。每次最多 10 道，练完明天再来。
   */
  async practiceQueue(studentId: string, limit = 10) {
    const todayStartUtc = new Date(Date.parse(`${sgtDayOf(new Date())}T00:00:00+08:00`));
    const rows = await this.prisma.mistakeEntry.findMany({
      where: {
        studentId,
        resolved: false,
        OR: [{ lastPracticedAt: null }, { lastPracticedAt: { lt: todayStartUtc } }],
      },
      orderBy: [{ correctStreak: 'asc' }, { quizDay: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 20),
    });
    const remaining = await this.prisma.mistakeEntry.count({
      where: {
        studentId,
        resolved: false,
        OR: [{ lastPracticedAt: null }, { lastPracticedAt: { lt: todayStartUtc } }],
      },
    });

    const ids = rows.map((r) => r.paperQuestionId).filter((x): x is string => !!x);
    const pqs = ids.length
      ? await this.prisma.paperQuestion.findMany({
          where: { id: { in: ids } },
          select: { id: true, snapshotContent: true, overrideContent: true, snapshotAnswer: true, overrideAnswer: true, snapshotOptions: true },
        })
      : [];
    const byId = new Map(pqs.map((p) => [p.id, p]));

    return {
      remaining,
      items: rows.map((r) => {
        const pq = r.paperQuestionId ? byId.get(r.paperQuestionId) : undefined;
        const content = (pq?.overrideContent ?? pq?.snapshotContent) as any;
        const answerObj = (pq?.overrideAnswer ?? pq?.snapshotAnswer) as any;
        const passage = String(content?.passage ?? '');
        let { kind, options } = practiceKindOf(r.taskType, passage) as {
          kind: 'tfng' | 'letters' | 'reveal' | 'options';
          options: Array<string | { key: string; text: string }>;
        };
        // MCQ / 情绪配对：题库存了完整选项（snapshotOptions），能真正重选
        const so = pq?.snapshotOptions as any;
        if (kind === 'reveal' && Array.isArray(so) && so.length >= 2 && so[0]?.key) {
          kind = 'options';
          options = so.map((o: any) => ({ key: String(o.key), text: String(o.text ?? '') }));
        }
        const { points, model } = humanizeAnswer(r.correctAnswer);
        return {
          id: r.id,
          taskType: r.taskType,
          reason: r.reason,
          passageTitle: r.passageTitle,
          quizDay: r.quizDay,
          stem: cleanStem(r.stem) || r.stem,
          correctAnswer: translateAnswerLetter(r.taskType, r.correctAnswer),
          myOldAnswer: r.studentAnswer,
          markerComment: cleanMarkerComment(r.markerComment, r.maxMarks),
          answerPoints: points.map((p) => translateAnswerLetter(r.taskType, p)),
          answerModel: model,
          explanation: String((answerObj as any)?.explanation ?? ''),
          evidence: String((answerObj as any)?.evidence ?? ''),
          practiceKind: kind,
          options,
          correctStreak: r.correctStreak,
          passage,
          submissionId: r.submissionId,
          paperQuestionId: r.paperQuestionId,
        };
      }),
    };
  }

  /** 记录一次练习结果；隔天第二次做对自动销账。 */
  async practiceResult(studentId: string, id: string, correct: boolean) {
    const entry = await this.prisma.mistakeEntry.findFirst({
      where: { id, studentId },
      select: { correctStreak: true, lastPracticedAt: true, resolved: true },
    });
    if (!entry) return { ok: false as const };
    const now = new Date();
    const next = nextPracticeState(entry, correct, now);
    await this.prisma.mistakeEntry.update({
      where: { id },
      data: {
        practiceCount: { increment: 1 },
        correctStreak: next.correctStreak,
        lastPracticedAt: now,
        ...(next.resolved && !entry.resolved
          ? { resolved: true, resolvedAt: now }
          : {}),
      },
    });
    return { ok: true as const, correctStreak: next.correctStreak, resolved: next.resolved };
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
