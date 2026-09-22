/**
 * 打印材料的排版模型（2026-09-22，叶老师要「打印 / 下载」：阅读文章 + 题目、单词表 / 默写纸，
 * 老师后台和学生 App 两边都要）。
 *
 * 这里只做纯计算：把一份卷子的题目整理成「文章段落 + 按题型分好的题组」，把一天的单词
 * 整理成单词表。学生端和教师端都只按这份结果排 A4 版 —— 分组规则只有这一份，两边印出来
 * 一样。规则照搬学生端阅读页（apps/student-web/src/lib textUtils + IELTSReadingPassage
 * 的 groupQuestions），包括 2026-09-05 盲测 P0：一组配对题只要有一题的选项和库不一样，
 * 就不共用选项库，各题印自己的选项。
 */

export interface PrintOption {
  key: string;
  text: string;
}

export interface PrintQuestion {
  /** 卷面题号（从 1 起，按 sortOrder） */
  no: number;
  /** 这一题自己的题干（组说明已经拆走） */
  item: string;
  /** 这一题要印的选项；共用选项库时为 null（选项库印在组头） */
  options: PrintOption[] | null;
  /** 作答横线的行数；选择题为 0 */
  lines: number;
  marks: number;
  /** 只有教师要答案时才有：选择题是字母（+ 选项文字），简答是参考答案 */
  answer: string | null;
}

export interface PrintGroup {
  taskType: string;
  title: string;
  instruction: string;
  bank: PrintOption[] | null;
  bankLabel: string | null;
  questions: PrintQuestion[];
}

export interface PrintParagraph {
  /** 「Paragraph 3」这类段首标签，没有就是 null */
  label: string | null;
  text: string;
}

export interface ReadingPrint {
  title: string;
  paragraphs: PrintParagraph[];
  groups: PrintGroup[];
  questionCount: number;
  totalMarks: number;
}

export interface PrintWord {
  headword: string;
  phonetic: string | null;
  pos: string | null;
  translation: string;
  sentence: string | null;
}

/** 一道题的原始行（服务层从 PaperQuestion 取出后交给这里）。 */
export interface PrintQuestionRow {
  sortOrder: number;
  marks: number;
  questionType: string;
  /** overrideContent ?? snapshotContent */
  content: unknown;
  snapshotOptions: unknown;
  /** overrideAnswer ?? snapshotAnswer */
  answer: unknown;
}

const TASK_TITLES: Record<string, string> = {
  matching_information: 'Matching Information',
  matching_headings: 'Matching Headings',
  matching_features: 'Matching Features',
  multiple_choice: 'Multiple Choice',
  true_false_not_given: 'True / False / Not Given',
  yes_no_not_given: 'Yes / No / Not Given',
  sentence_completion: 'Sentence Completion',
  summary_completion: 'Summary Completion',
  note_completion: 'Note Completion',
  table_completion: 'Table Completion',
  flow_chart_completion: 'Flow-chart Completion',
  diagram_label_completion: 'Diagram Labelling',
  short_answer: 'Short Answer',
  multi_match: 'Multi-text Matching',
  olevel_short_answer: 'Short Answer',
  olevel_comprehension: 'Comprehension',
  classification: 'Classification',
  _other: 'Question',
};

// ── 文本工具：与学生端 lesson/shared/textUtils.ts 同一口径 ──

export function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/�/g, '–').replace(/\r\n/g, '\n');
}

export function reflowPassage(s: string): string {
  if (!s) return '';
  const blocks = s.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out = blocks
    .map((b) => {
      const m = b.match(/^\s*(Paragraph\s+[0-9A-H]+)\s*\n([\s\S]*)$/i);
      const label = m ? m[1] : null;
      const body = (m ? m[2] : b).replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      return label ? `${label}\n${body}` : body;
    })
    .filter(Boolean)
    .join('\n\n');
  return out
    .replace(/(^|[.!?]\s)([A-Z])\s+(?=[A-Z][a-z])/g, (_, prefix: string, label: string) => `${prefix.trimEnd()}\n\n${label} `)
    .replace(/^\n+/, '');
}

export function splitStem(stem: string): { instruction: string; item: string } {
  const trimmed = stem.trim();
  const matches = [...trimmed.matchAll(/\n\s*\n/g)];
  if (matches.length === 0) return { instruction: '', item: trimmed };
  const last = matches[matches.length - 1];
  const splitAt = last.index ?? 0;
  return { instruction: trimmed.slice(0, splitAt).trim(), item: trimmed.slice(splitAt + last[0].length).trim() };
}

