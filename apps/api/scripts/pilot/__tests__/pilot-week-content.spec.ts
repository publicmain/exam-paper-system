/**
 * S12M —— 试点第一周内容的**完整性验收**。
 *
 * 这一份不测代码，测**内容**。学生真的会读它、答它、背它，所以每一条
 * 断言背后都是一个学生会撞到的具体后果：
 *
 *   · 证据句不是原文逐字子串 → 错题重练的定位高亮标不上（S12I 的教训）；
 *   · 语境句不是原文原句 → 学习卡上的例句与他读过的文章对不上；
 *   · 目标词不在原文里 → 「今天的生词」根本不是今天的生词；
 *   · 选项重复 / 答案键越界 → 一道题永远判错；
 *   · 主观题没有 rubric → 老师批到它时没有依据，同一份卷子两个人判两个分。
 *
 * 全部是纯数据检查，不连库、不发请求。
 */

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../content');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { findNearDuplicate, questionItem } = require('../content-similarity');

type Word = {
  headword: string;
  surfaceForm: string;
  phonetic: string;
  pos: string;
  translation: string;
  definition: string;
  context: string;
  contextTranslation: string;
};
type Question = {
  taskType: string;
  questionType: 'mcq' | 'short_answer';
  marks: number;
  options: Array<{ key: string; text: string }> | null;
  answer: string;
  accept?: string[] | null;
  stem: string;
  evidence: string;
  rubric?: string;
  explanation: string;
};
type Day = {
  date: string;
  title: string;
  passage: string;
  questions: Question[];
  words: Word[];
};

const {
  LEVELS,
  DATES,
  MIN_WORDS_PER_DAY,
  MAX_WORDS_PER_DAY,
  QUESTIONS_PER_DAY,
  MIN_AUTO_PER_DAY,
  MAX_HUMAN_PER_DAY,
  lessonFor,
  allWords,
} = content as {
  LEVELS: Record<string, Day[]>;
  DATES: string[];
  MIN_WORDS_PER_DAY: number;
  MAX_WORDS_PER_DAY: number;
  QUESTIONS_PER_DAY: number;
  MIN_AUTO_PER_DAY: number;
  MAX_HUMAN_PER_DAY: number;
  lessonFor: (level: string, date: string) => Day | null;
  allWords: () => Word[];
};

const LEVEL_KEYS = Object.keys(LEVELS);
/**
 * 五档 × 五天 = 二十五个 (档, 天) 组合。每一条断言都对它们逐一跑。
 *
 * 第一个元素是**给测试名用的短标签** —— 直接把 Day 对象丢给 `describe.each`
 * 的话，vitest 会把整篇原文打进测试名里，失败时几十 KB 全是文章。
 */
const EVERY: Array<[string, string, Day]> = LEVEL_KEYS.flatMap((lv) =>
  LEVELS[lv].map((d) => [`${lv} / ${d.date}`, lv, d] as [string, string, Day]),
);

/** S12F 验收夹具的十三个标题 —— 一个都不许出现在试点内容里。 */
const ACCEPTANCE_TITLES = [
  'The Rooftop Garden Project',
  'How Cities Cool Themselves',
  'Reading the Night Sky',
  'The Return of the Wetland',
  'Paper, Ink and Memory',
  'Why Bridges Sing in the Wind',
  'The Quiet Work of Bees',
  'Maps Before Satellites',
  'The School That Grew a Forest',
  'Rain, Rivers and Rice',
  'Small Machines, Long Journeys',
  'When the Library Moved House',
  'The Rooftop Garden, Two Years On',
];

/** 学生绝不该在屏幕上看到的字样。 */
const PLACEHOLDER_MARKERS = [
  'S12F',
  'S12L',
  'S12M',
  '合成阅读',
  // 曾经这里还有一条裸的 'synthetic'。它会误伤正常词典释义 ——
  // `plastic` 的释义就是「generic name for certain synthetic or
  // semisynthetic materials…」。真正要挡的是下面这条 staging 夹具标记。
  'STAGING SYNTHETIC',
  'placeholder',
  'TODO',
  'Lorem ipsum',
  '占位',
  '示例文本',
];

// ─────────────────────────────────────────────────────────────
// 1. 有几天、有几档
// ─────────────────────────────────────────────────────────────

