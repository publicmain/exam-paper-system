/**
 * 首次注册 —— 设密码即注册即登录。
 *
 * **触发条件与旧端不同**：旧端是「本机已知姓名 + 服务端说未注册 →
 * 弹全屏卡、不可跳过」，靠的是 `mq:history:name`。新端**不读那个键**，
 * 入口就是登录页上的「还没注册？」。
 *
 * 端点本身是 `@Public()` 的、以姓名为先 —— 不需要扫码令牌、不需要任何
 * 学生令牌。
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type StudentCandidate } from '../lib/api';
import { adoptSession } from '../lib/auth-store';
import { registerErrorText } from '../lib/errors';
import { ROUTES } from '../routes.contract';
import { Button, Card, CandidatePicker, Field, Notice, Screen, Title } from '../ui';

export default function RegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StudentCandidate[] | null>(null);

  async function submit(studentId?: string) {
    if (busy) return;
    if (!name.trim() || !password) {
      setErr('姓名和密码都要填。');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.register({ name: name.trim(), studentId, password });
      if ('needDisambiguation' in r && r.needDisambiguation) {
        setCandidates(r.candidates);
        return;
      }
      adoptSession(r.token, r.student);
      nav(ROUTES.today, { replace: true });
    } catch (e) {
      setErr(registerErrorText(e));
      setCandidates(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen center width="narrow">
      <Card>
        <Title>第一次使用</Title>
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
            <p className="text-sm text-slate-600 mb-4">
              用花名册上的姓名，给自己设一个密码。设好就直接进去了。
            </p>
            <Field label="姓名" value={name} onChange={setName} autoComplete="username" />
            <Field
              label="设置密码"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={busy}>
              {busy ? '注册中…' : '注册并进入'}
            </Button>
            <p className="text-center text-sm text-slate-500 mt-5">
              <Link to={ROUTES.login} className="text-blue-600 underline">
                已经注册过了，去登录
              </Link>
            </p>
          </form>
        )}
      </Card>
    </Screen>
  );
}
