import { findClozeSpan, windowAroundSpan } from '../vocab/cloze';
import { cjkBigramCollision, optionText, posOf, isSafeDistractor } from '../vocab/vocab-quiz.service';

/**
 * 早测卷内的词汇题（2026-08-25 定，只给两个轻量层）。
 *
 * ## 为什么把词汇搬进卷子
 *
 * 首日数据：全班 683 词、74% 从没被翻开过、33 人里 23 人从没打开过任何
 * 词汇页面；成绩页那条自愿横幅的转化率只有 20%（10 人看成绩 → 2 人点）。
 * 供给端一天能进 242 词，消化端一天 28 次复习 —— 进出比 8.6:1。
 *
 * 症结不是入口不够顺手，是**背单词没有回报**。这套系统里唯一 100%
 * 生效的强制力是早测本身（扫码、限时、算分，一个都跑不掉）。把词汇
 * 放进卷子，就不再需要学生做「要不要顺便背个单词」这个额外决定。
 *
 * ## 只给轻量两层（教师定，2026-08-25）
 *
 * 雅思轻量 6 题、O-Level 基础 5 题，本来就短，塞得下 2 道；雅思真题
 * 13 题、O-Level 标准 14 题的学生时间已经很紧，不能再加。
 *
 * ## 题型与公平性
 *
 * 每天 2 道，都是 4 选 1 的 **mcq**（questionType='mcq'）：
 *   1. 原句填空（cloze）—— 给出例句挖空。**没背过的人靠语境也能推**，
 *      背过的人秒选。这一题是给缺课/刚来的学生留的路。
 *   2. 看词选义 —— 纯记忆，背了就得分。
 *
 * 必须是 mcq 而不是 short_answer：mcq 走 gradeMcq 确定性判分，交卷即
 * 出分、零 AI 调用（铁律）、且不进人工判分队列 —— 每天多两道题不能
 * 变成老师每天多批 70 份。
 *
 * ## 考的词只能是「他名下已经有的词」
 *
 * 词源是本周主线词（weekly-track fixture），扫码时已推给该层每个学生。
 * 绝不从学生个人生词本出题 —— 那样每人题目不同，而 PaperQuestion 是
 * 卷子级的，全班共用一份。
 */

export interface VocabQuestionSpec {
  /** 'A' | 'B' | 'C' | 'D' */
  answerKey: string;
  taskType: 'multiple_choice';
  stem: string;
  options: Array<{ key: string; text: string; correct: boolean }>;
  /** 出自哪个词 —— 写进 snapshotContent，方便日后统计与复盘 */
  headword: string;
  qtype: 'cloze' | 'word_to_meaning';
}

export interface VocabWordInput {
  word: string;
  context: string;
  translation: string;
}

const KEYS = ['A', 'B', 'C', 'D'];

/** 确定性洗牌（与 vocab-quiz 同款 xorshift）—— 同一天同一层结果稳定。 */
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

/**
 * 日期 → 稳定种子。同一天同一层每次生成的题目完全一样（可重跑、可对账），
 * 不同天不同层则不同。
 */
