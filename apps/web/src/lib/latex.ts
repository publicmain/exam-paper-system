import katex from 'katex';

// Render a string mixing markdown-ish text with $..$ inline math, $$..$$ display
// math, **bold**, *italic*, and GFM tables. XSS-safe: user text is HTML-escaped;
// only KaTeX-rendered HTML and our own derived markup live in trusted slots.
//
// Placeholder marker uses the Unicode private-use area (U+E000) which cannot
// appear in legitimate question text, so the slot index can never collide with
// real content like "K0 = 100".
const SLOT_MARK = '';

export function renderInline(text: string): string {
  if (!text) return '';
  const slots: string[] = [];
  const placeholder = (i: number) => `${SLOT_MARK}K${i}${SLOT_MARK}`;
  const pushSlot = (html: string) => {
    slots.push(html);
    return placeholder(slots.length - 1);
  };

  // 1. Display math $$..$$
  let working = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: true, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escape(expr)}</code>`; }
    return pushSlot(html);
  });

  // 2. Inline math $..$
  working = working.replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: false, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escape(expr)}</code>`; }
    return pushSlot(html);
  });

  // 3. Bold **text**
  working = working.replace(/\*\*([^*\n]+?)\*\*/g, (_m, body) =>
    pushSlot(`<strong>${escape(body)}</strong>`));

  // 4. Italic *text* — require non-asterisk on each side so multi-asterisks
  //    used as decoration don't accidentally trip italic.
  working = working.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, (_m, body) =>
    pushSlot(`<em>${escape(body)}</em>`));

  // 5. GFM tables: one header row, separator (|---|---|), one+ body rows.
  const tableRe = /(?:^|\n)(\|[^\n]+\|)\n\|[\s\-:|]+\|\n((?:\|[^\n]+\|(?:\n|$))+)/g;
  working = working.replace(tableRe, (_m, headerLine: string, bodySection: string) => {
    const parseCells = (line: string) =>
      line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const headerCells = parseCells(headerLine);
    const bodyRows = bodySection.trim().split('\n').map(parseCells);
    if (headerCells.length === 0 || bodyRows.length === 0) return _m;
    const cell = (c: string) =>
      escape(c).replace(new RegExp(`${SLOT_MARK}K(\\d+)${SLOT_MARK}`, 'g'),
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

  // 6. Escape remaining text + convert newlines.
  let escaped = escape(working).replace(/\n/g, '<br/>');

  // 7. Restore slots — the SLOT_MARK PUA char survives escape() unchanged.
  for (let i = 0; i < slots.length; i++) {
    escaped = escaped.replace(placeholder(i), slots[i]);
  }
  return escaped;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
