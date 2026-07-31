import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { VocabService, normalizeWord } from './vocab.service';

/**
 * 学生生词本（P2）。
 *
 * 身份模型沿用 /my-history 那一套：公开接口 + 姓名匹配（+ 同名时用
 * studentId 消歧），学生不需要登录。所有写操作都必须先把姓名解析成
 * 唯一学生，解析不出来就拒绝 —— 绝不允许凭姓名字符串直接写库。
 *
 * 铁律：本服务不调用任何 LLM。释义来自 DictEntry（本地词典）。
 */
@Injectable()
export class StudentWordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vocab: VocabService,
  ) {}

  /**
   * 姓名 → 唯一学生。与 morning-quiz 的 resolveStudentByName 同口径：
   * 必须是某个未归档班级的在读学生，避免幽灵账号。
   */
  async resolveStudent(rawName: string, studentId?: string) {
    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    if (name.length > 50) throw new BadRequestException({ code: 'name_too_long' });
    const candidates = await this.prisma.user.findMany({
      where: {
        name,
        isActive: true,
        classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
        ...(studentId ? { id: studentId } : {}),
      },
      select: { id: true, name: true },
    });
    if (candidates.length === 0) throw new NotFoundException({ code: 'student_not_found' });
    if (candidates.length > 1) {
      throw new ForbiddenException({
        code: 'multiple_students_with_same_name',
        candidates: candidates.map((c) => ({ studentId: c.id, name: c.name })),
      });
    }
    return candidates[0];
  }

  /**
   * 加入生词本。
   *
   * headword 必须是词典里真实存在的条目 —— 由服务端重新查一次词典决定，
   * 不信任前端传来的 headword（否则学生可以往生词本里塞任意字符串）。
   */
  async addWord(input: {
    studentName: string;
    studentId?: string;
    word: string;
    contextSentence?: string;
    sourcePaperQuestionId?: string;
    sourcePassageTitle?: string;
  }) {
    const student = await this.resolveStudent(input.studentName, input.studentId);
    const hit = await this.vocab.lookup(input.word);
    if (!hit) throw new BadRequestException({ code: 'word_not_in_dictionary' });

    const existing = await this.prisma.studentWord.findUnique({
      where: { studentId_headword: { studentId: student.id, headword: hit.word } },
      select: { id: true },
    });
    if (existing) return { created: false as const, headword: hit.word };

    await this.prisma.studentWord.create({
      data: {
        studentId: student.id,
        headword: hit.word,
        surfaceForm: normalizeWord(input.word),
        sourceType: 'click',
        contextSentence: (input.contextSentence ?? '').slice(0, 500),
        sourcePaperQuestionId: input.sourcePaperQuestionId ?? null,
        sourcePassageTitle: input.sourcePassageTitle ?? null,
      },
    });
    return { created: true as const, headword: hit.word };
  }

  /** 移出生词本（只能删自己的）。 */
  async removeWord(input: { studentName: string; studentId?: string; headword: string }) {
    const student = await this.resolveStudent(input.studentName, input.studentId);
    const res = await this.prisma.studentWord.deleteMany({
      where: { studentId: student.id, headword: normalizeWord(input.headword) },
    });
    return { deleted: res.count };
  }

  /** 我的生词本（带词典释义）。 */
  async listWords(input: { studentName: string; studentId?: string }) {
    const student = await this.resolveStudent(input.studentName, input.studentId);
    const words = await this.prisma.studentWord.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const entries = await this.prisma.dictEntry.findMany({
      where: { word: { in: words.map((w) => w.headword) } },
    });
    const byWord = new Map(entries.map((e) => [e.word, e]));
    const now = Date.now();
    return {
      student: { id: student.id, name: student.name },
      total: words.length,
      dueCount: words.filter((w) => w.due.getTime() <= now && w.state !== 'known').length,
      words: words.map((w) => {
        const e = byWord.get(w.headword);
        return {
          headword: w.headword,
          surfaceForm: w.surfaceForm,
          sourceType: w.sourceType,
          sourcePassageTitle: w.sourcePassageTitle,
          contextSentence: w.contextSentence,
          state: w.state,
          reps: w.reps,
          lapses: w.lapses,
          due: w.due.toISOString(),
          createdAt: w.createdAt.toISOString(),
          phonetic: e?.phonetic ?? null,
          translation: e?.translation ?? '',
          tag: e?.tag ?? [],
        };
      }),
    };
  }

  /**
   * 判分后自动采集：把一份提交里「答错的词义题目标词」写进生词本。
   *
   * 这是本项目既有的「批改即采集」哲学（错题本 StudentMistakes 的注释）
   * 在词汇上的复用 —— 最需要生词本的学生恰恰是最不会主动加词的那批，
   * 见 PRD §1.2 的学情数据。
   *
   * 目标词来源（按优先级）：
   *   1. snapshotContent.targetWord   —— vocab-in-context 题型的显式字段
   *   2. 题干里被引号括起来的词        —— O-Level §B 词义题的固定写法：
   *      What does the word 'coax' in ... suggest?
   *
   * 幂等：已在生词本里的词跳过。
   */
  async harvestFromSubmission(submissionId: string) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        studentId: true,
        status: true,
        scripts: {
          select: {
            awardedMarks: true,
            paperQuestion: {
              select: {
                id: true,
                marks: true,
                snapshotContent: true,
              },
            },
          },
        },
      },
    });
    if (!sub || sub.status === 'practice') return { added: 0, candidates: 0 };

    const wanted: Array<{ word: string; qid: string; title: string | null; sentence: string }> = [];
    for (const s of sub.scripts) {
      // 只采集"确实失分"的题：满分不采
      if (s.awardedMarks == null) continue;
      if (s.awardedMarks >= (s.paperQuestion.marks ?? 1)) continue;
      const sc = (s.paperQuestion.snapshotContent ?? {}) as Record<string, unknown>;
      const title = typeof sc.passageTitle === 'string' ? sc.passageTitle : null;
      const stem = typeof sc.stem === 'string' ? sc.stem : '';
      const passage = typeof sc.passage === 'string' ? sc.passage : '';
      const target =
        typeof sc.targetWord === 'string' && sc.targetWord.trim()
          ? sc.targetWord.trim()
          : extractQuotedWord(stem);
      if (!target) continue;
      wanted.push({
        word: target,
        qid: s.paperQuestion.id,
        title,
        sentence: contextFor(passage, stem, target),
      });
    }

    let added = 0;
    for (const w of wanted) {
      const hit = await this.vocab.lookup(w.word);
      if (!hit) continue;
      const exists = await this.prisma.studentWord.findUnique({
        where: { studentId_headword: { studentId: sub.studentId, headword: hit.word } },
        select: { id: true },
      });
      if (exists) continue;
      await this.prisma.studentWord.create({
        data: {
          studentId: sub.studentId,
          headword: hit.word,
          surfaceForm: normalizeWord(w.word),
          sourceType: 'wrong_answer',
          sourcePaperQuestionId: w.qid,
          sourcePassageTitle: w.title,
          contextSentence: w.sentence.slice(0, 500),
        },
      });
      added++;
    }
    return { added, candidates: wanted.length };
  }
}