export function seedFor(dateIso: string, level: string): number {
  let h = 2166136261;
  for (const ch of `${dateIso}|${level}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) | 1;
}

/**
 * 从本周主线词里挑当天要考的 N 个。
 *
 * 按天轮转而不是随机重抽：15 个词分散到一周里考，一周内不重复考同一个
 * （dayIndex 从 0 起，每天取接着的两个，转满一圈再从头）。
 */
export function pickWordsForDay<T>(words: T[], dayIndex: number, count: number): T[] {
  if (!words.length) return [];
  const out: T[] = [];
  for (let i = 0; i < count && i < words.length; i++) {
    out.push(words[(dayIndex * count + i) % words.length]);
  }
  return out;
}

/**
 * 出一道原句填空题：例句挖空 + 4 个候选词。
 * 定位不到词就返回 null（调用方降级成看词选义）。
 */
export function buildClozeQuestion(
  target: VocabWordInput,
  distractorWords: string[],
  seed: number,
): VocabQuestionSpec | null {
  const span = findClozeSpan(target.context, target.word);
  if (!span) return null;
  const win = windowAroundSpan(target.context, span, 180);
  const sentence = win.text.slice(0, win.span.start) + '＿＿＿' + win.text.slice(win.span.end);
  const picks = distractorWords.slice(0, 3);
  if (picks.length < 3) return null;
  const raw = [target.word, ...picks];
  const order = shuffle([0, 1, 2, 3], seed);
  const options = order.map((i, idx) => ({
    key: KEYS[idx],
    text: raw[i],
    correct: i === 0,
  }));
  return {
    answerKey: options.find((o) => o.correct)!.key,
    taskType: 'multiple_choice',
    stem:
      '本周词汇 · 选出最合适的词填入空格 · Choose the best word for the blank.\n\n' + sentence,
    options,
    headword: target.word,
    qtype: 'cloze',
  };
}

/** 出一道看词选义题：词 + 4 个中文释义。 */
export function buildMeaningQuestion(
  target: VocabWordInput,
  distractorTranslations: string[],
  seed: number,
): VocabQuestionSpec | null {
  const correct = optionText(target.translation);
  if (!correct) return null;
  const picks = distractorTranslations.slice(0, 3);
  if (picks.length < 3) return null;
  const raw = [correct, ...picks];
  const order = shuffle([0, 1, 2, 3], seed);
  const options = order.map((i, idx) => ({
    key: KEYS[idx],
    text: raw[i],
    correct: i === 0,
  }));
  return {
    answerKey: options.find((o) => o.correct)!.key,
    taskType: 'multiple_choice',
    stem: `本周词汇 · 选出 “${target.word}” 的意思 · What does “${target.word}” mean?`,
    options,
    headword: target.word,
    qtype: 'word_to_meaning',
  };
}

/**
 * 从候选池里挑干扰项释义 —— 复用自测那套过滤（词性优先 + 中文 bigram
 * 碰撞剔近义 + 脏词黑名单），保证四个选项看起来同档、且只有一个对。
 */
export function pickMeaningDistractors(
  answer: { word: string; translation: string },
  pool: Array<{ word: string; translation: string }>,
  seed: number,
): string[] {
  const target = posOf(answer.translation);
  const shuffled = shuffle(pool, seed);
  const ordered = target
    ? [
        ...shuffled.filter((c) => posOf(c.translation) === target),
        ...shuffled.filter((c) => posOf(c.translation) !== target),
      ]
    : shuffled;
  const out: string[] = [];
  const seen = new Set([answer.word.toLowerCase()]);
  for (const c of ordered) {
    const w = c.word.toLowerCase();
    if (seen.has(w)) continue;
    if (!isSafeDistractor(c.word)) continue;
    const t = optionText(c.translation);
    if (!t) continue;
    if (cjkBigramCollision(t, optionText(answer.translation))) continue;
    if (out.some((o) => cjkBigramCollision(o, t))) continue;
    seen.add(w);
    out.push(t);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * 挑填空题的干扰项。
 *
 * ⚠️ 填空题的干扰项比选义题危险得多：选义题只要四个释义不同义就行，
 * 而填空题的干扰项**填进空格里必须读不通**，否则就是两个正确答案。
 * 2026-08-25 首次出题就撞上了：「The classroom was ___ when I arrived.」
 * 正解 empty，而同批词表里的 tidy 填进去一样通顺。
 *
 * 两道防线：
 *   1. 中文释义 bigram 碰撞 —— 挡掉近义词（approach/method 共享「方法」、
 *      process/method 同理）。这条挡不住 empty/tidy 这种「不同义但同语境」。
 *   2. **例句必须写成只有目标词填得进去**（weekly-track authoring 规约），
 *      外加每天出的 2 道题人工过一遍 —— 语义是否唯一，机器判不了。
 */
export function pickWordDistractors(
  answerWord: string,
  answerTranslation: string,
  pool: Array<{ word: string; translation: string }>,
  seed: number,
): string[] {
  const a = answerWord.toLowerCase();
  const stem = a.replace(/e$/, '').slice(0, Math.max(3, a.length - 2));
  const answerText = optionText(answerTranslation);
  const out: string[] = [];
  const chosen: string[] = [];
  for (const c of shuffle(pool, seed)) {
    const w = c.word.toLowerCase();
    if (w === a) continue;
    if (!isSafeDistractor(c.word)) continue;
    // 同词根的词做干扰项等于送分/坑人（borrow vs borrowed），剔掉
    if (stem.length >= 3 && (w.startsWith(stem) || a.startsWith(w.slice(0, 3)))) continue;
    if (out.includes(w)) continue;
    const t = optionText(c.translation);
    // 与正解近义 → 填进去多半也通，弃用
    if (answerText && t && cjkBigramCollision(t, answerText)) continue;
    // 干扰项之间也不能互为近义（两个都像对的）
    if (chosen.some((o) => cjkBigramCollision(o, t))) continue;
    chosen.push(t);
    out.push(w);
    if (out.length === 3) break;
  }
  return out;
}
