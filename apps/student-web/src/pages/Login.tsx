/**
 * 登录 —— 姓名 + 密码。
 *
 * 姓名与（消歧选中的）studentId **只活在这个组件的 state 里**，
 * 随请求发出去之后就随组件一起消失。**不进 URL、不落盘。**
 *
 * ## ⚠️ 临时：staging 的一键夹具登录（上生产前必须拆）
 *
 * 构建期变量 `VITE_STAGING_FIXTURE_LOGIN` **逐字**等于 `t6_done` 时，
 * 这一屏多一个按钮，点了就以虚构账号「测试六号」进去 —— 免密码。
 *
 * 值不对或没设（**生产与默认构建都属于这一类**）时按钮**根本不存在**：
 * 判定发生在渲染期，产物里连那段 DOM 都不会出现。这里**不存任何口令**，
 * 也不知道任何口令 —— 账号是服务端写死的。
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, type StudentCandidate } from '../lib/api';
import { adoptSession, getState } from '../lib/auth-store';
import { loginErrorText } from '../lib/errors';
import { ROUTES } from '../routes.contract';
import { Button, Card, CandidatePicker, Field, Notice, Screen, Title } from '../ui';

/**
 * 构建期变量表。
 *
 * 真实构建里唯一的来源是 `import.meta.env`。这里额外并上 `process.env`
 * **只是为了测试驱动得动它** —— `vi.stubEnv` 改得动 `process.env`，改不动
 * `import.meta.env`（jsdom 里后者压根没有 VITE_* 键）。浏览器里 `process`
 * 不存在，所以先 `typeof` 探一下；`import.meta.env` 放在后面，真实构建里
 * 它永远压过另一个。
 */
function buildEnv(): Record<string, string | undefined> {
  const meta = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  const proc = typeof process !== 'undefined' && process?.env ? process.env : {};
  return { ...proc, ...meta };
}

/** 这份构建到底开没开夹具登录。只认逐字的 `t6_done`。 */
export function stagingFixtureLoginEnabled(
  env: Record<string, string | undefined> = buildEnv(),
): boolean {
  return env.VITE_STAGING_FIXTURE_LOGIN === 't6_done';
}

export default function LoginPage() {
  const nav = useNavigate();
  const st = getState();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<StudentCandidate[] | null>(null);
  const notice = st.status === 'anonymous' ? st.notice : undefined;

  /**
   * ⚠️ 临时：一键进虚构账号。**不带任何参数** —— 登谁由服务端写死。
   */
  async function fixtureLogin() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.stagingFixtureSession();
      if ('needDisambiguation' in r && r.needDisambiguation) {
        // 这条通道不可能返回消歧（账号是写死的一个）—— 真返回了就是配错了
        setErr('夹具登录返回了意外的结果。');
        return;
      }
      adoptSession(r.token, r.student);
      nav(ROUTES.today, { replace: true });
    } catch {
      // 服务端关掉时是 404 —— 对使用者而言就是「这条通道没开」
      setErr('夹具登录没有开启。');
    } finally {
      setBusy(false);
    }
  }

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
    <Screen center width="narrow">
      <Card>
        <Title>每日英语</Title>
        {/* 报错时只显示错误，别和上一条提示叠在一起（2026-09-05 盲测 P2-16） */}
        {notice && !err ? <Notice kind="info">{notice}</Notice> : null}
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
              numericPin
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            <Button type="submit" disabled={busy}>
              {busy ? '登录中…' : '登录'}
            </Button>
            <p className="text-center text-sm text-slate-500 mt-5">
              <Link to={ROUTES.register} className="text-blue-600 underline">
                第一次使用？注册
              </Link>
            </p>
          </form>
        )}

        {/* ⚠️ 临时：只有 staging 构建才存在。默认构建里这一整段不会渲染。 */}
        {stagingFixtureLoginEnabled() ? (
          <div className="mt-6 border-t border-dashed border-amber-300 pt-4">
            <button
              type="button"
              data-testid="staging-fixture-login"
              disabled={busy}
              onClick={() => void fixtureLogin()}
              className="w-full rounded-xl border border-amber-400 bg-amber-50 text-amber-900 py-3 text-base min-h-[44px] disabled:opacity-60"
            >
              Staging：一键登录测试六号
            </button>
            <p className="mt-2 text-center text-xs text-amber-700">
              临时的 staging 测试通道，上线前会撤掉。
            </p>
          </div>
        ) : null}
      </Card>
    </Screen>
  );
}
