import { useEffect, useMemo, useState } from 'react';
import type { ExamPaper, ExamQuestion, ExamOption } from '../types';
import { useExam } from '../ExamContext';
import { clean, reflowPassage, splitStem } from '../shared/textUtils';
import { Highlighter, useStoredHighlights } from '../shared/Highlighter';
import { useStoredNotes, StickyNoteRail } from '../shared/StickyNote';
import { DraggableSplit } from '../shared/DraggableSplit';
import { QuestionFlag } from '../shared/QuestionFlag';

/**
 * IELTS Computer-Delivered-style reading shell.
 *
 *  - Left pane: shared passage with selection-driven highlighting + a
 *    notes rail. iPad-portrait collapses into a tab toggle ("看原文")
 *    so the question side stays at a comfortable reading width.
 *  - Right pane: scrollable list of grouped tasks (matching, TFNG, MCQ,
 *    completion). Each task carries its own instruction and shared bank
 *    when applicable.
 *  - Resizable: the divider between panes can be dragged on lg+, and
 *    the chosen ratio sticks across reloads.
 *  - Mark for review: every question has a flag button which lights up
 *    the bottom palette. Wired through ExamContext.
 */

type TaskType =
  | 'matching_information'
  | 'matching_headings'
  | 'matching_features'
  | 'multiple_choice'
  | 'true_false_not_given'
  | 'yes_no_not_given'
  | 'sentence_completion'
  | 'summary_completion'
  | 'note_completion'
  | 'table_completion'
  | 'flow_chart_completion'
  | 'diagram_label_completion'
  | 'short_answer';

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
  _other: 'Question',
};

interface TaskGroup {
  taskType: TaskType | '_other';
  instruction: string;
  bank: ExamOption[] | null;
  bankLabel: string;
  questions: Array<ExamQuestion & { itemText: string; localIdx: number }>;
}

