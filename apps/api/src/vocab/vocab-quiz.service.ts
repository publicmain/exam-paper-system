import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { StudentWordService } from './student-word.service';

/**
 * 生词自测（P5）—— 百词斩式的客观选择题。
 *
 * ## 为什么在自评式复习（P3）之外还要一个自测
 *
 * P3 的翻卡复习靠学生自己点「记得 / 忘了」。上线两周的真实数据：复习
 * 全部发生在早测当天、寄生在交卷后的两分钟里 —— 流程是通的，但自评
 * 有个结构性弱点：**最需要背单词的学生恰恰是最会骗自己的**，连点四下
 * 「记得」只要两秒钟。客观选择题把判断权从学生手里拿回来：选错就是
 * 选错，FSRS 收到的是真实信号（对→good，错→again），调度才准。
 *
 * ## 出题完全是本地计算，零 AI 调用（铁律）
 *
 * 三种题型全部由既有数据拼出来：
 *   word_to_meaning   看词选义 —— headword + DictEntry.translation
 *   meaning_to_word   看义选词 —— 反向
 *   cloze             原句填空 —— 学生自己读过的那句话挖空选词。
 *                     这是本产品独有的资产（百词斩给不了原句语境），
 *                     所以只要有原句就优先出这种。
 *
 * ## 干扰项从哪来、怎么保证不是同义词
 *
 * 优先从**该学生自己的其他生词**里取（难度天然同档，还白赚一次曝光），
 * 不够再从 DictEntry 补（限考纲词 + 高频段，避免抽到生僻词一眼假）。
 * 同义词冲突用一个便宜的启发式挡掉：候选词释义与正确答案的释义若共享
 * 任何两个连续汉字（bigram），就弃用 —— "干涉/干扰"、"松开/松散"
 * 这类近义碰撞几乎都逃不过这一关。误杀（碰巧同字不同义）无所谓，
 * 候选池够大。
 */

export interface QuizQuestion {
  qtype: 'word_to_meaning' | 'meaning_to_word' | 'cloze';
  headword: string;
  /** 看词选义时 = headword；看义选词时 = 中文释义；cloze 时 = 挖空句 */
  prompt: string;
  options: string[];
  correctIndex: number;
  /** 判完对错后展示用 */
  phonetic: string | null;
  translation: string;
  contextSentence: string | null;
}

/** 取释义第一行并截断 —— 做选项时太长会把手机屏挤爆。 */
export function optionText(translation: string): string {
  const line = (translation ?? '').split('\n')[0].trim();
  return line.length > 38 ? line.slice(0, 37) + '…' : line;
}

/**
 * 干扰项黑名单。词典兜底池按"考纲标签+高频段"过滤,但 ECDICT 的标签
 * 来自历史考纲,里面混着今天绝不该出现在学校题目里的词(上线首日实测
 * 就抽出了 negro)。宁可误杀。
 */
const OFFENSIVE = /negro|nigg|rape|fuck|shit|bitch|cunt|whore|slut|penis|vagina|dick\b|porn|nazi/i;

export function isSafeDistractor(word: string): boolean {
  return !OFFENSIVE.test(word) && /^[a-z][a-z-]{2,15}$/i.test(word);
}

/** 释义第一行的词性前缀（n./v./a. …）。匹配不到返回 ''。 */
export function posOf(translation: string): string {
  const m = (translation ?? '').trim().match(/^(vt|vi|n|v|adj|adv|a|ad|prep|conj|pron)\./i);
  if (!m) return '';
  const p = m[1].toLowerCase();
  if (p === 'adj') return 'a';
  if (p === 'adv' || p === 'ad') return 'ad';
  if (p === 'vt' || p === 'vi') return 'v';
  return p;
}

