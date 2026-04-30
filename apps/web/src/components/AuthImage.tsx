import { useEffect, useState } from 'react';

/**
 * Renders a JWT-protected image. The QuestionAsset endpoints
 * (/api/question-assets/...) require an Authorization header, which
 * native <img src> cannot supply, so we fetch the bytes ourselves and
 * hand back an object URL.
 *
 * Accepts either a relative API path (prepended with VITE_API_URL) or
 * an absolute URL.
 */
export function AuthImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    const token = localStorage.getItem('auth_token');
    const base = (import.meta as any).env?.VITE_API_URL || '';
    const fullSrc = src.startsWith('http') ? src : `${base}${src}`;
    fetch(fullSrc, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const blob = await r.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      })
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (err) return <div className="text-xs text-red-600">image: {err}</div>;
  if (!url) return <div className="text-xs text-gray-400">loading image…</div>;
  return <img src={url} alt={alt} className={className ?? 'border rounded max-w-md'} />;
}
