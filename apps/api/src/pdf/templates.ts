// HTML templates for PDF rendering. KaTeX is server-side rendered into static
// HTML+CSS so no JS is required at PDF time. Cover page comes first with a
// page break, then the question pages.
import katex from 'katex';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { SCHOOL_LOGO_DATA_URI } from './school-logo';

/**
 * Round-7 C-G2 — KaTeX CSS + woff2 fonts inlined as data: URIs at module
 * load. Previously we linked `https://cdn.jsdelivr.net/npm/katex@.../katex.min.css`
 * and used `waitUntil: 'networkidle0'`, so a CDN hiccup (common from
 * Singapore school networks reaching out via Railway egress) blocked the
 * render until the 30s PDF timeout fired and bubbled a 5xx to the teacher.
 *
 * The cost is a one-time ~200ms read of the woff2 files on first call;
 * the resulting `<style>` block is ~300KB but it's only built into the
 * single PDF render's HTML, never sent to a student client.
 */
const requireFromHere = createRequire(__filename);
function buildKatexInlineCss(): string {
  try {
    const cssPath = requireFromHere.resolve('katex/dist/katex.min.css');
    let css = fs.readFileSync(cssPath, 'utf8');
    const fontsDir = path.join(path.dirname(cssPath), 'fonts');
    // Drop ttf/woff @font-face entries — Chromium supports woff2 and we'd
    // otherwise embed three copies of every font. Then rewrite woff2
    // url(fonts/X.woff2) refs to data: URIs.
    css = css.replace(
      /@font-face\{[^}]*src:url\(fonts\/[^)]+\.ttf\)[^}]*\}/g,
      '',
    );
    css = css.replace(
      /,?\s*url\(fonts\/[^)]+\.woff\)[^,)]*?(?=,|\))/g,
      '',
    );
    css = css.replace(/url\(fonts\/([^)]+\.woff2)\)/g, (_m, fname) => {
      try {
        const buf = fs.readFileSync(path.join(fontsDir, fname));
        return `url(data:font/woff2;base64,${buf.toString('base64')})`;
      } catch {
        // If a referenced woff2 went missing, leave it as a relative URL
        // — Chromium will fail to load that single font but won't block
        // the whole render. PDF math still renders structurally.
        return `url(fonts/${fname})`;
      }
    });
    return `<style>${css}</style>`;
  } catch (err) {
    // Module not installed (shouldn't happen — katex is a runtime dep).
    // Fall back to the CDN, but with a warning logged once at startup.
    // eslint-disable-next-line no-console
    console.error('[pdf] katex inline css failed, falling back to CDN:', err);
    return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">';
  }
}
const KATEX_INLINE_CSS = buildKatexInlineCss();

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

  // 2. Inline math $..$ — allow \$ (escaped literal dollar) inside content
  //    so currency notation like $\$285\,000$ stays as one math block.
  working = working.replace(/\$((?:\\\$|[^$\n])+?)\$/g, (_m, expr) => {
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
  examBoardCode?: string; // 'CIE', 'Edexcel', etc — used for the cover course line
  syllabusCode?: string;  // '9709', '4024', '4MA1' — used for the cover paper line
  subjectLevel?: string;  // 'A_LEVEL' | 'AS_LEVEL' | 'IGCSE' | 'O_LEVEL'
  componentName?: string;
  componentCode?: string; // 'P1', 'M1', 'OL', 'H'
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
  ${KATEX_INLINE_CSS}
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body { font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; line-height: 1.5; color: #111; }

    /* ---------- Cover page (first sheet) ----------
       Kept in plain block flow — flexbox + bottom-pinned marker table
       was getting split across pages by Puppeteer because the table
       sat right on the 261mm content-area edge. Now content stacks
       naturally from the top with measured margins; the marker table
       has page-break-inside: avoid so it always renders intact. font-
       family falls through to Liberation since the chromium runtime
       in our Docker image only ships fonts-liberation. */
    .cover {
      width: 100%;
      box-sizing: border-box;
      page-break-after: always;
      page-break-inside: avoid;
      font-family: "Liberation Serif", Cambria, Georgia, "Times New Roman", serif;
      color: #000;
    }
    .cover .logo {
      display: block; margin: 0 auto 5mm;
      width: 50mm; height: auto;
    }
    .cover .course-line  { text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 3mm; line-height: 1.3; }
    .cover .subject-line { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 2.5mm; }
    .cover .paper-line   { text-align: center; font-size: 14pt; font-weight: bold; margin: 0 0 5mm; letter-spacing: 0.04em; }
    .cover .exam-name    { text-align: center; font-size: 17pt; font-weight: bold; margin: 0 0 6mm; line-height: 1.25; }
    .cover .instructions { font-size: 12pt; line-height: 1.4; }
    .cover .instructions p { margin: 0 0 3mm; }
    .cover .class-line   { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; font-size: 13pt; font-weight: bold; margin: 8mm 0 3mm; }
    .cover .student-name { font-size: 13pt; margin: 0 0 5mm; }
    .cover .marker-table {
      margin-left: auto; margin-top: 12mm; margin-right: 0;
      border-collapse: collapse;
      page-break-inside: avoid;
      font-family: "Liberation Sans", Arial, Helvetica, sans-serif; font-size: 11pt;
    }
    .cover .marker-table tr,
    .cover .marker-table td { page-break-inside: avoid; }
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
    /* Question spacing — generous bottom margin so questions don't run
       into each other. No dividers between questions per request. */
    .question { margin-bottom: 24px; page-break-inside: avoid; }
    .q-head { font-weight: bold; }
    .q-marks { float: right; }
    .q-stem { margin: 8px 0; }
    .q-options { list-style: upper-alpha; margin: 6px 0 6px 28px; }
    .q-options li { margin-bottom: 3px; }
    .q-parts { margin-left: 18px; margin-top: 10px; }
    .q-part { margin-bottom: 6mm; }
    .q-part-label { font-weight: bold; }
    /* Answer area: blank empty box, no horizontal rule lines. Height scales
       with marks so a 1-mark item gets ~14mm and a 10-mark sub-part gets a
       full half-page worth of writing room. Used in distributable papers
       only; answer-key PDFs replace this with the answer-block. */
    .answer-area { background: white; }
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
 * Map (examBoardCode, subjectLevel) to the school's official course-line
 * text. The school is a Singapore-Cambridge / Pearson-Edexcel prep
 * centre; these strings come from the Cover Page Builder COURSES list.
 */
function deriveCourseLine(boardCode: string | undefined, level: string | undefined): string {
  const b = (boardCode || '').toLowerCase();
  const lv = (level || '').toUpperCase();
  if (b === 'edexcel') {
    return 'Preparatory Course for Pearson Edexcel International Advanced Level';
  }
  if (lv === 'O_LEVEL') {
    return 'Preparatory Course for Singapore-Cambridge General Certificate of Education (Ordinary Level) (Intensive)';
  }
  if (lv === 'IGCSE') {
    return 'Preparatory Course for Cambridge International Advanced Subsidiary and Advanced Level';
  }
  // A_LEVEL / AS_LEVEL / fallback
  return 'Preparatory Course for Cambridge International Advanced Subsidiary and Advanced Level';
}

/**
 * Render the school's internal cover page. Layout mirrors the school's
 * Cover Page Builder: logo → full course name → subject → paper code →
 * exam name (Type · Month Year) → instructions → class → student-name →
 * filler → marker/moderator table.
 */
function renderCoverPage(data: PaperData): string {
  const logo = SCHOOL_LOGO_DATA_URI;
  const logoHtml = logo ? `<img class="logo" src="${logo}" alt="School logo" />` : '';

  const courseLine = deriveCourseLine(data.examBoardCode, data.subjectLevel);

  // Paper line — always show the syllabus code; append component code or
  // name when available. e.g. "Paper 9709 · M1" / "Paper 4MA1 · Higher Tier".
  const paperParts: string[] = [];
  if (data.syllabusCode) paperParts.push(`Paper ${data.syllabusCode}`);
  if (data.componentCode) paperParts.push(data.componentCode);
  else if (data.componentName) paperParts.push(data.componentName);
  const paperLine = paperParts.join(' · ') || 'Internal Mock Paper';

  // Exam name "[Type] · [Month] [Year]" mirrors the builder. We don't store
  // exam-type as a field yet; default to "Mock Exam" for AI-generated papers.
  const dateStr = data.examDate || new Date().toISOString().slice(0, 10);
  const year = dateStr.slice(0, 4);
  const monthIdx = parseInt(dateStr.slice(5, 7), 10) - 1;
  const monthName = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'][monthIdx] || '';
  const examName = monthName ? `Mock Exam · ${monthName} ${year}` : `Mock Exam · ${year}`;

  const classLine = data.classLabel
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
      <p>1. You may circle the correct answer or write your answer on the question paper/question sheet provided</p>
      <p>2. Calculator is allowed</p>
      <p>3. The total marks are <strong>${data.totalMarks}</strong></p>
    </div>
    <div class="class-line">${classLine}</div>
    <div class="student-name">Student Name: ____________________</div>
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

    // ~12mm per mark of writing room, with a 14mm floor so 0/1-mark items
    // still get a usable answer box. Capped at 140mm so a single sub-part
    // doesn't push the next question off the page.
    const answerMm = (marks: number) => Math.min(140, Math.max(14, Math.round((marks || 1) * 12)));

    let partsHtml = '';
    if (q.content?.parts && q.content.parts.length > 0) {
      partsHtml = `<div class="q-parts">${
        q.content.parts.map(p => {
          const partAnswer = isAnswerKey && p.answer
            ? `<div class="answer-block"><span class="answer-label">Answer:</span> ${renderInline(p.answer)}</div>`
            : (isAnswerKey ? '' : `<div class="answer-area" style="height:${answerMm(p.marks)}mm"></div>`);
          return `<div class="q-part">
            <span class="q-part-label">(${escapeHtml(p.label)})</span> ${renderInline(p.content)}
            <span class="q-marks">[${p.marks}]</span>
            ${partAnswer}
          </div>`;
        }).join('')
      }</div>`;
    } else if (!q.options) {
      // Structured/short answer with no parts: blank answer area sized by marks.
      if (isAnswerKey) {
        const ans = q.answer?.text;
        partsHtml = ans
          ? `<div class="answer-block"><span class="answer-label">Answer:</span> ${renderInline(ans)}</div>`
          : '';
      } else {
        partsHtml = `<div class="answer-area" style="height:${answerMm(q.marks)}mm"></div>`;
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
