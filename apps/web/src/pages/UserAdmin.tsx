import { useEffect, useState } from 'react';

/**
 * Admin-only RBAC management page.
 *
 * Lists all users (paginated, optional q+role filter), opens a row in a
 * modal to change role / toggle active / reset password.
 *
 * As with CostDashboard, this page calls the backend directly via fetch
 * — `lib/api.ts` is owned by another agent and B6 isn't allowed to add
 * helpers there.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || '';

function token(): string | null {
  return localStorage.getItem('auth_token');
}

async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${method} ${path} failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'head_teacher' | 'admin' | 'student';
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
}

interface UserList {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  users: UserRow[];
}

const ROLES: UserRow['role'][] = ['teacher', 'head_teacher', 'admin', 'student'];

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function UserAdminPage() {
  const [list, setList] = useState<UserList | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (roleFilter) params.set('role', roleFilter);
      params.set('page', String(page));
      const r = await req<UserList>('GET', `/admin-rbac/users?${params.toString()}`);
      setList(r);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Pull "me" so the UI can disable the demote/deactivate controls
    // for the current admin (the backend rejects them too — this is
    // belt-and-suspenders).
    req<any>('GET', '/auth/me')
      .then((u) => setMe({ id: u.id, role: u.role }))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Administration</h1>
        <div className="text-sm text-gray-500">
          {list ? `${list.total} users` : '…'}
        </div>
      </div>

      <form onSubmit={onSearch} className="flex gap-2 items-end">
        <label className="flex flex-col text-sm">
          <span className="text-xs text-gray-500">Search (email or name)</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border rounded px-2 py-1 w-64"
            placeholder="alice@school.local"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-xs text-gray-500">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">all</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr className="text-left">
              <th className="py-2">Email</th>
              <th className="py-2">Name</th>
              <th className="py-2">Role</th>
              <th className="py-2">Status</th>
              <th className="py-2">Created</th>
              <th className="py-2">Last login</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list?.users.map((u) => (
              <tr
                key={u.id}
                className="border-t hover:bg-gray-50 cursor-pointer"
                onClick={() => setEditing(u)}
              >
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.name}</td>
                <td className="py-2">
                  <span className="badge">{u.role}</span>
                </td>
                <td className="py-2">
                  {u.isActive ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">deactivated</span>
                  )}
                </td>
                <td className="py-2">{fmtDate(u.createdAt)}</td>
                <td className="py-2">{fmtDate(u.lastLogin)}</td>
                <td className="py-2 text-right">
                  <button className="btn btn-ghost text-xs">Edit →</button>
                </td>
              </tr>
            ))}
            {list?.users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list && list.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            className="btn btn-ghost"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <div className="text-gray-500">
            Page {page} of {list.totalPages}
          </div>
          <button
            className="btn btn-ghost"
            disabled={page >= list.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {editing && (
        <UserEditModal
          user={editing}
          isMe={me?.id === editing.id}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function UserEditModal({
  user,
  isMe,
  onClose,
  onSaved,
}: {
  user: UserRow;
  isMe: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRow['role']>(user.role);
  const [isActive, setIsActive] = useState<boolean>(user.isActive);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function saveProfile() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const patch: any = {};
      if (role !== user.role) patch.role = role;
      if (isActive !== user.isActive) patch.isActive = isActive;
      if (Object.keys(patch).length === 0) {
        setInfo('No changes.');
        return;
      }
      await req('PATCH', `/admin-rbac/users/${user.id}`, patch);
      setInfo('Saved.');
      onSaved();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!confirm(`Reset password for ${user.email}? This will sign them out of any future requests.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await req('POST', `/admin-rbac/users/${user.id}/reset-password`, { newPassword });
      // CRITICAL: never echo plaintext to clipboard / DOM after success.
      // The admin already typed it; we just confirm.
      setNewPassword('');
      setInfo('Password reset. Communicate the new password to the user out-of-band.');
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit user</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            ✕
          </button>
        </div>

        <div className="space-y-1 text-sm">
          <div>
            <span className="text-gray-500">Email:</span> {user.email}
          </div>
          <div>
            <span className="text-gray-500">Name:</span> {user.name}
          </div>
        </div>

        {isMe && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
            This is your own account. You cannot demote yourself or
            deactivate your own account (lockout protection). Ask another
            admin to perform those changes.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRow['role'])}
              className="border rounded px-2 py-1 w-full"
            >
              {ROLES.map((r) => {
                // Disable any non-admin role for the acting admin themselves.
                const disabled = isMe && r !== 'admin';
                return (
                  <option key={r} value={r} disabled={disabled}>
                    {r}{disabled ? ' (lockout-protected)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isMe && user.isActive /* can't deactivate self */}
            />
            <label htmlFor="isActive" className="text-sm">
              Active{isMe && user.isActive ? ' (cannot deactivate self)' : ''}
            </label>
          </div>

          <button className="btn btn-primary" disabled={busy} onClick={saveProfile}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>

        <hr />

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Reset password</h3>
          <p className="text-xs text-gray-500">
            New password must be at least 8 characters. The user is not
            notified by email — communicate it out-of-band. We never store
            or log the plaintext.
          </p>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            placeholder="new password"
            autoComplete="new-password"
          />
          <button className="btn btn-secondary" disabled={busy || newPassword.length < 8} onClick={resetPassword}>
            {busy ? 'Working…' : 'Reset password'}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-2">{error}</div>}
        {info && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded p-2">{info}</div>}
      </div>
    </div>
  );
}
