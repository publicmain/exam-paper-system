/**
 * 短答案的「差异分析」—— 判分辅助，**不改变任何自动判分结果**。
 *
 * 背景：近 30 天雅思层 1701 条作答里有 236 条落到人工队列（14%），其中
 * 相当一部分不是真的答错，而是机械差异 —— 单复数、大小写、一个字母的
 * 拼写、词形变化。人要逐条肉眼比对「culture」和「cultures」差在哪，
 * 慢且容易看漏。
 *
 * 但**绝不能让机器自动放过这类差异**：雅思填空题里 `culture` 写成
 * `cultures` 在真考就是错的，自动判对等于骗学生。所以这个模块只回答
 * 「差在哪」，判几分仍然由人决定。
 *
 * 只对**短答案**（正确答案 ≤2 词）有意义。O-Level 那种「用自己的话解释」
 * 的长答案，差异类型没有意义，一律返回 long_answer 让人正常判。
 */

export type DiffKind =
  | 'exact' // 完全一致（正常不该进人工队列）
  | 'case' // 仅大小写不同
  | 'plural' // 仅单复数不同
  | 'word_form' // 词形变化：-ing / -ed / -er 等
  | 'typo' // 拼写错，编辑距离 1–2
  | 'extra_words' // 多写了词（如整句作答而非单词）
  | 'blank' // 空答
  | 'different' // 内容不同
  | 'long_answer'; // 参考答案本身是长句，不做机械比对

export interface AnswerDiff {
  kind: DiffKind;
  /** 给判分人看的一句话说明，可直接用作评语骨架 */
  note: string;
  /** 这个差异在正式考试里是否照样算错。人判时的主要依据。 */
  wrongInExam: boolean;
}

const norm = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,;:!?"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Levenshtein 距离，用于识别拼写错。短词才有意义，长串直接截断判 different。 */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 4) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** 两个词是不是只差单复数 */
function isPluralPair(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long === short + 's' || long === short + 'es' ||
    (short.endsWith('y') && long === short.slice(0, -1) + 'ies');
}

/** 两个词是不是同一词根的不同形态 */
function isWordFormPair(a: string, b: string): boolean {
  // 先削后缀再削结尾的 e：shading → shad，shade → shad。不削 e 的话
  // 这两个永远配不上，会被误报成「内容完全不同」。
  const stem = (w: string) => w.replace(/(ing|ed|er|est|ly|s)$/, '').replace(/e$/, '');
  const sa = stem(a);
  const sb = stem(b);
  // 词干至少 4 个字母才认：3 个字母的词干太容易碰撞（cars/care → car）
  return sa.length >= 4 && sa === sb && a !== b;
}

export function diffAnswer(studentRaw: string | null | undefined, correctRaw: string | null | undefined): AnswerDiff {
  const correct = norm(correctRaw ?? '');
  const student = norm(studentRaw ?? '');
  // norm() 会小写化并去标点，所以大小写差异必须拿**原值**比 —— 否则
  // student === correct 先命中 exact，case 分支永远走不到。
  const rawS = String(studentRaw ?? '').trim();
  const rawC = String(correctRaw ?? '').trim();

  // 参考答案本身是长句 → 不做机械比对，正常人判
  if (correct.split(' ').length > 2) {
    return { kind: 'long_answer', note: '参考答案为长句，按内容人工判分。', wrongInExam: false };
  }
  if (!student) {
    return { kind: 'blank', note: '未作答。', wrongInExam: true };
  }
  if (student === correct) {
    // 归一化后一致：完全相同，或只差大小写 / 标点。后者雅思不扣分，
    // 但要标出来让判分人知道学生原样写了什么。
    if (rawS === rawC) {
      return { kind: 'exact', note: '与参考答案完全一致。', wrongInExam: false };
    }
    return {
      kind: 'case',
      note: `仅大小写或标点不同（答「${rawS}」，正解「${rawC}」）。雅思不因此扣分。`,
      wrongInExam: false,
    };
  }
  if (isPluralPair(student, correct)) {
    return {
      kind: 'plural',
      note: `单复数不同：答「${student}」，正解「${correct}」。填进句子后语法要成立，真考同样扣分。`,
      wrongInExam: true,
    };
  }
  if (isWordFormPair(student, correct)) {
    return {
      kind: 'word_form',
      note: `词形不同：答「${student}」，正解「${correct}」。真考要求填入后语法成立。`,
      wrongInExam: true,
    };
  }
  // 学生把整句写进来了，但正确答案就在里面
  const words = student.split(' ');
  if (words.length > 1 && words.includes(correct)) {
    return {
      kind: 'extra_words',
      note: `答案里含正解「${correct}」，但多写了其他词。雅思填空限定词数，超出即算错。`,
      wrongInExam: true,
    };
  }
  const d = editDistance(student, correct);
  if (d > 0 && d <= 2 && correct.length >= 4) {
    return {
      kind: 'typo',
      note: `拼写错（差 ${d} 个字母）：答「${student}」，正解「${correct}」。雅思拼写必须正确。`,
      wrongInExam: true,
    };
  }
  return {
    kind: 'different',
    note: `答「${student}」，正解「${correct}」，内容不同。`,
    wrongInExam: true,
  };
}
