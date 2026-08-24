import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { closeNames } from '../common/name-suggest';
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
    if (candidates.length === 0) {
      // 相近姓名建议（学生十问 #9）—— 与 morning-quiz 的 history-by-name
      // 同一套逻辑：输错一个字要给出路，不是一句「找不到」。
      let suggestions: string[] = [];
      if (!studentId) {
        try {
          const roster = await this.prisma.user.findMany({
            where: {
              role: 'student',
              isActive: true,
              classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
            },
            select: { name: true },
          });
          suggestions = closeNames(name, roster.map((r) => r.name));
        } catch { /* 建议失败不影响报错 */ }
      }
      throw new NotFoundException({ code: 'student_not_found', suggestions });
    }
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
   *   3. 填空类题目的**参考答案本身**  —— 雅思卷没有任何引号词义题（实测：
   *      本周雅思 305 次失分里，带引号目标词的是 0 个），只靠 1/2 的话
   *      雅思学生一个词都收不到。而填空答错时，正确答案往往正是那个他不
   *      认识的词（sediment / skeleton / axis / interference…），这才是
   *      雅思那边真正的词汇缺口。
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
                snapshotAnswer: true,
              },
            },
          },
        },
      },
    });
    if (!sub || sub.status === 'practice') return { added: 0, candidates: 0 };

    const wanted: Array<{
      word: string;
      qid: string;
      title: string | null;
      sentence: string;
      needsWorthCheck?: boolean;
    }> = [];
    for (const s of sub.scripts) {
      // 只采集"确实失分"的题：满分不采
      if (s.awardedMarks == null) continue;
      if (s.awardedMarks >= (s.paperQuestion.marks ?? 1)) continue;
      const sc = (s.paperQuestion.snapshotContent ?? {}) as Record<string, unknown>;
      const title = typeof sc.passageTitle === 'string' ? sc.passageTitle : null;
      const stem = typeof sc.stem === 'string' ? sc.stem : '';
      const passage = typeof sc.passage === 'string' ? sc.passage : '';
      let target =
        typeof sc.targetWord === 'string' && sc.targetWord.trim()
          ? sc.targetWord.trim()
          : extractQuotedWord(stem);

      // 来源 3：填空类题目 —— 参考答案本身就是那个词
      let fromAnswer = false;
      if (!target && isCompletionTask(sc.taskType)) {
        const ref = (s.paperQuestion.snapshotAnswer as { text?: unknown } | null)?.text;
        const cand = typeof ref === 'string' ? ref.trim() : '';
        // 只收单个词：多词答案（"calcium carbonate" / "active layer"）不是
        // 单一生词，塞进生词卡既查不到释义也不便复习。
        if (cand && /^[A-Za-z][A-Za-z'’-]*$/.test(cand)) {
          target = cand;
          fromAnswer = true;
        }
      }
      if (!target) continue;
      wanted.push({
        word: target,
        qid: s.paperQuestion.id,
        title,
        sentence: contextFor(passage, stem, target),
        // 由参考答案推出来的词要额外过一道"值不值得背"的筛子，
        // 见 harvest 主循环里的 isWorthLearning。
        needsWorthCheck: fromAnswer,
      });
    }

    // 单次交卷的采集上限（2026-08-24）。
    //
    // 原来无上限：一份 14 题的卷子全错就可能一次进十几个词。生产数据
    // 是 14 天 430 词、复习 156 次，进出比 3:1，68% 的词从没被翻开过 ——
    // 生词本变成只涨不落的数字，学生直接放弃。
    //
    // 宁可漏收也不要淹没：真正重要的词会在后面的卷子里反复出现，还有
    // 机会被收；而一次灌进来的十几个词，学生一个都不会看。
    const HARVEST_CAP_PER_SUBMISSION = 5;
    let added = 0;
    // 同一次交卷里同一个词只收一次（不同题的正确答案可能撞词）
    const takenThisRun = new Set<string>();
    for (const w of wanted) {
      if (added >= HARVEST_CAP_PER_SUBMISSION) break;
      const hit = await this.vocab.lookup(w.word);
      if (!hit) continue;
      if (takenThisRun.has(hit.word.toLowerCase())) continue;
      // 由填空答案推出来的词：只收"确实值得背"的，否则会把 hole / mirror /
      // twice 这种学生明明认识、只是读错了段落的常用词灌进生词本。
      if (w.needsWorthCheck) {
        const entry = await this.prisma.dictEntry.findUnique({ where: { word: hit.word } });
        if (!entry) continue;
        // 屈折形式自身没有词频信号，取原形的记录一并交给过滤器判断
        let lemma: { tag: string[]; oxford: boolean | null; bnc: number | null } | null = null;
        if (!entry.oxford && !(typeof entry.bnc === 'number' && entry.bnc > 0)) {
          const cands = lemmaCandidates(hit.word);
          if (cands.length) {
            const rows = await this.prisma.dictEntry.findMany({
              where: { word: { in: cands } },
              select: { tag: true, oxford: true, bnc: true },
            });
            // 多个候选原形都命中时取"最基础"的那个（牛津核心优先，其次词频最高）
            lemma = rows.sort((a, b) =>
              Number(Boolean(b.oxford)) - Number(Boolean(a.oxford)) ||
              (a.bnc ?? 1e9) - (b.bnc ?? 1e9))[0] ?? null;
          }
        }
        if (!isWorthLearning(entry, lemma)) continue;
      }
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
      takenThisRun.add(hit.word.toLowerCase());
    }
    return { added, candidates: wanted.length };
  }
}

