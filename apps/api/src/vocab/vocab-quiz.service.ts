import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { findClozeSpan, windowAroundSpan } from './cloze';
import { StudentWordService } from './student-word.service';
import { VocabReviewService } from './vocab-review.service';

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

export type QuizQType = 'word_to_meaning' | 'meaning_to_word' | 'cloze' | 'spelling';

export interface QuizQuestion {
  qtype: QuizQType;
  headword: string;
  /** 看词选义时 = headword；看义选词时 = 中文释义；cloze/spelling 时 = 挖空句 */
  prompt: string;
  /** spelling 题恒为空数组（前端渲染输入框而非选项） */
  options: string[];
  /** spelling 题恒为 -1 */
  correctIndex: number;
  /** 判完对错后展示用 */
  phonetic: string | null;
  translation: string;
  contextSentence: string | null;
  /** spelling 专用：要拼出的原文 token（与 MCQ 的 correctIndex 同威胁模型 —— 客户端判分，答案本就到端） */
  answer?: string;
  /** spelling 专用：首字母提示（降低手机输入摩擦，半产出而非全产出） */
  hint?: string;
}

/**
 * 这个词能不能出拼写题（研究性分析 #2）。
 *
 * 依据：产出型检索的长期保持显著强于四选一辨认（Kang/Roediger），
 * 且自家数据显示自评「记得」的词客观一考大面积倒下。约束是手机
 * 输入摩擦：只挑 4–12 个纯字母的 token（太短没意义、太长劝退、
 * 带撇号/连字符的输入法折磨人），且只考**复习过**的词 —— 产出练习
 * 属于已见过的词，生词直接考拼写是罚抄。
 */
export function isSpellable(token: string): boolean {
  return /^[A-Za-z]{4,12}$/.test(token);
}

// ─────────────────────────────────────────────────────────────
// S9D2D —— 正式测试的**题型分配**
//
// 自由练习那条路是「能出什么就出什么」：有挖空位就出 cloze，先占满两道
// spelling。学生自己点进来练，题型分布怎么歪都无所谓。
//
// 正式测试不行 —— 它是**成绩**。同一份任务应该同时量到四种能力：
// 认（看词选义）、产（看义选词）、用（原句填空）、写（拼写）。把这件事
// 交给通用算法的结果是：四个全能词会变成「2 道拼写 + 2 道填空」，两种
// 选择题一道都没有（2026-08-30 修复前的实际行为是另一个极端 —— 因为
// surfaceForm 丢了，四道题全是选择题）。
//
// 所以正式路径有一条**显式的、确定性的**分配策略，与自由练习分开。
// ─────────────────────────────────────────────────────────────

/** 一个词**撑不撑得起**产出型题目。两条都由词本身的事实决定，不掷骰子。 */
export interface WordTypeCapability {
  /** 能出拼写题：复习过（reps>0）、原句里定位得到词形、token 是 4–12 纯字母 */
  canSpell: boolean;
  /** 能出填空题：原句里定位得到词形 */
  canCloze: boolean;
}

/**
 * 正式测试的题型分配。**纯函数、确定性、不改词序。**
 *
 * 规则（按优先级填槽，词的位置一步都不挪）：
 *
 *   1. `spelling` → **第一个**撑得起拼写的词；
 *   2. `cloze`    → 剩下的词里**第一个**挖得了空的；
 *   3. 其余的词按 `word_to_meaning` / `meaning_to_word` **交替**补齐。
 *
 * 四个全能词 ⇒ 恰好四种各一道。
 *
 * **撑不起就不出**：没有词能拼写时不硬出（那只能靠瞎猜一个 token），
 * 该槽直接让给交替的选择题；一个都挖不了空时同理。降级是有名字的
 * （见 `resolveFormalType`），不是悄悄换一道题。
 *
 * 多于四个词时，前两槽照旧，其余全部按选择题交替 —— 正式测试目前
 * 恒为四题，这一条只是让函数对更长的队列也有定义。
 */
