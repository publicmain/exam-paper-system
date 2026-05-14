import type { ExamPaper } from './types';
import { IELTSReadingPassage } from './questions/IELTSReadingPassage';
import { OLevelComprehension } from './questions/OLevelComprehension';
import { OLevelCloze } from './questions/OLevelCloze';
import { OLevelVocabInContext } from './questions/OLevelVocabInContext';
import { OLevelSentenceTransformation } from './questions/OLevelSentenceTransformation';
import { OLevelMcqList } from './questions/OLevelMcqList';

/**
 * Empty-paper safety net. The DB schema doesn't strictly forbid a paper
 * with zero PaperQuestion rows (admin mid-edit, AI-generation half-failed,
 * cleanup race), and earlier renderers indexed `questions[0]` directly.
 * Now we surface an explicit "no questions yet" card; the bottom palette
 * still works (empty grid). See round-3 SUMMARY C3.
 */
function EmptyPaperCard() {
  return (
    <div className="max-w-xl mx-auto py-12 px-6 text-center">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 shadow-sm">
        <div className="text-3xl mb-3">📄</div>
        <h2 className="text-lg font-semibold text-amber-900 mb-2">
          该卷尚未出题 · No questions yet
        </h2>
        <p className="text-sm text-amber-800 leading-relaxed">
          这份卷子目前没有题目。请联系老师或刷新页面重试；若仍空白，请反馈给管理员。
        </p>
      </div>
    </div>
  );
}

/**
 * Pick the renderer for a paper.
 *
 * Priority of detection (the first match wins):
 *  1. paper.paperMode === 'passage_pick' OR first question carries a
 *     `taskType` typical of IELTS Reading (matching_*, *_completion …)
 *     → IELTSReadingPassage. The IELTS shell already knows how to group
 *     by task and place the bank, so anything that smells IELTS goes
 *     here regardless of `level`.
 *  2. First question's snapshotContent.uiKind === 'cloze' / 'vocab' /
 *     'transformation' (set by the AI generator for new O-Level papers)
 *     → corresponding O-Level shell.
 *  3. First question carries a passage field but no IELTS task type →
 *     OLevelComprehension.
 *  4. Otherwise → generic OLevelMcqList.
 *
 * Everything is driven by the question data so the registry stays
 * level-agnostic — `level` is a hint, not the gate. Adding a new
 * renderer is one switch case here plus a new component file.
 */

export function pickRenderer(paper: ExamPaper) {
  const first = paper?.questions?.[0];
  if (!first) return EmptyPaperCard;

  const c = first.snapshotContent ?? {};
  const tt: string = c.taskType ?? '';
  const uiKind: string = c.uiKind ?? '';

  // 1. IELTS Reading family
  const ieltsTaskTypes = new Set([
    'matching_information',
    'matching_headings',
    'matching_features',
    'multiple_choice',
    'true_false_not_given',
    'yes_no_not_given',
    'sentence_completion',
    'summary_completion',
    'note_completion',
    'table_completion',
    'flow_chart_completion',
    'diagram_label_completion',
    'short_answer',
  ]);
  if (paper.paperMode === 'passage_pick' || ieltsTaskTypes.has(tt)) {
    // R15-followup — multi-passage detection. OLEVEL Cambridge papers
    // (e.g. cambridge_0510_s23/Paper12) carry TWO passages: Q1-7 share
    // one, Q8-15 share another. IELTSReadingPassage hardcodes
    // `questions[0].snapshotContent.passage` so the left pane is
    // pinned to passage #1 forever — Q8-15 students saw an unrelated
    // article and couldn't answer. The IELTS scrolling layout simply
    // can't represent "passage changes mid-scroll" anyway, so the
    // correct fallback is OLevelComprehension which is paged
    // (one Q at a time) AND already walks back from the current Q
    // to find its passage.
    //
    // R15-followup-13 — but the AI generator for OLEVEL Section-B
    // comprehension (library_card / ndp_orchid / senior_sister fixtures)
    // appends a SHORT "Refer to the same narrative above…" backref
    // pseudo-passage to the MCQ sub-section (Q7-Q10 on library_card,
    // Q13-Q16 on ndp_orchid). That tripped the multi-passage check
    // (uniquePassages.size = 2) and forced these papers through the
    // paged OLevelComprehension shell, which renders the section-intro
    // preamble inside each question card.
    //
    // The IELTSReadingPassage shell groups by taskType + instruction
    // and shows the preamble ONCE at the top of each group — much
    // cleaner. Filter out backref passages before counting so single-
    // real-passage OLEVEL papers route to the IELTS shell instead.
    const looksLikeBackref = (s: string): boolean => {
      const t = s.trim().toLowerCase();
      if (!t) return false;
      return (
        t.startsWith('refer to') ||
        t.startsWith('see passage') ||
        t.startsWith('see the passage') ||
        t.startsWith('using the passage above') ||
        t.startsWith('see exercise') ||
        t.startsWith('based on the same') ||
        t.startsWith('with reference to the')
      );
    };
    const uniquePassages = new Set(
      (paper.questions ?? [])
        .map((q) => q?.snapshotContent?.passage)
        .filter((p): p is string => typeof p === 'string' && p.length > 0)
        .filter((p) => !looksLikeBackref(p)),
    );
    if (uniquePassages.size > 1) {
      return OLevelComprehension;
    }
    return IELTSReadingPassage;
  }

  // 2. Explicit O-Level UI hint
  if (uiKind === 'cloze') return OLevelCloze;
  if (uiKind === 'vocab' || uiKind === 'vocab_in_context') return OLevelVocabInContext;
  if (uiKind === 'transformation' || uiKind === 'sentence_transformation') {
    return OLevelSentenceTransformation;
  }

  // 3. Heuristic — passage at the top with multi-question MCQs ⇒ comprehension
  if (typeof c.passage === 'string' && c.passage.length > 200 && paper.questions.length > 1) {
    return OLevelComprehension;
  }

  // 4. Fallback: generic standalone MCQ
  return OLevelMcqList;
}

export function ExamRenderer({ paper }: { paper: ExamPaper }) {
  const Renderer = pickRenderer(paper);
  // Defensive: even if a renderer is reached with empty questions (e.g.
  // a future router branch forgot to guard), surface the empty card
  // instead of letting `questions[0]` crash inside the renderer.
  if (!paper?.questions?.length) return <EmptyPaperCard />;
  return <Renderer paper={paper} />;
}

export { EmptyPaperCard };
