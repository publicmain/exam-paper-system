/** 账号设置 —— 换难度、改密码、退出。 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { getState, handleAuthFailure, logout } from '../lib/auth-store';
import { writeToken } from '../lib/identity';
import { changePasswordErrorText, levelChangeErrorText } from '../lib/errors';
import { readToken } from '../lib/identity';
import { levelLabel, type PilotLevelId } from '../lib/levels';
import { ROUTES } from '../routes.contract';
import { Button, Card, Field, LevelPicker, Notice, Screen } from '../ui';

export default function AccountPage() {
  const st = getState();
  const who = st.status === 'authenticated' ? st.profile.nickname || st.profile.name : '';
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ── 难度 ──
  // `current` 是**服务端说的那一档**，`picked` 是他手上正在挑的那一档。
  // 两者分开，才谈得上「选中不等于提交」——只有确认之后 current 才动。
  const [current, setCurrent] = useState<PilotLevelId | null>(null);
  const [picked, setPicked] = useState<PilotLevelId | null>(null);
  const [levelBusy, setLevelBusy] = useState(false);
  const [levelErr, setLevelErr] = useState<string | null>(null);
  const [levelOk, setLevelOk] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    let alive = true;
    void api
      .me(token)
      .then((m) => {
        if (!alive) return;
        const lv = (m.englishLevel ?? null) as PilotLevelId | null;
        setCurrent(lv);
        setPicked(lv);
      })
      .catch((e) => {
        if (alive) handleAuthFailure(e);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function changeLevel() {
    if (levelBusy || !picked || picked === current) return;
    const token = readToken();
    if (!token) {
      logout();
      return;
    }
    setLevelBusy(true);
    setLevelErr(null);
    setLevelOk(null);
    try {
      const r = await api.setEnglishLevel(token, picked);
      setCurrent(r.englishLevel);
      setLevelOk(`已经换成「${levelLabel(r.englishLevel) ?? r.englishLevel}」了。`);
    } catch (e) {
      // 令牌死了走**统一**的登出，别在这一页上自成一套。
      if (handleAuthFailure(e)) return;
      setLevelErr(levelChangeErrorText(e));
      // 服务端没认，界面上就退回它认的那一档 —— 不让屏幕上留一个假状态。
      setPicked(current);
    } finally {
      setLevelBusy(false);
    }
  }

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
      const r = await api.changePassword(token, { oldPin: oldPw, newPin: newPw });
      // 服务端递增了 studentAuthVersion —— 旧票作废，其它设备被登出；
      // 本机拿服务端一并发回的新票换上，不用重新登录（2026-09-05 盲测 P2-16）。
      // 老服务端不发新票时才回登录页。
      if (r.token) {
        writeToken(r.token);
        setOldPw('');
        setNewPw('');
        setPwOk('密码已经改好了。其它设备上需要用新密码重新登录。');
      } else {
        logout('密码已经改好了 —— 用新密码重新登录一次。');
      }
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

        <section data-testid="level-box" className="mb-8">
          <h2 className="text-base font-medium mb-1">英语难度</h2>
          <p data-testid="current-level" className="text-sm text-slate-600 mb-3">
            现在是：<strong>{levelLabel(current) ?? '还没选'}</strong>
          </p>
          {levelErr ? <Notice kind="error">{levelErr}</Notice> : null}
          {levelOk ? (
            <div role="status" className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm mb-4">
              {levelOk}
            </div>
          ) : null}
          <LevelPicker
            name="account-level"
            value={picked}
            onChange={(v) => {
              setPicked(v);
              setLevelOk(null);
              setLevelErr(null);
            }}
            disabled={levelBusy}
          />
          <Button type="button" disabled={levelBusy || !picked || picked === current} onClick={() => void changeLevel()}>
            {levelBusy ? '正在换…' : '确认换难度'}
          </Button>
          {/* 中文句子不在标点后换行 —— JSX 换行会渲染出多余空格（2026-09-05 盲测 P2-14） */}
          <p className="text-sm text-slate-500 mt-3">
            换了之后，<strong>已经开始的那一天不会中途变</strong>{' '}—— 今天的文章、题目和单词表都按你开始时的那一档走完。新难度从<strong>下一次还没开始的课</strong>起生效。以前的成绩也不会动，历史里看到的还是你当时做的那一份。
          </p>
        </section>

        <section>
          <h2 className="text-base font-medium mb-3">改密码</h2>
          {err ? <Notice kind="error">{err}</Notice> : null}
          {pwOk ? <Notice kind="info">{pwOk}</Notice> : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void change();
            }}
          >
            <Field label="当前密码" type="password" numericPin value={oldPw} onChange={setOldPw} autoComplete="current-password" />
            <Field label="新密码" type="password" numericPin value={newPw} onChange={setNewPw} autoComplete="new-password" />
            <Button type="submit" disabled={busy}>
              {busy ? '修改中…' : '修改密码'}
            </Button>
          </form>
        </section>

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
