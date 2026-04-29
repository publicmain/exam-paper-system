// Minimal HTML templates for PDF rendering. KaTeX is server-side rendered into static
// HTML+CSS so no JS is required at PDF time.
import katex from 'katex';

const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';

/**
 * Render a string mixing markdown-ish text with $...$ inline math and $$...$$ display math.
 * Very small subset — adequate for school question text.
 */
function renderInline(text: string): string {
  if (!text) return '';
  const slots: string[] = [];
  const placeholder = (i: number) => `\u0000K${i}\u0000`;

  let working = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: true, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escapeHtml(expr)}</code>`; }
    slots.push(html);
    return placeholder(slots.length - 1);
  });
  working = working.replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: false, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escapeHtml(expr)}</code>`; }
    slots.push(html);
    return placeholder(slots.length - 1);
  });

  let escaped = escapeHtml(working).replace(/\n/g, '<br/>');
  for (let i = 0; i < slots.length; i++) {
    escaped = escaped.replace(escapeHtml(placeholder(i)), slots[i]);
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
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
    .school { font-size: 14pt; font-weight: bold; letter-spacing: 0.05em; }
    .paper-name { font-size: 16pt; font-weight: bold; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-top: 8px; }
    .student-info { display: flex; gap: 16px; margin-top: 12px; font-size: 10pt; }
    .student-info > div { flex: 1; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .instructions { background: #f8f8f8; border-left: 3px solid #888; padding: 8px 12px; font-size: 10pt; margin: 12px 0 18px; }
    .question { margin-bottom: 14px; page-break-inside: avoid; }
    .q-head { font-weight: bold; }
    .q-marks { float: right; }
    .q-stem { margin: 4px 0; }
    .q-options { list-style: upper-alpha; margin: 6px 0 6px 28px; }
    .q-options li { margin-bottom: 3px; }
    .q-parts { margin-left: 18px; margin-top: 6px; }
    .q-part { margin-bottom: 8px; }
    .q-part-label { font-weight: bold; }
    .answer-space { border-bottom: 1px dotted #888; height: 1.2em; margin: 4px 0; }
    .answer-block { background: #fafafa; border: 1px solid #ddd; padding: 8px 10px; margin-top: 6px; }
    .q-assets { margin: 8px 0; text-align: center; }
    .q-assets img { display: block; margin: 6px auto; max-width: 75%; max-height: 280px; page-break-inside: avoid; }
    .answer-label { font-weight: bold; color: #555; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { position: running(footer); font-size: 9pt; color: #666; text-align: center; }
    code { background: #fdd; padding: 0 3px; }
    .copyright { font-size: 8.5pt; color: #888; text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; }
  </style>
`;

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

  return `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    ${baseStyles}
  </head><body>
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
    <div class="copyright">© School internal use only. Generated ${new Date().toISOString().slice(0,10)}.</div>
  </body></html>`;
}
