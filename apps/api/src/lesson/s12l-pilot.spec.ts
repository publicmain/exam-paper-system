/**
 * S12L —— 小范围试点要修的东西（服务端这一半）。
 *
 * 试点的目标不是「架构对」，是**让真学生用得下去**。这一份钉三件事：
 *
 *   1. 错题段暂停之后，今天的分母是 2 不是 3，阶段与完成也不再等它；
 *   2. 正式测试的题数 = 今天教了几个词，不是恒定的 10；
 *   3. 二十一道题里四种题型都要出现，而不是「一道拼写 + 一道填空 +
 *      十九道选择」。
 *
 * 全部是纯函数，不连库。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  deriveStage,
  lessonComplete,
  lessonProgress,
  type LessonSegments,
} from './lesson-rules';
import { selectEligible, type EligibilityWord } from '../vocab/quiz-eligibility';
import { cueFor, formalTypePlan, type WordTypeCapability } from '../vocab/vocab-quiz.service';
import { LessonService, lessonWordsFromConfig } from './lesson.service';

// ─────────────────────────────────────────────────────────────
// 1. 错题段暂停
// ─────────────────────────────────────────────────────────────

const AVAIL_NO_DRILL = { read: true, vocab: true, drill: false } as const;

describe('S12L —— 错题段不可用时的完成度', () => {
  const seg = (over: Partial<LessonSegments> = {}): LessonSegments => ({
    read: 'done',
    vocab: 'done',
    drill: 'todo',
    ...over,
  });

  it('分母只数可用的必修段 —— 两段，不是三段', () => {
    const p = lessonProgress(seg(), AVAIL_NO_DRILL);
    expect(p.total).toBe(2);
    expect(p.completed).toBe(2);
  });

  it('错题没做完不影响「整节课完成」', () => {
    expect(lessonComplete(seg({ drill: 'todo' }), AVAIL_NO_DRILL)).toBe(true);
  });

  it('阶段不再卡在补段上 —— 读完 + 背完 = done', () => {
    expect(
      deriveStage({
        readSettled: true,
        vocabSettled: true,
        hasPendingCourseCards: false,
        drillSettled: false,
        drillAvailable: false,
      }),
    ).toBe('done');
  });

  it('错题段可用时行为一个字不变（默认三段）', () => {
    expect(lessonProgress(seg()).total).toBe(3);
    expect(lessonComplete(seg({ drill: 'todo' }))).toBe(false);
    expect(
      deriveStage({
        readSettled: true,
        vocabSettled: true,
        hasPendingCourseCards: false,
        drillSettled: false,
      }),
    ).toBe('vocab_test');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 正式测试的题数 = 今天学了几个词
// ─────────────────────────────────────────────────────────────

const taught = (n: number): EligibilityWord[] =>
  Array.from({ length: n }, (_, i) => ({
    headword: `w${i + 1}`,
    firstTaughtAt: new Date('2026-08-31T00:00:00Z'),
    due: new Date('2026-08-31T00:00:00Z'),
  }));

describe('S12L —— 正式测试一词一题', () => {
  it('教了 21 个词就考 21 题（不再静默截到 10）', () => {
    const out = selectEligible(taught(21));
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect(out.words).toHaveLength(21);
  });

  it('只教了 1 / 2 / 3 个词也开得出测试，不补题也不拒绝', () => {
    for (const n of [1, 2, 3]) {
      const out = selectEligible(taught(n));
      expect(out.kind, `教了 ${n} 个词却开不出测试`).toBe('ok');
      if (out.kind !== 'ok') continue;
      expect(out.words).toHaveLength(n);
    }
  });

  it('一个都没教过 —— 仍然明说没准备好', () => {
    expect(selectEligible([]).kind).toBe('not_ready');
    expect(
      selectEligible([{ headword: 'a', firstTaughtAt: null, due: new Date() }]).kind,
    ).toBe('not_ready');
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 题型分布
// ─────────────────────────────────────────────────────────────

const cap = (n: number, all = true): WordTypeCapability[] =>
  Array.from({ length: n }, () => ({ canSpell: all, canCloze: all }));

describe('S12L —— 二十一题里四种题型都要出现', () => {
  it('21 个全能词：四种题型各自至少出现 4 次', () => {
    const plan = formalTypePlan(cap(21));
    const count = (t: string) => plan.filter((p) => p === t).length;
    for (const t of ['spelling', 'cloze', 'word_to_meaning', 'meaning_to_word']) {
      expect(count(t), `${t} 只出现了 ${count(t)} 次`).toBeGreaterThanOrEqual(4);
    }
    expect(plan).toHaveLength(21);
  });

  it('四个全能词仍然是四种各一道（既有行为不变）', () => {
    expect([...formalTypePlan(cap(4))].sort()).toEqual(
      ['cloze', 'meaning_to_word', 'spelling', 'word_to_meaning'].sort(),
    );
  });

  it('确定性：同样的输入永远同样的计划', () => {
    expect(formalTypePlan(cap(21))).toEqual(formalTypePlan(cap(21)));
  });

  it('拼不出 / 挖不了空的词不硬出，降级由下游处理', () => {
    const plan = formalTypePlan(cap(8, false));
    expect(plan).toHaveLength(8);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 安全线索：指得到那个词，但产不出它
// ─────────────────────────────────────────────────────────────

describe('S12L —— 拼写 / 填空题的安全线索', () => {
  const SRC = { pos: 'vt.', translation: '实现，完成；取得', definition: 'to succeed in reaching a goal' };

  it('拼写题给得出线索：词性 + 中文释义 + 该做什么', () => {
    const cue = cueFor('spelling', SRC, ['achieve', 'achieved']);
    expect(cue).not.toBeNull();
    expect(cue!.pos).toBe('vt.');
    expect(cue!.translation).toBe('实现，完成；取得');
    expect(cue!.instruction).toContain('拼');
  });

  it('填空题同样给', () => {
    expect(cueFor('cloze', SRC, ['achieve'])!.instruction).toContain('选');
  });

  it('**选择题不给线索** —— 选项本身就是释义，给了等于给答案', () => {
    expect(cueFor('word_to_meaning', SRC, ['achieve'])).toBeNull();
    expect(cueFor('meaning_to_word', SRC, ['achieve'])).toBeNull();
  });

  it('线索里混进答案 → 那一项作废（大小写、词形变化都算）', () => {
    const leaky = { pos: 'v. (achieve)', translation: '实现（Achieve）', definition: 'to ACHIEVED something' };
    expect(cueFor('spelling', leaky, ['achieve'])).toBeNull();
  });

  it('只要还剩一项干净的，线索照给；三项全脏才整条作废', () => {
    const half = { pos: 'vt.', translation: '实现（achieve）', definition: 'achieve something' };
    const cue = cueFor('spelling', half, ['achieve']);
    expect(cue!.pos).toBe('vt.');
    expect(cue!.translation).toBeNull();
    expect(cue!.definition).toBeNull();
  });

  it('答案 token 与 headword 两个都要挡', () => {
    // 原文里的词形与词典词条不同（achieved / achieve）
    expect(cueFor('spelling', { translation: 'achieved 的意思' }, ['achieve', 'achieved'])).toBeNull();
  });

  it('一个字都没有的线索不给空壳', () => {
    expect(cueFor('spelling', { pos: '', translation: '  ', definition: null }, ['x'])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. S12M —— 词性别说两遍
// ─────────────────────────────────────────────────────────────

describe('S12M —— 线索里的词性不重复', () => {
  it('释义已经带了词性 → 不再单发一份（否则学生看到「adj.adj. 粗心的」）', () => {
    const cue = cueFor('cloze', { pos: 'adj.', translation: 'adj. 粗心的，不在乎的' }, ['careless']);
    expect(cue!.pos).toBeNull();
    expect(cue!.translation).toBe('adj. 粗心的，不在乎的');
  });

  it('大小写不同也算带了', () => {
    expect(cueFor('cloze', { pos: 'VT.', translation: 'vt. 实现' }, ['achieve'])!.pos).toBeNull();
  });

  it('释义里没有词性时照发 —— 那是学生真正需要的一条信息', () => {
    const cue = cueFor('spelling', { pos: 'n.', translation: '预算' }, ['budget']);
    expect(cue!.pos).toBe('n.');
    expect(cue!.translation).toBe('预算');
  });

  it('只剩词性一样的情况下线索仍然成立', () => {
    const cue = cueFor('spelling', { pos: 'n.', translation: 'budget 的意思' }, ['budget']);
    expect(cue!.pos).toBe('n.');
    expect(cue!.translation).toBeNull();
  });
});

describe('小范围上线 —— 新注册学生第一次开课就拿到当天生词', () => {
  const payload = {
    lessonWords: [
      { headword: 'Emerges', surfaceForm: 'emerges', context: 'A pattern emerges slowly.' },
      { headword: 'emerge', surfaceForm: 'emerge', context: 'duplicate lemma' },
      { headword: '', surfaceForm: '', context: '' },
    ],
  };

  it('只接受发布卷 config 里的合法、去重词条', () => {
    expect(lessonWordsFromConfig(payload)).toEqual([
      { headword: 'emerges', surfaceForm: 'emerges', context: 'A pattern emerges slowly.' },
      { headword: 'emerge', surfaceForm: 'emerge', context: 'duplicate lemma' },
    ]);
    expect(lessonWordsFromConfig({})).toEqual([]);
  });

  it('补词是幂等批量写，保留原文语境，不覆盖学生已有词', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const svc = new LessonService(
      { studentWord: { createMany } } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const words = lessonWordsFromConfig(payload);
    await (svc as any).ensureLessonWords('student-new', 'A pattern', words, new Date('2026-09-01T00:00:00Z'));
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          studentId: 'student-new',
          headword: 'emerges',
          sourceType: 'teacher_push',
          sourcePassageTitle: 'A pattern',
          contextSentence: 'A pattern emerges slowly.',
        }),
      ]),
    }));
  });
});
