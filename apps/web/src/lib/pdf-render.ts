/**
 * Client-side PDF rendering (pdf.js). Teachers overwhelmingly upload PDF
 * worksheets, so PDFs must be first-class:
 *  - inline page previews for students/teachers (no context-losing new tab)
 *  - a PDF page as the handwriting background (“直接在卷面上写”)
 *
 * All rendering happens in the browser; the server stays a dumb byte store.
 * pdf.js and its worker live in their own lazy chunk — pages without PDFs
 * never pay the download.
 */
import * as pdfjs from 'pdfjs-dist';
// Vite turns this into an asset URL served from our own origin (CSP-safe).
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function apiBase(): string {
  return (import.meta as any).env?.VITE_API_URL || '';
}

async function fetchAuthorized(path: string): Promise<ArrayBuffer> {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${apiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`PDF 下载失败: ${res.status}`);
  return res.arrayBuffer();
}

export interface RenderedPdf {
  pageCount: number;
  /** Render one 1-based page to a PNG object URL at the given CSS width. */
  renderPage: (pageNum: number, targetWidth?: number) => Promise<string>;
  destroy: () => void;
}

/** Load a PDF (JWT-authorized API path) and return a per-page renderer. */
export async function loadPdf(contentPath: string): Promise<RenderedPdf> {
  const data = await fetchAuthorized(contentPath);
  const doc = await pdfjs.getDocument({ data }).promise;
  return {
    pageCount: doc.numPages,
    renderPage: async (pageNum: number, targetWidth = 1200) => {
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d')!;
      // intent:'print' — the default 'display' intent schedules paint chunks
      // via requestAnimationFrame, which never fires in a backgrounded /
      // hidden tab, so the render promise hangs forever (student switches
      // tab while a big PDF renders → spinner stuck). Print intent renders
      // synchronously to the canvas with identical output for our use.
      await page.render({ canvasContext: ctx, viewport, intent: 'print' } as any).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('PDF 页渲染失败');
      return URL.createObjectURL(blob);
    },
    destroy: () => { doc.destroy().catch(() => {}); },
  };
}

/** One-shot: render a single PDF page to an object URL (for ink backgrounds). */
export async function renderPdfPageToUrl(
  contentPath: string,
  pageNum: number,
  targetWidth = 1200,
): Promise<{ url: string; width: number; height: number }> {
  const pdf = await loadPdf(contentPath);
  try {
    const url = await pdf.renderPage(pageNum, targetWidth);
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = url;
    });
    return { url, ...dims };
  } finally {
    pdf.destroy();
  }
}

/** Page count only (workspace rail shows ＋P1..Pn buttons). */
export async function pdfPageCount(contentPath: string): Promise<number> {
  const pdf = await loadPdf(contentPath);
  const n = pdf.pageCount;
  pdf.destroy();
  return n;
}
