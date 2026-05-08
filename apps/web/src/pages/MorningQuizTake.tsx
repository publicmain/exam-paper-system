import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Option = { key: string; text: string };

interface PaperQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  snapshotContent: any;
  snapshotOptions: Option[] | null;
}

interface SessionView {
  sessionId: string;
  attendanceId: string;
  submissionId: string | null;
  quizEnd: string;
  paperQuestions: PaperQuestion[];
}

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

interface TaskGroup {
  taskType: TaskType | '_other';
  /** Instruction shared across the group's sub-questions (deduped). */
  instruction: string;
  /** Bank of letter→text options shown once per group. Three task types
   *  carry shared banks: matching_features (`snapshotOptions`),
   *  matching_headings (`content.headingsBank`), summary_completion
   *  (`content.wordBank`). */
  bank: Option[] | null;
  /** Label for the bank header — varies by source so the student knows
   *  whether they're picking a heading number or a word from a word list. */
  bankLabel: string;
  questions: Array<PaperQuestion & { itemText: string; localIdx: number }>;
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
  _other: 'Question',
};

/** Strip the ingestion mojibake — past-paper PDFs lose en-dashes to U+FFFD. */
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/�/g, '–');
}

/** Reflow a passage extracted from a column-based PDF. PyMuPDF's text
 *  extraction puts a newline at every visual line break, leaving the body
 *  with a hard wrap every ~10 words. We coalesce single newlines into
 *  spaces, preserve double-newlines as paragraph breaks, and bump
 *  paragraph-letter markers (`\nA `, `\nB ` …) onto their own line so the
 *  passage reads like prose instead of a poem. Highlight char-offsets are
 *  computed against the same cleaned/reflowed string so they stay aligned. */
