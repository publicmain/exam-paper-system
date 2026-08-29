import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VocabQuizAttemptService } from './vocab-quiz-attempt.service';

/**
 * S9B0 —— **未作答的题不得下发任何带答案的元数据**。
 *
 * ## 泄的是什么
 *
 * `view()` 一直只扣着 `correctIndex` / `answer` 两个字段，却把
 * `headword` / `translation` / `phonetic` / `contextSentence` 原样下发。
 * 对四种题型来说，这几个字段**本身就是答案**：
 *
 * | 题型 | 题干 | 选项 | 泄答案的字段 |
 * |---|---|---|---|
 * | `word_to_meaning` | 单词 | 四个释义 | `translation` = 正确选项原文 |
 * | `meaning_to_word` | 释义 | 四个单词 | `headword` = 正确选项原文 |
 * | `cloze` | 挖空句 | 四个单词 | `headword`；`contextSentence` 是**没挖空的原句** |
 * | `spelling` | 挖空句 | （无） | `headword` ≈ 要拼的词；`contextSentence` 是原句 |
 *
 * `phonetic` 同理 —— 音标就是那个词的读法，看义选词 / 挖空 / 拼写题上
 * 它是强提示。
 *
 * 也就是说：打开 devtools 看一眼网络响应，整份卷子的答案都在里面。
 *
 * ## 这里怎么证
 *
 * 每个字段塞一个**题干和选项里都不存在的哨兵值**，然后断言序列化后的
 * 响应里**一个哨兵都搜不到**。这比逐字段 `toBeNull()` 强：字段被换个名字
 * 重新下发、或者被塞进某个嵌套对象里，哨兵照样能抓到。
 */

const S = {
  headword: 'SENTINEL_HEADWORD_a1b2',
  translation: 'SENTINEL_TRANSLATION_c3d4',
  phonetic: 'SENTINEL_PHONETIC_e5f6',
  context: 'SENTINEL_CONTEXT_g7h8',
} as const;

const ALL_SENTINELS = Object.values(S);

/** 四种题型各一道。题干与选项里刻意不含任何哨兵。 */
function items() {
  return [
    {
      qtype: 'word_to_meaning',
      headword: S.headword + '_0',
      prompt: 'harbour',
      options: ['港口', '灯笼', '草地', '卵石'],
      correctIndex: 0,
      answer: null,
      phonetic: S.phonetic + '_0',
      translation: S.translation + '_0',
      contextSentence: S.context + '_0',
      studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
    },
    {
      qtype: 'meaning_to_word',
      headword: S.headword + '_1',
      prompt: '灯笼',
      options: ['harbour', 'lantern', 'meadow', 'pebble'],
      correctIndex: 1,
      answer: null,
      phonetic: S.phonetic + '_1',
      translation: S.translation + '_1',
      contextSentence: S.context + '_1',
      studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
    },
    {
      qtype: 'cloze',
      headword: S.headword + '_2',
      prompt: 'The ＿＿＿ was green.',
      options: ['harbour', 'lantern', 'meadow', 'pebble'],
      correctIndex: 2,
      answer: null,
      phonetic: S.phonetic + '_2',
      translation: S.translation + '_2',
      contextSentence: S.context + '_2',
      studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
    },
    {
      qtype: 'spelling',
      headword: S.headword + '_3',
      prompt: 'A small ＿＿＿ on the path.',
      options: [],
      correctIndex: -1,
      answer: 'pebble',
      phonetic: S.phonetic + '_3',
      translation: S.translation + '_3',
      contextSentence: S.context + '_3',
      studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null,
    },
  ];
}

