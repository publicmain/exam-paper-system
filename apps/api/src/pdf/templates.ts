// HTML templates for PDF rendering. KaTeX is server-side rendered into static
// HTML+CSS so no JS is required at PDF time. Cover page comes first with a
// page break, then the question pages.
import katex from 'katex';
import * as fs from 'node:fs';
import * as path from 'node:path';

const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';

// School logo as a data URI baked at build time. Sourced from the school's
// internal cover-page builder (committed to apps/api/src/pdf/school-logo.b64.txt).
let SCHOOL_LOGO_DATA_URI: string | null = null;
function getSchoolLogo(): string {
  if (SCHOOL_LOGO_DATA_URI !== null) return SCHOOL_LOGO_DATA_URI;
  try {
    SCHOOL_LOGO_DATA_URI = fs.readFileSync(path.join(__dirname, 'school-logo.b64.txt'), 'utf-8').trim();
  } catch {
    SCHOOL_LOGO_DATA_URI = '';
  }
  return SCHOOL_LOGO_DATA_URI;
}

// Slot placeholder uses U+E000 (Private Use Area) so the marker can never
// collide with legitimate question content like "K0 = 100".
const SLOT_MARK = '';

/**
 * Render a string mixing markdown-ish text with $..$ inline math, $$..$$ display
 * math, **bold**, *italic*, and GFM tables. XSS-safe: user text is HTML-escaped;
 * only KaTeX-rendered HTML and our own derived markup live in trusted slots.
 */
function renderInline(text: string): string {
  if (!text) return '';
  const slots: string[] = [];
  const placeholder = (i: number) => `${SLOT_MARK}K${i}${SLOT_MARK}`;
  const pushSlot = (html: string) => {
    slots.push(html);
    return placeholder(slots.length - 1);
  };

  // 1. Display math
  let working = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: true, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escapeHtml(expr)}</code>`; }
    return pushSlot(html);
  });

  // 2. Inline math
  working = working.replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: false, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escapeHtml(expr)}</code>`; }
    return pushSlot(html);
  });

  // 3. Bold **text**
  working = working.replace(/\*\*([^*\n]+?)\*\*/g, (_m, body) =>
    pushSlot(`<strong>${escapeHtml(body)}</strong>`));

  // 4. Italic *text*
  working = working.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_m, body) =>
    pushSlot(`<em>${escapeHtml(body)}</em>`));

  // 5. GFM tables
  const tableRe = /(?:^|\n)(\|[^\n]+\|)\n\|[\s\-:|]+\|\n((?:\|[^\n]+\|(?:\n|$))+)/g;
  working = working.replace(tableRe, (_m, headerLine: string, bodySection: string) => {
    const parseCells = (line: string) =>
      line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const headerCells = parseCells(headerLine);
    const bodyRows = bodySection.trim().split('\n').map(parseCells);
    if (headerCells.length === 0 || bodyRows.length === 0) return _m;
    const cell = (c: string) =>
      escapeHtml(c).replace(new RegExp(`${SLOT_MARK}K(\\d+)${SLOT_MARK}`, 'g'),
        (m, i) => slots[Number(i)] ?? m);
    let html = '<table class="md-table">';
    html += '<thead><tr>' + headerCells.map(c => `<th>${cell(c)}</th>`).join('') + '</tr></thead>';
    html += '<tbody>';
    for (const row of bodyRows) {
      html += '<tr>' + row.map(c => `<td>${cell(c)}</td>`).join('') + '</tr>';
    }
    html += '</tbody></table>';
    return '\n' + pushSlot(html);
  });

  // 6. Escape remaining + br
  let escaped = escapeHtml(working).replace(/\n/g, '<br/>');

  // 7. Restore slots
  for (let i = 0; i < slots.length; i++) {
    escaped = escaped.replace(placeholder(i), slots[i]);
  }
  return escaped;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

interface PaperData {
  schoolName?: string;
  paperName: string;
  subjectName: string;
  examBoardName: string;
  componentName?: string;
  classLabel?: string;
  examDate?: string;
  durationMin: number;
  totalMarks: number;
  questions: Array<{
    sortOrder: number;
    questionType: string;
    marks: number;
    content: { stem: string; parts?: { label: string; content: string; marks: number; answer?: string }[] };
    options?: { key: string; text: string; correct: boolean }[];
    answer?: { text?: string };
    assets?: { dataUri: string; alt: string }[];
  }>;
}

