import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { VocabService } from './vocab.service';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

/**
 * 教师端生词视图（P4）。
 *
 * 回答老师每天早上真正关心的一个问题：**今天该讲哪几个词**。
 * 数据来源是学生自己的生词本 —— 尤其是判分时自动收录的 wrong_answer 词，
 * 那是全班真实的词汇缺口，不是猜的。
 *
 * 铁律：无任何 LLM 调用。
 */
@Injectable()
export class VocabTeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vocab: VocabService,
  ) {}

  /**
   * 班级高频生词榜。
   *
   * 按「有多少个学生把这个词收进了生词本」排序，答错自动收录的权重更高
   * （那是确凿的失分证据，而学生主动点的可能只是好奇）。
   */
  async classTop(classId: string, actor: ActorCtx, opts?: { limit?: number; days?: number }) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
    const days = Math.min(Math.max(opts?.days ?? 30, 1), 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.studentWord.findMany({
      where: {
        createdAt: { gte: since },
        student: {
          classEnrollments: { some: { classId, role: 'student' } },
        },
      },
      select: {
        headword: true,
        sourceType: true,
        studentId: true,
        sourcePassageTitle: true,
        contextSentence: true,
        state: true,
      },
    });

    const agg = new Map<
      string,
      {
        headword: string;
        students: Set<string>;
        wrongAnswer: number;
        clicked: number;
        mastered: number;
        sample: string;
        passages: Set<string>;
      }
    >();
    for (const r of rows) {
      let a = agg.get(r.headword);
      if (!a) {
        a = {
          headword: r.headword,
          students: new Set(),
          wrongAnswer: 0,
          clicked: 0,
          mastered: 0,
          sample: '',
          passages: new Set(),
        };
        agg.set(r.headword, a);
      }
      a.students.add(r.studentId);
      if (r.sourceType === 'wrong_answer') a.wrongAnswer++;
      if (r.sourceType === 'click') a.clicked++;
      if (r.state === 'known') a.mastered++;
      if (!a.sample && r.contextSentence) a.sample = r.contextSentence;
      if (r.sourcePassageTitle) a.passages.add(r.sourcePassageTitle);
    }

    const list = [...agg.values()]
      .map((a) => ({
        headword: a.headword,
        studentCount: a.students.size,
        wrongAnswer: a.wrongAnswer,
        clicked: a.clicked,
        mastered: a.mastered,
        contextSentence: a.sample,
        passages: [...a.passages].slice(0, 3),
        // 答错收录的权重 ×2 —— 那是确凿失分，主动点词只是好奇
        score: a.students.size + a.wrongAnswer,
      }))
      .sort((x, y) => y.score - x.score || y.studentCount - x.studentCount)
      .slice(0, limit);

    const entries = await this.prisma.dictEntry.findMany({
      where: { word: { in: list.map((l) => l.headword) } },
    });
    const byWord = new Map(entries.map((e) => [e.word, e]));

    return {
      classId,
      days,
      totalDistinctWords: agg.size,
      items: list.map((l) => {
        const e = byWord.get(l.headword);
        return {
          ...l,
          phonetic: e?.phonetic ?? null,
          translation: e?.translation ?? '',
          tag: e?.tag ?? [],
        };
      }),
    };
  }

  /**
   * 老师推词给全班：给每个在读学生的生词本插入这些词。
   *
   * 已在某学生本子里的词会跳过（保留其原有的调度进度和来源），
   * 所以重复推送是安全的。
   *
   * 两种入参，可混用：
   *   words: string[]                        整批共用一个 contextSentence
   *   items: Array<{word, context}>          **逐词各自的例句**（推荐）
   *
   * 为什么要逐词例句：生词本相对百词斩类产品的唯一优势就是「复习时
   * 看到的是他自己读过的那一句」。整批共用一句话时，10 个词配同一个
   * 句子，这个优势直接归零 —— 学生看到的是一堆对不上号的卡片。
   */
  async pushWords(
    input: {
      classId: string;
      words?: string[];
      items?: Array<{ word: string; context?: string }>;
      contextSentence?: string;
    },
    actor: ActorCtx,
  ) {
    if (!(await canActOnClass(this.prisma, actor, input.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    // 归一成 {word, context} 列表；words[] 走整批共用句。
    const requested: Array<{ word: string; context: string }> = [
      ...(input.items ?? []).map((it) => ({
        word: it.word,
        context: (it.context ?? input.contextSentence ?? '').slice(0, 500),
      })),
      ...(input.words ?? []).map((w) => ({
        word: w,
        context: (input.contextSentence ?? '').slice(0, 500),
      })),
    ];
    if (!requested.length) throw new BadRequestException({ code: 'words_required' });
    if (requested.length > 50) throw new BadRequestException({ code: 'too_many_words' });

    // 先把每个词落到词典原形；查不到的直接拒绝，不让老师推一个查不到释义的词
    const resolved: Array<{ headword: string; surface: string; context: string }> = [];
    const notFound: string[] = [];
    for (const r of requested) {
      const hit = await this.vocab.lookup(r.word);
      if (hit) resolved.push({ headword: hit.word, surface: r.word.toLowerCase(), context: r.context });
      else notFound.push(r.word);
    }

    const students = await this.prisma.classEnrollment.findMany({
      where: { classId: input.classId, role: 'student', user: { isActive: true } },
      select: { userId: true },
    });

    let created = 0;
    let skipped = 0;
    for (const s of students) {
      for (const r of resolved) {
        const exists = await this.prisma.studentWord.findUnique({
          where: { studentId_headword: { studentId: s.userId, headword: r.headword } },
          select: { id: true },
        });
        if (exists) {
          skipped++;
          continue;
        }
        await this.prisma.studentWord.create({
          data: {
            studentId: s.userId,
            headword: r.headword,
            surfaceForm: r.surface,
            sourceType: 'teacher_push',
            contextSentence: r.context,
          },
        });
        created++;
      }
    }
    return {
      students: students.length,
      wordsResolved: resolved.map((r) => r.headword),
      notFound,
      created,
      skipped,
    };
  }

  /**
   * 效果度量（PRD §7）—— 生词本到底有没有用。
   *
   * 大多数背单词产品做不到这件事，因为它们没有学生的考试数据；本系统有。
   * 这里给出班级层面的采集与复习执行情况，以及"已掌握"的转化率。
   */
  async classStats(classId: string, actor: ActorCtx) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const students = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { isActive: true } },
      select: { userId: true, user: { select: { name: true } } },
    });
    const ids = students.map((s) => s.userId);
    if (!ids.length) return { classId, students: 0, rows: [] };

    const words = await this.prisma.studentWord.groupBy({
      by: ['studentId', 'state'],
      where: { studentId: { in: ids } },
      _count: true,
    });
    const reviews = await this.prisma.wordReviewLog.groupBy({
      by: ['studentWordId'],
      where: { studentWord: { studentId: { in: ids } } },
      _count: true,
    });
    const reviewCount = reviews.reduce((a, r) => a + r._count, 0);

    const byStudent = new Map<string, { total: number; known: number }>();
    for (const w of words) {
      const cur = byStudent.get(w.studentId) ?? { total: 0, known: 0 };
      cur.total += w._count;
      if (w.state === 'known') cur.known += w._count;
      byStudent.set(w.studentId, cur);
    }

    return {
      classId,
      students: students.length,
      totalReviews: reviewCount,
      rows: students
        .map((s) => {
          const v = byStudent.get(s.userId) ?? { total: 0, known: 0 };
          return { studentId: s.userId, name: s.user.name, words: v.total, mastered: v.known };
        })
        .sort((a, b) => b.words - a.words),
    };
  }
}