function makeSvc(over: { status?: string; items?: any[] } = {}) {
  let stored: any = {
    id: 'att1',
    status: over.status ?? 'in_progress',
    startedAt: new Date('2026-08-29T00:00:00Z'),
    submittedAt: over.status === 'submitted' ? new Date('2026-08-29T01:00:00Z') : null,
    total: 4,
    correct: 0,
    score: 0,
    dailyLessonCompletionId: 'dlc1',
    items: over.items ?? items(),
  };
  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    vocabQuizAttempt: {
      findFirst: async () => stored,
      findUnique: async () => stored,
      updateMany: async ({ data }: any) => {
        stored = { ...stored, ...data, items: data.items ?? stored.items };
        return { count: 1 };
      },
    },
    dailyLessonCompletion: {
      findUnique: async () => ({ id: 'dlc1', stage: 'vocab_test', vocabWords: [] }),
      updateMany: async () => ({ count: 1 }),
    },
    studentWord: {
      update: () => { throw new Error('考试不得改写 FSRS 字段'); },
      updateMany: () => { throw new Error('考试不得改写 FSRS 字段'); },
    },
    wordReviewLog: {
      create: () => { throw new Error('考试不得写复习流水'); },
    },
    studentSubmission: {
      create: () => { throw new Error('考试不得写阅读答卷'); },
      update: () => { throw new Error('考试不得写阅读答卷'); },
      updateMany: () => { throw new Error('考试不得写阅读答卷'); },
    },
  };
  const words = { resolveStudent: vi.fn(async () => ({ id: 'stu1', name: '小明' })) } as any;
  const quiz = { buildQuiz: vi.fn(async () => ({ questions: [] })) } as any;
  return {
    svc: new VocabQuizAttemptService(prisma, words, quiz),
    snapshot: () => stored.items,
  };
}

/** 序列化整份响应，看有没有哨兵漏出去。 */
function leaked(res: unknown): string[] {
  const s = JSON.stringify(res);
  return ALL_SENTINELS.filter((v) => s.includes(v));
}

const ANSWER_META = ['headword', 'translation', 'phonetic', 'contextSentence'] as const;

beforeEach(() => vi.clearAllMocks());

// ─────────────────────────────────────────────────────────────

describe('未作答的题：一个带答案的字段都不下发', () => {
  it('**start / 恢复**：四种题型全部遮住，序列化后搜不到任何哨兵', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.start({ studentName: '小明' });
    expect(r.items).toHaveLength(4);
    expect(leaked(r)).toEqual([]);
    for (const it of r.items) {
      for (const f of ANSWER_META) expect(it[f], `${it.qtype}.${f}`).toBeNull();
      expect(it.correctIndex).toBeNull();
      expect(it.answer).toBeNull();
    }
  });

  it('**current / resume 用同一套遮法**（不是只在 start 上遮）', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.current({ studentName: '小明' });
    expect(leaked(r)).toEqual([]);
    for (const it of r.items) {
      for (const f of ANSWER_META) expect(it[f]).toBeNull();
    }
  });

  it('**渲染题目要的字段一个不少**：index / qtype / prompt / options', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.current({ studentName: '小明' });
    expect(r.items.map((x: any) => x.index)).toEqual([0, 1, 2, 3]);
    expect(r.items.map((x: any) => x.qtype)).toEqual([
      'word_to_meaning', 'meaning_to_word', 'cloze', 'spelling',
    ]);
    expect(r.items[0].prompt).toBe('harbour');
    expect(r.items[1].options).toEqual(['harbour', 'lantern', 'meadow', 'pebble']);
    expect(r.items[3].options).toEqual([]);
  });

  it('**作答状态字段仍然是 null**（没答就是没答）', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.current({ studentName: '小明' });
    for (const it of r.items) {
      expect(it.studentIndex).toBeNull();
      expect(it.studentAnswer).toBeNull();
      expect(it.isCorrect).toBeNull();
      expect(it.answeredAt).toBeNull();
    }
  });

  it('**不动落库的快照** —— 遮的是下发，不是存储', async () => {
    const { svc, snapshot } = makeSvc();
    await svc.start({ studentName: '小明' });
    await svc.current({ studentName: '小明' });
    for (let n = 0; n < 4; n++) {
      expect(snapshot()[n].headword).toBe(S.headword + '_' + n);
      expect(snapshot()[n].translation).toBe(S.translation + '_' + n);
      expect(snapshot()[n].phonetic).toBe(S.phonetic + '_' + n);
      expect(snapshot()[n].contextSentence).toBe(S.context + '_' + n);
    }
  });

  it('题目条数 / 顺序 / attempt 元信息都不变', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.current({ studentName: '小明' });
    expect(r.attemptId).toBe('att1');
    expect(r.status).toBe('in_progress');
    expect(r.total).toBe(4);
    expect(r.correct).toBe(0);
    expect(r.score).toBeNull();
  });
});