/** 两条中文释义是否共享任何连续两个汉字 —— 同义词碰撞的便宜探测器。 */
export function cjkBigramCollision(a: string, b: string): boolean {
  const grams = (s: string) => {
    const cjk = (s.match(/[一-鿿]/g) ?? []).join('');
    const out = new Set<string>();
    for (let i = 0; i < cjk.length - 1; i++) out.add(cjk.slice(i, i + 2));
    return out;
  };
  const ga = grams(a);
  if (!ga.size) return false;
  for (const g of grams(b)) if (ga.has(g)) return true;
  return false;
}

/** 确定性洗牌（xorshift 简版）—— 同一批题每次刷新顺序不同即可，无需加密强度。 */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Candidate {
  headword: string;
  translation: string;
}

/**
 * 为一个词挑 3 个干扰项。纯函数，可测。
 * 返回 null 表示候选不足（词典兜底池也见底了）—— 调用方跳过该词。
 */
export function pickDistractors(
  answer: Candidate,
  pool: Candidate[],
  seed: number,
): Candidate[] | null {
  const seen = new Set<string>([answer.headword.toLowerCase()]);
  const ok: Candidate[] = [];
  // 词性相同的候选排前面：看义选词/原句填空时,四个选项词性一致才有
  // 迷惑性("was ___ with rain" 里混一个名词等于白送)。词性不足再用
  // 其他的补 —— 出得出题永远优先于题目漂亮。
  const target = posOf(answer.translation);
  const shuffled = shuffle(pool, seed);
  const ordered = target
    ? [...shuffled.filter((c) => posOf(c.translation) === target), ...shuffled.filter((c) => posOf(c.translation) !== target)]
    : shuffled;
  for (const c of ordered) {
    const hw = c.headword.toLowerCase();
    if (seen.has(hw)) continue;
    if (!isSafeDistractor(c.headword)) continue;
    if (!c.translation?.trim()) continue;
    if (cjkBigramCollision(optionText(c.translation), optionText(answer.translation))) continue;
    // 干扰项之间也不能互为近义 —— 否则"两个都像对的"
    if (ok.some((o) => cjkBigramCollision(optionText(o.translation), optionText(c.translation)))) continue;
    seen.add(hw);
    ok.push(c);
    if (ok.length === 3) return ok;
  }
  return null;
}