const baseStyles = `
  <link rel="stylesheet" href="${KATEX_CSS_URL}">
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; line-height: 1.5; color: #111; }

    /* ---------- Cover page (first sheet) ---------- */
    .cover {
      width: 100%;
      min-height: 261mm;
      box-sizing: border-box;
      page-break-after: always;
      font-family: Cambria, Georgia, "Times New Roman", "Songti SC", serif;
      color: #000;
      display: flex;
      flex-direction: column;
    }
    .cover .logo { display: block; margin: 0 auto 5mm; width: 60mm; height: auto; }
    .cover .course-line  { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 3mm; line-height: 1.25; }
    .cover .subject-line { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 2.5mm; }
    .cover .paper-line   { text-align: center; font-size: 15pt; font-weight: bold; margin: 0 0 6mm; letter-spacing: 0.04em; }
    .cover .exam-name    { text-align: center; font-size: 19pt; font-weight: bold; margin: 0 0 7mm; line-height: 1.25; }
    .cover .instructions { font-size: 14pt; line-height: 1.4; }
    .cover .instructions p { margin: 0 0 3mm; }
    .cover .class-line   { font-family: Arial, Helvetica, "Microsoft YaHei", sans-serif; font-size: 14pt; font-weight: bold; margin: 6mm 0 4mm; }
    .cover .student-name { font-size: 14pt; margin: 0 0 5mm; }
    .cover .filler { flex: 1; }
    .cover .marker-table {
      margin-left: auto; margin-top: 12mm; border-collapse: collapse;
      font-family: Arial, Helvetica, "Microsoft YaHei", sans-serif; font-size: 11pt;
    }
    .cover .marker-table td {
      border: 1px solid #000; width: 16mm; height: 13mm;
      text-align: center; vertical-align: middle; font-weight: bold;
    }
    .cover .marker-table td.empty { font-weight: normal; background: white; }

    /* ---------- Question pages ---------- */
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
    .school { font-size: 14pt; font-weight: bold; letter-spacing: 0.05em; }
    .paper-name { font-size: 16pt; font-weight: bold; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-top: 8px; }
    .student-info { display: flex; gap: 16px; margin-top: 12px; font-size: 10pt; }
    .student-info > div { flex: 1; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .instructions { background: #f8f8f8; border-left: 3px solid #888; padding: 8px 12px; font-size: 10pt; margin: 12px 0 18px; }
    /* Question spacing — bumped up so questions don't run into each other.
       Per-question card gets a clear bottom margin and a thin top divider. */
    .question { margin-bottom: 28px; padding-top: 12px; border-top: 1px solid #e2e2e2; page-break-inside: avoid; }
    .question:first-of-type { border-top: none; padding-top: 0; }
    .q-head { font-weight: bold; }
    .q-marks { float: right; }
    .q-stem { margin: 8px 0; }
    .q-options { list-style: upper-alpha; margin: 6px 0 6px 28px; }
    .q-options li { margin-bottom: 3px; }
    .q-parts { margin-left: 18px; margin-top: 10px; }
    /* Sub-part spacing — was 8px which compressed multi-part questions. */
    .q-part { margin-bottom: 16px; }
    .q-part-label { font-weight: bold; }
    .answer-space { border-bottom: 1px dotted #888; height: 1.2em; margin: 6px 0; }
    .answer-block { background: #fafafa; border: 1px solid #ddd; padding: 8px 10px; margin-top: 6px; }
    .q-assets { margin: 8px 0; text-align: center; }
    .q-assets img { display: block; margin: 6px auto; max-width: 75%; max-height: 280px; page-break-inside: avoid; }
    .answer-label { font-weight: bold; color: #555; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { position: running(footer); font-size: 9pt; color: #666; text-align: center; }
    code { background: #fdd; padding: 0 3px; }
    .copyright { font-size: 8.5pt; color: #888; text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; }

    /* ---------- Markdown tables (used inside stems / parts) ---------- */
    .md-table {
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10.5pt;
    }
    .md-table th, .md-table td {
      border: 1px solid #555;
      padding: 4px 10px;
      text-align: left;
      vertical-align: middle;
    }
    .md-table th { background: #f0f0f0; font-weight: bold; }
    .md-table tr:nth-child(even) td { background: #fafafa; }
  </style>
`;

/**
 * Render the school cover page. Pulls Paper metadata into the official
 * internal cover layout (course / subject / paper / exam name / instructions /
 * class / student name / marker table). Logo is the school crest committed
 * with the api source.
 */
function renderCoverPage(data: PaperData): string {
  const logo = getSchoolLogo();
  const logoHtml = logo ? `<img class="logo" src="${logo}" alt="School logo" />` : '';
  // Course = exam board + level family. We synthesise it from the available
  // PaperData fields. Subject is the syllabus subject name.
  const courseLine = data.examBoardName + ' International Examinations';
  const paperLine = data.componentName ? `Paper · ${data.componentName}` : 'Internal Mock Paper';
  // Exam name like "Internal Mock Exam — 2026" (no fine-grained month yet).
  const year = (data.examDate || new Date().toISOString().slice(0, 10)).slice(0, 4);
  const examName = `Internal Mock Exam — ${year}`;
  const classLabel = data.classLabel
    ? `Class: ${escapeHtml(data.classLabel)}`
    : 'Class: ____________________';

  return `<section class="cover">
    ${logoHtml}
    <h2 class="course-line">${escapeHtml(courseLine)}</h2>
    <h2 class="subject-line">${escapeHtml(data.subjectName)}</h2>
    <h2 class="paper-line">${escapeHtml(paperLine)}</h2>
    <h2 class="exam-name">${escapeHtml(examName)}</h2>
    <div class="instructions">
      <p>Instructions:</p>
      <p>1. You may circle the correct answer or write your answer on the question paper provided.</p>
      <p>2. Calculator is allowed.</p>
      <p>3. The total marks are <strong>${data.totalMarks}</strong>; time allowed: <strong>${data.durationMin} minutes</strong>.</p>
    </div>
    <div class="class-line">${classLabel}</div>
    <div class="student-name">Student Name: ____________________</div>
    <div class="filler"></div>
    <table class="marker-table">
      <tr>
        <td colspan="2">Marker</td>
        <td colspan="2">Moderator</td>
      </tr>
      <tr>
        <td>Marks</td><td class="empty"></td>
        <td>Marks</td><td class="empty"></td>
      </tr>
      <tr>
        <td>Grade</td><td class="empty"></td>
        <td>Grade</td><td class="empty"></td>
      </tr>
    </table>
  </section>`;
}

