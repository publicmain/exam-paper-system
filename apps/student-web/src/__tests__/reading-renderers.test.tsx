/**
 * AC-03 / AC-04 / AC-05 —— 六个渲染器、注册表优先级、以及 IELTS 的排除项。
 *
 * 全部用**真的导出组件**：真的 `pickRenderer`、真的渲染器、真的
 * `ReadingProvider`（副作用注入 mock）。不做源码字符串比对来代替行为断言。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import {
  ExamRenderer,
  EmptyPaperCard,
  RENDERER_KEYS,
  pickRenderer,
} from '../lesson/QuestionTypeRegistry';
import { IELTSReadingPassage } from '../lesson/questions/IELTSReadingPassage';
import { OLevelComprehension } from '../lesson/questions/OLevelComprehension';
import { OLevelCloze } from '../lesson/questions/OLevelCloze';
import { OLevelVocabInContext } from '../lesson/questions/OLevelVocabInContext';
import { OLevelSentenceTransformation } from '../lesson/questions/OLevelSentenceTransformation';
import { OLevelMcqList } from '../lesson/questions/OLevelMcqList';
import { ReadingProvider } from '../lesson/ReadingProvider';
import { ExamModeProvider } from '../lesson/ExamContext';
import type { ExamPaper, ExamQuestion } from '../lesson/examTypes';

function q(over: Partial<ExamQuestion> & { id: string }): ExamQuestion {
  return {
    sortOrder: 1,
    marks: 1,
    questionType: 'mcq',
    snapshotContent: {},
    snapshotOptions: null,
    ...over,
  };
}

function paper(over: Partial<ExamPaper>): ExamPaper {
  return {
    sessionId: 's1',
    quizEnd: '2026-08-28T23:59:00.000Z',
    level: 'ielts_authentic',
    paperMode: null,
    mode: 'test',
    questions: [],
    ...over,
  };
}

const deps = {
  saveAnswer: vi.fn(async () => ({ applied: true, clientSeq: 1 })),
  loadSession: vi.fn(async () => {
    throw new Error('not used');
  }),
};

function mount(p: ExamPaper) {
  return render(
    <ReadingProvider sessionId="s1" submissionId="sub1" deps={deps as never}>
      <ExamModeProvider mode={p.mode ?? 'test'}>
        <ExamRenderer paper={p} />
      </ExamModeProvider>
    </ReadingProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  deps.saveAnswer.mockClear();
});

// ─────────────────────────────────────────────────────────────
// AC-03 注册表
// ─────────────────────────────────────────────────────────────

describe('AC-03 六个渲染器与选择顺序', () => {
  it('**注册表恰好六个 key，一个不多一个不少**', () => {
    expect([...RENDERER_KEYS].sort()).toEqual(
      [
        'ielts_reading',
        'olevel_cloze',
        'olevel_comprehension',
        'olevel_mcq',
        'olevel_transformation',
        'olevel_vocab',
      ].sort(),
    );
  });

  it('① 显式 rendererKey 优先，压过一切推断', () => {
    const p = paper({
      rendererKey: 'olevel_cloze',
      paperMode: 'passage_pick',
      questions: [q({ id: 'a', snapshotContent: { taskType: 'true_false_not_given' } })],
    });
    expect(pickRenderer(p)).toBe(OLevelCloze);
  });

  it('未知的 rendererKey → 回退到推断（并且不抛）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = paper({
      rendererKey: 'no_such_renderer',
      questions: [q({ id: 'a', snapshotContent: { taskType: 'matching_headings' } })],
    });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('② IELTS 家族：paperMode=passage_pick → IELTS 壳', () => {
    const p = paper({ paperMode: 'passage_pick', questions: [q({ id: 'a' })] });
    expect(pickRenderer(p)).toBe(IELTSReadingPassage);
  });

  it('② IELTS 家族：taskType 命中 → IELTS 壳', () => {
    for (const tt of ['matching_information', 'true_false_not_given', 'summary_completion']) {
      const p = paper({ questions: [q({ id: 'a', snapshotContent: { taskType: tt } })] });
      expect(pickRenderer(p), tt).toBe(IELTSReadingPassage);
    }
  });

  it('②a **多个真实段落 → 回退到分页的 OLevelComprehension**', () => {
    const p = paper({
      paperMode: 'passage_pick',
      questions: [
        q({ id: 'a', snapshotContent: { taskType: 'multiple_choice', passage: 'First real passage.' } }),
        q({ id: 'b', snapshotContent: { taskType: 'multiple_choice', passage: 'Second real passage.' } }),
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelComprehension);
  });

  it('②b **backref 伪段落被过滤掉 → 仍走 IELTS 壳**', () => {
    for (const backref of [
      'Refer to the same narrative above.',
      'See passage above.',
      'Using the passage above, answer…',
      'Based on the same text…',
      'With reference to the article above…',
    ]) {
      const p = paper({
        paperMode: 'passage_pick',
        questions: [
          q({ id: 'a', snapshotContent: { taskType: 'multiple_choice', passage: 'The only real passage.' } }),
          q({ id: 'b', snapshotContent: { taskType: 'multiple_choice', passage: backref } }),
        ],
      });
      expect(pickRenderer(p), backref).toBe(IELTSReadingPassage);
    }
  });

  it('③ uiKind 提示 → 对应的 O-Level 壳', () => {
    const cases: Array<[string, unknown]> = [
      ['cloze', OLevelCloze],
      ['vocab', OLevelVocabInContext],
      ['vocab_in_context', OLevelVocabInContext],
      ['transformation', OLevelSentenceTransformation],
      ['sentence_transformation', OLevelSentenceTransformation],
    ];
    for (const [uiKind, expected] of cases) {
      const p = paper({ questions: [q({ id: 'a', snapshotContent: { uiKind } })] });
      expect(pickRenderer(p), uiKind).toBe(expected);
    }
  });

  it('④ 启发式：长段落 + 多题 → OLevelComprehension', () => {
    const long = 'x'.repeat(250);
    const p = paper({
      questions: [
        q({ id: 'a', snapshotContent: { passage: long } }),
        q({ id: 'b', snapshotContent: {} }),
      ],
    });
    expect(pickRenderer(p)).toBe(OLevelComprehension);
  });

  it('⑤ 兜底：独立选择题 → OLevelMcqList', () => {
    const p = paper({ questions: [q({ id: 'a', snapshotContent: { stem: 'Pick one' } })] });
    expect(pickRenderer(p)).toBe(OLevelMcqList);
  });

  it('**空卷 → EmptyPaperCard**，不去索引 questions[0]', () => {
    expect(pickRenderer(paper({ questions: [] }))).toBe(EmptyPaperCard);
    mount(paper({ questions: [] }));
    expect(screen.getByText(/尚未出题|No questions/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 字段语义
// ─────────────────────────────────────────────────────────────

describe('AC-04 渲染器的字段语义', () => {
  it('**TFNG 空选项 → 合成 TRUE / FALSE / NOT GIVEN**，绝不出现空单选组', () => {
    mount(
      paper({
        paperMode: 'passage_pick',
        questions: [
          q({
            id: 'a',
            snapshotContent: { taskType: 'true_false_not_given', stem: 'Do it.\n\nItem one', passage: 'P' },
            snapshotOptions: [],
          }),
        ],
      }),
    );
    const labels = screen.getAllByRole('radio').map((el) => el.closest('label')?.textContent ?? '');
    expect(labels.some((l) => /TRUE/.test(l))).toBe(true);
    expect(labels.some((l) => /FALSE/.test(l))).toBe(true);
    expect(labels.some((l) => /NOT GIVEN/.test(l))).toBe(true);
  });

  it('**YNG 空选项 → 合成 YES / NO / NOT GIVEN**', () => {
    mount(
      paper({
        paperMode: 'passage_pick',
        questions: [
          q({
            id: 'a',
            snapshotContent: { taskType: 'yes_no_not_given', stem: 'Do it.\n\nItem one', passage: 'P' },
            snapshotOptions: [],
          }),
        ],
      }),
    );
    const labels = screen.getAllByRole('radio').map((el) => el.closest('label')?.textContent ?? '');
    expect(labels.some((l) => /YES/.test(l))).toBe(true);
    expect(labels.some((l) => /NO/.test(l))).toBe(true);
    expect(labels.some((l) => /NOT GIVEN/.test(l))).toBe(true);
  });

  it('**五个冻结的 IELTS case 都双写 selectedOption + textAnswer**', async () => {
    const cases = [
      'true_false_not_given',
      'yes_no_not_given',
      'multiple_choice',
      'matching_features',
      'classification',
    ];
    for (const tt of cases) {
      localStorage.clear();
      const { unmount } = mount(
        paper({
          paperMode: 'passage_pick',
          questions: [
            q({
              id: 'a',
              snapshotContent: { taskType: tt, stem: 'Do it.\n\nItem', passage: 'P' },
              snapshotOptions: [
                { key: 'A', text: 'Alpha' },
                { key: 'B', text: 'Beta' },
              ],
            }),
          ],
        }),
      );
      const radio = screen.getAllByRole('radio')[0] as HTMLInputElement;
      await act(async () => {
        radio.click();
      });
      const cached = JSON.parse(localStorage.getItem('sw:reading:answers:s1:sub1')!);
      expect(cached.a, tt).toEqual({ selectedOption: 'A', textAnswer: 'Alpha' });
      unmount();
    }
  });

  it('**通用 MCQ 没有选项 → 退化成文本框**', () => {
    mount(paper({ questions: [q({ id: 'a', snapshotContent: { stem: 'Write something' }, snapshotOptions: [] })] }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('O-Level 理解题：有选项写 selectedOption', async () => {
    mount(
      paper({
        questions: [
          q({ id: 'a', snapshotContent: { passage: 'x'.repeat(250), stem: 'Q1' }, snapshotOptions: [{ key: 'A', text: 'aa' }] }),
          q({ id: 'b', snapshotContent: { stem: 'Q2' }, snapshotOptions: [{ key: 'A', text: 'bb' }] }),
        ],
      }),
    );
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    expect(JSON.parse(localStorage.getItem('sw:reading:answers:s1:sub1')!)).toEqual({
      a: { selectedOption: 'A' },
    });
  });

  it('O-Level 完形：只写 textAnswer', async () => {
    mount(
      paper({
        questions: [q({ id: 'a', snapshotContent: { uiKind: 'cloze', passage: 'Hello [BLANK] world.' } })],
      }),
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'big' } });
      fireEvent.blur(input);
    });
    expect(JSON.parse(localStorage.getItem('sw:reading:answers:s1:sub1')!)).toEqual({
      a: { textAnswer: 'big' },
    });
  });

  it('O-Level 句子转换：只写 textAnswer', async () => {
    mount(
      paper({
        questions: [
          q({ id: 'a', snapshotContent: { uiKind: 'transformation', original: 'He is tall.', starter: 'He' } }),
        ],
      }),
    );
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(ta, { target: { value: 'He is a tall boy.' } });
    });
    expect(JSON.parse(localStorage.getItem('sw:reading:answers:s1:sub1')!)).toEqual({
      a: { textAnswer: 'He is a tall boy.' },
    });
  });

  it('O-Level 词汇题：只写 selectedOption', async () => {
    mount(
      paper({
        questions: [
          q({
            id: 'a',
            snapshotContent: { uiKind: 'vocab', targetWord: 'keen', contextSentence: 'He is keen.' },
            snapshotOptions: [{ key: 'A', text: 'eager' }],
          }),
        ],
      }),
    );
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    expect(JSON.parse(localStorage.getItem('sw:reading:answers:s1:sub1')!)).toEqual({
      a: { selectedOption: 'A' },
    });
  });

  it('**mode=test 下不显示答案 / 解析 / 对错反馈**', async () => {
    mount(
      paper({
        mode: 'test',
        questions: [
          q({
            id: 'a',
            snapshotContent: { stem: 'Pick', correctOption: 'B', explanation: '因为 B 最合适' },
            snapshotOptions: [
              { key: 'A', text: 'aa' },
              { key: 'B', text: 'bb' },
            ],
          }),
        ],
      }),
    );
    await act(async () => {
      (screen.getAllByRole('radio')[0] as HTMLInputElement).click();
    });
    expect(screen.queryByText(/因为 B 最合适/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 IELTS 的排除项
// ─────────────────────────────────────────────────────────────

describe('AC-05 IELTS 迁移后的排除项', () => {
  const READING_SRC = (() => {
    const dir = path.resolve(__dirname, '..', 'lesson');
    const out: Array<{ f: string; text: string }> = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name)) out.push({ f: p, text: fs.readFileSync(p, 'utf8') });
      }
    };
    walk(dir);
    out.push({
      f: 'pages/Reading.tsx',
      text: fs.readFileSync(path.resolve(__dirname, '..', 'pages', 'Reading.tsx'), 'utf8'),
    });
    return out;
  })();

  it('**阅读端代码里没有 ExamWordSheet 的任何痕迹**', () => {
    for (const { f, text } of READING_SRC) {
      expect(text, f).not.toContain('ExamWordSheet');
    }
  });

  it('**不发任何查词 / 生词本请求**', () => {
    for (const { f, text } of READING_SRC) {
      expect(text, f).not.toContain('/vocab/lookup');
      expect(text, f).not.toContain('/vocab/words');
    }
  });

  it('**不读 studentName**', () => {
    for (const { f, text } of READING_SRC) {
      expect(text, f).not.toContain('studentName');
    }
  });

  it('**本地 UI 状态只写 sw: 键**（高亮 / 便笺 / 分栏）', () => {
    mount(
      paper({
        paperMode: 'passage_pick',
        questions: [
          q({
            id: 'a',
            snapshotContent: { taskType: 'multiple_choice', passage: 'Some passage text.', stem: 'Do.\n\nItem' },
            snapshotOptions: [{ key: 'A', text: 'aa' }],
          }),
        ],
      }),
    );
    for (const k of Object.keys(localStorage)) {
      expect(k.startsWith('sw:'), k).toBe(true);
    }
  });

  it('**保留段落、分组标题、高亮容器与便笺**', () => {
    mount(
      paper({
        paperMode: 'passage_pick',
        questions: [
          q({
            id: 'a',
            snapshotContent: {
              taskType: 'true_false_not_given',
              passageTitle: 'The Nile',
              passage: 'The Nile is long.',
              stem: 'Decide.\n\nThe Nile is short.',
            },
            snapshotOptions: [],
          }),
        ],
      }),
    );
    expect(screen.getByText('The Nile')).toBeInTheDocument();
    expect(screen.getByText(/The Nile is long/)).toBeInTheDocument();
    expect(screen.getAllByText(/Not Given/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /便笺/ })).toBeInTheDocument();
  });

  it('**手机上是上下堆叠的两个分页，不是窄屏分栏**', () => {
    mount(
      paper({
        paperMode: 'passage_pick',
        questions: [
          q({
            id: 'a',
            snapshotContent: { taskType: 'multiple_choice', passage: 'P', stem: 'Do.\n\nItem' },
            snapshotOptions: [{ key: 'A', text: 'aa' }],
          }),
        ],
      }),
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['原文', '题目']);
  });
});
