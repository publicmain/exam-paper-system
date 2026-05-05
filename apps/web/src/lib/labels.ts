/**
 * Shared formatting helpers for entity labels that show up in dropdowns,
 * cards, and breadcrumbs. Pulled out into one place so we stop seeing the
 * same subject rendered three different ways across pages (fixes Bug #9).
 */

export interface SubjectLike {
  code?: string;
  name?: string;
  level?: string;
  examBoard?: { code?: string; name?: string };
}

/**
 * Canonical subject label. Used in dropdowns: AI Generate, Quality,
 * Questions, Quick Paper, Variants. Format:
 *   "{boardCode} {code} {name} ({level})"
 * with each segment dropped if absent. Examples:
 *   "CIE 9709 Mathematics (A_LEVEL)"
 *   "Edexcel 4MA1 Mathematics A (IGCSE)"
 *   "9709 Mathematics" (when board / level missing)
 */
export function formatSubjectLabel(s: SubjectLike): string {
  const parts: string[] = [];
  const boardCode = s.examBoard?.code;
  if (boardCode) parts.push(boardCode);
  if (s.code) parts.push(s.code);
  if (s.name) parts.push(s.name);
  const tail = s.level ? ` (${s.level})` : '';
  return parts.join(' ') + tail;
}

/**
 * Component label, dedup-safe: if the component name already starts with the
 * code (e.g. code='AS', name='AS Computer Science'), we don't double-print
 * the code. Fixes Bug #11.
 */
export function formatComponentLabel(c: { code?: string; name?: string }): string {
  if (!c.name) return c.code ?? '';
  if (!c.code) return c.name;
  if (c.code === c.name) return c.name;
  if (c.name.startsWith(c.code + ' ')) return c.name;
  return `${c.code} ${c.name}`;
}

/**
 * Render a list of label parts joined by middle dot, dropping any
 * null/undefined/empty entries so we don't get " ·  · " (Bug #4).
 *
 *   joinDot(['Math', undefined, '60min']) === 'Math · 60min'
 */
export function joinDot(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(' · ');
}