describe('S12M —— 这一周有什么', () => {
  it('五档都在，key 就是 EnglishLevel 的枚举值', () => {
    expect(LEVEL_KEYS.sort()).toEqual(['ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate']);
  });

  it('每一档都恰好覆盖公布的那几天，一天不多一天不少', () => {
    for (const lv of LEVEL_KEYS) {
      expect(LEVELS[lv].map((d) => d.date), lv).toEqual(DATES);
    }
  });

  it('日期是新加坡日历日，按周连续（周末跳过）', () => {
    // 内容包按周累加：试点第一周 + 首发周。旧的周只增不删 —— 学生的历史
    // 答卷、冻结的正式测试和跨日待办都指向他做过的那一天，把上一周从包里
    // 拿掉等于让那些记录指向不存在的课。
    expect(DATES).toEqual([
      '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
      '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    ]);
    for (const d of DATES) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const DAY = 86_400_000;
    const ms = DATES.map((d) => Date.parse(`${d}T00:00:00+08:00`));
    for (let i = 1; i < ms.length; i++) {
      const gap = ms[i] - ms[i - 1];
      // 教学日只排周一到周五：同一周内相邻一天，跨周相隔三天。
      expect([DAY, 3 * DAY], `${DATES[i - 1]} → ${DATES[i]} 的间隔不是 1 天或 3 天`).toContain(gap);
    }
    for (const d of DATES) {
      // 星期要按**新加坡日历日**算。写成 `new Date(d + 'T00:00:00+08:00').getUTCDay()`
      // 会先折回 UTC（8 月 31 日周一 → UTC 8 月 30 日周日），把每个周一都误判成周末。
      const [y, m, day] = d.split('-').map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      expect(weekday, `${d} 落在周末`).toBeGreaterThanOrEqual(1);
      expect(weekday, `${d} 落在周末`).toBeLessThanOrEqual(5);
    }
  });

  it('`lessonFor` 取得到，取不到的返回 null 而不是抛', () => {
    expect(lessonFor('olevel', DATES[0])).toBeTruthy();
    expect(lessonFor('olevel', '2026-12-25')).toBeNull();
    expect(lessonFor('no_such_level', DATES[0])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 形状：一篇原文 + 十道题 + 完整的当日词表
// ─────────────────────────────────────────────────────────────

describe.each(EVERY)('S12M —— %s 的形状', (_label, _level, day) => {
  it('一篇原文、十道题、12–21 个真正来自原文的词', () => {
    expect(day.passage.length, '原文太短').toBeGreaterThan(900);
    expect(day.passage.split(/\n\s*\n/).filter((p) => p.trim().length > 40).length).toBeGreaterThanOrEqual(4);
    expect(day.questions).toHaveLength(QUESTIONS_PER_DAY);
    expect(day.words.length).toBeGreaterThanOrEqual(MIN_WORDS_PER_DAY);
    expect(day.words.length).toBeLessThanOrEqual(MAX_WORDS_PER_DAY);
  });

  it('六道自动判、四道人工判 —— 学生交卷立刻看得到东西，老师每天只批四题', () => {
    const auto = day.questions.filter((q) => q.questionType === 'mcq');
    const human = day.questions.filter((q) => q.questionType === 'short_answer');
    expect(auto.length).toBeGreaterThanOrEqual(MIN_AUTO_PER_DAY);
    expect(human.length).toBeLessThanOrEqual(MAX_HUMAN_PER_DAY);
    expect(auto.length + human.length).toBe(QUESTIONS_PER_DAY);
    // 题型只能是引擎认识的那两种
    for (const q of day.questions) expect(['mcq', 'short_answer']).toContain(q.questionType);
  });

  it('任务类型都是渲染器支持的那六种', () => {
    const SUPPORTED = [
      'true_false_not_given',
      'matching_features',
      'multiple_choice',
      'sentence_completion',
      'summary_completion',
      'short_answer',
    ];
    for (const q of day.questions) expect(SUPPORTED, q.stem.slice(0, 40)).toContain(q.taskType);
  });

  it('标题唯一，且不是验收夹具的任何一篇', () => {
    expect(ACCEPTANCE_TITLES, day.title).not.toContain(day.title);
    expect(day.title.trim().length).toBeGreaterThan(5);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 每一道题都答得出来
// ─────────────────────────────────────────────────────────────

describe.each(EVERY)('S12M —— %s 的题目', (_label, _level, day) => {
  it('每一句证据都是原文里的**逐字**子串', () => {
    for (const q of day.questions) {
      if (!q.evidence) continue;
      expect(day.passage.includes(q.evidence), `证据句不在原文里：「${q.evidence.slice(0, 60)}」`).toBe(true);
    }
  });

  it('至少八道题有证据句 —— 没有证据的只能是刻意的 NOT GIVEN', () => {
    const withEvidence = day.questions.filter((q) => q.evidence);
    expect(withEvidence.length).toBeGreaterThanOrEqual(8);
    for (const q of day.questions.filter((x) => !x.evidence)) {
      expect(q.answer, `没有证据句却不是 NOT GIVEN：${q.stem.slice(0, 40)}`).toBe('C');
      expect(q.taskType).toBe('true_false_not_given');
    }
  });

  it('题干都写全了，没有一道靠课外知识', () => {
    for (const q of day.questions) {
      expect(q.stem.trim().length, '题干太短').toBeGreaterThan(15);
      expect(q.explanation.trim().length, `${q.stem.slice(0, 30)} 没写解析`).toBeGreaterThan(8);
    }
  });

  it('选择题：选项不重复、答案键在范围内、正确项唯一', () => {
    for (const q of day.questions.filter((x) => x.questionType === 'mcq')) {
      expect(q.options, q.stem.slice(0, 40)).toBeTruthy();
      const keys = q.options!.map((o) => o.key);
      const texts = q.options!.map((o) => o.text.trim());
      expect(new Set(keys).size, '选项键重复').toBe(keys.length);
      expect(new Set(texts).size, '选项文字重复').toBe(texts.length);
      expect(keys, `答案键 ${q.answer} 不在选项里`).toContain(q.answer);
      expect(q.options!.length).toBeGreaterThanOrEqual(3);
      for (const o of q.options!) expect(o.text.trim().length, '空选项').toBeGreaterThan(0);
    }
  });

  it('主观题：有参考答案、有评分标准，且**没有假的自动分**', () => {
    for (const q of day.questions.filter((x) => x.questionType === 'short_answer')) {
      expect(q.options, '主观题不该有选项').toBeNull();
      expect(String(q.answer).trim().length, `${q.stem.slice(0, 30)} 没有参考答案`).toBeGreaterThan(0);
      expect(String(q.rubric ?? '').trim().length, `${q.stem.slice(0, 30)} 没有评分标准`).toBeGreaterThan(10);
    }
  });

  it('可接受的写法只出现在支持它的题上，且都包含标准答案', () => {
    for (const q of day.questions) {
      if (!q.accept) continue;
      expect(q.accept.length).toBeGreaterThan(0);
      expect(q.accept.map((a) => a.toLowerCase())).toContain(String(q.answer).toLowerCase());
    }
  });

  it('分值合理：每题 1–2 分，全卷 10–16 分', () => {
    const total = day.questions.reduce((a, q) => a + q.marks, 0);
    for (const q of day.questions) {
      expect(q.marks).toBeGreaterThanOrEqual(1);
      expect(q.marks).toBeLessThanOrEqual(2);
    }
    expect(total).toBeGreaterThanOrEqual(10);
    expect(total).toBeLessThanOrEqual(16);
  });

  it('一周之内题型是**混着**的，不是同一套模板复制五遍', () => {
    const kinds = new Set(day.questions.map((q) => q.taskType));
    expect(kinds.size, '一天之内题型太单一').toBeGreaterThanOrEqual(4);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 每一个目标词都真的在那篇原文里
// ─────────────────────────────────────────────────────────────

describe.each(EVERY)('S12M —— %s 的生词', (_label, level, day) => {
  it('语境句是原文里的**逐字**句子', () => {
    for (const w of day.words) {
      expect(day.passage.includes(w.context), `${w.headword} 的语境句不在原文里`).toBe(true);
    }
  });

  it('词形真的出现在语境句里，也出现在原文里', () => {
    for (const w of day.words) {
      expect(w.context.includes(w.surfaceForm), `${w.headword} 的词形不在它自己的语境句里`).toBe(true);
      expect(day.passage.includes(w.surfaceForm), `${w.headword} 的词形不在原文里`).toBe(true);
    }
  });

  it('同一天之内 lemma 不重复', () => {
    const heads = day.words.map((w) => w.headword);
    expect(new Set(heads).size, `重复的 lemma：${heads.filter((h, i) => heads.indexOf(h) !== i)}`).toBe(heads.length);
  });

  it('每个词的教学元数据都齐 —— staging 的通用词典只有 59 条，靠它是教不了的', () => {
    for (const w of day.words) {
      expect(w.headword).toMatch(/^[a-z][a-z-]{1,19}$/);
      expect(w.phonetic, `${w.headword} 没有音标`).toMatch(/^\/.+\/$/);
      expect(w.pos, `${w.headword} 没有词性`).toMatch(/\.$/);
      expect(w.translation, `${w.headword} 没有中文释义`).toMatch(/[一-鿿]/);
      // 这一条要挡的是**没有释义**，不是「释义太短」。原来卡 >10 字符，是
      // 手写释义时代留下的门槛；而 `twice` → “two times”、`extraordinarily`
      // → “extremely”、`hardly` → “almost not” 都是好释义，只是短。为了凑
      // 长度换成一句拖泥带水的解释，对学生是净损失。
      expect(w.definition.trim().length, `${w.headword} 没有英文释义`).toBeGreaterThan(3);

      // 一词一义 —— 首发周（2026-09-07）起的新内容适用。
      //
      // ECDICT 会把一个词的所有义项、所有词性塞进同一个字段：`umbrella` 的
      // 英文释义里带着「在地面作战上空维持的军用机编队」，`cleaning` 的中文
      // 里带着「家畜的胞衣」。学习卡第一屏原样显示，中一学生看到的就是这些。
      //
      // 为什么不追溯到第一周：第一周的两个改编档（ielts_light /
      // olevel_intermediate）用的是未加裁剪的旧生成器，词表已经提交。而第一周
      // 在 09-04 结束、真实上线是 09-07，那批卡片不会发到真学生手上，所以
      // 只立标准、不回改历史内容 —— 回改会让已有的 StudentWord 记录与内容包
      // 对不上，代价大于收益。
      if (day.date >= '2026-09-07') {
        expect(w.definition, `${w.headword} 的英文释义堆了多个义项`).not.toMatch(/\\n|\n/);
        expect(w.translation, `${w.headword} 的中文释义堆了多个词性`).not.toMatch(/[；;]/);
      }
      expect(w.contextTranslation, `${w.headword} 的例句没有中文句意`).toMatch(/[一-鿿]/);
      expect(w.contextTranslation.trim().length, `${w.headword} 的例句翻译太短`).toBeGreaterThan(3);
    }
  });

  it('教学顺序就是数组顺序 —— 稳定、可重放', () => {
    const a = day.words.map((w) => w.headword);
    const b = lessonFor(level, day.date)!.words.map((w) => w.headword);
    expect(b).toEqual(a);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 跨档跨天的唯一性与干净度
// ─────────────────────────────────────────────────────────────

describe('S12M —— 全周', () => {
  it('每一篇原文各不相同，标题也各不相同', () => {
    const titles = EVERY.map(([, , d]) => d.title);
    const passages = EVERY.map(([, , d]) => d.passage);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(passages).size).toBe(passages.length);
  });

  it('全部文章与题干都通过近似重复扫描', () => {
    const passages = EVERY.map(([, level, day]) => ({ id: `${level}/${day.date}`, text: day.passage }));
    // 只比题干里**真正属于这道题**的那一段。同一题组的指令是故意完全相同的
    // （雅思标准指令一天三道判断题共用一份），拿整条题干去比量到的是模板，
    // 不是内容 —— 详见 content-similarity.js 的 questionItem。
    const questions = EVERY.flatMap(([, level, day]) => day.questions.map((question, index) => ({ id: `${level}/${day.date}/q${index + 1}`, text: questionItem(question.stem) })));
    expect(findNearDuplicate(passages, passages, 0.25, 5)).toBeNull();
    expect(findNearDuplicate(questions, questions, 0.8, 4)).toBeNull();
  });

  it('学生看得到的每一个字里都没有占位 / 测试标记', () => {
    for (const [, lv, d] of EVERY) {
      const visible = [
        d.title,
        d.passage,
        ...d.questions.flatMap((q) => [q.stem, ...(q.options ?? []).map((o) => o.text)]),
        ...d.words.flatMap((w) => [w.context, w.translation, w.definition]),
      ].join('\n');
      for (const marker of PLACEHOLDER_MARKERS) {
        expect(visible.includes(marker), `${lv}/${d.date} 出现了「${marker}」`).toBe(false);
      }
    }
  });

  it('跨档重复的词只在词典里留一条，且释义一致', () => {
    const all = allWords();
    const heads = all.map((w) => w.headword);
    expect(new Set(heads).size).toBe(heads.length);
    // 抽一个确实跨档出现的词，确认去重逻辑真的在跑
    expect(heads).toContain('rubbish');
    expect(heads).toContain('stiff');
  });

  it('词典补录的规模是**可数的**，不是把整本词典塞进来', () => {
    const all = allWords();
    expect(all.length).toBeLessThanOrEqual(MAX_WORDS_PER_DAY * DATES.length * LEVEL_KEYS.length);
    expect(all.length).toBeGreaterThan(100);
  });

  it('答案 / 线索**不在题干里**：题干本身不得包含参考答案', () => {
    for (const [, lv, d] of EVERY) {
      for (const q of d.questions) {
        if (q.questionType !== 'short_answer') continue;
        const ans = String(q.answer).toLowerCase();
        if (ans.length < 4) continue; // 太短的（数字、单字）不做这条检查
        expect(
          q.stem.toLowerCase().includes(ans),
          `${lv}/${d.date} 的题干里直接写了答案：${q.stem.slice(0, 50)}`,
        ).toBe(false);
      }
    }
  });
});