export function renderPaperHtml(data: PaperData, isAnswerKey: boolean): string {
  const title = isAnswerKey ? `${data.paperName} — Answer Key` : data.paperName;

  const headerInstructions = isAnswerKey
    ? '<div class="instructions"><strong>FOR TEACHER USE — Answer Key.</strong> Do not distribute to students.</div>'
    : `<div class="instructions">
        <strong>Instructions:</strong> Answer all questions. Show working clearly.
        Time allowed: <strong>${data.durationMin} minutes</strong>.
        Total marks: <strong>${data.totalMarks}</strong>.
      </div>`;

  const studentInfo = isAnswerKey ? '' : `
    <div class="student-info">
      <div>Name: </div>
      <div>Class: ${escapeHtml(data.classLabel || '')}</div>
      <div>Date: ${escapeHtml(data.examDate || '')}</div>
    </div>`;

  const questionsHtml = data.questions.map((q, i) => {
    const num = i + 1;
    const stem = renderInline(q.content?.stem || '');

    let optionsHtml = '';
    if (q.options && q.options.length > 0) {
      optionsHtml = `<ol class="q-options" type="A">${
        q.options.map(o => {
          const marker = isAnswerKey && o.correct ? ' ✓' : '';
          return `<li>${renderInline(o.text)}${marker}</li>`;
        }).join('')
      }</ol>`;
    }

    let partsHtml = '';
    if (q.content?.parts && q.content.parts.length > 0) {
      partsHtml = `<div class="q-parts">${
        q.content.parts.map(p => {
          const partAnswer = isAnswerKey && p.answer
            ? `<div class="answer-block"><span class="answer-label">Answer:</span> ${renderInline(p.answer)}</div>`
            : (isAnswerKey ? '' : `<div class="answer-space"></div><div class="answer-space"></div>`);
          return `<div class="q-part">
            <span class="q-part-label">(${escapeHtml(p.label)})</span> ${renderInline(p.content)}
            <span class="q-marks">[${p.marks}]</span>
            ${partAnswer}
          </div>`;
        }).join('')
      }</div>`;
    } else if (!q.options) {
      // structured/short answer with no parts: provide answer space or final answer
      if (isAnswerKey) {
        const ans = q.answer?.text;
        partsHtml = ans
          ? `<div class="answer-block"><span class="answer-label">Answer:</span> ${renderInline(ans)}</div>`
          : '';
      } else {
        partsHtml = '<div class="answer-space"></div><div class="answer-space"></div><div class="answer-space"></div>';
      }
    }

    const assetsHtml = (q.assets && q.assets.length > 0)
      ? `<div class="q-assets">${
          q.assets.map(a => `<img src="${a.dataUri}" alt="${escapeHtml(a.alt)}" />`).join('')
        }</div>`
      : '';

    return `<div class="question">
      <div class="q-head">
        <span>Q${num}.</span>
        <span class="q-marks">[${q.marks}]</span>
      </div>
      <div class="q-stem">${stem}</div>
      ${assetsHtml}
      ${optionsHtml}
      ${partsHtml}
    </div>`;
  }).join('');

  // Skip cover for answer-key PDFs (teachers don't need it; one page wastes paper).
  const coverHtml = isAnswerKey ? '' : renderCoverPage(data);

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    ${baseStyles}
  </head><body>
    ${coverHtml}
    <div class="header">
      ${data.schoolName ? `<div class="school">${escapeHtml(data.schoolName)}</div>` : ''}
      <div class="paper-name">${escapeHtml(title)}</div>
      <div class="meta">
        <span>${escapeHtml(data.examBoardName)} · ${escapeHtml(data.subjectName)}${data.componentName ? ' · ' + escapeHtml(data.componentName) : ''}</span>
        <span>Duration: ${data.durationMin} min · Total marks: ${data.totalMarks}</span>
      </div>
      ${studentInfo}
    </div>
    ${headerInstructions}
    ${questionsHtml}
  </body></html>`;
}
