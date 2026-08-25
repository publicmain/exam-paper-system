import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExamProvider } from '../ExamContext';
import { pickRenderer } from '../QuestionTypeRegistry';
import { IELTSReadingPassage } from '../questions/IELTSReadingPassage';
import type { ExamPaper } from '../types';

/**
 * 卷内词汇题的渲染回归（2026-08-25 起，只给轻量两层）。
 *
 * 词汇题挂在卷子末尾、且**不带 passage 字段** —— 这是它与其它所有题
 * 的结构差异，也是唯一可能把渲染搞坏的地方：
 *
 *   · pickRenderer 按**第一题**的 taskType 选组件 —— 词汇题在末尾，
 *     不能把整卷的渲染器换掉（换掉 = 阅读题的左右分栏没了）；
 *   · 多篇文章检测靠 `unique(passage)` 计数 —— 词汇题没有 passage，
 *     必须被过滤掉，否则会被误判成「两篇文章」而切到 OLevelComprehension。
 *
 * 下面用的是 2026-08-26 雅思轻量真卷的数据（8 题：6 阅读 + 2 词汇）。
 */

const PASSAGE =
  'Every human body keeps time. Deep in the brain sits a small cluster of cells that acts as an ' +
  'internal clock, telling us when to feel alert and when to feel tired. This rhythm repeats roughly ' +
  'every twenty-four hours, and it is set mainly by light.';

function tomorrowsLightPaper(): ExamPaper {
  return {
    sessionId: 's-light-0826',
    quizEnd: new Date(Date.now() + 600_000).toISOString(),
    level: 'ielts_light',
    paperMode: null,
    questions: [
      {
        id: 'q1',
        sortOrder: 1,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: {
          stem: "Do the following statements agree with the information given in the passage?\n\nThe body's internal clock is set mainly by light.",
          passage: PASSAGE,
          taskType: 'true_false_not_given',
          passageTitle: 'Working Against the Clock',
        },
        snapshotOptions: [
          { key: 'A', text: 'TRUE' },
          { key: 'B', text: 'FALSE' },
          { key: 'C', text: 'NOT GIVEN' },
        ],
      },
      {
        id: 'q4',
        sortOrder: 4,
        marks: 1,
        questionType: 'short_answer',
        snapshotContent: {
          stem: 'Complete the sentences below. Choose ONE WORD ONLY from the passage for each answer.\n\nAs darkness falls the body starts to produce ______, which prepares it for sleep.',
          passage: PASSAGE,
          taskType: 'sentence_completion',
          passageTitle: 'Working Against the Clock',
        },
        snapshotOptions: null,
      },
      // ── 卷内词汇题：无 passage，taskType=multiple_choice ──
      {
        id: 'qv1',
        sortOrder: 7,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: {
          stem: '本周词汇 · 选出最合适的词填入空格 · Choose the best word for the blank.\n\nThere is strong ＿＿＿ that sleep improves memory.',
          taskType: 'multiple_choice',
          vocabTrack: true,
          headword: 'evidence',
          vocabQtype: 'cloze',
        },
        snapshotOptions: [
          { key: 'A', text: 'vary' },
          { key: 'B', text: 'resource' },
          { key: 'C', text: 'trend' },
          { key: 'D', text: 'evidence' },
        ],
      },
      {
        id: 'qv2',
        sortOrder: 8,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: {
          stem: '本周词汇 · 选出 “expand” 的意思 · What does “expand” mean?',
          taskType: 'multiple_choice',
          vocabTrack: true,
          headword: 'expand',
          vocabQtype: 'word_to_meaning',
        },
        snapshotOptions: [
          { key: 'A', text: 'a. 重要的, 有效的' },
          { key: 'B', text: 'vt. 使膨胀, 详述, 扩张' },
          { key: 'C', text: 'vt. 改变, 使多样化' },
          { key: 'D', text: 'n. 程序, 进行, 过程' },
        ],
      },
    ],
  };
}

describe('卷内词汇题', () => {
  it('挂在末尾不改变整卷渲染器 —— 仍是 IELTS 左右分栏', () => {
    expect(pickRenderer(tomorrowsLightPaper())).toBe(IELTSReadingPassage);
  });

  it('没有 passage 的词汇题不会被误判成「第二篇文章」', () => {
    // 若 unique(passage) 把 undefined 也算一种，就会切成 OLevelComprehension
    const p = tomorrowsLightPaper();
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
    // 再加一道词汇题也一样（多道无 passage 的题不累加成多篇）
    p.questions.push({ ...p.questions[3], id: 'qv3', sortOrder: 9 });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
  });

  it('词汇题的题干与四个选项都渲染得出来，且可以作答', async () => {
    const paper = tomorrowsLightPaper();
    const u = userEvent.setup();
    render(
      <ExamProvider sessionId="s-light-0826" mode="test" onPersistAnswer={async () => {}}>
        <IELTSReadingPassage paper={paper} />
      </ExamProvider>,
    );
    // 阅读原文仍在（词汇题没把左栏挤掉）
    expect(screen.getByText(/Every human body keeps time/)).toBeTruthy();
    // 词汇题渲染出来了
    expect(screen.getByText(/There is strong ＿＿＿ that sleep improves memory/)).toBeTruthy();
    expect(screen.getByText(/选出 “expand” 的意思/)).toBeTruthy();
    // 四个选项可点
    const opt = screen.getByText('evidence');
    await u.click(opt);
    expect(opt).toBeTruthy();
  });
});