function groupQuestions(qs: ExamQuestion[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let cur: TaskGroup | null = null;
  qs.forEach((pq, idx) => {
    const c = pq.snapshotContent || {};
    const tt = (c.taskType as TaskType) ?? '_other';
    const { instruction, item } = splitStem(c.stem ?? '');
    const sameAsCurrent = cur && cur.taskType === tt && cur.instruction === instruction;
    if (!sameAsCurrent) {
      let sharedBank: ExamOption[] | null = null;
      let bankLabel = '选项库 · Bank';
      if (tt === 'matching_features' && pq.snapshotOptions && pq.snapshotOptions.length > 2) {
        sharedBank = pq.snapshotOptions;
      } else if (tt === 'matching_headings' && Array.isArray(c.headingsBank) && c.headingsBank.length > 0) {
        sharedBank = c.headingsBank;
        bankLabel = '标题列表 · List of Headings';
      } else if (tt === 'summary_completion' && Array.isArray(c.wordBank) && c.wordBank.length > 0) {
        sharedBank = c.wordBank;
        bankLabel = '词库 · Word Bank';
      }
      cur = { taskType: tt, instruction, bank: sharedBank, bankLabel, questions: [] };
      groups.push(cur);
    }
    cur!.questions.push({ ...pq, itemText: item, localIdx: idx + 1 });
  });
  return groups;
}

export function IELTSReadingPassage({ paper }: { paper: ExamPaper }) {
  const { fontScale } = useExam();
  // Mobile pane toggle — the split collapses to a stack on iPad portrait
  // and phones; the user picks which side to look at. Default to questions
  // since that's where they'll spend most of their time.
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('right');

  if (!paper?.questions?.length) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }
  const passageContent = paper.questions[0]?.snapshotContent ?? {};
  const passageTitle = clean(passageContent.passageTitle ?? 'Reading Passage');
  const passageBody = useMemo(() => reflowPassage(clean(passageContent.passage ?? '')), [passageContent.passage]);
  const groups = useMemo(() => groupQuestions(paper.questions), [paper.questions]);

  const hlKey = `mq:hl:${paper.sessionId}`;
  const noteKey = `mq:nt:${paper.sessionId}`;
  const [highlights, setHighlights] = useStoredHighlights(hlKey);
  const [notes, addNote, editNote, removeNote] = useStoredNotes(noteKey);

  return (
    <div className="lg:h-[calc(100dvh-9rem)]" style={{ fontSize: `${fontScale}rem` }}>
      {/* Mobile pane switch — only visible below lg.  On lg+ the split
          renders both panes side-by-side. */}
      <div className="lg:hidden flex justify-center gap-1 px-3 py-2 border-b bg-white sticky top-14 z-10">
        <button
          type="button"
          onClick={() => setMobileSide('left')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium ${mobileSide === 'left' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
        >
          原文 · Passage
        </button>
        <button
          type="button"
          onClick={() => setMobileSide('right')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium ${mobileSide === 'right' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
        >
          题目 · Questions
        </button>
      </div>

      <DraggableSplit
        storageKey={`mq:split:${paper.sessionId}`}
        mobileSide={mobileSide}
        left={
          <aside className="bg-white lg:rounded-lg lg:border lg:shadow-sm lg:max-h-full lg:overflow-auto h-full">
            <div className="px-5 py-5 lg:px-6 lg:py-6">
              <h2 className="font-semibold text-xl lg:text-2xl mb-1">{passageTitle}</h2>
              <div className="text-xs text-gray-400 mb-3">
                提示 · Tip：拖选文字加黄色高亮，点击高亮可移除。
              </div>
              <Highlighter
                body={passageBody}
                highlights={highlights}
                onChange={setHighlights}
                className="text-[1.0625rem] lg:text-lg text-gray-800 leading-[1.75] font-serif"
              />
              <StickyNoteRail
                notes={notes}
                onAdd={addNote}
                onEdit={editNote}
                onRemove={removeNote}
              />
            </div>
          </aside>
        }
        right={
          <div className="lg:max-h-full lg:overflow-auto space-y-5 px-4 lg:px-4 py-4 lg:py-4">
            {groups.map((g, gi) => (
              <TaskGroupView key={gi} group={g} gi={gi} />
            ))}
          </div>
        }
      />
    </div>
  );
}

function TaskGroupView({ group, gi }: { group: TaskGroup; gi: number }) {
  const firstNum = group.questions[0].localIdx;
  const lastNum = group.questions[group.questions.length - 1].localIdx;
  const range = firstNum === lastNum ? `${firstNum}` : `${firstNum}–${lastNum}`;
  const taskTitle = TASK_TITLES[group.taskType] ?? 'Question';
  return (
    <section className="bg-white rounded-md border border-gray-200 overflow-hidden">
      <header className="bg-gray-50 border-b border-gray-200 px-4 lg:px-5 py-3">
        <div className="flex items-baseline gap-2 flex-wrap text-sm">
          <span className="text-gray-500">Section {gi + 1}</span>
          <span className="text-gray-300">·</span>
          <span className="font-semibold text-gray-900">{taskTitle}</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-gray-500">Q{range}</span>
        </div>
        {group.instruction && (
          <p className="mt-2 text-[15px] text-gray-700 whitespace-pre-wrap leading-relaxed">
            {clean(group.instruction)}
          </p>
        )}
      </header>
      {group.bank && (
        <div className="px-4 lg:px-5 py-3 bg-amber-50/60 border-b border-amber-100">
          <div className="text-xs text-amber-900 font-semibold tracking-wide uppercase mb-2">
            {group.bankLabel}
          </div>
          <ul className="text-[15px] space-y-1 sm:columns-2 sm:gap-x-6">
            {group.bank.map((b) => (
              <li key={b.key} className="break-inside-avoid leading-snug">
                <span className="font-mono text-gray-500 mr-2 font-semibold">{b.key}.</span>
                <span>{clean(b.text)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="divide-y divide-gray-100">
        {group.questions.map((q) => (
          <QuestionRow key={q.id} q={q} taskType={group.taskType} hasBank={!!group.bank} />
        ))}
      </ol>
    </section>
  );
}

function QuestionRow({
  q,
  taskType,
  hasBank,
}: {
  q: ExamQuestion & { itemText: string; localIdx: number };
  taskType: TaskType | '_other';
  hasBank: boolean;
}) {
  const { answers, setAnswer, savingId, isFlagged, mode } = useExam();
  const flagged = isFlagged(q.id);
  const a = answers[q.id];
  const correctKey =
    typeof q.snapshotContent?.correctOption === 'string' ? q.snapshotContent.correctOption : null;

  const showFeedback = mode === 'practice' && a?.selectedOption && correctKey;
  const isCorrect = showFeedback && a.selectedOption === correctKey;

  return (
    <li
      id={`q-${q.id}`}
      className={`px-4 lg:px-5 py-4 transition-colors ${flagged ? 'bg-orange-50/40' : ''} ${
        showFeedback
          ? isCorrect
            ? 'border-l-4 border-green-400'
            : 'border-l-4 border-rose-300'
          : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-gray-100 text-gray-700 font-mono text-sm font-semibold tabular-nums">
          {q.localIdx}
        </span>
        <span className="text-xs text-gray-400">{q.marks}m</span>
        {savingId === q.id && <span className="text-xs text-blue-500">saving…</span>}
        <div className="flex-1" />
        <QuestionFlag qid={q.id} />
      </div>
      <QuestionItem q={q} taskType={taskType} hasBank={hasBank} />
      {showFeedback && (
        <div
          className={`mt-2 text-sm font-medium ${
            isCorrect ? 'text-green-700' : 'text-rose-700'
          }`}
        >
          {isCorrect ? '✓ Correct' : `✗ Correct answer: ${correctKey}`}
          {q.snapshotContent?.explanation && !isCorrect && (
            <span className="block text-gray-600 font-normal mt-1">
              {clean(q.snapshotContent.explanation)}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function QuestionItem({
  q,
  taskType,
  hasBank,
}: {
  q: ExamQuestion & { itemText: string };
  taskType: TaskType | '_other';
  hasBank: boolean;
}) {
  const { answers, setAnswer } = useExam();
  const answer = answers[q.id];
  const itemNode = clean(q.itemText);

  switch (taskType) {
    case 'yes_no_not_given':
    case 'true_false_not_given':
    case 'multiple_choice':
    case 'matching_features':
      return (
        <>
          <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug">{itemNode}</div>
          <RadioGroup
            options={q.snapshotOptions ?? []}
            value={answer?.selectedOption}
            onChange={(opt) => setAnswer(q.id, { selectedOption: opt })}
            compact={hasBank}
          />
        </>
      );
    case 'matching_information':
      return (
        <>
          <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug">{itemNode}</div>
          <LetterInput
            placeholder="A–H"
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          />
        </>
      );
    case 'matching_headings':
      return (
        <>
          <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug">{itemNode}</div>
          <LetterInput
            placeholder="i, ii, iii…"
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
            wider
          />
        </>
      );
    case 'sentence_completion':
    case 'summary_completion':
    case 'note_completion':
    case 'table_completion':
    case 'flow_chart_completion':
    case 'diagram_label_completion':
    case 'short_answer':
      return (
        <BlankAwareInput
          item={q.itemText}
          value={answer?.textAnswer ?? ''}
          onChange={(v) => setAnswer(q.id, { textAnswer: v })}
        />
      );
    default:
      return (
        <>
          <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug">{itemNode}</div>
          <DebouncedTextarea
            value={answer?.textAnswer ?? ''}
            onChange={(v) => setAnswer(q.id, { textAnswer: v })}
          />
        </>
      );
  }
}

function RadioGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: ExamOption[];
  value: string | undefined;
  onChange: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
      {options.map((opt) => {
        const checked = value === opt.key;
        if (compact) {
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg border text-base font-semibold transition-colors touch-manipulation ${
                checked
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-blue-50'
              }`}
            >
              {opt.key}
            </button>
          );
        }
        return (
          <label
            key={opt.key}
            className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors touch-manipulation min-h-[48px] ${
              checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50 active:bg-blue-50'
            }`}
          >
            <input
              type="radio"
              checked={checked}
              onChange={() => onChange(opt.key)}
              className="mt-1 w-5 h-5"
            />
            <span className="font-mono text-gray-500 text-base w-6">{opt.key}.</span>
            <span className="flex-1 text-base leading-snug">{clean(opt.text)}</span>
          </label>
        );
      })}
    </div>
  );
}

function LetterInput({
  value,
  onChange,
  placeholder,
  wider = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  wider?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
      placeholder={placeholder}
      className={`border rounded-lg px-4 py-3 text-lg font-mono uppercase tracking-wider min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${wider ? 'w-40' : 'w-28'}`}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}

function DebouncedTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local); }}
      placeholder="Your answer…"
      className="w-full border rounded-lg px-4 py-3 text-base min-h-[80px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
  );
}

function BlankAwareInput({
  item,
  value,
  onChange,
}: {
  item: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const cleaned = clean(item);
  const hasBlank = /\[BLANK\]/i.test(cleaned);
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <>
      <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-relaxed">
        {hasBlank
          ? cleaned.split(/(\[BLANK\])/i).map((part, i) =>
              /\[BLANK\]/i.test(part) ? (
                <span key={i} className="inline-block px-2.5 mx-0.5 bg-amber-100 border border-amber-200 rounded text-amber-800 text-sm font-medium">
                  ___
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )
          : cleaned}
      </div>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder="Your answer…"
        className="border rounded-lg px-4 py-3 text-base w-full max-w-md min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </>
  );
}
