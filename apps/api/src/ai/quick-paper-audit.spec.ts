import { describe, it, expect } from 'vitest';
import { QuickPaperAuditService, type AuditableQuestion } from './quick-paper-audit.service';
import { evaluateFormula, extractFormulaAndTable } from './formula-eval';

/**
 * Sanity tests for the R15-followup-15 audit pipeline. These reproduce
 * the exact failure mode from the Functions-and-graphs Quick Paper
 * shipped 2026-05-18: AI emitted a table for y = 6/x + x - 5 with the
 * values [2, -0.5, -1, -0.5, 1, 1] for x = 1..6, which are wrong
 * (correct values are [2, 0, 0, 0.5, 1.2, 2]).
 */

describe('evaluateFormula — single-variable arithmetic', () => {
  it('evaluates Q3 formula y = 6/x + x - 5 correctly at integer x', () => {
    expect(evaluateFormula('6/x + x - 5', 1)).toBe(2);
    expect(evaluateFormula('6/x + x - 5', 2)).toBe(0);
    expect(evaluateFormula('6/x + x - 5', 3)).toBe(0);
    expect(evaluateFormula('6/x + x - 5', 6)).toBe(2);
  });

  it('evaluates Q5 cubic y = x^3 - 6x + 2', () => {
    expect(evaluateFormula('x^3 - 6x + 2', 0)).toBe(2);
    // The dialect requires explicit multiplication (we don't infer "6x"
    // as "6*x"); test the spelled-out form too.
    expect(evaluateFormula('x^3 - 6*x + 2', 1)).toBe(-3);
    expect(evaluateFormula('x^3 - 6*x + 2', 3)).toBe(11);
  });

  it('normalises LaTeX \\frac{a}{b}', () => {
    expect(evaluateFormula('\\frac{6}{x} + x - 5', 2)).toBe(0);
  });

  it('returns null on un-auditable expressions (unknown function)', () => {
    expect(evaluateFormula('foobar(x)', 1)).toBeNull();
  });
});

describe('extractFormulaAndTable', () => {
  it('parses Q3 stem (markdown table without separator row)', () => {
    const stem = [
      'The table below gives values of x and corresponding values of y = 6/x + x - 5 for x > 0.',
      '',
      '| x | 1 | 2 | 3 | 4 | 5 | 6 |',
      '| y | 2 | -0.5 | -1 | -0.5 | 1 | 1 |',
    ].join('\n');
    const pair = extractFormulaAndTable(stem);
    expect(pair).not.toBeNull();
    expect(pair!.formulaRhs).toBe('6/x + x - 5');
    expect(pair!.rows).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: -0.5 },
      { x: 3, y: -1 },
      { x: 4, y: -0.5 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
    ]);
  });
});

describe('QuickPaperAuditService — check 06 (table vs formula)', () => {
  const audit = new QuickPaperAuditService();

  it('flags the exact Q3 hallucinated-table bug from 2026-05-18 PDF', () => {
    const q: AuditableQuestion = {
      ref: 'Q3',
      questionType: 'structured',
      totalMarks: 8,
      stem: [
        'The table below gives values of x and corresponding values of y = 6/x + x - 5 for x > 0.',
        '',
        '| x | 1 | 2 | 3 | 4 | 5 | 6 |',
        '| y | 2 | -0.5 | -1 | -0.5 | 1 | 1 |',
      ].join('\n'),
      parts: [
        { label: 'a', text: 'Plot the points given in the table and draw a smooth curve through them.', marks: 3 },
      ],
    };
    const rep = audit.audit(q);
    const tableCheck = rep.findings.find((f) => f.checkId === '06_table_formula_consistent');
    expect(tableCheck).toBeDefined();
    expect(tableCheck!.severity).toBe('error');
    expect(tableCheck!.message).toContain('x=2');
  });

  it('passes a correctly-tabulated formula', () => {
    const q: AuditableQuestion = {
      ref: 'Q3',
      questionType: 'structured',
      totalMarks: 8,
      stem: [
        'The table below gives values of x and corresponding values of y = 6/x + x - 5 for x > 0.',
        '',
        '| x | 1 | 2 | 3 | 6 |',
        '| y | 2 | 0 | 0 | 2 |',
      ].join('\n'),
      parts: [{ label: 'a', text: 'Plot the points.', marks: 3 }],
    };
    const rep = audit.audit(q);
    const tableCheck = rep.findings.find((f) => f.checkId === '06_table_formula_consistent');
    expect(tableCheck).toBeUndefined();
  });
});

describe('QuickPaperAuditService — check 07 (diagram answer leakage)', () => {
  const audit = new QuickPaperAuditService();

  it('flags Q3-style untagged points on a "plot the points" question', () => {
    const q: AuditableQuestion = {
      ref: 'Q3',
      questionType: 'structured',
      totalMarks: 8,
      stem: 'The table below gives values of x and corresponding values of y = 6/x + x - 5.',
      parts: [
        { label: 'a', text: 'Plot the points given in the table.', marks: 3 },
      ],
      diagram: {
        needed: true,
        type: 'graph',
        spec: {
          kind: 'coordinate_plane',
          xRange: [0, 7],
          yRange: [-2, 4],
          // No role tags — the bug we just fixed.
          points: [{ x: 1, y: 2 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        },
      },
    };
    const rep = audit.audit(q);
    const leak = rep.findings.find((f) => f.checkId === '07_diagram_answer_leakage');
    expect(leak).toBeDefined();
    expect(leak!.severity).toBe('error');
  });

  it('passes when overlays are correctly tagged role="answer"', () => {
    const q: AuditableQuestion = {
      ref: 'Q3',
      questionType: 'structured',
      totalMarks: 8,
      stem: 'The table below gives values of x and corresponding values of y = 6/x + x - 5.',
      parts: [
        { label: 'a', text: 'Plot the points given in the table.', marks: 3 },
      ],
      diagram: {
        needed: true,
        type: 'graph',
        spec: {
          kind: 'coordinate_plane',
          xRange: [0, 7],
          yRange: [-2, 4],
          points: [
            { x: 1, y: 2, role: 'answer' },
            { x: 2, y: 0, role: 'answer' },
          ],
        },
      },
    };
    const rep = audit.audit(q);
    const leak = rep.findings.find((f) => f.checkId === '07_diagram_answer_leakage');
    expect(leak).toBeUndefined();
  });
});

describe('QuickPaperAuditService — check 02 (parts marks sum)', () => {
  const audit = new QuickPaperAuditService();

  it('flags mismatched part-mark sum', () => {
    const q: AuditableQuestion = {
      ref: 'Q1',
      questionType: 'structured',
      totalMarks: 10,
      stem: 'Stem.',
      parts: [
        { label: 'a', text: 'p', marks: 3 },
        { label: 'b', text: 'p', marks: 3 }, // sums to 6, not 10
      ],
    };
    const rep = audit.audit(q);
    const f = rep.findings.find((x) => x.checkId === '02_parts_marks_sum');
    expect(f?.severity).toBe('error');
  });
});
