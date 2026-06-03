import { useEffect, useState, useRef } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import QuestionsPage from './pages/Questions';
import QuestionEditPage from './pages/QuestionEdit';
import PapersPage from './pages/Papers';
import PaperWizardPage from './pages/PaperWizard';
import PaperEditPage from './pages/PaperEdit';
import TemplatesPage from './pages/Templates';
import SourcesPage from './pages/Sources';
import ReviewPage from './pages/Review';
import AiGeneratePage from './pages/AiGenerate';
import QuickPaperPage from './pages/QuickPaper';
import StudentHomePage from './pages/StudentHome';
import StudentTakePage from './pages/StudentTake';
import StudentResultPage from './pages/StudentResult';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/CommandPalette';
// Morning quiz feature
import MorningQuizDisplayPage from './pages/MorningQuizDisplay';
import MorningQuizQrPrintPage from './pages/MorningQuizQrPrint';
import MorningQuizScanPage from './pages/MorningQuizScan';
import MorningQuizTakePage from './pages/MorningQuizTake';
import MorningQuizSchedulePage from './pages/MorningQuizSchedule';
import MorningQuizQaReviewPage from './pages/MorningQuizQaReview';
import MorningQuizSessionDashboard from './pages/MorningQuizSessionDashboard';
import MorningQuizClassDayDashboard from './pages/MorningQuizClassDayDashboard';
import AttendanceAdminPage from './pages/AttendanceAdmin';
// Path-B pages
import ClassesPage from './pages/Classes';
import MarkerQueuePage from './pages/MarkerQueue';
import MarkerScriptPage from './pages/MarkerScript';
import ClassStatsPage from './pages/ClassStats';
import WrongAnswerDashboardPage from './pages/WrongAnswerDashboard';
import QualityFeedbackPage from './pages/QualityFeedback';
import AiGenWithPerfPage from './pages/AiGenWithPerf';
import SyllabusAdminPage from './pages/SyllabusAdmin';
import CostDashboardPage from './pages/CostDashboard';
import UserAdminPage from './pages/UserAdmin';
import VariantPreviewPage from './pages/VariantPreview';
import CodegraderTestPage from './pages/CodegraderTest';
import StudentTutorPage from './pages/StudentTutor';
import PracticePage from './pages/Practice';
import MyHistoryPage from './pages/MyHistory';
import MyHistoryDetailPage from './pages/MyHistoryDetail';
// ROUND 14 — new admin/teacher pages
import AuditLogPage from './pages/AuditLog';
import ArchivedClassesPage from './pages/ArchivedClasses';
// ROUND 14 — FE-Student PracticeMode + FE-Parent ParentPortal.
import PracticeModePage from './pages/PracticeMode';
import ParentPortalPage from './pages/ParentPortal';
import QuickAttendancePage from './pages/QuickAttendance';