/**
 * 从题干里抽被引号括起来的单词。
 * O-Level 词义题固定写法：What does the word 'coax' in '...' (Paragraph 1) suggest?
 * 取**第一个**单引号/弯引号里的单个词（多词的是引用句子，不是目标词）。
 */
export function extractQuotedWord(stem: string): string | null {
  const re = /['‘’"“”]([A-Za-z][A-Za-z'’-]{1,30})['‘’"“”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stem))) {
    const w = m[1];
    if (!w.includes(' ')) return w;
  }
  return null;
}

/**
 * 把文章切成句子。
 *
 * 文章正文带 "Paragraph 3" 这样的段落标记和换行，朴素的
 * `split(/(?<=[.!?])\s+/)` 会出两种毛病（真实数据实测）：
 *   - 句末是 `liked.'` 这种「句号+引号」时不切，于是把上一句和下一句连在一起
 *   - 段落标记被当成句子的一部分 → 卡片上下文变成 "Paragraph 1\nAh Seng's…"
 * 这里先按换行拆、丢掉段落标记行，再按句末标点（允许尾随引号）切。
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    if (/^Paragraph\s+[0-9A-H]+$/i.test(t)) continue; // 段落标记行
    for (const s of t.split(/(?<=[.!?]['"’”]?)\s+/)) {
      const v = s.trim();
      if (v) out.push(v);
    }
  }
  return out;
}

/** 找出文本里包含该词的第一句。 */
export function firstSentenceWith(text: string, word: string): string {
  const lower = word.toLowerCase();
  for (const s of splitSentences(text)) {
    if (s.toLowerCase().includes(lower)) return s;
  }
  return text.slice(0, 200).trim();
}

/**
 * 生词卡的上下文句 —— **必须来自文章原文，不能用题干**。
 *
 * 复习卡会把该词从句子里挖空让学生回忆。如果拿题干当上下文，卡片会变成
 *   "What does the word '___' in 'frail now, her back curved…' suggest?"
 * —— 挖掉的是题目里的引用词，学生看到的是一道题而不是自然语境，卡片是坏的。
 * （这个缺陷是 P4 上线后拿真实数据做端到端验证时发现的。）
 *
 * 优先级：
 *   1. 文章原文里含该词的第一句
 *   2. 题干里被引号括起来的那段原文摘录（O-Level 词义题固定写法：
 *      What does the word 'frail' in 'frail now, her back curved like a
 *      question mark' (Paragraph 2) suggest? —— 第二段引文就是原文）
 *   3. 实在没有才退回题干
 */
export function contextFor(passage: string, stem: string, target: string): string {
  if (passage) {
    const s = firstSentenceWith(passage, target);
    // firstSentenceWith 找不到时会返回开头截断，这里要求确实含该词才采用
    if (s.toLowerCase().includes(target.toLowerCase())) return s;
  }
  // 题干里第二段引文（长度 > 目标词本身）通常就是原文摘录
  const quotes = [...stem.matchAll(/['‘’"“”]([^'‘’"“”]{4,200})['‘’"“”]/g)].map((m) => m[1]);
  const excerpt = quotes.find(
    (q) => q.toLowerCase().includes(target.toLowerCase()) && q.trim().length > target.length + 3,
  );
  if (excerpt) return excerpt.trim();
  return firstSentenceWith(stem, target);
}
