import { Injectable, Logger } from '@nestjs/common';
import { evaluateFormula, extractFormulaAndTable } from './formula-eval';

/**
 * 10-step AI audit runner. Runs deterministic structural / numeric checks
 * over a generated question payload BEFORE it ships to a student paper.
 * Each check produces a finding with a severity:
 *
 *   - 'error'   — student paper is broken or unsolvable; caller should
 *                 reject the question (drop or regenerate).
 *   - 'warning' — paper is shippable but a teacher should eyeball it
 *                 (rare cosmetic / borderline-style issue).
 *
 * Designed to be pure (no I/O) so callers can run it inline during
 * QuickPaperService.generate without slowing the flow, and can replay it
 * later from an admin endpoint over stored Question rows.
 *
 * The check IDs map 1:1 onto the school's "10 PDF→fixture audit checks"
 * rule (passage / stem / mark-scheme / schema / AI-grader exact + paraphrase
 * + reject / UI render). Checks 06–09 are diagram + numeric audits added in
 * R15-followup to catch the failure mode where the AI ships a "Plot the
 * points" question with the points already pre-plotted.
 */
export type AuditSeverity = 'error' | 'warning';

export interface AuditFinding {
  checkId: string;
  severity: AuditSeverity;
  message: string;
}

export interface AuditableQuestion {
  /** A short locator like "Q3" or "Q3(a)" — surfaced in warning text. */
  ref?: string;
  stem: string;
  parts?: Array<{ label: string; text: string; marks: number }>;
  totalMarks: number;
  questionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  /** Optional MCQ options encoded inline in the stem (A/B/C/D); the audit
   *  only inspects the stem for these. */
  diagram?: {
    needed: boolean;
    type?: string;
    spec?: any;
  };
}

export interface AuditReport {
  questionRef: string;
  findings: AuditFinding[];
  errorCount: number;
  warningCount: number;
}

@Injectable()
export class QuickPaperAuditService {
  private readonly logger = new Logger('QuickPaperAudit');

  /**
   * Run all checks against one question. Returns the report; never throws
   * (callers decide what to do with errors — typically drop the question
   * from the paper and add a warning to the API response).
   */
  audit(q: AuditableQuestion): AuditReport {
    const ref = q.ref ?? '(unknown)';
    const f: AuditFinding[] = [];

    this.check01_stemNonEmpty(q, f);
    this.check02_partsMarksSum(q, f);
    this.check03_mcqHasOptions(q, f);
    this.check04_latexBalanced(q, f);
    this.check05_tableWellFormed(q, f);
    this.check06_tableFormulaConsistent(q, f);
    this.check07_diagramAnswerLeakage(q, f);
    this.check08_diagramSpecPopulated(q, f);
    this.check09_strayMathArtifacts(q, f);
    this.check10_marksRange(q, f);

    return {
      questionRef: ref,
      findings: f,
      errorCount: f.filter((x) => x.severity === 'error').length,
      warningCount: f.filter((x) => x.severity === 'warning').length,
    };
  }

  /** 01 — stem is not empty. */
  private check01_stemNonEmpty(q: AuditableQuestion, f: AuditFinding[]): void {
    if (!q.stem || q.stem.trim().length < 5) {
      f.push({ checkId: '01_stem_non_empty', severity: 'error',
        message: 'Stem is empty or shorter than 5 characters.' });
    }
  }

  /** 02 — when parts are present, the sum of part marks must equal totalMarks. */
  private check02_partsMarksSum(q: AuditableQuestion, f: AuditFinding[]): void {
    if (!q.parts || q.parts.length === 0) return;
    const sum = q.parts.reduce((s, p) => s + (p.marks || 0), 0);
    if (sum !== q.totalMarks) {
      f.push({ checkId: '02_parts_marks_sum', severity: 'error',
        message: `Parts sum to ${sum} marks but totalMarks=${q.totalMarks}.` });
    }
  }

  /** 03 — MCQ stems must include four lettered options. */
  private check03_mcqHasOptions(q: AuditableQuestion, f: AuditFinding[]): void {
    if (q.questionType !== 'mcq') return;
    const tags = ['(A)', '(B)', '(C)', '(D)'].filter((t) => q.stem.includes(t));
    if (tags.length < 4) {
      f.push({ checkId: '03_mcq_has_options', severity: 'error',
        message: `MCQ stem missing options — found ${tags.length}/4 of (A)–(D).` });
    }
  }

