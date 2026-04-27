import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('teacher@school.local');
  const [password, setPassword] = useState('teacher123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await login(email, password);
      nav('/');
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
