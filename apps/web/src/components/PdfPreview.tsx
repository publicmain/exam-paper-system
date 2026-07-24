import { useEffect, useRef, useState } from 'react';

/**
 * Inline PDF preview: renders every page as an image, stacked. pdf.js is
 * imported dynamically so its ~1MB chunk loads only when a PDF is actually
 * on screen.
 */
export function PdfPreview({ contentPath, className }: { contentPath: string; className?: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPages([]);
    (async () => {
      try {
        const { loadPdf } = await import('../lib/pdf-render');
        const pdf = await loadPdf(contentPath);
        const urls: string[] = [];
        for (let i = 1; i <= pdf.pageCount; i++) {
          const url = await pdf.renderPage(i, 1000);
          if (cancelled) { URL.revokeObjectURL(url); break; }
          urls.push(url);
          urlsRef.current = urls;
          setPages([...urls]); // progressive: show pages as they render
        }
        pdf.destroy();
        if (!cancelled) setState('ready');
      } catch (e: any) {
        if (!cancelled) { setState('error'); setErrMsg(e.message ?? String(e)); }
      }
    })();
    return () => {
      cancelled = true;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [contentPath]);

  if (state === 'error') {
    return <div className="text-sm text-red-600 p-3">PDF 预览失败：{errMsg}</div>;
  }
  return (
    <div className={className}>
      {pages.map((u, i) => (
        <img key={i} src={u} alt={`PDF 第 ${i + 1} 页`} className="w-full border-t first:border-t-0" />
      ))}
      {state === 'loading' && (
        <div className="text-sm text-gray-400 p-3 text-center">PDF 渲染中…</div>
      )}
    </div>
  );
}
