import { describe, expect, it } from 'vitest';
import { buildReadingPrint, buildWordsPrint, splitStem, type PrintQuestionRow } from './print-model';

const PASSAGE = 'Paragraph 1\nMy father never let me win.\nNot even on my birthday.\n\nParagraph 2\nEvery Sunday we played badminton.';
const FEELINGS = [
  { key: 'A', text: 'alarmed', correct: false },
  { key: 'B', text: 'grief-stricken', correct: true },
  { key: 'C', text: 'awkward', correct: false },
  { key: 'D', text: 'relieved', correct: false },
];
const TFNG = [
  { key: 'A', text: 'TRUE', correct: false },
  { key: 'B', text: 'FALSE', correct: true },
  { key: 'C', text: 'NOT GIVEN', correct: false },
];

function row(i: number, over: Partial<PrintQuestionRow> & { taskType: string; stem: string }): PrintQuestionRow {
  const { taskType, stem, ...rest } = over;
  return {
    sortOrder: i,
    marks: 1,
    questionType: 'mcq',
    content: { passage: PASSAGE, passageTitle: 'Properly This Time', stem, taskType },
    snapshotOptions: null,
    answer: {},
    ...rest,
  };
}

const MATCH = 'Choose the word from the box that best describes the narrator\'s feelings.';
const rows: PrintQuestionRow[] = [
  row(1, { taskType: 'matching_features', stem: `${MATCH}\n\nWhen the father coughed`, snapshotOptions: FEELINGS }),
  row(2, { taskType: 'matching_features', stem: `${MATCH}\n\nWhen he lost the game`, snapshotOptions: FEELINGS }),
  row(3, { taskType: 'true_false_not_given', stem: 'Do the following statements agree with the information given in the passage?\n\nThe father let the writer win.', snapshotOptions: TFNG }),
  row(4, {
    taskType: 'short_answer',
    questionType: 'short_answer',
    marks: 2,
    stem: 'What did the father say in Paragraph 1, and what does this show about him?',
    answer: { text: 'A point someone gives you is worth nothing; he believes a win must be earned.', rubric: '两分……' },
  }),
  row(5, {
    taskType: 'sentence_completion',
    questionType: 'short_answer',
    stem: 'Complete the sentence. Choose ONE WORD ONLY from the passage.\n\nThey played [BLANK] every Sunday.',
    answer: { text: 'badminton' },
  }),
];

describe('阅读打印版', () => {
  it('标题、段落（段首标签单独一行）', () => {
    const p = buildReadingPrint(rows, { withAnswers: false });
    expect(p.title).toBe('Properly This Time');
    expect(p.paragraphs).toEqual([
      { label: 'Paragraph 1', text: 'My father never let me win. Not even on my birthday.' },
      { label: 'Paragraph 2', text: 'Every Sunday we played badminton.' },
    ]);
    expect(p.questionCount).toBe(5);
    expect(p.totalMarks).toBe(6);
  });

  it('按题型 + 说明分组；题号连续；说明只印在组头', () => {
    const p = buildReadingPrint(rows, { withAnswers: false });
    expect(p.groups.map((g) => [g.taskType, g.questions.map((q) => q.no)])).toEqual([
      ['matching_features', [1, 2]],
      ['true_false_not_given', [3]],
      ['short_answer', [4]],
      ['sentence_completion', [5]],
    ]);
    expect(p.groups[0].instruction).toBe(MATCH);
    expect(p.groups[0].questions[0].item).toBe('When the father coughed');
  });

  it('配对题选项一致：选项框只印一次（组头），各题不再重复', () => {
    const g = buildReadingPrint(rows, { withAnswers: false }).groups[0];
    expect(g.bank?.map((o) => o.text)).toEqual(['alarmed', 'grief-stricken', 'awkward', 'relieved']);
    expect(g.questions.every((q) => q.options === null)).toBe(true);
  });

  it('配对题有一题选项不一样（2026-09-05 盲测 P0）：不共用选项框，各题印自己的', () => {
    const other = FEELINGS.map((o, i) => ({ ...o, text: ['bored', 'proud', 'tired', 'calm'][i] }));
    const mixed = [rows[0], { ...rows[1], snapshotOptions: other }];
    const g = buildReadingPrint(mixed, { withAnswers: false }).groups[0];
    expect(g.bank).toBeNull();
    expect(g.questions[1].options?.map((o) => o.text)).toEqual(['bored', 'proud', 'tired', 'calm']);
  });

  it('选择题印选项、不留横线；简答留横线（两分三行、一词填空一行）', () => {
    const qs = buildReadingPrint(rows, { withAnswers: false }).groups.flatMap((g) => g.questions);
    expect(qs[2].options?.map((o) => o.text)).toEqual(['TRUE', 'FALSE', 'NOT GIVEN']);
    expect(qs[2].lines).toBe(0);
    expect(qs[3].lines).toBe(3);
    expect(qs[4].lines).toBe(1);
  });

  it('**学生版不带答案**：没有 answer，选项里也没有 correct', () => {
    const p = buildReadingPrint(rows, { withAnswers: false });
    const text = JSON.stringify(p);
    expect(p.groups.flatMap((g) => g.questions).every((q) => q.answer === null)).toBe(true);
    expect(text).not.toContain('correct');
    expect(text).not.toContain('worth nothing');
    expect(text).not.toContain('rubric');
  });

  it('老师版带答案：选择题给字母 + 选项；简答给参考答案；不带评分细则', () => {
    const qs = buildReadingPrint(rows, { withAnswers: true }).groups.flatMap((g) => g.questions);
    expect(qs[0].answer).toBe('B  grief-stricken');
    expect(qs[2].answer).toBe('B  FALSE');
    expect(qs[3].answer).toBe('A point someone gives you is worth nothing; he believes a win must be earned.');
    expect(qs[4].answer).toBe('badminton');
    expect(JSON.stringify(qs)).not.toContain('两分');
  });

  it('老师在卷子里改过的题（override）以改过的为准 —— 由服务层传进来，这里照用', () => {
    const edited = [{ ...rows[3], content: { ...(rows[3].content as object), stem: 'Edited stem?' } }];
    expect(buildReadingPrint(edited, { withAnswers: false }).groups[0].questions[0].item).toBe('Edited stem?');
  });

  it('题干没有空行：整句当题目，说明为空', () => {
    expect(splitStem('Just one line?')).toEqual({ instruction: '', item: 'Just one line?' });
  });
});

describe('单词表', () => {
  it('按顺序取英文 / 音标 / 词性 / 中文 / 例句；缺英文或中文的跳过', () => {
    const words = buildWordsPrint([
      { position: 2, contentSnapshot: { headword: 'retain', pos: 'verb', translation: 'vt. 保持, 保留', phonetic: '/rɪˈteɪn/', sentence: 'Try to retain the key ideas.' } },
      { position: 1, contentSnapshot: { headword: 'calm', pos: 'adjective', translation: 'a. 平静的' } },
      { position: 3, contentSnapshot: { headword: 'ghost', translation: '' } },
    ]);
    expect(words).toEqual([
      { headword: 'calm', phonetic: null, pos: 'adjective', translation: 'a. 平静的', sentence: null },
      { headword: 'retain', phonetic: '/rɪˈteɪn/', pos: 'verb', translation: 'vt. 保持, 保留', sentence: 'Try to retain the key ideas.' },
    ]);
  });
});
