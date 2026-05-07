/**
 * Filename parser for Cambridge International Examinations (CIE) and a
 * permissive fallback for other formats.
 *
 * Canonical CIE pattern:
 *   9702_s19_qp_22.pdf
 *   <syllabus>_<season><yy>_<kind>_<variant>.pdf
 *     season:  m=Feb/Mar, s=May/Jun, w=Oct/Nov
 *     kind:    qp=question paper, ms=mark scheme, er=examiner report,
 *              in=insert, gt=grade thresholds, sf=specimen, pre=pre-release
 *     variant: 22 = paper 2, variant 2
 *
 * Anything we can't parse is returned with the raw filename only so the
 * record still ingests; reviewers can fix metadata later.
 */

import { FileKind } from '@prisma/client';

export interface ParsedFilename {
  syllabusCode?: string;
  examYear?: number;
  examSeason?: string; // 'm' | 's' | 'w'
  paperVariant?: string;
  paperNumber?: string;
  fileKind: FileKind;
  raw: string;
  matched: boolean;
}

const SEASON_MAP: Record<string, string> = { m: 'm', s: 's', w: 'w' };

const KIND_MAP: Record<string, FileKind> = {
  qp: FileKind.question_paper,
  ms: FileKind.mark_scheme,
  er: FileKind.examiner_report,
  in: FileKind.insert,
  sf: FileKind.syllabus_doc,
  gt: FileKind.other,
  pre: FileKind.other,
};

const CIE_RE = /^(\d{4})_([msw])(\d{2})_(qp|ms|er|in|gt|sf|pre)(?:_?(\d{1,2}))?\.pdf$/i;

/**
 * Permissive IELTS filename matcher. Cambridge IELTS books 1–19 ship as
 * "Cambridge IELTS N — Test M — <Section>". Pirated mirrors on GitHub use
 * many naming variants; this regex captures the common ones:
 *
 *   cambridge_ielts_18_test_2_reading.pdf
 *   ielts18_t2_reading.pdf
 *   Cambridge IELTS 18 - Test 2 Reading.pdf  (whitespace + dashes)
 *   ielts_18_2_reading_passages.pdf
 *
 * We extract: book (1-19), test (1-4), section (reading/listening/writing).
 * The morning-quiz pipeline currently only ingests reading + listening
 * sections; writing is out of scope (essay → manual marking).
 */
// Note on the missing trailing \b: `_` is a word character in JavaScript
// regex, so \b right after "reading" in "..._reading_answer_key.pdf" would
// fail (g→_ is word→word, no boundary). We anchor the optional section
// match implicitly via the longest greedy match instead.
const IELTS_RE =
  /(?:^|[^a-z])(?:cambridge[_\- ]?)?ielts[_\- ]?(\d{1,2})(?:[_\- ]?(?:test|t)?[_\- ]?(\d))?(?:[_\- ]?(reading|listening|writing|speaking))?/i;

export function parseFilename(name: string): ParsedFilename {
  const lower = name.toLowerCase();
  const m = CIE_RE.exec(lower);
  if (m) {
    const yy = parseInt(m[3], 10);
    const yearFull = yy >= 70 ? 1900 + yy : 2000 + yy;
    const kind = KIND_MAP[m[4]] ?? FileKind.other;
    return {
      syllabusCode: m[1],
      examYear: yearFull,
      examSeason: SEASON_MAP[m[2]] ?? m[2],
      paperVariant: m[5] ?? undefined,
      paperNumber: m[4],
      fileKind: kind,
      raw: name,
      matched: true,
    };
  }

  // IELTS path — recognise Cambridge IELTS books before falling back to
  // generic kind sniffing. Reading + listening become question papers; the
  // book number maps to paperVariant for downstream "Cambridge IELTS 18,
  // Test 2" lookups.
  const ie = IELTS_RE.exec(lower);
  if (ie) {
    const book = parseInt(ie[1], 10);
    const test = ie[2] ? parseInt(ie[2], 10) : undefined;
    const section = ie[3] as 'reading' | 'listening' | 'writing' | 'speaking' | undefined;
    const isMs = /[_\- ](?:ms|answer[_\- ]?key|key)\b/.test(lower);
    let ieKind: FileKind = FileKind.question_paper;
    if (isMs) ieKind = FileKind.mark_scheme;
    else if (section === 'speaking' || section === 'writing') ieKind = FileKind.other;
    return {
      syllabusCode: 'IELTS',
      examYear: undefined,
      examSeason: undefined,
      paperVariant: test !== undefined ? `${book}.${test}` : `${book}`,
      paperNumber: section ?? 'unknown',
      fileKind: ieKind,
      raw: name,
      matched: true,
    };
  }

  // Fallback: try to at least guess the file kind from the lowercase name.
  let kind: FileKind = FileKind.other;
  if (/(?:^|[^a-z])qp(?:[^a-z]|$)|question[_\- ]paper/i.test(lower)) kind = FileKind.question_paper;
  else if (/(?:^|[^a-z])ms(?:[^a-z]|$)|mark[_\- ]scheme/i.test(lower)) kind = FileKind.mark_scheme;
  else if (/examiner|report|er[._]/i.test(lower)) kind = FileKind.examiner_report;
  else if (/insert|in[._]/i.test(lower)) kind = FileKind.insert;
  else if (/syllabus|specification/i.test(lower)) kind = FileKind.syllabus_doc;

  return { fileKind: kind, raw: name, matched: false };
}