export default function App() {
  const { user, loading, init, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { init(); }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  // Public route: big-screen QR display. No login required so the venue
  // laptop can stay on it without an auth-token. Sits above the user-required
  // gate below.
  if (location.pathname === '/display' || location.pathname.startsWith('/display/')) {
    return (
      <Routes>
        <Route path="/display" element={<MorningQuizDisplayPage />} />
        <Route path="/display/:sessionId" element={<MorningQuizDisplayPage />} />
      </Routes>
    );
  }

  // Public route: printable permanent QR. No login — opened once by staff
  // to print the wall sheet, then never needed again. Kept above the auth
  // gate so it renders chrome-free for a clean print.
  if (location.pathname === '/qr-print') {
    return (
      <Routes>
        <Route path="/qr-print" element={<MorningQuizQrPrintPage />} />
      </Routes>
    );
  }

  // Public routes: student-self-service portal (typed-name lookup).
  // No JWT (scan tokens expire daily so a student wanting to check
  // yesterday's score wouldn't have one); backend routes are IP-gated
  // to school WiFi + name-matched server-side so /my-history/submission/:id
  // can't be enumerated by curious onlookers.
  if (location.pathname === '/my-history' || location.pathname.startsWith('/my-history/submission/')) {
    return (
      <Routes>
        <Route path="/my-history" element={<MyHistoryPage />} />
        <Route path="/my-history/submission/:submissionId" element={<MyHistoryDetailPage />} />
      </Routes>
    );
  }

  // ROUND 14 — Feature: Parent portal. Token-gated, public — no JWT
  // required (the token IS the auth). Lives outside the admin layout
  // and even outside the login gate so parents can land here directly
  // from the admin-issued URL without bouncing through /login.
  if (location.pathname.startsWith('/parent/')) {
    return (
      <Routes>
        <Route path="/parent/:token" element={<ParentPortalPage />} />
      </Routes>
    );
  }

  // R15-followup — Practice mode (Feature 16). Public — no JWT (the
  // student arrives via the "🔄 重做" button on /my-history). The
  // backend validates studentName+studentId, IP-gates, and rate-limits.
  // Without this block, /practice/:id bounced unauthenticated students
  // through /login (where they have no password), trapping them.
  if (location.pathname.startsWith('/practice/')) {
    return (
      <Routes>
        <Route path="/practice/:practiceSubmissionId" element={<PracticeModePage />} />
      </Routes>
    );
  }

  // Public route: phone-first roster tap-tracker. No login (it's a
  // personal tool for the cohort owner — all state is local to the
  // device, no API calls). Bypasses both the auth gate and the admin
  // chrome so it can be home-screened as a standalone PWA.
  if (location.pathname === '/quick-attendance') {
    return (
      <Routes>
        <Route path="/quick-attendance" element={<QuickAttendancePage />} />
      </Routes>
    );
  }

  // QR-scan gate. Lift it OUT of the !user branch so when staff are
  // already logged in as admin/teacher on the same browser, scanning a
  // student QR doesn't render the full admin header + "404 链接无效或已
  // 过期" body when the token rotates. Hidden chrome matters because
  // shared-device flows (one iPad shared between students) shouldn't
  // leak the admin nav to whoever picks up the device.
  if (location.pathname.startsWith('/scan/')) {
    return (
      <Routes>
        <Route path="/scan/:token" element={<MorningQuizScanPage />} />
      </Routes>
    );
  }

  if (!user) {
    // Allow /scan/:token to bounce through login with a `next` param so
    // returning students land back on the scan flow.
    const isPublicLogin = location.pathname === '/login';
    const isScan = location.pathname.startsWith('/scan/');
    // If a student loses their scanToken auth mid-quiz (refresh after
    // session.quizEnd, browser back from /morning-quiz/:id, etc.) the old
    // behaviour was to bounce to /login — but students don't have
    // passwords. Dropping them on the password form is a dead-end that
    // confuses everyone. Send them to /my-history (public, IP-gated,
    // name-typed) instead, which is the canonical "what's my situation"
    // landing page for unauthenticated students.
    const isStudentFlow =
      location.pathname.startsWith('/morning-quiz/') ||
      location.pathname.startsWith('/student/');
    if (isStudentFlow) return <Navigate to="/my-history" replace />;
    if (!isPublicLogin && !isScan) return <Navigate to="/login" replace />;
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/scan/:token" element={<MorningQuizScanPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Students get a dedicated minimal layout — no teacher nav, no Dashboard.
  if (user.role === 'student') {
    // R10 follow-up — when a student is mid-quiz the chrome (nav links,
    // name badge, Logout button) becomes a hazard: one accidental tap on
    // "Past-Paper Practice", "My Papers", or "Logout" navigates them away
    // and dumps in-flight answers. Hide the entire header on:
    //   - take-quiz routes (so the only way out is the official Submit)
    //   - result page (after submit, the laptop is shared between students;
    //     showing Logout is a footgun that lets the previous student log
    //     out the next person, or click their way to other students' data)
    const isQuizTaking =
      location.pathname.startsWith('/morning-quiz/') ||
      /^\/student\/take\//.test(location.pathname) ||
      /^\/student\/result\//.test(location.pathname);
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <CommandPalette role="student" />
        {!isQuizTaking && (
          <header className="bg-white border-b">
            <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-5 text-sm">
                <Link to="/student" className="font-bold text-lg">📝 My Papers</Link>
                <Link to="/practice" className="text-blue-600 hover:underline">Past-Paper Practice</Link>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">{user.name} <span className="badge">student</span></span>
                <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
              </div>
            </div>
          </header>
        )}
        <main className={`flex-1 w-full ${isQuizTaking ? '' : 'max-w-4xl mx-auto px-6 py-6'}`}>
          <ErrorBoundary>
            <Routes>
              <Route path="/student" element={<StudentHomePage />} />
              <Route path="/student/take/:assignmentId" element={<StudentTakePage />} />
              <Route path="/student/result/:sessionId" element={<StudentResultPage />} />
              <Route path="/student/tutor" element={<StudentTutorPage />} />
              <Route path="/practice" element={<PracticePage />} />
              {/* ROUND 14 — FE-Student practice-mode (review-by-doing) page */}
              <Route path="/practice/:practiceSubmissionId" element={<PracticeModePage />} />
              <Route path="/scan/:token" element={<MorningQuizScanPage />} />
              <Route path="/morning-quiz/:sessionId" element={<MorningQuizTakePage />} />
              <Route path="*" element={<Navigate to="/student" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <CommandPalette role={user.role as any} />
      {/* Fix #1: header was wrapping the logo to 3 lines and most of the
          nav items to 2 lines because the flex container had no min-width
          guard and gap-1 left no horizontal slack. Setting whitespace-nowrap
          on every nav-link + min-w-0 + overflow-x-auto on the nav strip keeps
          everything on one row and lets it scroll horizontally on narrow
          viewports rather than stack. */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0 flex-1">
            <Link to="/" className="font-bold text-lg whitespace-nowrap shrink-0">📄 Exam Paper System</Link>
            {/* Nav reorg: 常驻高频一级项 + 「出卷」「管理」两个下拉，
                取代原先 21 个 NavLink 挤在一行横滑的布局。所有 to= 路径、
                角色显示条件、emoji、/quick-attendance.html 的 <a href>
                均原样保留，仅中文化文字 + 重新分组。 */}
            <nav className="flex gap-1 text-sm flex-wrap min-w-0">
              {/* 常驻一级项 */}
              <NavLink to="/" label="仪表盘" />
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/morning-quiz/schedule" label="🌅 早测" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/marker" label="判分" />
              )}
              {/* Fix #14: classes management nav */}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/classes" label="班级" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/stats" label="统计" />
              )}

              {/* 「出卷 ▾」下拉 */}
              <NavDropdown label="出卷">
                <NavDropdownLink to="/papers" label="卷子" />
                <NavDropdownLink to="/questions" label="题库" />
                <NavDropdownLink to="/templates" label="模板" />
                {(user.role === 'admin' || user.role === 'head_teacher') && (
                  <NavDropdownLink to="/quick-paper" label="⚡ 快速出卷" />
                )}
                {(user.role === 'admin' || user.role === 'head_teacher') && (
                  <NavDropdownLink to="/ai-generate" label="AI出卷" />
                )}
                {(user.role === 'admin' || user.role === 'head_teacher') && (
                  <NavDropdownLink to="/review" label="审核" />
                )}
              </NavDropdown>

              {/* 「管理 ▾」下拉 — 各项保留原有角色条件 */}
              <NavDropdown label="管理">
                {user.role === 'admin' && <NavDropdownLink to="/admin/users" label="用户" />}
                {user.role === 'admin' && <NavDropdownLink to="/admin/audit" label="🔍 审计" />}
                {user.role === 'admin' && <NavDropdownLink to="/sources" label="题源" />}
                {user.role === 'admin' && <NavDropdownLink to="/syllabus" label="大纲" />}
                {user.role === 'admin' && <NavDropdownLink to="/admin/cost" label="AI成本" />}
                {(user.role === 'admin' || user.role === 'head_teacher') && (
                  <NavDropdownLink to="/quality" label="质量" />
                )}
                {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                  <NavDropdownLink to="/codegrader-test" label="代码判分" />
                )}
                <NavDropdownLink to="/practice" label="📝 练习" />
                {/* /quick-attendance is a static-HTML page served from
                    apps/web/public/quick-attendance.html. The bare path
                    bounces through a React redirect (see QuickAttendance.tsx),
                    but for the nav we link straight to the .html to skip
                    the React detour. */}
                <a
                  href="/quick-attendance.html"
                  className="block px-4 py-2 text-sm whitespace-nowrap hover:bg-gray-50"
                >📋 快速考勤</a>
              </NavDropdown>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{user.name} <span className="badge">{user.role}</span></span>
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/papers" element={<PapersPage />} />
          <Route path="/papers/new" element={<PaperWizardPage />} />
          <Route path="/papers/:id" element={<PaperEditPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/questions/new" element={<QuestionEditPage />} />
          <Route path="/questions/:id" element={<QuestionEditPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/sources" element={user.role === 'admin' ? <SourcesPage /> : <Navigate to="/" replace />} />
          <Route
            path="/review"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <ReviewPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/ai-generate"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <AiGeneratePage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/quick-paper"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <QuickPaperPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* Path-B routes */}
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/marker" element={<MarkerQueuePage />} />
          {/* Fix #16: param name must match useParams<{ submissionId }> in MarkerScript.tsx,
              otherwise the page guard early-returns and gets stuck at "Loading…". */}
          <Route path="/marker/submission/:submissionId" element={<MarkerScriptPage />} />
          <Route path="/stats" element={<ClassStatsPage />} />
          <Route path="/stats/wrong-answers" element={<WrongAnswerDashboardPage />} />
          <Route
            path="/quality"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <QualityFeedbackPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/ai-generate-with-perf"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <AiGenWithPerfPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/syllabus" element={user.role === 'admin' ? <SyllabusAdminPage /> : <Navigate to="/" replace />} />
          <Route path="/admin/cost" element={user.role === 'admin' ? <CostDashboardPage /> : <Navigate to="/" replace />} />
          <Route path="/admin/users" element={user.role === 'admin' ? <UserAdminPage /> : <Navigate to="/" replace />} />
          <Route path="/variants" element={<VariantPreviewPage />} />
          <Route path="/codegrader-test" element={<CodegraderTestPage />} />
          {/* Morning quiz */}
          <Route
            path="/morning-quiz/schedule"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MorningQuizSchedulePage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/morning-quiz/qa-review"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MorningQuizQaReviewPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* R10-Bug2: live per-session dashboard. API existed; UI didn't.
              Round-9 found this URL fell through to "/" wildcard. */}
          <Route
            path="/morning-quiz/sessions/:sessionId/dashboard"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MorningQuizSessionDashboard />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* Aggregated dashboard for one (class, date) — merges the 1–3
              level sessions into a single roster. Used by the schedule
              page's per-row "考勤 →" link. */}
          <Route
            path="/morning-quiz/classes/:classId/date/:date/dashboard"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <MorningQuizClassDayDashboard />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/admin/attendance"
            element={
              user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher' ? (
                <AttendanceAdminPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* ROUND 14 — Feature 8: audit log viewer (admin only) */}
          <Route
            path="/admin/audit"
            element={user.role === 'admin' ? <AuditLogPage /> : <Navigate to="/" replace />}
          />
          {/* ROUND 14 — Feature 6: archived (soft-deleted) restore UI */}
          <Route
            path="/admin/archived-classes"
            element={
              user.role === 'admin' || user.role === 'head_teacher' ? (
                <ArchivedClassesPage />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* ROUND 14 — FE-Student practice-mode route (admin/teacher
              view of the same page, mostly so they can preview a
              student's practice link). */}
          <Route
            path="/practice/:practiceSubmissionId"
            element={<PracticeModePage />}
          />
          {/* R13 Bug 5: /scan?token=... (query form, used by some old
              QR generators) → bounce to /scan/:token. */}
          <Route path="/scan" element={<ScanQueryRedirect />} />
          {/* Already-authenticated users who hand-type or bookmark /login
              or /dashboard shouldn't hit a 404 — the real dashboard is at
              "/". (Unauthenticated /login is handled in the logged-out
              branch above; this only runs when a session exists.) */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          {/* R13 Bug 5: unknown URLs MUST NOT leak the admin dashboard.
              Render a chrome-light NotFoundPage instead of bouncing to `/`. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <footer className="text-center text-xs text-gray-500 py-4">
        © School internal use only · MVP v0.1
      </footer>
    </div>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 ${active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
    >
      {label}
    </Link>
  );
}

/**
 * Lightweight nav dropdown — pure React + Tailwind, no extra deps.
 * Opens on hover (desktop) and on click (keyboard/touch), closes on
 * outside-click. Children are <NavDropdownLink> items (or a raw <a>
 * for the static quick-attendance.html page). If a dropdown has no
 * visible children (all gated out by role), it renders nothing.
 */
function NavDropdown({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hide the whole dropdown when role-gating left it with no items.
  const hasItems = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!hasItems) return null;

  return (
    <div
      ref={ref}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-md whitespace-nowrap hover:bg-gray-50 flex items-center gap-1"
      >
        {label}
        <span className="text-xs text-gray-400">▾</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-md border bg-white py-1 shadow-lg"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function NavDropdownLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`block px-4 py-2 text-sm whitespace-nowrap ${active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
    >
      {label}
    </Link>
  );
}

/**
 * R13 Bug 5 — friendly 404 for unknown URLs. NEVER falls through to
 * the admin dashboard (which would leak student counts / paper drafts
 * to a curious student who scanned a bad QR or mistyped a link).
 */
function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto mt-24 bg-white border rounded-lg p-8 text-center shadow-sm">
      <div className="text-5xl font-bold text-gray-300 mb-2">404</div>
      <div className="text-lg font-medium text-gray-800 mb-1">链接无效或已过期</div>
      <div className="text-sm text-gray-500 mb-6">This link is invalid or has expired.</div>
      <div className="flex flex-col gap-2">
        <Link
          to="/my-history"
          className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
        >
          回到我的考勤记录 →
        </Link>
        <Link
          to="/scan"
          className="border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50"
        >
          扫码考勤 →
        </Link>
      </div>
    </div>
  );
}

/**
 * R13 Bug 5 — old QR generators send `/scan?token=ABC` (query form);
 * the take-flow expects `/scan/:token` (path form). Bounce silently.
 */
function ScanQueryRedirect() {
  const [params] = useSearchParams();
  const token = params.get('token');
  if (token && /^[A-Za-z0-9_\-.]+$/.test(token)) {
    return <Navigate to={`/scan/${encodeURIComponent(token)}`} replace />;
  }
  return (
    <div className="max-w-md mx-auto mt-24 bg-white border rounded-lg p-8 text-center shadow-sm">
      <div className="text-lg font-medium text-gray-800 mb-2">📱 请用手机相机扫描大屏二维码</div>
      <div className="text-sm text-gray-500">Use your phone camera to scan the QR on the wall display.</div>
    </div>
  );
}
