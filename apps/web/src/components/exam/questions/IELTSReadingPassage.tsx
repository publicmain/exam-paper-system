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
  // R10 follow-up — OLEVEL Cambridge IGCSE 0510 Exercise 2 sets four
  // mini-reviews (texts A–D) and asks "which writer says…"; ingest tags
  // these as taskType=multi_match. Without an entry here the shell fell
  // back to "_other" → "Question", which read like a placeholder. Same
  // pattern for Ex 3 note-completion (we keep that under note_completion
  // already). Add the OLEVEL families explicitly.
  multi_match: 'Multi-text Matching',
  olevel_short_answer: 'Short Answer',
  olevel_comprehension: 'Comprehension',
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
  // All hooks run on every render — round-7 C-E2. The empty-paper early
  // return previously sat between useState and useMemo / useStoredX hooks,
  // so the first non-empty render after a refetch reordered them and
  // React threw the "Rules of Hooks" violation.
  const { fontScale } = useExam();
  // Mobile pane toggle — the split collapses to a stack on iPad portrait
  // and phones; the user picks which side to look at. Default to questions
  // since that's where they'll spend most of their time.
  const [mobileSide, setMobileSide] = useState<'left' | 'right'>('right');
  const passageContent = paper?.questions?.[0]?.snapshotContent ?? {};
  const passageTitle = clean(passageContent.passageTitle ?? 'Reading Passage');
  const passageBody = useMemo(() => reflowPassage(clean(passageContent.passage ?? '')), [passageContent.passage]);
  const groups = useMemo(() => groupQuestions(paper?.questions ?? []), [paper?.questions]);

  const hlKey = `mq:hl:${paper?.sessionId ?? ''}`;
  const noteKey = `mq:nt:${paper?.sessionId ?? ''}`;
  const [highlights, setHighlights] = useStoredHighlights(hlKey);
  const [notes, addNote, editNote, removeNote] = useStoredNotes(noteKey);

  if (!paper?.questions?.length) {
    return (
      <div className="max-w-xl mx-auto py-12 px-6 text-center text-amber-800">
        该卷尚未出题，请联系老师。
      </div>
    );
  }

  // R10 follow-up — `zoom` was unreliable: Firefox doesn't support it
  // and Chrome's behaviour with nested overflow:auto + dvh height
  // calculations is glitchy enough that students reported the passage
  // panel ignoring A+/A−. Switch to a CSS variable that descendants
  // reference via explicit inline-style font-size; works the same in
  // every browser and means the passage Highlighter, question stems
  // and option labels all scale together.
  return (
    <div
      className="lg:h-[calc(100dvh-9rem)]"
      style={{ ['--mq-fs' as any]: String(fontScale) }}
    >
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
          // R15-Audit#2 — same hidden-scrollbar pattern as the OLEVEL bug.
          // On iPad-landscape (1024×768 exactly at lg) the inner scrollbar
          // is ~2px wide; students don't realize the passage continues.
          // Keeping lg:max-h-full to respect the parent's calc-height
          // container, but switching to overflow-y-auto + scrollbar-gutter:
          // stable so the gutter is reserved (visible) at all breakpoints.
          <aside className="bg-white lg:rounded-lg lg:border lg:shadow-sm lg:max-h-full lg:overflow-y-auto h-full [scrollbar-gutter:stable]">
            <div className="px-5 py-5 lg:px-6 lg:py-6">
              <h2 className="font-semibold text-xl lg:text-2xl mb-1">{passageTitle}</h2>
              <div className="text-xs text-gray-400 mb-3">
                提示 · Tip：拖选文字加黄色高亮，点击高亮可移除。
              </div>
              <Highlighter
                body={passageBody}
                highlights={highlights}
                onChange={setHighlights}
                className="text-gray-800 leading-[1.75] font-serif"
                // Apply the user-controlled font scale via inline style
                // (overrides any inherited text-* class). 1.125rem is the
                // baseline that text-lg used at fontScale=1.
                style={{ fontSize: `calc(1.125rem * var(--mq-fs, 1))` }}
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
          <div className="lg:max-h-full lg:overflow-y-auto space-y-5 px-4 lg:px-4 py-4 lg:py-4 [scrollbar-gutter:stable]">
            {groups.map((g, gi) => (
              // B3-H12/H13 perf — `content-visibility: auto` lets the
              // browser skip layout / paint for off-screen task groups
              // (each ~3-13 questions). `contain-intrinsic-size` reserves
              // a placeholder height so the scrollbar doesn't jump as
              // groups become visible. iPad Safari respects both.
              <div
                key={gi}
                style={{
                  contentVisibility: 'auto' as any,
                  containIntrinsicSize: '600px',
                }}
              >
                <TaskGroupView group={g} gi={gi} />
              </div>
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
          <p
            className="mt-2 text-gray-700 whitespace-pre-wrap leading-relaxed"
            style={{ fontSize: `calc(0.9375rem * var(--mq-fs, 1))` }}
          >
            {clean(group.instruction)}
          </p>
        )}
      </header>
      {group.bank && (
        <div className="px-4 lg:px-5 py-3 bg-amber-50/60 border-b border-amber-100">
          <div className="text-xs text-amber-900 font-semibold tracking-wide uppercase mb-2">
            {group.bankLabel}
          </div>
          <ul
            className="space-y-1 sm:columns-2 sm:gap-x-6"
            style={{ fontSize: `calc(0.9375rem * var(--mq-fs, 1))` }}
          >
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
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
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
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
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
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
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
          <div
            className="text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug"
            style={{ fontSize: `calc(1rem * var(--mq-fs, 1))` }}
          >
            {itemNode}
          </div>
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
  // R10 follow-up — option text scales with the user's A+/A− setting via
  // the same `--mq-fs` CSS variable used elsewhere on this page. Default
  // 1rem is what `text-base` resolved to before; the calc() multiplies it.
  const optStyle = { fontSize: `calc(1rem * var(--mq-fs, 1))` } as const;
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
              className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg border font-semibold transition-colors touch-manipulation ${
                checked
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-blue-50'
              }`}
              style={optStyle}
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
            style={optStyle}
          >
            <input
              type="radio"
              checked={checked}
              onChange={() => onChange(opt.key)}
              className="mt-1 w-5 h-5"
            />
            <span className="font-mono text-gray-500 w-6">{opt.key}.</span>
            <span className="flex-1 leading-snug">{clean(opt.text)}</span>
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
      onChange={(e) => {
        // R15-followup-6 — save IMMEDIATELY on every keystroke instead
        // of waiting for blur. The blur-only save lost answers when a
        // student tapped "Done" right after typing: the input lost
        // focus AND the Submit handler fired in the same tick, racing
        // React's state batching — the parent saw the old value and
        // posted (空答) to the backend. Live save matches the rest of
        // the renderer's behavior (LetterInput is short — "ii", "iii"
        // — so per-keystroke debounce in ExamProvider isn't a hot path).
        const v = e.target.value;
        setLocal(v);
        onChange(v);
      }}
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
  // R15-followup-6 — save on every keystroke (same fix as LetterInput).
  // The blur-only save raced the Done button and dropped answers; for
  // 1-3 sentence short answers per-keystroke save is cheap.
  return (
    <textarea
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        onChange(v);
      }}
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
        onChange={(e) => {
          // R15-followup-6 — live save (see LetterInput comment).
          const v = e.target.value;
          setLocal(v);
          onChange(v);
        }}
        onBlur={() => { if (local !== value) onChange(local); }}
        placeholder="Your answer…"
        className="border rounded-lg px-4 py-3 text-base w-full max-w-md min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </>
  );
}
