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
import { loginErrorText, registerErrorText } from '../lib/errors';
import { ROUTES } from '../routes.contract';
import { Button, Card, CandidatePicker, Field, Notice, Screen, Title } from '../ui';
import { Icon } from '../design/Icon';

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
  /**
   * 老师在教师端点了「重置密码」之后，账号的密码被清空：登录会 invalid_credentials，
   * 重新注册会 name_taken_in_class —— 学生自己在页面上出不来（2026-09-08 实测）。
   * 这里补一条设新密码的通道，走 `/student-auth/register`（未设密码的账号才认）。
   */
  const [mode, setMode] = useState<'login' | 'setnew'>('login');
  const [confirmPw, setConfirmPw] = useState('');

  async function setNewPassword(studentId?: string) {
    if (busy) return;
    if (!name.trim() || !password) {
      setErr('姓名和新密码都要填。');
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      setErr('新密码要正好 6 位数字。');
      return;
    }
    if (password !== confirmPw) {
      setErr('两次输入的新密码不一样。');
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
        <div className="mb-6 flex flex-col items-center text-center">
          <span aria-hidden="true" className="mb-3 grid h-14 w-14 place-items-center rounded-[16px] bg-accent-fill text-accent-on">
            <Icon name="words" size={30} />
          </span>
          <Title>每日英语</Title>
          <p className="-mt-4 text-footnote text-ink-3">ESIC · 用自己的姓名和密码登录</p>
        </div>
        {/* 报错时只显示错误，别和上一条提示叠在一起（2026-09-05 盲测 P2-16） */}
        {notice && !err ? <Notice kind="info">{notice}</Notice> : null}
        {err ? <Notice kind="error">{err}</Notice> : null}

        {candidates ? (
          <CandidatePicker
            candidates={candidates}
            onPick={(id) => void (mode === 'setnew' ? setNewPassword(id) : submit(id))}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void (mode === 'setnew' ? setNewPassword() : submit());
            }}
          >
            {mode === 'setnew' ? (
              <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm leading-6 text-ink">
                老师帮你重置密码之后，在这里设一个新的。要是老师没重置过，这一步会提示你直接去登录。
              </p>
            ) : null}
            <Field label="姓名" value={name} onChange={setName} autoComplete="username" />
            <Field
              label={mode === 'setnew' ? '新密码（6 位数字）' : '密码'}
              type="password"
              numericPin
              maxLength={mode === 'setnew' ? 6 : undefined}
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'setnew' ? 'new-password' : 'current-password'}
            />
            {mode === 'setnew' ? (
              <Field
                label="再输一次新密码"
                type="password"
                numericPin
                maxLength={6}
                value={confirmPw}
                onChange={setConfirmPw}
                autoComplete="new-password"
              />
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? (mode === 'setnew' ? '设置中…' : '登录中…') : mode === 'setnew' ? '设新密码并登录' : '登录'}
            </Button>
            {mode === 'login' ? (
              <>
                <p className="mt-4 text-center">
                  <Link to={ROUTES.register} className="inline-flex min-h-[44px] items-center px-2 text-callout font-medium text-accent">
                    第一次使用？注册
                  </Link>
                </p>
                <p className="text-center">
                  <button
                    type="button"
                    data-testid="forgot-password"
                    className="inline-flex min-h-[44px] items-center px-2 text-callout text-accent"
                    onClick={() => {
                      setMode('setnew');
                      setErr(null);
                      setPassword('');
                      setConfirmPw('');
                    }}
                  >
                    忘了密码？先找老师重置，再点这里
                  </button>
                </p>
              </>
            ) : (
              <p className="mt-4 text-center">
                <button
                  type="button"
                  data-testid="back-to-login"
                  className="inline-flex min-h-[44px] items-center px-2 text-callout font-medium text-accent"
                  onClick={() => {
                    setMode('login');
                    setErr(null);
                    setPassword('');
                    setConfirmPw('');
                  }}
                >
                  <Icon name="back" size={20} />回到登录
                </button>
              </p>
            )}
          </form>
        )}

        {/* ⚠️ 临时：只有 staging 构建才存在。默认构建里这一整段不会渲染。 */}
        {stagingFixtureLoginEnabled() ? (
          <div className="mt-6 border-t border-dashed border-warning/35 pt-4">
            <button
              type="button"
              data-testid="staging-fixture-login"
              disabled={busy}
              onClick={() => void fixtureLogin()}
              className="w-full rounded-xl border border-warning bg-warning-soft text-warning py-3 text-base min-h-[44px] disabled:opacity-60"
            >
              Staging：一键登录测试六号
            </button>
            <p className="mt-2 text-center text-xs text-warning">
              临时的 staging 测试通道，上线前会撤掉。
            </p>
          </div>
        ) : null}
      </Card>
    </Screen>
  );
}
