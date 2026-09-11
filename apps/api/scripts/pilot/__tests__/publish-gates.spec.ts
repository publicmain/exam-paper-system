/**
 * 发布路径上的内容门禁（PUB03 / CONTENT01，2026-09-11）。
 *
 * `pilot-week-content.spec.ts` 是「写完跑一下」的内容测试；这里钉的是
 * **发布脚本自己**会不会拦 —— 不跑测试也照样发得出去的那条路。
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../../../src/vocab-v2/cefr-difficulty';
import { wordPolicyFor } from '../../../src/vocab-v2/level-policy';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gates = require('../publish-gates');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prep = require('../prepare-pilot-week');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../content');

const levelTools = {
  difficultyProfile,
  contextDifficultyFor: (level: string) => wordPolicyFor(level as never).contextDifficulty,
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const DATES = content.DATES as string[];
const LEVELS = Object.keys(content.LEVELS as Record<string, unknown>);
const GATED_DAY = DATES.find((d) => d >= gates.GATES_FROM) as string;

describe('分值与评分标准矛盾（CONTENT01）', () => {
  const conflict = gates.rubricMarksConflict as (rubric: string, marks: number) => string | null;

  it('09-09 甘地那道题：开头「两分」、满分 1 —— 拦', () => {
    expect(conflict('两分：行为（走到海边自制盐）与违法原因（英国垄断制盐）各 1 分。', 1)).toMatch(/开头写 2 分.*满分却是 1 分/);
  });

  it('同一句评分标准配 2 分满分就不矛盾', () => {
    expect(conflict('两分：行为（走到海边自制盐）与违法原因（英国垄断制盐）各 1 分。', 2)).toBeNull();
  });

  it('各种写法的矛盾都认得出', () => {
    expect(conflict('写出两点给 2 分；只写一点给 1 分。', 1)).toMatch(/给 2 分/);
    expect(conflict('按参考答案的要点给分；本题共 2 分，每个要点 1 分。', 1)).toMatch(/共 2 分/);
    expect(conflict('2 marks: one for each point.', 1)).toMatch(/2 marks/);
    expect(conflict('1 分：答对即给分', 2)).toMatch(/开头写 1 分/);
  });

  it('不矛盾的写法不误伤', () => {
    expect(conflict('一分：答「Captain」即给分。', 1)).toBeNull();
    expect(conflict('两分：放错黄瓜、多找了一次零钱，每点 1 分。', 2)).toBeNull();
    expect(conflict('MP1 (…): …; MP2 (…): …. Award one mark per distinct point.', 2)).toBeNull();
    expect(conflict('写 thirty-four 或 34 都算对（全分）。只写 nine 不给分。', 2)).toBeNull();
    expect(conflict('只认 ceiling。写 roof / wall 不给分 —— 题干要求原文词。', 1)).toBeNull();
    expect(conflict('写出 1,840 loans 得 2 分；只写 1,840 得 1 分。', 2)).toBeNull();
  });
});

describe('发布门禁 × 全部内容包', () => {
  it('六十个「档 × 天」全部可发（09-09 甘地那一题的评分标准已在 CONTENT01 订正）', () => {
    const flagged: string[] = [];
    for (const level of LEVELS) {
      for (const day of content.LEVELS[level]) {
        flagged.push(...gates.lessonProblems(level, day, { levelTools }));
      }
    }
    expect(flagged).toEqual([]);
  });

  it('CONTENT01 回归：09-09 甘地题现在是「一分」评分标准，不再与 marks=1 矛盾', () => {
    const day = content.lessonFor('ielts_light', '2026-09-09');
    const q = day.questions[8];
    expect(q.marks).toBe(1);
    expect(gates.leadingDeclaredMarks(q.rubric)).toBe(1);
    expect(gates.rubricMarksConflict(q.rubric, q.marks)).toBeNull();
  });

  it('发布脚本发任意已发布日期都不会被内容门禁拦下；第三周的日子照常放行', () => {
    expect(() => prep.assertDayContentGates('2026-09-09', levelTools)).not.toThrow();
    for (const d of DATES) {
      expect(prep.dayContentProblems(d, levelTools), d).toEqual([]);
    }
  });

  it('第三周起的日子没有篇幅 / 超纲词检查器就拒绝（fail closed），不当作通过', () => {
    const day = content.lessonFor('olevel', GATED_DAY);
    expect(gates.lessonProblems('olevel', day, {})).toEqual([expect.stringMatching(/没有加载篇幅/)]);
    // 旧日子不需要它
    const old = content.lessonFor('olevel', '2026-09-10');
    expect(gates.lessonProblems('olevel', old, {})).toEqual([]);
  });

  it('发布脚本（纯 node 进程）自己能把 TS 的检查器加载起来（ts-node 只转译）', () => {
    // 放在子进程里跑：ts-node 注册的是进程级 require 钩子，别污染测试进程
    const gatesPath = path.resolve(__dirname, '..', 'publish-gates.js');
    const r = spawnSync(
      process.execPath,
      ['-e', `const t=require(${JSON.stringify(gatesPath)}).loadLevelTools();const p=t.difficultyProfile('The cat sat on the mat by the old door.', t.contextDifficultyFor('olevel'));process.stdout.write(String(p.words));`],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(Number(r.stdout)).toBeGreaterThan(5);
  });
});

describe('发布门禁 —— 反向夹具：每一类问题都拦得住', () => {
  const base = () => clone(content.lessonFor('olevel', GATED_DAY));
  const problems = (day: any, level = 'olevel') => gates.lessonProblems(level, day, { levelTools }) as string[];
  const firstMcq = (day: any) => day.questions.findIndex((q: any) => q.questionType === 'mcq');
  const firstShort = (day: any) => day.questions.findIndex((q: any) => q.questionType === 'short_answer');

  it('基线本身是干净的', () => {
    expect(problems(base())).toEqual([]);
  });

  it('选择题两个选项文字相同（等于两个「正确答案」）', () => {
    const day = base();
    const q = day.questions[firstMcq(day)];
    q.options[1].text = q.options[0].text;
    expect(problems(day).join('\n')).toMatch(/选项文字重复/);
  });

  it('答案键不在选项里（没有正确项）', () => {
    const day = base();
    day.questions[firstMcq(day)].answer = 'Z';
    expect(problems(day).join('\n')).toMatch(/答案键 Z/);
  });

  it('证据句不是原文逐字子串', () => {
    const day = base();
    const i = day.questions.findIndex((q: any) => q.evidence);
    day.questions[i].evidence = 'This sentence is not in the passage at all.';
    expect(problems(day).join('\n')).toMatch(/证据句不是原文逐字子串/);
  });

  it('主观题没有评分标准 / 分值越界 / 评分标准与分值矛盾', () => {
    const a = base();
    a.questions[firstShort(a)].rubric = '';
    expect(problems(a).join('\n')).toMatch(/没有评分标准/);
    const b = base();
    b.questions[firstShort(b)].marks = 3;
    expect(problems(b).join('\n')).toMatch(/分值 3/);
    const c = base();
    const q = c.questions[firstShort(c)];
    q.rubric = q.rubric.replace(/^两分/, '一分').replace(/^一分/, q.marks === 1 ? '两分' : '一分');
    expect(problems(c).join('\n')).toMatch(/评分标准开头写/);
  });

  it('第三周门：评分标准没以「N 分：」开头', () => {
    const day = base();
    const q = day.questions[firstShort(day)];
    q.rubric = `写出要点给分：${q.rubric}`;
    expect(problems(day).join('\n')).toMatch(/没有以「N 分：」开头/);
  });

  /** 第三周起第一个含某种题型（至少 n 道）的「档 × 天」—— 找不到就让测试失败，别静默跳过。 */
  const gatedWith = (taskType: string, n = 1) => {
    for (const level of LEVELS) {
      for (const d of content.LEVELS[level]) {
        if (d.date >= gates.GATES_FROM && d.questions.filter((q: any) => q.taskType === taskType).length >= n) {
          return { level, day: clone(d) };
        }
      }
    }
    throw new Error(`第三周内容里没有 ${n} 道以上的 ${taskType}`);
  };

  it('第三周门：判断题答案全一样', () => {
    const { level, day } = gatedWith('true_false_not_given', 2);
    for (const q of day.questions) if (q.taskType === 'true_false_not_given') q.answer = 'A';
    expect(problems(day, level).join('\n')).toMatch(/判断题/);
  });

  it('第三周门：选择题正确项比干扰项长一半以上', () => {
    const { level, day } = gatedWith('multiple_choice');
    const q = day.questions.find((x: any) => x.taskType === 'multiple_choice');
    const correct = q.options.find((o: any) => o.key === q.answer);
    correct.text = `${correct.text} ${correct.text} ${correct.text}`;
    expect(problems(day, level).join('\n')).toMatch(/正确项比最长的干扰项长/);
  });

  it('第三周门：篇幅超出这一档', () => {
    const day = base();
    day.passage = `${day.passage}\n\n${day.passage}`;
    expect(problems(day).join('\n')).toMatch(/词，这一档要/);
  });

  it('题数不是 10', () => {
    const day = base();
    day.questions.pop();
    expect(problems(day).join('\n')).toMatch(/应有 10 题/);
  });
});
