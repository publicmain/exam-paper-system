import { useEffect } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
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
// Path-B pages
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

export default function App() {
  const { user, loading, init, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { init(); }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  if (!user) {
    if (location.pathname !== '/login') return <Navigate to="/login" replace />;
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Students get a dedicated minimal layout — no teacher nav, no Dashboard.
  if (user.role === 'student') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link to="/student" className="font-bold text-lg">📝 My Papers</Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">{user.name} <span className="badge">student</span></span>
              <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
          <Routes>
            <Route path="/student" element={<StudentHomePage />} />
            <Route path="/student/take/:assignmentId" element={<StudentTakePage />} />
            <Route path="/student/tutor" element={<StudentTutorPage />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold text-lg">📄 Exam Paper System</Link>
            <nav className="flex gap-1 text-sm">
              <NavLink to="/" label="Dashboard" />
              <NavLink to="/papers" label="Papers" />
              <NavLink to="/questions" label="Questions" />
              <NavLink to="/templates" label="Templates" />
              {(user.role === 'admin' || user.role === 'head_teacher') && (
                <NavLink to="/review" label="Review" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher') && (
                <NavLink to="/quick-paper" label="⚡ Quick Paper" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher') && (
                <NavLink to="/ai-generate" label="AI Generate" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/marker" label="Marker" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/stats" label="Stats" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher') && (
                <NavLink to="/quality" label="Quality" />
              )}
              {(user.role === 'admin' || user.role === 'head_teacher' || user.role === 'teacher') && (
                <NavLink to="/codegrader-test" label="Code Grader" />
              )}
              {user.role === 'admin' && <NavLink to="/syllabus" label="Syllabus" />}
              {user.role === 'admin' && <NavLink to="/admin/cost" label="AI Cost" />}
              {user.role === 'admin' && <NavLink to="/admin/users" label="Users" />}
              {user.role === 'admin' && <NavLink to="/sources" label="Sources" />}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{user.name} <span className="badge">{user.role}</span></span>
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
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
          <Route path="/marker" element={<MarkerQueuePage />} />
          <Route path="/marker/submission/:id" element={<MarkerScriptPage />} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
      className={`px-3 py-1.5 rounded-md ${active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'}`}
    >
      {label}
    </Link>
  );
}
