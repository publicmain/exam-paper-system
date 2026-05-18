/**
 * Tiny safe-ish evaluator for single-variable math expressions emitted by
 * the AI in a `y = f(x)` stem. Used by the table-formula audit check to
 * verify that the AI's tabulated y values actually match the formula it
 * wrote. Scope is deliberately small:
 *
 *   - One free variable named `x`.
 *   - Operators: + - * / ^ and unary minus.
 *   - Functions: sqrt sin cos tan ln log exp abs (case-insensitive).
 *   - Constants: pi, e.
 *   - LaTeX shorthand normalised first: \frac{a}{b} → (a)/(b),
 *     \sqrt{a} → sqrt(a), \cdot → *, \pi → pi, x^{n} → x^(n).
 *
 * Anything else (function/operator we don't recognise, embedded variable
 * other than x, mismatched braces) returns null so the caller treats the
 * expression as un-auditable rather than incorrectly flagging it. False
 * positives on a syllabus-level "is this table right?" check would be
 * worse than false negatives — we silently skip the check when in doubt.
 *
 * We do NOT use Function() / eval here; we walk a tiny recursive-descent
 * parser over a whitelisted token stream so an exotic stem expression
 * can't reach unexpected globals.
 */

type Token =
  | { kind: 'num'; v: number }
  | { kind: 'id'; v: string }
  | { kind: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { kind: 'lp' } | { kind: 'rp' }
  | { kind: 'comma' };

/** Convert LaTeX-ish source into the small algebraic dialect the parser
 *  understands. Returns null if the source contains LaTeX commands we
 *  haven't whitelisted. */
function normaliseLatex(raw: string): string | null {
  let s = raw.trim();
  // Strip outer math delimiters if present.
  s = s.replace(/^\$+|\$+$/g, '').trim();
  // Reject unbalanced braces — easier than recovering.
  let depth = 0;
  for (const c of s) {
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;
  // \frac{a}{b}  →  (a)/(b)
  for (let i = 0; i < 8 && /\\frac\s*\{/.test(s); i++) {
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1))/(($2))');
  }
  // \sqrt{a}  →  sqrt(a)
  for (let i = 0; i < 8 && /\\sqrt\s*\{/.test(s); i++) {
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt(($1))');
  }
  // \cdot, \times → *
  s = s.replace(/\\cdot\b|\\times\b/g, '*');
  // \pi, \mathrm{e}, \exp
  s = s.replace(/\\pi\b/g, 'pi');
  // x^{n}  →  x^(n)   and   x^n   stays
  for (let i = 0; i < 8 && /\^\s*\{/.test(s); i++) {
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
  }
  // Reject any remaining backslash commands — we don't know what they do.
  if (/\\[a-zA-Z]/.test(s)) return null;
  // Unicode niceties: minus signs, multiplication dot
  s = s.replace(/[−–]/g, '-').replace(/×|·/g, '*');
  // Unicode superscript digits (² ³ ⁴ ...) — rewrite as ^N
  const supMap: Record<string, string> = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
    '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  };
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => '^(' + [...m].map(c => supMap[c] ?? '').join('') + ')');
  // Implicit multiplication: AI / textbook notation writes "6x", "3sin(x)",
  // "2(x+1)" without explicit `*`. Insert one between a digit and an
  // identifier-or-open-paren when there's no operator between them.
  // Avoid breaking scientific notation: `1e6` and `2E-3` must NOT become
  // `1*e6`, so we exclude e/E when followed by a sign or digit.
  s = s.replace(/(\d)\s*(?=[a-df-zA-DF-Z(])/g, '$1*');
  s = s.replace(/(\d)\s*([eE])(?![+\-\d])/g, '$1*$2');
  return s;
}

function tokenise(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(') { out.push({ kind: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ kind: 'rp' }); i++; continue; }
    if (c === ',') { out.push({ kind: 'comma' }); i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '^') {
      out.push({ kind: 'op', v: c });
      i++; continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const n = Number(src.slice(i, j));
      if (!Number.isFinite(n)) return null;
      out.push({ kind: 'num', v: n });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ kind: 'id', v: src.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    return null; // unknown character
  }
  return out;
}

interface ParserState { toks: Token[]; pos: number }

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
const RIGHT_ASSOC = new Set(['^']);

function peek(s: ParserState): Token | undefined { return s.toks[s.pos]; }
function next(s: ParserState): Token | undefined { return s.toks[s.pos++]; }

function parseExpr(s: ParserState, minPrec: number, x: number): number | null {
  let lhs = parseAtom(s, x);
  if (lhs === null) return null;
  while (true) {
    const t = peek(s);
    if (!t || t.kind !== 'op') break;
    const prec = PRECEDENCE[t.v];
    if (prec < minPrec) break;
    next(s);
    const nextMin = RIGHT_ASSOC.has(t.v) ? prec : prec + 1;
    const rhs = parseExpr(s, nextMin, x);
    if (rhs === null) return null;
    switch (t.v) {
      case '+': lhs = lhs + rhs; break;
      case '-': lhs = lhs - rhs; break;
      case '*': lhs = lhs * rhs; break;
      case '/': lhs = lhs / rhs; break;
      case '^': lhs = Math.pow(lhs, rhs); break;
    }
  }
  return lhs;
}

function parseAtom(s: ParserState, x: number): number | null {
  const t = next(s);
  if (!t) return null;
  if (t.kind === 'op' && (t.v === '+' || t.v === '-')) {
    const v = parseAtom(s, x);
    if (v === null) return null;
    return t.v === '-' ? -v : v;
  }
  if (t.kind === 'num') return t.v;
  if (t.kind === 'lp') {
    const v = parseExpr(s, 0, x);
    if (v === null) return null;
    const close = next(s);
    if (!close || close.kind !== 'rp') return null;
    return v;
  }
  if (t.kind === 'id') {
    // Function call vs constant vs variable
    if (peek(s)?.kind === 'lp') {
      next(s); // consume '('
      const arg = parseExpr(s, 0, x);
      if (arg === null) return null;
      const close = next(s);
      if (!close || close.kind !== 'rp') return null;
      switch (t.v) {
        case 'sqrt': return Math.sqrt(arg);
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'ln': return Math.log(arg);
        case 'log': return Math.log10(arg);
        case 'exp': return Math.exp(arg);
        case 'abs': return Math.abs(arg);
        default: return null;
      }
    }
    if (t.v === 'x') return x;
    if (t.v === 'pi') return Math.PI;
    if (t.v === 'e') return Math.E;
    return null;
  }
  return null;
}

/** Evaluate `expr` (a y = f(x) right-hand side, possibly in LaTeX) at the
 *  given x value. Returns null if the expression contains anything outside
 *  the whitelisted dialect or evaluation produces NaN / Infinity. */
export function evaluateFormula(expr: string, x: number): number | null {
  const norm = normaliseLatex(expr);
  if (norm === null) return null;
  const toks = tokenise(norm);
  if (!toks || toks.length === 0) return null;
  const state: ParserState = { toks, pos: 0 };
  const v = parseExpr(state, 0, x);
  if (v === null) return null;
  if (state.pos !== toks.length) return null; // trailing garbage
  if (!Number.isFinite(v)) return null;
  return v;
}

/**
 * Look for a `y = ...` formula in the stem and a markdown / LaTeX table
 * pairing x values with y values. Returns the formula RHS and the
 * table rows so callers can audit them. Returns null when the stem
 * does not match the simple pattern — auditing is opt-in.
 *
 * Recognised table shapes (whitespace tolerant):
 *
 *   | x | 1 | 2 | 3 |
 *   | y | 2 | 0 | -1 |
 *
 * with or without the GFM separator row, and case-insensitive on the
 * x / y headers. The variable in the formula must literally be x.
 */
export interface FormulaTablePair {
  formulaRhs: string;
  rows: Array<{ x: number; y: number }>;
}

export function extractFormulaAndTable(stem: string): FormulaTablePair | null {
  if (!stem) return null;
  // Find "y = <expr>" inside or outside $...$. RHS terminates at the next
  // sentence boundary, newline, or closing math delimiter.
  const fm = stem.match(/y\s*=\s*([^.\n$]+?)(?=[.\n$]|\s+for\s|\s+when\s|$)/i);
  if (!fm) return null;
  const formulaRhs = fm[1].trim();
  if (!formulaRhs) return null;

  // Try to find a two-row table. We tolerate missing separator rows;
  // header cells named x and y can appear on any two lines of the stem,
  // not necessarily adjacent.
  const lines = stem.split('\n');
  let xRow: number[] | null = null;
  let yRow: number[] | null = null;
  for (let i = 0; i < lines.length && (!xRow || !yRow); i++) {
    const cells = splitCells(lines[i]);
    if (!cells || cells.length < 3) continue;
    const head = cells[0].toLowerCase().replace(/[*$_\\]/g, '').trim();
    if (head !== 'x' && head !== 'y') continue;
    const nums = cells.slice(1).map((c) => parseNumberCell(c));
    if (nums.some((n) => n === null)) continue;
    if (head === 'x') xRow = nums as number[];
    if (head === 'y') yRow = nums as number[];
  }
  if (!xRow || !yRow || xRow.length !== yRow.length) return null;
  const rows = xRow.map((x, i) => ({ x, y: (yRow as number[])[i] }));
  return { formulaRhs, rows };
}

function splitCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  // Strip leading/trailing pipes, then split.
  return trimmed.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function parseNumberCell(c: string): number | null {
  // Tolerate Unicode minus and stripped formatting marks.
  const cleaned = c
    .replace(/[*$_\\]/g, '')
    .replace(/[−–]/g, '-')
    .trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
