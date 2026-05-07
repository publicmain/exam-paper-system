import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('teacher@school.local');
  const [password, setPassword] = useState('teacher123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  // Bouncing components (e.g. MorningQuizScan) set ?next=<encoded-path>
  // when they need the user authenticated first. Honour it on success so
  // the student never has to re-scan after logging in — they go straight
  // to /scan/<token> → 5-gate validation → /morning-quiz/<id> in one shot.
  const next = params.get('next');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
      // Refuse anything that isn't an internal absolute path. Guards
      // against open-redirect via ?next=https://evil.example.
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      nav(safeNext);
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card w-96 space-y-4">
        <div>
          <h1 className="text-xl font-bold">📄 Exam Paper System</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with your school account</p>
          {next && (
            <p className="text-xs text-amber-600 mt-2">登录后将自动跳转继续签到</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Email</label>
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Password</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {err && <div className="badge badge-error w-full justify-center py-2">{err}</div>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="text-xs text-gray-500 text-center pt-2 border-t">
          Demo: teacher@school.local / teacher123 · admin@school.local / admin123
        </div>
      </form>
    </div>
  );
}
