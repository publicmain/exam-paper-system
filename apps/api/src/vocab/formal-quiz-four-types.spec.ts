/**
 * S9D2D —— 正式单词测试必须**四种题型各一道**。
 *
 * ## 这一条为什么单独立一份
 *
 * 2026-08-30 的 staging 实跑（S9D2C）开出来的四道题只有两种题型：
 * `word_to_meaning` / `meaning_to_word`。`cloze` 与 `spelling`
 * **一次都没出现，而且不可能出现** —— 不是数据不巧，是链路断了：
 *
 *   · `VocabQuizAttemptService.start()` 把选中的词投影成
 *     `{ headword, contextSentence, reps }` 交给 `buildQuiz`，
 *     **`surfaceForm` 在这一步被丢掉**；
 *   · 出题时挖空位置靠 `findClozeSpan(contextSentence, surfaceForm)` 定位，
 *     `surfaceForm` 是 `undefined` → 恒返回 `null`；
 *   · 于是 `spelling` 分支（要求 `clozeSpan`）与 `cloze` 分支（同样要求它）
 *     **对任何学生、任何一天都走不到**，「每轮最多 2 道拼写题」那段预算
 *     是死代码。
 *
 * 自由练习那条路不传 `words`，`chosen` 直接来自完整的 `StudentWord` 行
 * （带 `surfaceForm`），所以它一直是好的 —— **缺陷只在正式测试这条路上**。
 *
 * ## 光把 surfaceForm 传下去还不够
 *
 * 传下去之后，通用算法会给**每个**有挖空位的词出 cloze、并且先占满
 * 2 道 spelling —— 四个词会变成「2 道拼写 + 2 道填空」，选择题一道都没有。
 * 正式测试要的是**四种各一道**，所以它需要一条显式的、确定性的分配策略。
 *
 * ## 证据层级
 *
 * 服务层行为测试：跑的是**真的** `VocabQuizAttemptService` +
 * **真的** `VocabQuizService` 的组合，只在 Prisma 这个存储边界打桩。
 * 不连数据库，不声称 staging / 真机结论。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { VocabQuizAttemptService } from './vocab-quiz-attempt.service';
import { VocabQuizService, formalTypePlan, resolveFormalType } from './vocab-quiz.service';

// ─────────────────────────────────────────────────────────────
// 夹具：一个四词的正式任务，四个词**全都**支持全部题型
//
// 与 staging 的 t6_done 同形：教过、到期、有原句、原句里含词形、
// 词长 4–12 且纯字母（isSpellable），且 reps > 0（拼写题的门槛）。
// ─────────────────────────────────────────────────────────────

const STUDENT = { id: 's1', name: '测试' };
const DLC_ID = 'dlc1';

const WORDS = [
  { headword: 'harbour', surfaceForm: 'harbour', translation: 'n. 海港' },
  { headword: 'lantern', surfaceForm: 'lantern', translation: 'n. 灯笼' },
  { headword: 'meadow', surfaceForm: 'meadow', translation: 'n. 草地' },
  { headword: 'pebble', surfaceForm: 'pebble', translation: 'n. 卵石' },
];

const ctx = (w: string) => `The ${w} lay still in the evening light.`;

interface WordRow {
  id: string;
  studentId: string;
  headword: string;
  surfaceForm: string | null;
  contextSentence: string | null;
  reps: number;
  firstTaughtAt: Date | null;
  due: Date;
}

function studentWordRows(over: Partial<{ reps: number; surfaceForm: string | null }> = {}): WordRow[] {
  return WORDS.map((w, i) => ({
    id: `sw${i}`,
    studentId: STUDENT.id,
    headword: w.headword,
    surfaceForm: over.surfaceForm !== undefined ? over.surfaceForm : w.surfaceForm,
    contextSentence: ctx(w.headword) as string | null,
    reps: over.reps !== undefined ? over.reps : 3,
    firstTaughtAt: new Date('2026-08-20T00:00:00Z') as Date | null,
    due: new Date('2026-08-29T00:00:00Z'),
  }));
}

// ─────────────────────────────────────────────────────────────
// 假 Prisma —— 只到存储边界为止
// ─────────────────────────────────────────────────────────────

function fakePrisma(opts: { words?: WordRow[] } = {}) {
  const rows = opts.words ?? studentWordRows();
  const created: any[] = [];
  return {
    created,
    dailyLessonCompletion: {
      findUnique: async () => ({
        id: DLC_ID,
        vocabWords: WORDS.map((w) => w.headword),
        stage: 'vocab_test',
      }),
    },
    vocabQuizAttempt: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const row = {
          id: 'att1',
          status: data.status,
          startedAt: new Date('2026-08-30T02:00:00Z'),
          submittedAt: null,
          total: data.total,
          correct: 0,
          score: 0,
          items: data.items,
        };
        created.push(row);
        return row;
      },
    },
    studentWord: {
      // 自由练习那条路会问两次：先「今天到期且教过的」，不够再补
      // 「教过但不在上一批里的」。第二次带 `headword.notIn` —— 认它，
      // 否则同一批词会被算两遍，测出来的题数是假的。
      findMany: async (args: any = {}) => {
        const notIn: string[] | undefined = args?.where?.headword?.notIn;
        return notIn ? rows.filter((r) => !notIn.includes(r.headword)) : rows;
      },
    },
    dictEntry: {
      findMany: async () => WORDS.map((w) => ({
        word: w.headword,
        translation: w.translation,
        phonetic: '/x/',
        bnc: 4000,
      })),
    },
    // 词典兜底干扰项池 —— 本夹具靠学生自己的四个词就够了，返回空
    $queryRaw: async () => [],
  } as any;
}

function makeService(prisma: any) {
  const words = {
    resolveStudent: async () => STUDENT,
  } as any;
  const review = {
    streakDays: async () => 0,
  } as any;
  const quiz = new VocabQuizService(prisma, words, review);
  return { quiz, attempts: new VocabQuizAttemptService(prisma, words, quiz) };
}

const START_INPUT = { studentName: STUDENT.name, authStudentId: STUDENT.id };

const countTypes = (items: Array<{ qtype: string }>) =>
  items.reduce<Record<string, number>>((acc, it) => {
    acc[it.qtype] = (acc[it.qtype] ?? 0) + 1;
    return acc;
  }, {});

// ─────────────────────────────────────────────────────────────
// 1 —— 正式路径必须把 surfaceForm 传下去
// ─────────────────────────────────────────────────────────────

describe('S9D2D-1 正式路径的固定词表契约', () => {
  it('**交给 buildQuiz 的每个词都带 surfaceForm**（丢掉它 = cloze/spelling 全灭）', async () => {
    const prisma = fakePrisma();
    const { quiz, attempts } = makeService(prisma);
    let handed: any[] | null = null;
    const orig = quiz.buildQuiz.bind(quiz);
    (quiz as any).buildQuiz = async (input: any) => {
      handed = input.words ?? null;
      return orig(input);
    };

    await attempts.start(START_INPUT);

    expect(handed, '正式路径没有传固定词表').not.toBeNull();
    expect(handed!).toHaveLength(4);
    for (const w of handed!) {
      expect(Object.keys(w).sort()).toEqual(
        ['contextSentence', 'headword', 'reps', 'surfaceForm'].sort(),
      );
      expect(typeof w.surfaceForm, `${w.headword} 的 surfaceForm 丢了`).toBe('string');
      expect(String(w.surfaceForm).length).toBeGreaterThan(0);
      // 原句里真的含这个词形 —— 否则 findClozeSpan 定位不到
      expect(String(w.contextSentence).toLowerCase()).toContain(String(w.surfaceForm).toLowerCase());
    }
  });

  it('**类型契约显式声明 surfaceForm**，不靠 `any` 把不一致藏起来', async () => {
    // 编译期由 tsc 保证；这里钉住运行时形状，防止有人把投影改回三字段
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);
    expect(view.items).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────
// 2 —— 四种题型各一道（本片的主张）
// ─────────────────────────────────────────────────────────────

describe('S9D2D-2 四个全能词 → 四种题型各一道', () => {
  it('**qtype 多重集恰好是 {word_to_meaning, meaning_to_word, cloze, spelling} 各一**', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);

    expect(view.items).toHaveLength(4);
    expect(countTypes(view.items as any)).toEqual({
      word_to_meaning: 1,
      meaning_to_word: 1,
      cloze: 1,
      spelling: 1,
    });
  });

  it('**四个冻结词各出现一次**，不重不漏，且顺序由服务端决定', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    await attempts.start(START_INPUT);
    const items = prisma.created[0].items as any[];
    expect(items.map((i) => i.headword)).toEqual(WORDS.map((w) => w.headword));
  });

  it('**分配是确定性的** —— 同样的输入跑两次，题型序列逐字相同', async () => {
    const a = makeService(fakePrisma());
    const b = makeService(fakePrisma());
    const va = await a.attempts.start(START_INPUT);
    const vb = await b.attempts.start(START_INPUT);
    expect((vb.items as any[]).map((i) => i.qtype)).toEqual((va.items as any[]).map((i) => i.qtype));
  });

  it('**cloze 真的挖了空**，而且挖的是那个词', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    await attempts.start(START_INPUT);
    const items = prisma.created[0].items as any[];
    const cz = items.find((i) => i.qtype === 'cloze')!;
    expect(cz, '没有 cloze 题').toBeTruthy();
    expect(cz.prompt).toContain('＿＿＿');
    expect(cz.prompt.toLowerCase()).not.toContain(cz.headword.toLowerCase());
    expect(cz.options).toHaveLength(4);
    expect(cz.correctIndex).toBeGreaterThanOrEqual(0);
    expect(cz.options[cz.correctIndex]).toBe(cz.headword);
  });

  it('**spelling 有服务端答案、没有选项**，题干挖了空', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    await attempts.start(START_INPUT);
    const items = prisma.created[0].items as any[];
    const sp = items.find((i) => i.qtype === 'spelling')!;
    expect(sp, '没有 spelling 题').toBeTruthy();
    expect(sp.options).toEqual([]);
    expect(sp.correctIndex).toBe(-1);
    expect(typeof sp.answer).toBe('string');
    expect(String(sp.answer).toLowerCase()).toBe(sp.headword.toLowerCase());
    expect(sp.prompt).toContain('＿＿＿');
  });

  it('**两道选择题各有四个选项与合法 correctIndex**', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    await attempts.start(START_INPUT);
    const items = prisma.created[0].items as any[];
    for (const it of items.filter((i) => i.qtype === 'word_to_meaning' || i.qtype === 'meaning_to_word')) {
      expect(it.options).toHaveLength(4);
      expect(it.correctIndex).toBeGreaterThanOrEqual(0);
      expect(it.correctIndex).toBeLessThan(4);
      expect(it.answer ?? null).toBeNull();
    }
  });

  it('**落库快照把题型永久固定下来**（回读不重算）', async () => {
    const prisma = fakePrisma();
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);
    const stored = prisma.created[0].items as any[];
    expect(stored.map((i) => i.qtype)).toEqual((view.items as any[]).map((i) => i.qtype));
  });
});

// ─────────────────────────────────────────────────────────────
// 3 —— 分配策略本身（纯函数，直接驱动）
// ─────────────────────────────────────────────────────────────

describe('S9D2D-3 分配策略与降级', () => {
  const cap = (canSpell: boolean, canCloze: boolean) => ({ canSpell, canCloze });

  it('四个全能词 → 拼写、填空、看词选义、看义选词', () => {
    expect(formalTypePlan([cap(true, true), cap(true, true), cap(true, true), cap(true, true)])).toEqual(
      ['spelling', 'cloze', 'word_to_meaning', 'meaning_to_word'],
    );
  });

  it('**没有词能出拼写** → 不硬出，剩下的按选择题交替补齐', () => {
    expect(formalTypePlan([cap(false, true), cap(false, true), cap(false, true), cap(false, true)])).toEqual(
      ['cloze', 'word_to_meaning', 'meaning_to_word', 'word_to_meaning'],
    );
  });

  it('**一个都挖不了空** → 两种选择题交替，绝不凭空造答案', () => {
    const plan = formalTypePlan([cap(false, false), cap(false, false), cap(false, false), cap(false, false)]);
    expect(plan).toEqual(['word_to_meaning', 'meaning_to_word', 'word_to_meaning', 'meaning_to_word']);
    expect(plan).not.toContain('spelling');
    expect(plan).not.toContain('cloze');
  });

  it('**只有第三个词能拼写** → 拼写落在它身上，位置不挪', () => {
    expect(formalTypePlan([cap(false, true), cap(false, true), cap(true, true), cap(false, false)])).toEqual(
      ['cloze', 'word_to_meaning', 'spelling', 'meaning_to_word'],
    );
  });

  it('**超过四个词**：前四种排完之后按选择题交替续', () => {
    const plan = formalTypePlan([cap(true, true), cap(true, true), cap(true, true), cap(true, true), cap(true, true), cap(true, true)]);
    expect(plan.slice(0, 2)).toEqual(['spelling', 'cloze']);
    expect(plan.slice(2)).toEqual(['word_to_meaning', 'meaning_to_word', 'word_to_meaning', 'meaning_to_word']);
  });

  it('**能力不足时的降级是有名字的**，不是悄悄换题', () => {
    expect(resolveFormalType('spelling', cap(false, true))).toEqual({ qtype: 'cloze', degradedFrom: 'spelling' });
    expect(resolveFormalType('spelling', cap(false, false))).toEqual({ qtype: 'word_to_meaning', degradedFrom: 'spelling' });
    expect(resolveFormalType('cloze', cap(false, false))).toEqual({ qtype: 'word_to_meaning', degradedFrom: 'cloze' });
    expect(resolveFormalType('spelling', cap(true, true))).toEqual({ qtype: 'spelling', degradedFrom: null });
    expect(resolveFormalType('cloze', cap(false, true))).toEqual({ qtype: 'cloze', degradedFrom: null });
    expect(resolveFormalType('word_to_meaning', cap(false, false))).toEqual({ qtype: 'word_to_meaning', degradedFrom: null });
  });
});

// ─────────────────────────────────────────────────────────────
// 4 —— 降级在**整条正式链路**上也成立（不是只有纯函数对）
// ─────────────────────────────────────────────────────────────

describe('S9D2D-4 词撑不起指定题型时的整链降级', () => {
  it('**reps=0（刚教过的新词）→ 不出拼写题**，也不凭空造答案', async () => {
    const prisma = fakePrisma({ words: studentWordRows({ reps: 0 }) });
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);
    const types = countTypes(view.items as any);
    expect(types.spelling ?? 0).toBe(0);
    expect(view.items).toHaveLength(4);
    for (const it of view.items as any[]) {
      if (it.qtype !== 'spelling') continue;
      throw new Error('不该有拼写题');
    }
  });

  it('**原句里定位不到词形 → 既不出填空也不出拼写**，退回选择题', async () => {
    const rows = studentWordRows().map((r) => ({ ...r, contextSentence: 'A sentence without the target token.' }));
    const prisma = fakePrisma({ words: rows });
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);
    const types = countTypes(view.items as any);
    expect(types.spelling ?? 0).toBe(0);
    expect(types.cloze ?? 0).toBe(0);
    expect((types.word_to_meaning ?? 0) + (types.meaning_to_word ?? 0)).toBe(4);
  });

  it('**没有原句** → 同样退回选择题，题数不减', async () => {
    const rows = studentWordRows().map((r) => ({ ...r, contextSentence: null }));
    const prisma = fakePrisma({ words: rows });
    const { attempts } = makeService(prisma);
    const view = await attempts.start(START_INPUT);
    expect(view.items).toHaveLength(4);
    expect(countTypes(view.items as any).cloze ?? 0).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 5 —— 自由练习那条路**一个字都不能变**
// ─────────────────────────────────────────────────────────────

describe('S9D2D-5 自由练习不受影响', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = fakePrisma();
  });

  it('**不传 words 时仍走自己选词的老路**，题型仍按老规则推断', async () => {
    const { quiz } = makeService(prisma);
    const built = await quiz.buildQuiz({ studentName: STUDENT.name, authStudentId: STUDENT.id });
    // 老规则：有挖空位 → cloze；拼写题预算每轮最多 2 道且要 reps>0
    const types = countTypes(built.questions as any);
    expect(built.questions.length).toBe(4);
    expect(types.spelling).toBe(2);
    expect(types.cloze).toBe(2);
    expect(types.word_to_meaning ?? 0).toBe(0);
    expect(types.meaning_to_word ?? 0).toBe(0);
  });

  it('**正式路径与自由练习给出不同的题型分布** —— 两条路没有被合并', async () => {
    const { quiz, attempts } = makeService(prisma);
    const free = countTypes((await quiz.buildQuiz({ studentName: STUDENT.name, authStudentId: STUDENT.id })).questions as any);
    const formal = countTypes((await attempts.start(START_INPUT)).items as any);
    expect(free).not.toEqual(formal);
    expect(formal).toEqual({ word_to_meaning: 1, meaning_to_word: 1, cloze: 1, spelling: 1 });
  });
});
