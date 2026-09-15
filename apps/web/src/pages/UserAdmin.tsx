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
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">User Administration</h1>
          <button type="button" className="btn btn-primary" data-testid="open-create-user" onClick={() => setCreating(true)}>
            新建账号
          </button>
          {notice && (
            <span data-testid="create-user-notice" className="text-sm text-green-700">
              {notice}
            </span>
          )}
        </div>
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

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={async (email, role) => {
            setCreating(false);
            setNotice(`已建好 ${email}（${ROLE_LABELS[role] ?? role}）。把登录邮箱和初始密码当面告诉对方。`);
            await refresh();
          }}
        />
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

const ROLE_LABELS: Record<string, string> = { teacher: '老师', head_teacher: '班主任', admin: '管理员' };

/**
 * 新建教职工账号（2026-09-15）—— 给学校领导、新来的老师开后台账号。
 *
 * 学生在学生端自助注册，这里只建老师 / 班主任 / 管理员。密码只随这一次请求发给服务端，
 * 提交后就从页面上清掉；建好后请当面告诉对方。服务端再核一遍所有规则（admin-rbac.service#createUser）。
 */
function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string, role: string) => void | Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'head_teacher' | 'admin'>('teacher');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !name.trim()) {
      setErr('邮箱和姓名都要填。');
      return;
    }
    if (password.length < 8) {
      setErr('初始密码至少 8 位。');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await req('POST', '/admin-rbac/users', { email: cleanEmail, name: name.trim(), role, password });
      setPassword('');
      await onCreated(cleanEmail, role);
    } catch (e2: any) {
      const text = String(e2?.message ?? e2);
      setErr(text.includes('email_taken') ? '这个邮箱已经有账号了，换一个或直接在列表里改那个账号的角色。' : `没建成：${text}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-lg bg-white p-5 shadow-xl" data-testid="create-user-form">
        <h2 id="create-user-title" className="text-lg font-semibold">
          新建教职工账号
        </h2>
        <p className="text-xs text-gray-500">学生自己在学生端注册，不从这里建。管理员能看、能改全校所有数据，只给确实需要的人。</p>
        <label className="flex flex-col gap-1 text-sm">
          登录邮箱
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border px-2 py-1.5" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          姓名
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-2 py-1.5" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          角色
          <select value={role} onChange={(e) => setRole(e.target.value as 'teacher' | 'head_teacher' | 'admin')} className="rounded border px-2 py-1.5">
            <option value="teacher">老师 —— 只看自己任教的班</option>
            <option value="head_teacher">班主任 —— 看全校的班，不能管账号</option>
            <option value="admin">管理员 —— 全部权限，含账号管理</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          初始密码（至少 8 位）
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded border px-2 py-1.5" autoComplete="new-password" />
        </label>
        {err && (
          <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy} data-testid="create-user-submit">
            {busy ? '正在建…' : '建账号'}
          </button>
        </div>
      </form>
    </div>
  );
}
