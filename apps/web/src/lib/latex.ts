import katex from 'katex';

// Render text mixing markdown-ish content with $..$ inline math and $$..$$ display math.
// XSS-safe: user text is HTML-escaped; only KaTeX-rendered HTML is trusted.
export function renderInline(text: string): string {
  if (!text) return '';
  const slots: string[] = [];
  const placeholder = (i: number) => `\u0000K${i}\u0000`;

  let working = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: true, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escape(expr)}</code>`; }
    slots.push(html);
    return placeholder(slots.length - 1);
  });
  working = working.replace(/\$([^$\n]+?)\$/g, (_m, expr) => {
    let html: string;
    try { html = katex.renderToString(expr, { displayMode: false, throwOnError: false, output: 'html' }); }
    catch { html = `<code>${escape(expr)}</code>`; }
    slots.push(html);
    return placeholder(slots.length - 1);
  });

  let escaped = escape(working).replace(/\n/g, '<br/>');
  for (let i = 0; i < slots.length; i++) {
    escaped = escaped.replace(escape(placeholder(i)), slots[i]);
  }
  return escaped;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}