function reflowPassage(s: string): string {
  if (!s) return '';
  // Normalise CRLF, then split on intentional blank lines.
  const blocks = s.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out = blocks
    .map((b) => b.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  // Force a paragraph break before single-letter paragraph markers
  // ("A The Babylonians…", "B Before the introduction…", up to "Z").
  // Doing this after the join means we catch markers that the PDF
  // extractor placed mid-paragraph.
  return out.replace(/(^|[^\n])\s+([A-Z])\s+(?=[A-Z][a-z])/g, '$1\n\n$2 ');
}

/** Split the stem into (instruction, item). Cambridge IELTS PDFs put the
 *  shared instruction (and any task-level resource like a list-of-headings)
 *  first, then a blank line, then the per-question item. We split on the
 *  LAST blank line so a multi-paragraph instruction (instruction + heading
 *  bank) groups together as the deduped instruction. */
function splitStem(stem: string): { instruction: string; item: string } {
  const trimmed = stem.trim();
  const matches = [...trimmed.matchAll(/\n\s*\n/g)];
  if (matches.length === 0) return { instruction: '', item: trimmed };
  const last = matches[matches.length - 1];
  const splitAt = last.index ?? 0;
  return {
    instruction: trimmed.slice(0, splitAt).trim(),
    item: trimmed.slice(splitAt + last[0].length).trim(),
  };
}

/** Group consecutive questions by (taskType + instruction). Each group is one
 *  IELTS task — a shared header, optional bank, then the items. */
function groupQuestions(qs: PaperQuestion[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let cur: TaskGroup | null = null;
  qs.forEach((pq, idx) => {
    const c = pq.snapshotContent || {};
    const tt = (c.taskType as TaskType) ?? '_other';
    const { instruction, item } = splitStem(c.stem ?? '');
    const sameAsCurrent =
      cur && cur.taskType === tt && cur.instruction === instruction;
    if (!sameAsCurrent) {
      // The shared bank can come from three places depending on task type:
      //   - matching_features: stored as `options` on every sibling Q (the
      //     options list IS the bank, with .correct flagging the right one).
      //   - matching_headings: bank is `content.headingsBank` (a separate
      //     field), populated by the IELTS repair pass after ingestion.
      //   - summary_completion: bank is `content.wordBank`, same source.
      // For yes_no / mcq the option list is per-question, so no shared bank.
      let sharedBank: Option[] | null = null;
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
      cur = {
        taskType: tt,
        instruction,
        bank: sharedBank,
        bankLabel,
        questions: [],
      };
      groups.push(cur);
    }
    cur!.questions.push({ ...pq, itemText: item, localIdx: idx + 1 });
  });
  return groups;
}

/* ============================================================
 * Highlights — text selection in the passage panel persists to
 * localStorage keyed by (paperId, studentMaskId). Stored as
 * { start, end } character offsets into the cleaned passage
 * string. We render by splicing <mark> spans on read.
 * ============================================================ */

interface Highlight {
  id: string;
  start: number;
  end: number;
  text: string;
}

function loadHighlights(key: string): Highlight[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}
function saveHighlights(key: string, hs: Highlight[]) {
  localStorage.setItem(key, JSON.stringify(hs));
}

interface Note {
  id: string;
  /** Anchor offset into the passage. */
  offset: number;
  text: string;
}

function loadNotes(key: string): Note[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}
function saveNotes(key: string, ns: Note[]) {
  localStorage.setItem(key, JSON.stringify(ns));
}

/* ============================================================
 * Main page
 * ============================================================ */

export default function MorningQuizTake() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, { selectedOption?: string; textAnswer?: string }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [submitted, setSubmitted] = useState(false);
  const [showPassageMobile, setShowPassageMobile] = useState(false);
  // Examplify-style review flag — students mark questions to revisit later;
  // the bottom palette shows them with an orange ring. Persist per session
  // in localStorage so a refresh doesn't drop them.
  const flagKey = sessionId ? `mq:flags:${sessionId}` : '';
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => {
    if (!flagKey) return new Set();
    try {
      const raw = localStorage.getItem(flagKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const questionRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const toggleFlag = useCallback((pqId: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pqId)) next.delete(pqId);
      else next.add(pqId);
      if (flagKey) localStorage.setItem(flagKey, JSON.stringify([...next]));
      return next;
    });
  }, [flagKey]);

  const scrollToQuestion = useCallback((pqId: string) => {
    const el = questionRefs.current[pqId];
    if (!el) return;
    // Account for the sticky header by scrolling slightly past the target.
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top - 80;
    window.scrollTo({ top, behavior: 'smooth' });
    setPaletteOpen(false);
    // Make sure the user isn't stuck on the passage panel in mobile/portrait.
    setShowPassageMobile(false);
    // Brief flash so the student sees which row they jumped to.
    el.classList.add('mq-jump-flash');
    setTimeout(() => el.classList.remove('mq-jump-flash'), 1100);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    api
      .morningQuizSession(sessionId)
      .then((v: SessionView) => setView(v))
      .catch((e: any) => setError(e.message ?? String(e)));
  }, [sessionId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = useMemo(() => {
    if (!view) return 0;
    return Math.max(0, new Date(view.quizEnd).getTime() - now);
  }, [view, now]);

  // Auto-submit when time is up.
  useEffect(() => {
    if (!view || submitted) return;
    if (remainingMs > 0) return;
    handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, view, submitted]);

  async function saveAnswer(
    pqId: string,
    body: { selectedOption?: string | null; textAnswer?: string | null },
  ) {
    if (!sessionId) return;
    setSavingId(pqId);
    try {
      await api.morningQuizSaveAnswer(sessionId, { paperQuestionId: pqId, ...body });
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSubmit() {
    if (!sessionId || submitted) return;
    setSubmitted(true);
    try {
      await api.morningQuizSubmit(sessionId);
      navigate('/student', { replace: true });
    } catch (e: any) {
      setError(e.message ?? String(e));
      setSubmitted(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="text-rose-600 text-lg mb-4">⚠️ {error}</div>
        <button
          className="text-sm text-blue-600 underline"
          onClick={() => navigate('/student')}
        >
          返回首页
        </button>
      </div>
    );
  }
  if (!view) return <div className="p-6 text-gray-500">Loading…</div>;

  const passageContent = view.paperQuestions[0]?.snapshotContent ?? {};
  const passageTitle = clean(passageContent.passageTitle ?? 'Reading Passage');
  const passageBody = reflowPassage(clean(passageContent.passage ?? ''));
  const groups = groupQuestions(view.paperQuestions);

  const mm = String(Math.floor(remainingMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');
  const danger = remainingMs < 5 * 60_000;
  const answeredCount = Object.values(answers).filter(
    (a) => a && (a.selectedOption || (a.textAnswer && a.textAnswer.trim())),
  ).length;
  const total = view.paperQuestions.length;
  const localStorageKey = `mq:hl:${sessionId}`;
  const noteStorageKey = `mq:nt:${sessionId}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-28" style={{ minHeight: '100dvh' }}>
      <style>{`
        @keyframes mq-flash {
          0% { background-color: rgb(254 240 138 / 0.7); }
          100% { background-color: transparent; }
        }
        .mq-jump-flash { animation: mq-flash 1.1s ease-out; }
      `}</style>
      {/* Top header bar.  iPad has a chunkier top edge so we bump padding;
          the passage-toggle button needs to be a real tap target (≥44px)
          for iPad portrait + phone, hidden on lg: where the passage is
          permanently visible side-by-side. */}
      <div
        className={`sticky top-0 z-20 px-4 py-2.5 lg:py-3 backdrop-blur bg-white/90 border-b flex items-center justify-between gap-2 ${danger ? 'text-rose-600' : 'text-gray-700'}`}
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
      >
        <div className="font-semibold text-base lg:text-lg">早测 · Morning Quiz</div>
        <div className="text-sm text-gray-500 hidden lg:block">
          {answeredCount} / {total} 已答
        </div>
        <div className="font-mono tabular-nums text-2xl lg:text-3xl">
          {mm}:{ss}
        </div>
        <button
          className="lg:hidden text-sm text-blue-600 underline px-3 py-2 -my-2 rounded touch-manipulation"
          onClick={() => setShowPassageMobile((v) => !v)}
        >
          {showPassageMobile ? '回到题目' : '看原文'}
        </button>
      </div>

      <div className="lg:flex lg:gap-6 lg:max-w-7xl lg:mx-auto lg:px-6 lg:py-4">
        {/* Passage panel.  Side-by-side at lg: (≥1024px, iPad landscape
            and bigger). Below that — including iPad portrait at 768-1023px
            — the panel is full-width and toggled via the header button so
            the questions side stays at a comfortable reading width. */}
        <aside
          className={`${showPassageMobile ? 'block' : 'hidden'} lg:block lg:w-1/2 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100dvh-5rem)] lg:overflow-auto bg-white lg:rounded-lg lg:border lg:shadow-sm`}
        >
          <PassagePanel
            title={passageTitle}
            body={passageBody}
            highlightKey={localStorageKey}
            noteKey={noteStorageKey}
          />
        </aside>

        {/* Tasks panel */}
        <div className={`${showPassageMobile ? 'hidden' : 'block'} lg:block lg:w-1/2 space-y-5 px-4 lg:px-0 py-4 lg:py-0`}>
          {groups.map((g, gi) => (
            <TaskGroupView
              key={gi}
              group={g}
              gi={gi}
              answers={answers}
              setAnswers={setAnswers}
              saveAnswer={saveAnswer}
              savingId={savingId}
              flaggedIds={flaggedIds}
              toggleFlag={toggleFlag}
              questionRefs={questionRefs}
            />
          ))}
        </div>
      </div>

      {/* Examplify-style question palette: 4-column grid of every Q with
          colour-coded status (answered / unanswered / flagged).  Tapping a
          number scrolls that question into view and closes the overlay. */}
      {paletteOpen && (
        <QuestionPalette
          questions={view.paperQuestions}
          answers={answers}
          flaggedIds={flaggedIds}
          onSelect={scrollToQuestion}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Bottom toolbar.  Examplify-style: palette + flag tally on the
          left, submit on the right. iPad keyboard hides 1/3 of the screen
          on focus, so we sit above the bottom safe-area inset and give
          every control a 44 px+ tap target. */}
      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-7xl mx-auto px-3 lg:px-5 py-2.5 lg:py-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 active:bg-gray-100 hover:bg-gray-50 touch-manipulation min-h-[48px] font-medium text-sm"
            title="题号面板"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="12.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="2.5" y="12.5" width="5" height="5" rx="1" />
              <rect x="12.5" y="12.5" width="5" height="5" rx="1" />
            </svg>
            <span>题号</span>
            <span className="text-xs tabular-nums text-gray-500">
              {answeredCount}/{total}
            </span>
          </button>
          {flaggedIds.size > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-orange-700 px-2 py-1.5 bg-orange-50 border border-orange-200 rounded-md">
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
              </svg>
              {flaggedIds.size} 已标记
            </span>
          )}
          <div className="flex-1" />
          <button
            disabled={submitted}
            onClick={handleSubmit}
            className="px-6 lg:px-7 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 text-white rounded-lg font-semibold text-base touch-manipulation min-h-[48px]"
          >
            {submitted ? '提交中…' : '交卷'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Passage panel
 * ============================================================ */

function PassagePanel({
  title,
  body,
  highlightKey,
  noteKey,
}: {
  title: string;
  body: string;
  highlightKey: string;
  noteKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>(() => loadHighlights(highlightKey));
  const [notes, setNotes] = useState<Note[]>(() => loadNotes(noteKey));
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // Capture text selection. Compute character offsets into the passage body,
  // record the highlight, persist, and clear the selection.
  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const root = containerRef.current?.querySelector('[data-passage-body]');
    if (!root) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const start = textOffset(root as HTMLElement, range.startContainer, range.startOffset);
    const end = textOffset(root as HTMLElement, range.endContainer, range.endOffset);
    if (start === end) return;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const text = body.slice(lo, hi);
    const h: Highlight = { id: cuid(), start: lo, end: hi, text };
    const next = mergeHighlight(highlights, h);
    setHighlights(next);
    saveHighlights(highlightKey, next);
    sel.removeAllRanges();
  }

  function removeHighlight(id: string) {
    const next = highlights.filter((h) => h.id !== id);
    setHighlights(next);
    saveHighlights(highlightKey, next);
  }

  function addNote() {
    const text = prompt('便笺内容?');
    if (!text || !text.trim()) return;
    const n: Note = { id: cuid(), offset: body.length, text: text.trim() };
    const next = [...notes, n];
    setNotes(next);
    saveNotes(noteKey, next);
  }

  function editNote(id: string) {
    const cur = notes.find((n) => n.id === id);
    const text = prompt('编辑便笺', cur?.text ?? '');
    if (text === null) return;
    if (!text.trim()) {
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      saveNotes(noteKey, next);
      return;
    }
    const next = notes.map((n) => (n.id === id ? { ...n, text: text.trim() } : n));
    setNotes(next);
    saveNotes(noteKey, next);
  }

  return (
    <div className="px-5 py-5 lg:px-6 lg:py-6" ref={containerRef}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-semibold text-xl lg:text-2xl">{title}</h2>
        <button
          className="text-sm text-blue-600 px-3 py-2 rounded-lg border border-blue-200 active:bg-blue-50 touch-manipulation min-h-[40px] font-medium"
          onClick={addNote}
          title="加便笺"
        >
          + 便笺
        </button>
      </div>
      <div className="text-xs text-gray-400 mb-3">
        提示:长按或拖选文字 → 自动黄色高亮;点击高亮可移除
      </div>
      <div
        data-passage-body
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        // text-base + leading-relaxed + serif font produces a comfortable
        // reading experience on iPad — students sit with the panel for
        // ~10 minutes, so legibility matters more than density here.
        className="max-w-none text-[1.0625rem] lg:text-lg text-gray-800 leading-[1.75] select-text whitespace-pre-wrap font-serif"
        style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
      >
        {renderHighlighted(body, highlights, removeHighlight)}
      </div>
      {notes.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <div className="text-xs text-gray-500 mb-2 font-medium">便笺</div>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="text-base bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5 cursor-pointer active:bg-yellow-100 hover:bg-yellow-100 touch-manipulation"
                onClick={() => editNote(n.id)}
                title="点击编辑/删除"
              >
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  // Walk text nodes in document order, summing lengths until we reach `node`.
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    if (cur === node) return total + offset;
    total += (cur.textContent ?? '').length;
  }
  return total;
}

/** Merge a new highlight into the list, deduping/coalescing overlaps. */
function mergeHighlight(existing: Highlight[], add: Highlight): Highlight[] {
  const out: Highlight[] = [];
  let merged: Highlight = { ...add };
  for (const h of existing) {
    if (h.end < merged.start || h.start > merged.end) {
      out.push(h);
    } else {
      merged = {
        id: merged.id,
        start: Math.min(merged.start, h.start),
        end: Math.max(merged.end, h.end),
        text: '', // recomputed below
      };
    }
  }
  out.push(merged);
  return out;
}

function renderHighlighted(
  body: string,
  highlights: Highlight[],
  onRemove: (id: string) => void,
): React.ReactNode {
  if (highlights.length === 0) return body;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of sorted) {
    if (h.start > cursor) parts.push(body.slice(cursor, h.start));
    parts.push(
      <mark
        key={h.id}
        className="bg-yellow-200 cursor-pointer"
        onClick={() => onRemove(h.id)}
        title="点击移除高亮"
      >
        {body.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

function cuid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ============================================================
 * Task group view
 * ============================================================ */

function TaskGroupView({
  group,
  gi,
  answers,
  setAnswers,
  saveAnswer,
  savingId,
  flaggedIds,
  toggleFlag,
  questionRefs,
}: {
  group: TaskGroup;
  gi: number;
  answers: Record<string, { selectedOption?: string; textAnswer?: string }>;
  setAnswers: React.Dispatch<
    React.SetStateAction<Record<string, { selectedOption?: string; textAnswer?: string }>>
  >;
  saveAnswer: (
    pqId: string,
    body: { selectedOption?: string | null; textAnswer?: string | null },
  ) => Promise<void>;
  savingId: string | null;
  flaggedIds: Set<string>;
  toggleFlag: (pqId: string) => void;
  questionRefs: React.MutableRefObject<Record<string, HTMLLIElement | null>>;
}) {
  const firstNum = group.questions[0].localIdx;
  const lastNum = group.questions[group.questions.length - 1].localIdx;
  const range = firstNum === lastNum ? `${firstNum}` : `${firstNum}–${lastNum}`;
  const taskTitle = TASK_TITLES[group.taskType] ?? 'Question';

  return (
    <section className="bg-white rounded-md border border-gray-200 overflow-hidden">
      {/* Examplify keeps the section header minimal — task type as a label,
          not a colourful pill. The whole header sits in a thin grey strip
          above the items so the page reads top-down without competing
          coloured blocks. */}
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
        {group.questions.map((q) => {
          const flagged = flaggedIds.has(q.id);
          return (
            <li
              key={q.id}
              ref={(el) => { questionRefs.current[q.id] = el; }}
              className={`px-4 lg:px-5 py-4 transition-colors ${flagged ? 'bg-orange-50/40' : ''}`}
            >
              <div className="flex items-center gap-3 mb-2">
                {/* Numbered Q badge — Examplify renders Q numbers as a
                    fixed-width pill so the eye lines them up on scroll. */}
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-gray-100 text-gray-700 font-mono text-sm font-semibold tabular-nums">
                  {q.localIdx}
                </span>
                <span className="text-xs text-gray-400">{q.marks}m</span>
                {savingId === q.id && (
                  <span className="text-xs text-blue-500">saving…</span>
                )}
                <div className="flex-1" />
                {/* Flag for review.  Toggle bookmark; the bottom palette
                    shows it with an orange ring. */}
                <button
                  type="button"
                  onClick={() => toggleFlag(q.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors touch-manipulation min-h-[36px] ${
                    flagged
                      ? 'bg-orange-100 border-orange-300 text-orange-800'
                      : 'border-gray-200 text-gray-500 active:bg-gray-100 hover:bg-gray-50'
                  }`}
                  title={flagged ? '取消标记' : '标记待复查'}
                  aria-pressed={flagged}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M4 3a1 1 0 011-1h11l-2 4 2 4H5v8H3V3a0 0 0 011 0z" />
                  </svg>
                  {flagged ? '已标记' : '标记'}
                </button>
              </div>
              <QuestionItem
                q={q}
                taskType={group.taskType}
                hasBank={!!group.bank}
                answer={answers[q.id]}
                onChange={(a) => {
                  setAnswers((p) => ({ ...p, [q.id]: a }));
                  saveAnswer(q.id, {
                    selectedOption: a.selectedOption ?? null,
                    textAnswer: a.textAnswer ?? null,
                  });
                }}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Examplify-style question palette: 4-column grid of Q numbers, colour-
 *  coded by status. Tapping a number scrolls that question into view and
 *  closes the overlay. Fixed-position modal with a backdrop so the student
 *  always lands back where they were when the overlay closes. */
function QuestionPalette({
  questions,
  answers,
  flaggedIds,
  onSelect,
  onClose,
}: {
  questions: PaperQuestion[];
  answers: Record<string, { selectedOption?: string; textAnswer?: string }>;
  flaggedIds: Set<string>;
  onSelect: (pqId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm flex items-end lg:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="font-semibold text-base">题号导航</div>
            <div className="text-xs text-gray-500 mt-0.5">点击数字跳到对应题目</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full active:bg-gray-100 hover:bg-gray-50 flex items-center justify-center text-gray-500 touch-manipulation"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-4">
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, i) => {
              const ans = answers[q.id];
              const answered = !!(ans?.selectedOption || (ans?.textAnswer && ans.textAnswer.trim()));
              const flagged = flaggedIds.has(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelect(q.id)}
                  className={`relative h-12 rounded-md font-mono font-semibold text-sm transition-colors touch-manipulation
                    ${answered ? 'bg-blue-600 text-white border border-blue-700' : 'bg-gray-100 text-gray-700 border border-gray-200 active:bg-gray-200 hover:bg-gray-50'}
                    ${flagged ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
                  aria-label={`Question ${i + 1} ${answered ? '已答' : '未答'}${flagged ? ' 已标记' : ''}`}
                >
                  {i + 1}
                  {flagged && (
                    <span className="absolute top-0.5 right-0.5 text-[10px] text-orange-500">●</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-600" /> 已答
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /> 未答
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-orange-400" /> 待复查
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Per-question rendering by taskType
 * ============================================================ */

function QuestionItem({
  q,
  taskType,
  hasBank,
  answer,
  onChange,
}: {
  q: PaperQuestion & { itemText: string };
  taskType: TaskType | '_other';
  hasBank: boolean;
  answer: { selectedOption?: string; textAnswer?: string } | undefined;
  onChange: (a: { selectedOption?: string; textAnswer?: string }) => void;
}) {
  const itemNode = renderItemText(q.itemText);

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
            onChange={(opt) => onChange({ selectedOption: opt })}
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
            onChange={(v) => onChange({ textAnswer: v })}
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
            onChange={(v) => onChange({ textAnswer: v })}
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
          onChange={(v) => onChange({ textAnswer: v })}
        />
      );

    default:
      // Unknown type — fallback to text area + plain item rendering.
      return (
        <>
          <div className="text-base text-gray-800 mb-2.5 whitespace-pre-wrap leading-snug">{itemNode}</div>
          <DebouncedTextarea
            value={answer?.textAnswer ?? ''}
            onChange={(v) => onChange({ textAnswer: v })}
          />
        </>
      );
  }
}

/** Item text from the source PDF often contains "[BLANK]" placeholders or
 *  repeated long instructions. We just render with the placeholder visible. */
function renderItemText(s: string): React.ReactNode {
  return clean(s);
}

function RadioGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: Option[];
  value: string | undefined;
  onChange: (key: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'space-y-2'}>
      {options.map((opt) => {
        const checked = value === opt.key;
        if (compact) {
          // Compact A-F buttons under a shared bank — 44×44 minimum so
          // an iPad finger doesn't have to aim for a 24px target.
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg border text-base font-semibold transition-colors touch-manipulation ${
                checked
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-gray-300 text-gray-700 active:bg-blue-50 hover:bg-gray-50'
              }`}
            >
              {opt.key}
            </button>
          );
        }
        // Full radios (TRUE/FALSE/NG, multiple-choice, etc.) — larger row
        // padding and bigger circle so the whole label is a comfortable tap.
        return (
          <label
            key={opt.key}
            className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition-colors touch-manipulation min-h-[48px] ${
              checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 active:bg-blue-50 hover:bg-gray-50'
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
  // Sync down when the parent's value changes (e.g. on initial fetch).
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onChange(local);
      }}
      placeholder={placeholder}
      className={`border rounded-lg px-4 py-3 text-lg font-mono uppercase tracking-wider min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${wider ? 'w-40' : 'w-28'}`}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
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
  useEffect(() => {
    setLocal(value);
  }, [value]);
  return (
    <textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onChange(local);
      }}
      placeholder="Your answer…"
      className="w-full border rounded-lg px-4 py-3 text-base min-h-[80px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    />
  );
}

/** Inputs for completion tasks. The PDF stem typically has [BLANK] inline; we
 *  show the stem with the blank highlighted and a single text input below.
 *  We hold the value locally and only fire the parent's onChange (which
 *  triggers a network save) when the input loses focus, so a user typing
 *  fast doesn't get characters dropped while a previous save round-trips. */
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
  useEffect(() => {
    setLocal(value);
  }, [value]);
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
        onBlur={() => {
          if (local !== value) onChange(local);
        }}
        placeholder="Your answer…"
        className="border rounded-lg px-4 py-3 text-base w-full max-w-md min-h-[48px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </>
  );
}