function paragraphsOf(passage: string): PrintParagraph[] {
  return reflowPassage(clean(passage))
    .split(/\n\s*\n/)
    .map((block) => {
      const m = block.match(/^(Paragraph\s+[0-9A-H]+)\n([\s\S]*)$/i);
      return m ? { label: m[1], text: m[2].trim() } : { label: null, text: block.trim() };
    })
    .filter((p) => p.text);
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asOptions(v: unknown): Array<PrintOption & { correct: boolean }> {
  if (!Array.isArray(v)) return [];
  return v
    .map((o) => asObject(o))
    .filter((o) => typeof o.key === 'string')
    .map((o) => ({ key: String(o.key), text: clean(String(o.text ?? '')), correct: o.correct === true }));
}

const bankKey = (opts: readonly PrintOption[]) => JSON.stringify(opts.map((o) => [o.key, o.text]));

/** 简答要留几行：一个词的填空一行；两分以上的简答三行；其余两行。 */
function linesFor(questionType: string, taskType: string, instruction: string, marks: number): number {
  if (questionType === 'mcq') return 0;
  if (/ONE WORD|ONE NUMBER|NO MORE THAN (ONE|TWO) WORDS?/i.test(instruction)) return 1;
  if (/completion$/.test(taskType)) return 1;
  return marks >= 2 ? 3 : 2;
}

function answerFor(row: PrintQuestionRow, options: Array<PrintOption & { correct: boolean }>): string | null {
  if (row.questionType === 'mcq') {
    const right = options.filter((o) => o.correct);
    return right.length ? right.map((o) => (o.text ? `${o.key}  ${o.text}` : o.key)).join(' / ') : null;
  }
  const a = asObject(row.answer);
  const text = [a.text, a.markScheme].find((v) => typeof v === 'string' && v.trim());
  return typeof text === 'string' ? clean(text).trim() : null;
}

export function buildReadingPrint(rows: readonly PrintQuestionRow[], opts: { withAnswers: boolean }): ReadingPrint {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const first = asObject(sorted[0]?.content);
  const title = clean(String(first.passageTitle ?? '')).trim() || 'Reading Passage';
  const paragraphs = paragraphsOf(String(first.passage ?? ''));

  type Draft = PrintGroup & { rawOptions: Array<Array<PrintOption & { correct: boolean }>> };
  const groups: Draft[] = [];
  let cur: Draft | null = null;
  sorted.forEach((row, idx) => {
    const c = asObject(row.content);
    const taskType = typeof c.taskType === 'string' && c.taskType ? c.taskType : '_other';
    const { instruction, item } = splitStem(clean(String(c.stem ?? '')));
    const options = asOptions(row.snapshotOptions);
    if (!cur || cur.taskType !== taskType || cur.instruction !== instruction) {
      let bank: PrintOption[] | null = null;
      let bankLabel: string | null = null;
      if (taskType === 'matching_features' && options.length > 2) {
        bank = options.map(({ key, text }) => ({ key, text }));
        bankLabel = 'Box';
      } else if (taskType === 'matching_headings' && Array.isArray(c.headingsBank) && c.headingsBank.length) {
        bank = asOptions(c.headingsBank).map(({ key, text }) => ({ key, text }));
        bankLabel = 'List of Headings';
      } else if (taskType === 'summary_completion' && Array.isArray(c.wordBank) && c.wordBank.length) {
        bank = asOptions(c.wordBank).map(({ key, text }) => ({ key, text }));
        bankLabel = 'Word Bank';
      }
      cur = { taskType, title: TASK_TITLES[taskType] ?? TASK_TITLES._other, instruction, bank, bankLabel, questions: [], rawOptions: [] };
      groups.push(cur);
    }
    cur.rawOptions.push(options);
    cur.questions.push({
      no: idx + 1,
      item,
      options: options.length ? options.map(({ key, text }) => ({ key, text })) : null,
      lines: linesFor(row.questionType, taskType, instruction, row.marks),
      marks: row.marks,
      answer: opts.withAnswers ? answerFor(row, options) : null,
    });
  });

  // 共用选项库只在「组里每一题的选项都和库一样」时成立（2026-09-05 盲测 P0）
  for (const g of groups) {
    if (!g.bank) continue;
    if (g.taskType === 'matching_features') {
      const key = bankKey(g.bank);
      if (!g.rawOptions.every((o) => bankKey(o) === key)) {
        g.bank = null;
        g.bankLabel = null;
        continue;
      }
    }
    for (const q of g.questions) q.options = null;
  }

  return {
    title,
    paragraphs,
    groups: groups.map(({ rawOptions: _drop, ...g }) => g),
    questionCount: sorted.length,
    totalMarks: sorted.reduce((sum, r) => sum + (r.marks || 0), 0),
  };
}

/** 一天的单词：取卡片快照里的字段；没有英文或中文的跳过。 */
export function buildWordsPrint(items: ReadonlyArray<{ position: number; contentSnapshot: unknown }>): PrintWord[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((it) => asObject(it.contentSnapshot))
    .map((c) => ({
      headword: String(c.headword ?? '').trim(),
      phonetic: typeof c.phonetic === 'string' && c.phonetic.trim() ? c.phonetic.trim() : null,
      pos: typeof c.pos === 'string' && c.pos.trim() ? c.pos.trim() : null,
      translation: clean(String(c.translation ?? '')).trim(),
      sentence: typeof c.sentence === 'string' && c.sentence.trim() ? clean(c.sentence).trim() : null,
    }))
    .filter((w) => w.headword && w.translation);
}
