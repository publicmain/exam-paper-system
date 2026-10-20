import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fp = require('../visible-fingerprint');

/**
 * 发布前必须审过（2026-10-20 叶老师硬规则）。
 *
 * prepare-pilot-week.js 发布前调 reviewProblem(day)：没有审核记录、或审完之后学生能看到
 * 的文字又改过（指纹对不上），就拒绝发布。这里在临时目录里造一个假的第九周来测。
 */

let root: string;

function writeWeek(over: { explanation?: string; source?: string } = {}) {
  const dir = join(root, 'week9');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'dates.js'),
    "module.exports = { DATES: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'] };\n");
  const levels = {
    olevel: [{
      date: '2026-10-26', source: over.source ?? 'internal-ref-1', title: 'Nine Centimetres',
      passage: 'In one year I grew nine centimetres.',
      questions: [{ taskType: 'mcq', stem: 'How much did the writer grow?', options: ['5 cm', '9 cm'], answer: 1,
        explanation: over.explanation ?? 'The first sentence says nine centimetres.' }],
      words: [{ headword: 'grow', pos: 'verb', translation: 'v. 长高', context: 'In one year I grew nine centimetres.', contextTranslation: '一年里我长高了九厘米。' }],
    }],
  };
  writeFileSync(join(dir, 'index.js'), `module.exports = { LEVELS: ${JSON.stringify(levels)} };\n`);
  // 同一个进程里改了文件要清 require 缓存；真实流程里导出和发布是两个进程，没这个问题
  delete require.cache[require.resolve(join(dir, 'index.js'))];
  delete require.cache[require.resolve(join(dir, 'dates.js'))];
}

function approveNow() {
  writeFileSync(fp.approvalPath('week9', root), JSON.stringify({
    week: 'week9', fingerprint: fp.weekFingerprint('week9', root), approvedAt: '2026-10-23T09:00:00.000Z',
  }));
}

beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'visible-review-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('发布前必须审过', () => {
  it('第九周之前的日子不追溯（已经上线）', () => {
    expect(fp.reviewProblem('2026-10-20', { root })).toBeNull();
  });

  it('日子不在任何周目录里：拒绝，并说明原因', () => {
    expect(fp.reviewProblem('2026-11-30', { root })).toMatch(/不在任何周目录/);
  });

  it('没有审核记录：拒绝，并给出三步做法', () => {
    writeWeek();
    const problem = fp.reviewProblem('2026-10-27', { root });
    expect(problem).toMatch(/还没有审核记录/);
    expect(problem).toMatch(/weekly-visible-review\.js --week=week9/);
    expect(problem).toMatch(/--approve/);
  });

  it('审过且内容没变：放行', () => {
    writeWeek();
    approveNow();
    expect(fp.reviewProblem('2026-10-26', { root })).toBeNull();
  });

  it('审完之后改了一个字（解析里的）：拒绝 —— 改过的部分没人看过', () => {
    writeWeek();
    approveNow();
    writeWeek({ explanation: 'The first sentence says nine centimeters.' });
    expect(fp.reviewProblem('2026-10-26', { root })).toMatch(/审核之后内容又改过/);
  });

  it('只改学生看不到的内部字段（source）：不影响，审核记录仍有效', () => {
    writeWeek();
    approveNow();
    writeWeek({ source: 'internal-ref-2' });
    expect(fp.reviewProblem('2026-10-26', { root })).toBeNull();
  });
});

describe('指纹', () => {
  it('对象字段顺序不影响指纹', () => {
    expect(fp.canonical({ a: 1, b: [1, { d: 2, c: 3 }] })).toBe(fp.canonical({ b: [1, { c: 3, d: 2 }], a: 1 }));
  });

  it('学生看得到的每类字段都进指纹：标题 / 正文 / 题干 / 选项 / 答案 / 解析 / 评分标准 / 生词例句', () => {
    const base = {
      olevel: [{
        date: 'd', title: 't', passage: 'p',
        questions: [{ stem: 's', options: ['a'], answer: 'a', accept: ['a'], explanation: 'e', rubric: 'r', evidence: 'v' }],
        words: [{ headword: 'h', translation: 'tr', definition: 'df', context: 'c', contextTranslation: 'ct' }],
      }],
    };
    const print = (levels: unknown) => fp.canonical(fp.visibleOf(levels));
    const original = print(base);
    const mutations: Array<(x: any) => void> = [
      (x) => { x.olevel[0].title = 't2'; },
      (x) => { x.olevel[0].passage = 'p2'; },
      (x) => { x.olevel[0].questions[0].stem = 's2'; },
      (x) => { x.olevel[0].questions[0].options = ['b']; },
      (x) => { x.olevel[0].questions[0].answer = 'b'; },
      (x) => { x.olevel[0].questions[0].explanation = 'e2'; },
      (x) => { x.olevel[0].questions[0].rubric = 'r2'; },
      (x) => { x.olevel[0].words[0].context = 'c2'; },
      (x) => { x.olevel[0].words[0].contextTranslation = 'ct2'; },
    ];
    for (const mutate of mutations) {
      const copy = JSON.parse(JSON.stringify(base));
      mutate(copy);
      expect(print(copy)).not.toBe(original);
    }
  });
});
