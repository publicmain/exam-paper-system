/** 账号设置 —— 改密码、退出。 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { afterPasswordChanged, getState, handleAuthFailure, logout } from '../lib/auth-store';
import { changePasswordErrorText } from '../lib/errors';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Field, Notice, Screen } from '../ui';

export default function AccountPage() {
  const st = getState();
  const who = st.status === 'authenticated' ? st.profile.nickname || st.profile.name : '';
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function change() {
    if (busy) return;
    const token = readToken();
    if (!token) {
      logout();
      return;
    }
    if (!oldPw || !newPw) {
      setErr('两个密码都要填。');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.changePassword(token, { oldPin: oldPw, newPin: newPw });
      // 服务端递增了 studentAuthVersion —— 手里这张票当场作废。
      // 必须清掉并回登录页，否则学生会卡在「要我登录，但我明明登录了」。
      afterPasswordChanged();
    } catch (e) {
      // **顺序有意义。** `invalid_credentials` 在这个端点上意味着
      //「当前密码打错了」，会话是好的；而在 `/student-auth/me` 上同一个码
      // 意味着会话已经死了。同一个错误码、两种含义 —— 只有调用点知道
      // 是哪一种，所以在这里先把它认掉，再交给通用的令牌失效处理。
      //
      // 弄反了的后果：学生改密码时手滑打错一次旧密码，就被直接登出。
      if (e instanceof ApiError && e.body.code === 'invalid_credentials') {
        setErr(changePasswordErrorText(e));
        return;
      }
      if (handleAuthFailure(e)) return;
      setErr(changePasswordErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">账号</h1>
        <p className="text-sm text-slate-500 mb-6">{who}</p>
        {err ? <Notice kind="error">{err}</Notice> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change();
          }}
        >
          <Field label="当前密码" type="password" value={oldPw} onChange={setOldPw} autoComplete="current-password" />
          <Field label="新密码" type="password" value={newPw} onChange={setNewPw} autoComplete="new-password" />
          <Button type="submit" disabled={busy}>
            {busy ? '修改中…' : '修改密码'}
          </Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to={ROUTES.today} className="text-blue-600 underline">
            ← 今天的课
          </Link>
          <button onClick={() => logout()} className="text-slate-500 underline">
            退出登录
          </button>
        </div>
      </Card>
    </Screen>
  );
}