@Injectable()
export class VocabQuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly words: StudentWordService,
  ) {}

  /**
   * 组一套自测题。
   *
   * 选词顺序：到期的优先（欠得最久在前）→ 不够拿最新加入的补。
   * 一套默认 8 题 —— 比复习的 5 张多一点（自测是学生主动点进来的，
   * 动机比"被寄生"强），但仍要保证 3 分钟内做得完。
   */
  async buildQuiz(input: { studentName: string; studentId?: string; limit?: number }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId);
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 15);
    const now = new Date();

    const due = await this.prisma.studentWord.findMany({
      where: { studentId: student.id, state: { not: 'known' }, due: { lte: now } },
      orderBy: [{ due: 'asc' }],
      take: limit,
    });
    const fresh =
      due.length < limit
        ? await this.prisma.studentWord.findMany({
            where: { studentId: student.id, headword: { notIn: due.map((w) => w.headword) } },
            orderBy: [{ createdAt: 'desc' }],
            take: limit - due.length,
          })
        : [];
    const chosen = [...due, ...fresh];

    // 干扰项池 1：该学生的全部生词（含已掌握的 —— 作干扰项正合适）
    const mine = await this.prisma.studentWord.findMany({
      where: { studentId: student.id },
      select: { headword: true },
    });
    const allWords = [...new Set([...mine.map((w) => w.headword), ...chosen.map((w) => w.headword)])];
    const dictRows = await this.prisma.dictEntry.findMany({
      where: { word: { in: allWords } },
    });
    const dict = new Map(dictRows.map((e) => [e.word.toLowerCase(), e]));

    const poolMine: Candidate[] = mine
      .map((w) => ({ headword: w.headword, translation: dict.get(w.headword.toLowerCase())?.translation ?? '' }))
      .filter((c) => c.translation);

    // 干扰项池 2：词典兜底。限考纲标签 + BNC 高频段（3k–20k），
    // 避免抽出 abecedarian 这种一眼假的词。随机取一批足够整场用。
    const poolDictRows = await this.prisma.$queryRaw<Array<{ word: string; translation: string }>>`
      SELECT word, translation FROM "DictEntry"
      WHERE translation IS NOT NULL AND translation <> ''
        AND ('ielts' = ANY(tag) OR 'toefl' = ANY(tag) OR 'cet6' = ANY(tag))
        AND bnc BETWEEN 3000 AND 20000
        AND word NOT IN (SELECT unnest(${allWords}::text[]))
      ORDER BY random() LIMIT 80`;
    const poolDict: Candidate[] = poolDictRows.map((r) => ({ headword: r.word, translation: r.translation }));

    const questions: QuizQuestion[] = [];
    let seed = (Date.now() % 2147483647) | 1;
    for (const w of chosen) {
      const e = dict.get(w.headword.toLowerCase());
      const translation = e?.translation ?? '';
      if (!translation.trim()) continue; // 词典没释义的词出不了选择题
      const answer: Candidate = { headword: w.headword, translation };
      seed = (seed * 48271) % 2147483647;
      // 学生自己的词优先做干扰项，不足由词典池续上（pickDistractors 内部逐个过滤）
      const distractors = pickDistractors(answer, [...poolMine, ...poolDict], seed);
      if (!distractors) continue;

      const hasCloze =
        !!w.contextSentence &&
        !!w.surfaceForm &&
        w.contextSentence.toLowerCase().includes(w.surfaceForm.toLowerCase());
      // 有原句 → 原句填空（独有资产，优先）；否则看词选义 / 看义选词交替
      const qtype: QuizQuestion['qtype'] = hasCloze
        ? 'cloze'
        : questions.length % 2 === 0
          ? 'word_to_meaning'
          : 'meaning_to_word';

      const wordOptions = qtype !== 'word_to_meaning';
      const raw = [answer, ...distractors].map((c) =>
        wordOptions ? c.headword : optionText(c.translation),
      );
      seed = (seed * 48271) % 2147483647;
      const order = shuffle([0, 1, 2, 3], seed);
      const options = order.map((i) => raw[i]);
      const correctIndex = order.indexOf(0);

      let prompt: string;
      if (qtype === 'cloze') {
        const s = w.contextSentence!;
        const i = s.toLowerCase().indexOf(w.surfaceForm.toLowerCase());
        prompt = s.slice(0, i) + '＿＿＿' + s.slice(i + w.surfaceForm.length);
      } else if (qtype === 'word_to_meaning') {
        prompt = w.headword;
      } else {
        prompt = optionText(translation);
      }

      questions.push({
        qtype,
        headword: w.headword,
        prompt,
        options,
        correctIndex,
        phonetic: e?.phonetic ?? null,
        translation: optionText(translation),
        contextSentence: w.contextSentence || null,
      });
    }

    return {
      student: { id: student.id, name: student.name },
      streakDays: await this.streakDays(student.id),
      totalWords: mine.length,
      questions,
    };
  }

  /**
   * 连续学习天数（新加坡时区自然日）。今天有复习记录算今天起，否则从
   * 昨天往前数 —— 今天还没做不该把昨天攒的连胜清零，多邻国同款规则。
   */
  private async streakDays(studentId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ d: string }>>`
      SELECT DISTINCT (("reviewedAt" + interval '8 hours')::date)::text AS d
      FROM "WordReviewLog" l JOIN "StudentWord" w ON w.id = l."studentWordId"
      WHERE w."studentId" = ${studentId}
      ORDER BY d DESC LIMIT 120`;
    if (!rows.length) return 0;
    const days = rows.map((r) => r.d);
    const sgtToday = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const sgtYesterday = new Date(Date.now() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    if (days[0] !== sgtToday && days[0] !== sgtYesterday) return 0;
    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1] + 'T00:00:00Z').getTime();
      const cur = new Date(days[i] + 'T00:00:00Z').getTime();
      if (prev - cur === 86400_000) streak++;
      else break;
    }
    return streak;
  }
}