/** 填空类题型：正确答案本身就是一个从原文取出的词。 */
export function isCompletionTask(taskType: unknown): boolean {
  return typeof taskType === 'string' && /completion$/.test(taskType);
}

/**
 * 「这个词值不值得进生词本」。
 *
 * 只对**由填空参考答案推出来的词**生效。填空答错有两种原因：不认识那个词，
 * 或者只是读错了段落。两者无法区分，所以取保守策略 —— 只收对 G11 学生
 * 而言确实可能不认识的词：
 *   · 带进阶考纲标签（雅思 / 托福 / GRE / 六级）
 *   · 且不是牛津 3000 核心词
 *   · 且不是高频词（BNC 排名前 3000）
 *
 * 实测校准（2026-07-31 本周真实错题）：
 *   收：sediment / skeleton / axis / slot / interference / calcium
 *   不收：hole(bnc 1329,核心词) / mirror(2086,核心词) / twice(1501,核心词)
 * 而 chromatophores / leucophores / clast 这类文中专业术语词典本就未收录，
 * 在更前面的 lookup 一步就已经被挡掉。
 */
type FreqSignals = { tag?: string[] | null; oxford?: boolean | null; bnc?: number | null };

/** 这条词典记录到底有没有"常不常用"的信号。屈折形式两个字段都是空的。 */
function hasFreqSignal(e: FreqSignals): boolean {
  return Boolean(e.oxford) || (typeof e.bnc === 'number' && e.bnc > 0);
}

/**
 * 考纲范围（2026-08-14 教师定）：**只考雅思 / O-Level 范围内的词**。
 * 只出现在托福或 GRE 里的词一律不收 —— 本校两条通道都不考这两个试，
 * 背它们对学生没有回报。
 *
 * ECDICT 没有 O-Level 标签，用中学-大学四六级这一串作代理：
 * zk(中考) / gk(高考) / cet4 / cet6 / ky(考研) 覆盖的难度带与
 * O-Level 英语基本重合。判定方式是**排除法**：只要还有 toefl/gre
 * 之外的任何标签就算在范围内，避免漏掉 ECDICT 标注不全的词。
 */
const OUT_OF_SYLLABUS_ONLY = new Set(['toefl', 'gre']);

export function isInSyllabus(tags: string[] | null | undefined): boolean {
  const t = tags ?? [];
  if (t.length === 0) return false;
  if (t.includes('ielts')) return true;
  return t.some((x) => !OUT_OF_SYLLABUS_ONLY.has(x));
}

export function isWorthLearning(e: FreqSignals, lemma?: FreqSignals | null): boolean {
  const tags = e.tag ?? [];
  // 先卡考纲范围：只带 toefl / gre 的词直接不收
  if (!isInSyllabus(tags)) return false;
  const advanced = ['ielts', 'toefl', 'gre', 'cet6'];
  if (!tags.some((t) => advanced.includes(t))) return false;
  if (e.oxford) return false;
  if (typeof e.bnc === 'number' && e.bnc > 0 && e.bnc < 3000) return false;
  // 屈折形式（lakes / minutes / surged）在 ECDICT 里 oxford 与 bnc 都是空的，
  // 上面三条一条也拦不住 —— 于是"湖泊的复数"成了全班覆盖最广的生词。
  // 本身没有词频信号时，回退到原形再判一次：lakes→lake 是牛津核心词，拒。
  if (!hasFreqSignal(e) && lemma) {
    if (lemma.oxford) return false;
    if (typeof lemma.bnc === 'number' && lemma.bnc > 0 && lemma.bnc < 3000) return false;
  }
  return true;
}

/**
 * 猜这个词可能的原形，供上面回退用。只做规则变形，不引入词形还原引擎
 * —— 猜错了顶多是回退不生效，退回原来的行为，不会误伤。
 */
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase().trim();
  const out = new Set<string>();
  const add = (s: string) => { if (s.length >= 3 && s !== w) out.add(s); };
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (/(.)\1ed$/.test(w)) add(w.slice(0, -3)); // stopped → stop
  }
  if (w.endsWith('ing')) {
    add(w.slice(0, -3));
    add(w.slice(0, -3) + 'e'); // wobbling → wobble
    if (/(.)\1ing$/.test(w)) add(w.slice(0, -4)); // running → run
  }
  return [...out];
}

/**
 * 从题干里抽被引号括起来的单词。
 * O-Level 词义题固定写法：What does the word 'coax' in '...' (Paragraph 1) suggest?
 * 取**第一个**单引号/弯引号里的单个词（多词的是引用句子，不是目标词）。
 */
export function extractQuotedWord(stem: string): string | null {
  // 只在"这个词是什么意思"这类词义题里抽。叙事题里也有引号，但那是引用
  // 人物说的话，不是考点 —— 真实误报：《The Uniform》Q6「explain why the
  // narrator 'said nothing' when his mother called the cloth 'good'」，
  // 'good' 被当成生词收进了 3 名学生的本子（BNC 词频第 73 位）。
  const asksAboutWord = /\bwhat does\b/i.test(stem) && /\b(suggest|mean|means|imply|convey)\b/i.test(stem);
  if (!asksAboutWord && !/\bthe word\s*['‘’"“”]/i.test(stem)) return null;

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
