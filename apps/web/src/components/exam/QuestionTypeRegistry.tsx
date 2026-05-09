import type { ExamPaper } from './types';
import { IELTSReadingPassage } from './questions/IELTSReadingPassage';
import { OLevelComprehension } from './questions/OLevelComprehension';
import { OLevelCloze } from './questions/OLevelCloze';
import { OLevelVocabInContext } from './questions/OLevelVocabInContext';
import { OLevelSentenceTransformation } from './questions/OLevelSentenceTransformation';
import { OLevelMcqList } from './questions/OLevelMcqList';

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
  const first = paper.questions[0];
  if (!first) return OLevelMcqList;

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
  return <Renderer paper={paper} />;
}
