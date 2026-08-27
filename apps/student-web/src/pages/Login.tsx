/**
 * 登录 —— 姓名 + 密码。
 *
 * 姓名与（消歧选中的）studentId **只活在这个组件的 state 里**，
 * 随请求发出去之后就随组件一起消失。**不进 URL、不落盘。**
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type StudentCandidate } from '../lib/api';
import { adoptSession, getState } from '../lib/auth-store';
import { loginErrorText } from '../lib/errors';
import { ROUTES } from '../routes.contract';
import { Button, Card, CandidatePicker, Field, Notice, Screen, Title } from '../ui';

export default function LoginPage() {
  const nav = useNavigate();
  const st = getState();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StudentCandidate[] | null>(null);
  const notice = st.status === 'anonymous' ? st.notice : undefined;

  async function submit(studentId?: string) {
    if (busy) return;
    if (!name.trim() || !password) {
      setErr('姓名和密码都要填。');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.login({ name: name.trim(), studentId, pin: password });
      if ('needDisambiguation' in r && r.needDisambiguation) {
        setCandidates(r.candidates);
        return;
      }
      // 服务端还会带 appVersion / studentAppOrigin —— **阶段 4A 不据此跳转**，
      // 新端只是知道有这么回事。灰度真正生效在阶段 15。
      adoptSession(r.token, r.student);
      nav(ROUTES.today, { replace: true });
    } catch (e) {
      setErr(loginErrorText(e));
      setCandidates(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Title>每日英语</Title>
        {notice ? <Notice kind="info">{notice}</Notice> : null}
        {err ? <Notice kind="error">{err}</Notice> : null}

        {candidates ? (
          <CandidatePicker candidates={candidates} onPick={(id) => void submit(id)} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="姓名" value={name} onChange={setName} autoComplete="username" />
            <Field
              label="密码"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <Button type="submit" disabled={busy}>
              {busy ? '登录中…' : '登录'}
            </Button>
            <p className="text-center text-sm text-slate-500 mt-5">
              <Link to={ROUTES.register} className="text-blue-600 underline">
                还没注册？
              </Link>
            </p>
          </form>
        )}
      </Card>
    </Screen>
  );
}