describe('作答之后：只揭开这一题', () => {
  it('**答了第 0 题 → 只有第 0 题揭开**，其余三题照旧遮着', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    expect(r.accepted).toBe(true);

    const answered = r.items[0];
    expect(answered.headword).toBe(S.headword + '_0');
    expect(answered.translation).toBe(S.translation + '_0');
    expect(answered.phonetic).toBe(S.phonetic + '_0');
    expect(answered.contextSentence).toBe(S.context + '_0');
    expect(answered.correctIndex).toBe(0);
    expect(answered.isCorrect).toBe(true);

    for (const it of r.items.slice(1)) {
      for (const f of ANSWER_META) expect(it[f], `${it.qtype}.${f}`).toBeNull();
      expect(it.correctIndex).toBeNull();
      expect(it.answer).toBeNull();
    }
    // 只有第 0 题的哨兵允许出现
    expect(leaked({ items: r.items.slice(1) })).toEqual([]);
  });

  it('**选择题揭开的是服务端的 correctIndex**，答错也照给', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.answer({ studentName: '小明', index: 1, optionIndex: 3 });
    expect(r.items[1].correctIndex).toBe(1);
    expect(r.items[1].isCorrect).toBe(false);
    expect(r.items[1].studentIndex).toBe(3);
  });

  it('**拼写题揭开的是服务端的 answer**', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.answer({ studentName: '小明', index: 3, text: 'pebble' });
    expect(r.items[3].answer).toBe('pebble');
    expect(r.items[3].isCorrect).toBe(true);
    expect(r.items[3].headword).toBe(S.headword + '_3');
    // 其余三题仍然遮着
    expect(leaked({ items: r.items.slice(0, 3) })).toEqual([]);
  });

  it('**already_answered：原样返回已存的答案，不覆盖**，且仍只揭开这一题', async () => {
    const { svc } = makeSvc();
    await svc.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    const again: any = await svc.answer({ studentName: '小明', index: 0, optionIndex: 3 });
    expect(again.accepted).toBe(false);
    expect(again.reason).toBe('already_answered');
    expect(again.items[0].studentIndex).toBe(0); // 第一次的答案
    expect(again.items[0].isCorrect).toBe(true);
    expect(again.items[0].correctIndex).toBe(0);
    expect(leaked({ items: again.items.slice(1) })).toEqual([]);
  });
});

describe('交卷之后：全部揭开', () => {
  it('**每一题都给全**，逐题回看要用', async () => {
    const { svc } = makeSvc();
    const r: any = await svc.submit({ studentName: '小明' });
    expect(r.status).toBe('submitted');
    for (let n = 0; n < 4; n++) {
      expect(r.items[n].headword).toBe(S.headword + '_' + n);
      expect(r.items[n].translation).toBe(S.translation + '_' + n);
      expect(r.items[n].phonetic).toBe(S.phonetic + '_' + n);
      expect(r.items[n].contextSentence).toBe(S.context + '_' + n);
    }
    expect(r.items[0].correctIndex).toBe(0);
    expect(r.items[3].answer).toBe('pebble');
  });

  it('落库的 total / correct / score 仍然是权威', async () => {
    const { svc } = makeSvc({
      status: 'submitted',
      items: items().map((it, n) => ({ ...it, isCorrect: n < 3, studentIndex: 0 })),
    });
    const r: any = await svc.submit({ studentName: '小明' });
    expect(r.alreadySubmitted).toBe(true);
    expect(r.total).toBe(4);
    expect(r.correct).toBe(0); // 落库的值，不是现算的
    expect(r.score).toBe(0);
  });
});