export function formalTypePlan(caps: ReadonlyArray<WordTypeCapability>): QuizQType[] {
  const plan: Array<QuizQType | null> = caps.map(() => null);
  const firstFree = (ok: (c: WordTypeCapability) => boolean): number => {
    for (let i = 0; i < caps.length; i++) if (plan[i] == null && ok(caps[i])) return i;
    return -1;
  };

  const s = firstFree((c) => c.canSpell);
  if (s >= 0) plan[s] = 'spelling';
  const c = firstFree((x) => x.canCloze);
  if (c >= 0) plan[c] = 'cloze';

  let alt = 0;
  for (let i = 0; i < plan.length; i++) {
    if (plan[i] == null) plan[i] = alt++ % 2 === 0 ? 'word_to_meaning' : 'meaning_to_word';
  }
  return plan as QuizQType[];
}

/**
 * 分配下来的题型这个词到底出不出得了 —— **出不了就明说降到哪一档**。
 *
 * 计划是在 `buildQuiz` 拿到词典释义之前算的（能力只看词本身的事实），
 * 所以真正出题时还要再确认一次。降级顺序：拼写 → 填空 → 看词选义。
 * **绝不为了凑题型而编答案。**
 */
export function resolveFormalType(
  planned: QuizQType,
  caps: WordTypeCapability,
): { qtype: QuizQType; degradedFrom: QuizQType | null } {
  if (planned === 'spelling' && !caps.canSpell) {
    return caps.canCloze
      ? { qtype: 'cloze', degradedFrom: 'spelling' }
      : { qtype: 'word_to_meaning', degradedFrom: 'spelling' };
  }
  if (planned === 'cloze' && !caps.canCloze) {
    return { qtype: 'word_to_meaning', degradedFrom: 'cloze' };
  }
  return { qtype: planned, degradedFrom: null };
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
    private readonly review: VocabReviewService,
  ) {}

  /**
   * 组一套自测题。
   *
   * 选词顺序：到期的优先（欠得最久在前）→ 不够拿最新加入的补。
   * 一套默认 8 题 —— 比复习的 5 张多一点（自测是学生主动点进来的，
   * 动机比"被寄生"强），但仍要保证 3 分钟内做得完。
   */
  async buildQuiz(input: {
    studentName: string;
    studentId?: string;
    /** 阶段 5A：已认证学生的 id。给了就走精确 ID 路径，不查姓名。 */
    authStudentId?: string;
    limit?: number;
    /**
     * P6：正式测试传进来的**固定词表**。给了就不再自己选词、不再补题。
     *
     * S9D2D —— `surfaceForm` 是**必填**的，不是可选的锦上添花：挖空位置
     * 靠 `findClozeSpan(contextSentence, surfaceForm)` 定位，少了它
     * `cloze` 与 `spelling` 两种题型在这条路上直接绝迹（2026-08-30 实测）。
     * 类型里写死它，就是为了让「投影时忘了带」在编译期就红，而不是
     * 等到线上少两种题型才发现。
     */
    words?: Array<{
      headword: string;
      surfaceForm: string | null;
      contextSentence: string | null;
      reps: number;
    }>;
    /**
     * S9D2D：题型分配策略。
     *
     * 缺省（自由练习）= 老规则，一个字都没变。
     * `'balanced'`（正式测试）= `formalTypePlan` 的四种各一道。
     */
    mix?: 'balanced';
  }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 15);
    const now = new Date();

    // ## P6 —— 只考教过的词
    //
    // 原来这里有两层「凑题数」兜底：到期词不够就捞 reps=0 的（从没学过
    // 的），还不够就捞任意词（连到期都不要求）。短文层的词是老师推的、
    // 学生从没见过，而 due 默认就是 now() —— 两层兜底叠起来的结果是
    // 第一次打开自测考的全是没读过的词，全错，答错还回写 FSRS 把它们
    // 标成困难词。
    //
    // 现在判据换成 firstTaughtAt（P5 建立的「教过」事实）：**任何情况下
    // 都不出没教过的词**。宁可题少，也不考他没学过的东西。
    const chosen = input.words
      ? (input.words as any[])
      : await (async () => {
          const dueTaught = await this.prisma.studentWord.findMany({
            where: { studentId: student.id, due: { lte: now }, firstTaughtAt: { not: null } },
            orderBy: [{ due: 'asc' }],
            take: limit,
          });
          // 学生主动来练时，到期的不够可以从**教过的**旧词里续 ——
          // 续的仍然只有教过的词，绝不放宽到 firstTaughtAt = null。
          const moreTaught =
            dueTaught.length < limit
              ? await this.prisma.studentWord.findMany({
                  where: {
                    studentId: student.id,
                    firstTaughtAt: { not: null },
                    headword: { notIn: dueTaught.map((w) => w.headword) },
                  },
                  orderBy: [{ createdAt: 'desc' }],
                  take: limit - dueTaught.length,
                })
              : [];
          return [...dueTaught, ...moreTaught];
        })();

    // 干扰项池 1：该学生的全部生词（含已掌握的 —— 作干扰项正合适）
    const mine = await this.prisma.studentWord.findMany({
      where: { studentId: student.id },
      // firstTaughtAt：seenWords 的判据（P6）。干扰项池不看这个 ——
      // 拿没教过的词当**干扰项**没问题，它不是被考的那一个。
      select: { headword: true, reps: true, firstTaughtAt: true },
    });
    const allWords = [...new Set([...mine.map((w) => w.headword), ...chosen.map((w) => w.headword)])];
    const dictRows = await this.prisma.dictEntry.findMany({
      where: { word: { in: allWords } },
    });
    const dict = new Map(dictRows.map((e) => [e.word.toLowerCase(), e]));

    const poolMine: Candidate[] = mine
      .map((w) => ({ headword: w.headword, translation: dict.get(w.headword.toLowerCase())?.translation ?? '' }))
      .filter((c) => c.translation);

    // 干扰项池 2：词典兜底。
    //
    // 难度必须跟着**被考的词**走，不能写死一个窗口。原来固定在
    // ielts/toefl/cet6 + bnc 3k–20k —— 那是照雅思班调的，基础层的词
    // （uniform bnc=3504、packet 3805）配上 photosynthesis / prevalence
    // 这种干扰项，学生一眼就能排除，题目等于白出（2026-08-14 基础层
    // 实测发现）。
    //
    // 现在按本场被考词的 bnc 区间取：下界放宽一半、上界放宽一倍，
    // 并把 zk/gk/cet4 这些中学考纲标签也纳入 —— 基础层的词大多只带
    // 这些标签，不带 ielts/toefl。区间取不到足够的词时回退到原窗口。
    const chosenBncs = chosen
      .map((w) => dict.get(w.headword.toLowerCase())?.bnc ?? 0)
      .filter((n) => n > 0);
    const loBnc = chosenBncs.length ? Math.max(500, Math.floor(Math.min(...chosenBncs) / 2)) : 3000;
    const hiBnc = chosenBncs.length ? Math.min(60000, Math.max(...chosenBncs) * 2) : 20000;
    const dictPoolQuery = (lo: number, hi: number) => this.prisma.$queryRaw<
      Array<{ word: string; translation: string }>
    >`
      SELECT word, translation FROM "DictEntry"
      WHERE translation IS NOT NULL AND translation <> ''
        -- 考纲范围（2026-08-14）：只考雅思 / O-Level。干扰项也必须在
        -- 范围内 —— 拿 GRE 词做干扰项等于告诉学生「这个你不用管」，
        -- 而且一眼就能排除，题目失去区分度。
        AND ('ielts' = ANY(tag) OR 'cet6' = ANY(tag)
             OR 'cet4' = ANY(tag) OR 'gk' = ANY(tag) OR 'zk' = ANY(tag)
             OR 'ky' = ANY(tag))
        AND bnc BETWEEN ${lo} AND ${hi}
        AND word NOT IN (SELECT unnest(${allWords}::text[]))
      ORDER BY random() LIMIT 80`;
    let poolDictRows = await dictPoolQuery(loBnc, hiBnc);
    if (poolDictRows.length < 12) poolDictRows = await dictPoolQuery(3000, 20000);
    const poolDict: Candidate[] = poolDictRows.map((r) => ({ headword: r.word, translation: r.translation }));

    const questions: QuizQuestion[] = [];
    let seed = (Date.now() % 2147483647) | 1;
    // 每轮最多 2 道拼写题（研究性分析 #2）：产出型保持效果最好，但
    // 手机打字摩擦大，混太多会把弱生劝退。盯着跳过率（「不会写」
    // 即 again）决定是否加码。
    let spellingLeft = 2;

    // 挖空位置对**每个**词各算一次 —— 它既决定能力（能不能出填空 / 拼写），
    // 又是真正出题时挖空要用的坐标。算两遍没必要，而且两遍不一致就是 bug。
    const spans = chosen.map((w: any) =>
      w.contextSentence && w.surfaceForm ? findClozeSpan(w.contextSentence, w.surfaceForm) : null,
    );
    const caps: WordTypeCapability[] = chosen.map((w: any, i: number) => ({
      canCloze: spans[i] != null,
      canSpell: (w.reps ?? 0) > 0 && spans[i] != null && isSpellable(spans[i]!.token),
    }));
    // 正式测试才有计划；自由练习恒为 null，走下面那条老路。
    const plan: QuizQType[] | null = input.mix === 'balanced' ? formalTypePlan(caps) : null;

    for (let wi = 0; wi < chosen.length; wi++) {
      const w = chosen[wi] as any;
      const e = dict.get(w.headword.toLowerCase());
      const translation = e?.translation ?? '';
      if (!translation.trim()) continue; // 词典没释义的词出不了选择题

      // 挖空定位走 findClozeSpan —— 原来用 `includes` 判定 + `indexOf`
      // 挖空，26% 的例句里词形只是子串（agree ⊂ agreed），会挖出
      // 「＿＿＿d」这种残缺提示。定位不到就放弃 cloze 改出词义题，
      // 绝不硬挖。
      const clozeSpan = spans[wi];
      // 计划里这个词该出什么（正式路径）；出不了就按 resolveFormalType 降级。
      const planned = plan ? resolveFormalType(plan[wi], caps[wi]).qtype : null;

      // 拼写题优先于选择题（不需要干扰项，所以在 pickDistractors 之前判）
      //
      // `clozeSpan &&` 在语义上是多余的（`caps[wi].canSpell` 与 `spellable`
      // 都已经蕴含它），写出来是给类型收窄用的：拼写题必须有挖空坐标。
      const spellable = (w.reps ?? 0) > 0 && clozeSpan != null && isSpellable(clozeSpan.token);
      if (clozeSpan && (planned ? planned === 'spelling' : spellingLeft > 0 && spellable)) {
        if (!planned) spellingLeft--;
        const win = windowAroundSpan(w.contextSentence!, clozeSpan, 180);
        questions.push({
          qtype: 'spelling',
          headword: w.headword,
          prompt: win.text.slice(0, win.span.start) + '＿＿＿' + win.text.slice(win.span.end),
          options: [],
          correctIndex: -1,
          phonetic: e?.phonetic ?? null,
          translation: optionText(translation),
          contextSentence: w.contextSentence || null,
          answer: clozeSpan.token,
          hint: clozeSpan.token[0],
        });
        continue;
      }

      const answer: Candidate = { headword: w.headword, translation };
      seed = (seed * 48271) % 2147483647;
      // 学生自己的词优先做干扰项，不足由词典池续上（pickDistractors 内部逐个过滤）
      const distractors = pickDistractors(answer, [...poolMine, ...poolDict], seed);
      if (!distractors) continue;
      // 正式测试按计划走（拼写那一档已经在上面处理掉了，落到这里的只剩
      // 填空 / 两种选择题）；自由练习照旧：有原句 → 原句填空（独有资产，
      // 优先），否则看词选义 / 看义选词交替。
      const qtype: QuizQType = planned
        ? planned === 'spelling'
          ? 'word_to_meaning' // 兜底：计划说拼写但这里没出成（无挖空坐标）
          : planned
        : clozeSpan
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
        // 长句以挖空处为中心开窗（修复 #5）：300 字符的学术长句对轻量层
        // 学生是墙不是提示，窗口化后题干只留挖空处前后各 ~80 字符。
        const win = windowAroundSpan(w.contextSentence!, clozeSpan!, 180);
        prompt = win.text.slice(0, win.span.start) + '＿＿＿' + win.text.slice(win.span.end);
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
      streakDays: await this.review.streakDays(student.id),
      totalWords: mine.length,
      // 教过的词数（P6 起判据从 reps>0 换成 firstTaughtAt）。为 0 说明
      // 学生还没学过任何词 —— 前端据此把「直接考」改成「先学新词」的引导。
      seenWords: mine.filter((w) => w.firstTaughtAt != null).length,
      questions,
    };
  }

}