  /** 04 — every $...$ and $$...$$ math span must be paired. Unbalanced
   *  dollar signs leak KaTeX errors as raw <code> blocks in the PDF. */
  private check04_latexBalanced(q: AuditableQuestion, f: AuditFinding[]): void {
    const texts = [q.stem, ...(q.parts?.map((p) => p.text) ?? [])];
    for (const text of texts) {
      // Count $$ occurrences first; then count single $ outside $$ pairs.
      const dd = (text.match(/\$\$/g) ?? []).length;
      if (dd % 2 !== 0) {
        f.push({ checkId: '04_latex_balanced', severity: 'error',
          message: 'Unbalanced $$ ... $$ display-math delimiters.' });
        return;
      }
      const stripped = text.replace(/\$\$[\s\S]*?\$\$/g, '');
      const sd = (stripped.match(/(?<!\\)\$/g) ?? []).length;
      if (sd % 2 !== 0) {
        f.push({ checkId: '04_latex_balanced', severity: 'error',
          message: 'Unbalanced $ ... $ inline-math delimiters.' });
        return;
      }
    }
  }

  /** 05 — markdown tables must be GFM-shaped: header row + separator
   *  row + at least one body row. The PDF renderer's table regex
   *  silently fails open when the separator is missing, leaving the
   *  pipes and dashes as raw text in the PDF. */
  private check05_tableWellFormed(q: AuditableQuestion, f: AuditFinding[]): void {
    const texts = [q.stem, ...(q.parts?.map((p) => p.text) ?? [])];
    for (const text of texts) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim().startsWith('|')) continue;
        // We have a pipe row — look ahead for a separator.
        const next = lines[i + 1]?.trim() ?? '';
        if (!/^\|[\s\-:|]+\|$/.test(next)) {
          // Missing separator IS allowed iff this isn't actually a table
          // (e.g. a stray pipe in prose). Heuristic: if the row has at
          // least 3 pipe-separated cells AND the line after it also
          // starts with `|`, it's a table missing its separator.
          const cells = lines[i].split('|').filter((c) => c.trim() !== '');
          const nextRowIsPipe = (lines[i + 1] ?? '').trim().startsWith('|');
          if (cells.length >= 3 && nextRowIsPipe) {
            f.push({ checkId: '05_table_well_formed', severity: 'error',
              message: 'Markdown table is missing the GFM separator row (|---|---|).' });
            return;
          }
        }
        break; // Only inspect the first candidate table per text block.
      }
    }
  }

  /** 06 — when the stem contains "y = f(x)" + a table of x/y values, every
   *  tabulated y must match f(x) to within 1% (or 0.05 absolute, whichever
   *  is larger). This catches AI hallucinations like writing y=-0.5 when
   *  the formula y = 6/x + x − 5 evaluates to 0 at x=2. */
  private check06_tableFormulaConsistent(q: AuditableQuestion, f: AuditFinding[]): void {
    const pair = extractFormulaAndTable(q.stem);
    if (!pair) return;
    const mismatches: string[] = [];
    for (const row of pair.rows) {
      const expected = evaluateFormula(pair.formulaRhs, row.x);
      if (expected === null) return; // un-auditable formula — skip silently
      const tol = Math.max(0.05, Math.abs(expected) * 0.01);
      if (Math.abs(expected - row.y) > tol) {
        mismatches.push(
          `x=${row.x}: formula gives ${roundForDisplay(expected)} but table says ${roundForDisplay(row.y)}`,
        );
      }
    }
    if (mismatches.length > 0) {
      f.push({ checkId: '06_table_formula_consistent', severity: 'error',
        message: `Table values do not match y = ${pair.formulaRhs.trim()}: ${mismatches.join('; ')}.` });
    }
  }

  /** 07 — coordinate-plane diagrams attached to a "plot / draw / find"
   *  style question MUST tag the relevant elements with role="answer".
   *  An untagged points/lines/curves array on a question that says "plot
   *  the points" leaks the answer onto the student paper. */
  private check07_diagramAnswerLeakage(q: AuditableQuestion, f: AuditFinding[]): void {
    const d = q.diagram;
    if (!d?.needed || !d.spec) return;
    if (d.spec.kind !== 'coordinate_plane') return;
    const drawVerbs = /\b(plot|draw|sketch|find|determine|calculate|construct|join|complete)\b/i;
    const verbInStem = drawVerbs.test(q.stem) ||
      (q.parts ?? []).some((p) => drawVerbs.test(p.text));
    if (!verbInStem) return;
    const elements = [
      ...(d.spec.points ?? []),
      ...(d.spec.segments ?? []),
      ...(d.spec.lines ?? []),
      ...(d.spec.parabolas ?? []),
      ...(d.spec.sineCurves ?? []),
    ];
    if (elements.length === 0) return;
    const allTagged = elements.every((e: any) => e?.role === 'answer' || e?.role === 'given');
    const anyAnswer = elements.some((e: any) => e?.role === 'answer');
    if (!allTagged) {
      f.push({ checkId: '07_diagram_answer_leakage', severity: 'error',
        message: 'Question asks the student to plot/draw, but diagram elements have no role tag. ' +
          'Add role="answer" to overlays the student is meant to produce, role="given" to anything ' +
          'the question itself supplies.' });
      return;
    }
    if (!anyAnswer) {
      f.push({ checkId: '07_diagram_answer_leakage', severity: 'warning',
        message: 'Question asks the student to plot/draw, but every diagram element is role="given". ' +
          'Double-check that nothing is being pre-drawn that the student should produce themselves.' });
    }
  }

  /** 08 — coordinate diagram spec is non-empty when it claims to exist. */
  private check08_diagramSpecPopulated(q: AuditableQuestion, f: AuditFinding[]): void {
    const d = q.diagram;
    if (!d?.needed || !d.spec) return;
    if (d.spec.kind !== 'coordinate_plane') return;
    const counts =
      (d.spec.points?.length ?? 0) +
      (d.spec.segments?.length ?? 0) +
      (d.spec.lines?.length ?? 0) +
      (d.spec.parabolas?.length ?? 0) +
      (d.spec.sineCurves?.length ?? 0);
    if (counts === 0) {
      f.push({ checkId: '08_diagram_spec_populated', severity: 'warning',
        message: 'Coordinate-plane diagram has zero drawable elements (axes-only grid).' });
    }
  }

  /** 09 — stray single-token math artifacts on their own line, e.g. a
   *  bare "x2" or "$x^2$" left over from a malformed table or scratchpad
   *  edit. These render in the PDF as orphan tokens between the stem and
   *  the figure. */
  private check09_strayMathArtifacts(q: AuditableQuestion, f: AuditFinding[]): void {
    const lines = q.stem.split('\n').map((l) => l.trim());
    for (const line of lines) {
      if (line.length === 0 || line.length > 8) continue;
      // Patterns we treat as suspicious: bare x², x2, x^2, $x^2$ alone.
      if (/^[a-z]\d$/.test(line)) {
        f.push({ checkId: '09_stray_math_artifact', severity: 'warning',
          message: `Stray short token "${line}" on its own line in stem — likely a stripped superscript or broken table cell.` });
        return;
      }
      if (/^\$[a-z]\^?\d\$$/.test(line)) {
        f.push({ checkId: '09_stray_math_artifact', severity: 'warning',
          message: `Stray math span "${line}" on its own line in stem.` });
        return;
      }
    }
  }

  /** 10 — totalMarks must be within the school-sensible 1..50 range and
   *  match the AI's declared difficulty band loosely (essays should be
   *  worth more than recall MCQs). */
  private check10_marksRange(q: AuditableQuestion, f: AuditFinding[]): void {
    if (q.totalMarks < 1 || q.totalMarks > 50) {
      f.push({ checkId: '10_marks_range', severity: 'error',
        message: `totalMarks=${q.totalMarks} outside the allowed 1..50 range.` });
      return;
    }
    if (q.questionType === 'mcq' && q.totalMarks !== 1) {
      f.push({ checkId: '10_marks_range', severity: 'warning',
        message: `MCQ has totalMarks=${q.totalMarks}; CIE convention is 1 mark per MCQ.` });
    }
  }
}

function roundForDisplay(n: number): string {
  if (Math.abs(n) < 1e-6) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return (Math.round(n * 100) / 100).toString();
}
