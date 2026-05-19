import { useEffect } from 'react';

/**
 * Quick Attendance — phone-first tally recorder.
 *
 * The actual page is a self-contained static HTML at
 * /quick-attendance.html (apps/web/public/quick-attendance.html). This
 * route exists only to bounce old bookmarks of /quick-attendance to it,
 * since Vite/nginx's SPA fallback would otherwise route the bare path
 * back into the React app.
 *
 * Why static-HTML instead of a React port: the design is a one-off
 * personal tool (custom Mario theming, pixel-art SVGs, fully scoped
 * CSS) and porting it to JSX would only add maintenance overhead with
 * no benefit — the page touches no backend, shares no components, and
 * its state lives entirely in localStorage.
 */
export default function QuickAttendancePage() {
  useEffect(() => {
    window.location.replace('/quick-attendance.html');
  }, []);
  return <div className="p-8 text-gray-500">Loading…</div>;
}
