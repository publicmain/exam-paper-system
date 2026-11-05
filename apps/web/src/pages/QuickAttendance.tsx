import { useEffect } from 'react';

/**
 * Quick Attendance — phone-first tally recorder.
 *
 * The actual page is a self-contained HTML at /quick-attendance.html
 * (apps/web/quick-attendance.html, a second Vite build entry). This
 * route exists only to bounce old bookmarks of /quick-attendance to it,
 * since Vite/nginx's SPA fallback would otherwise route the bare path
 * back into the React app.
 *
 * Why static-HTML instead of a React port: the design is a one-off
 * personal tool (custom Mario theming, pixel-art SVGs, fully scoped
 * CSS) and porting it to JSX would only add maintenance overhead with
 * no benefit — it shares no components and its marks live in localStorage.
 *
 * 2026-11-05: the roster is no longer hard-coded in the page (it used to
 * ship ~33 real student names to anyone, no login). The page now calls
 * GET /api/classes and /api/classes/:id with localStorage.auth_token and
 * shows only a login prompt without a valid teacher token.
 */
export default function QuickAttendancePage() {
  useEffect(() => {
    window.location.replace('/quick-attendance.html');
  }, []);
  return <div className="p-8 text-gray-500">Loading…</div>;
}
