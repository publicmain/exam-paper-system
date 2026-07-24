/**
 * Shared "finish handwriting" pipeline: flatten every ink draft that has
 * strokes into PNGs, upload them as source=ink answer pages, then delete
 * the drafts. Used by both the HandwritingWorkspace's 完成手写 button and —
 * critically — the submit-time rescue in StudentHomeworkSubmit: a student
 * who wrote with the pencil but never tapped 完成手写 must NOT silently
 * lose their work when they hit 提交.
 */
import { hwApi, hwFileContentPath } from './api-homework';
import { flattenInkToPng, Stroke } from '../components/HandwritingCanvas';

export interface InkDraft {
  id: string;
  strokes: Stroke[];
  width: number;
  height: number;
  backgroundFileId: string | null;
  /** 1-based PDF page when the background file is a PDF. */
  backgroundPage: number | null;
}

/** Drafts that actually contain ink (empty pages are ignored + cleaned). */
export async function listInkDrafts(assignmentId: string): Promise<InkDraft[]> {
  const { pages } = await hwApi.listInk(assignmentId);
  return (pages as any[]).map((p) => ({
    id: p.id,
    strokes: Array.isArray(p.strokes) ? p.strokes : [],
    width: p.width,
    height: p.height,
    backgroundFileId: p.backgroundFileId ?? null,
    backgroundPage: p.backgroundPage ?? null,
  }));
}

/** Resolve a draft's background to an object URL: PDF page → pdf.js render
 *  (lazy chunk), image → authorized blob. Shared by workspace + flatten. */
export async function resolveBgUrl(
  fileId: string,
  page: number | null,
  targetWidth = 1200,
): Promise<string | null> {
  if (page != null) {
    const { renderPdfPageToUrl } = await import('./pdf-render');
    const r = await renderPdfPageToUrl(hwFileContentPath(fileId), page, targetWidth);
    return r.url;
  }
  const token = localStorage.getItem('auth_token');
  const base = (import.meta as any).env?.VITE_API_URL || '';
  const res = await fetch(`${base}${hwFileContentPath(fileId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  return URL.createObjectURL(await res.blob());
}

/**
 * Flatten + upload + delete drafts. Returns how many pages were created.
 * Deletion happens ONLY after a successful upload, so a network failure
 * leaves the drafts intact for retry.
 */
export async function finishInkDrafts(assignmentId: string, drafts?: InkDraft[]): Promise<number> {
  const all = drafts ?? (await listInkDrafts(assignmentId));
  const withInk = all.filter((d) => d.strokes.length > 0);
  if (withInk.length === 0) return 0;
  const bgUrls: (string | null)[] = [];
  const files: File[] = [];
  for (let i = 0; i < withInk.length; i++) {
    const d = withInk[i];
    const bgUrl = d.backgroundFileId
      ? await resolveBgUrl(d.backgroundFileId, d.backgroundPage, d.width)
      : null;
    bgUrls.push(bgUrl);
    const blob = await flattenInkToPng(d.strokes, d.width, d.height, bgUrl);
    if (blob) files.push(new File([blob], `handwriting-${i + 1}.png`, { type: 'image/png' }));
  }
  if (files.length === 0) throw new Error('手写导出失败，请重试');
  await hwApi.uploadInkFlattened(assignmentId, files);
  for (const d of all) await hwApi.deleteInkPage(d.id).catch(() => {});
  bgUrls.forEach((u) => u && URL.revokeObjectURL(u));
  return files.length;
}
