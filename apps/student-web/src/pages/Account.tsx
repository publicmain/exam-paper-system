/**
 * 账号（IOS-09）—— 分组列表：我是谁、学习设置、提醒、密码、退出。
 *
 * 规矩：
 *   · 加载中显示「正在读取」，**不是**「还没选」（审计 IOS-09）。
 *   · 换难度在面板里确认，写清生效范围：已经开始 / 交过的任务按当时的难度保留，
 *     新难度从下一次还没开始的任务起生效。不承诺代码没做到的东西。
 *   · 改密码失败：不清草稿、不登出有效会话；错误显示在面板里。
 *   · 退出要确认，并说清会清掉什么（这台设备上没交的草稿、这台设备上的提醒）。
 */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { afterPasswordChanged, getState, handleAuthFailure, logoutAndRelease } from '../lib/auth-store';
import { writeToken, readToken } from '../lib/identity';
import { changePasswordErrorText, levelChangeErrorText } from '../lib/errors';
import { levelLabel, type PilotLevelId } from '../lib/levels';
import { Field, LevelPicker } from '../ui';
import { PushSettings } from '../push/PushSettings';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Group, Row, RowButton, Section } from '../design/List';
import { Page } from '../design/Page';
import { Spinner } from '../design/Status';
import { useToast } from '../design/Toast';

type LevelState = { s: 'loading' } | { s: 'ready'; level: PilotLevelId | null } | { s: 'error' };

export default function AccountPage() {
  const st = getState();
  const profile = st.status === 'authenticated' ? st.profile : null;
  const who = profile ? profile.nickname || profile.name : '';
  const toast = useToast();

  // ── 难度：`level` 是服务端说的那一档；面板里的 `picked` 只是正在挑的 ──
  const [level, setLevel] = useState<LevelState>({ s: 'loading' });
  const [levelOpen, setLevelOpen] = useState(false);
  const [picked, setPicked] = useState<PilotLevelId | null>(null);
  const [levelBusy, setLevelBusy] = useState(false);
  const [levelErr, setLevelErr] = useState<string | null>(null);

  // ── 密码 ──
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  // ── 退出 ──
  const [outOpen, setOutOpen] = useState(false);
  const [outBusy, setOutBusy] = useState(false);

  const loadGen = useRef(0);
  const loadLevel = () => {
    const token = readToken();
    if (!token) return;
    const mine = ++loadGen.current;
    setLevel({ s: 'loading' });
    void api
      .me(token)
      .then((m) => {
        if (mine !== loadGen.current) return;
        setLevel({ s: 'ready', level: (m.englishLevel ?? null) as PilotLevelId | null });
      })
      .catch((e) => {
        if (mine !== loadGen.current) return;
        if (handleAuthFailure(e)) return;
        setLevel({ s: 'error' });
      });
  };
  useEffect(() => {
    loadLevel();
    return () => {
      loadGen.current += 1;
    };
  }, []);

  const current = level.s === 'ready' ? level.level : null;

  async function confirmLevel() {
    if (levelBusy || !picked || picked === current) return;
    const token = readToken();
    if (!token) return;
    setLevelBusy(true);
    setLevelErr(null);
    try {
      const r = await api.setEnglishLevel(token, picked);
      setLevel({ s: 'ready', level: r.englishLevel });
      setLevelOpen(false);
      toast.show({
        tone: 'success',
        message: `已换成「${levelLabel(r.englishLevel) ?? r.englishLevel}」，从下一次还没开始的任务起生效。`,
      });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setLevelErr(levelChangeErrorText(e));
    } finally {
      setLevelBusy(false);
    }
  }

  async function changePassword() {
    if (pwBusy) return;
    const token = readToken();
    if (!token) return;
    if (!oldPw || !newPw) {
      setPwErr('两个密码都要填。');
      return;
    }
    if (!/^\d{6}$/.test(newPw)) {
      setPwErr('新密码要正好 6 位数字。');
      return;
    }
    setPwBusy(true);
    setPwErr(null);
    try {
      const r = await api.changePassword(token, { oldPin: oldPw, newPin: newPw });
      // 服务端递增了 studentAuthVersion —— 旧票作废，其它设备被登出；本机换上服务端
      // 一并发回的新票，不用重新登录（2026-09-05 盲测 P2-16）。老服务端不发新票时才回登录页。
      if (r.token) {
        writeToken(r.token);
        setOldPw('');
        setNewPw('');
        setPwOpen(false);
        toast.show({ tone: 'success', message: '密码已经改好了。其它设备上需要用新密码重新登录。' });
      } else {
        afterPasswordChanged();
      }
    } catch (e) {
      // **顺序有意义。** 这个端点上的 `invalid_credentials` 意思是「当前密码打错了」，
      // 会话是好的；在 `/me` 上同一个码才意味着会话死了。先在这里认掉，再交给通用处理。
      if (e instanceof ApiError && e.body.code === 'invalid_credentials') {
        setPwErr(changePasswordErrorText(e));
        return;
      }
      if (handleAuthFailure(e)) return;
      setPwErr(changePasswordErrorText(e));
    } finally {
      setPwBusy(false);
    }
  }

  async function logout() {
    setOutBusy(true);
    await logoutAndRelease();
  }

  return (
    <Page title="账号" testId="account-page">
      <Section title="我的信息">
        <Group>
          <Row icon="account" title={<span className="break-words">{who || '—'}</span>} subtitle="学生账号" testId="account-name" />
        </Group>
      </Section>

      <Section
        title="学习设置"
        id="level"
        testId="level-box"
        footer="五档从易到难：O-Level 基础 → 中级 → 标准 → 雅思轻量 → 雅思 · 真题型。"
      >
        <Group>
          <RowButton
            testId="open-level"
            icon="textSize"
            title="英语难度"
            value={
              level.s === 'loading' ? (
                <Spinner label="正在读取" />
              ) : level.s === 'error' ? (
                <span className="text-danger">没读到</span>
              ) : (
                <span data-testid="current-level">{levelLabel(current) ?? '还没选'}</span>
              )
            }
            disabled={level.s !== 'ready'}
            onClick={() => {
              setPicked(current);
              setLevelErr(null);
              setLevelOpen(true);
            }}
          />
        </Group>
        {level.s === 'error' ? (
          <button type="button" onClick={loadLevel} className="mt-2 min-h-[44px] px-1 text-callout font-medium text-accent">
            重新读取难度
          </button>
        ) : null}
      </Section>

      <PushSettings />

      <Section title="安全">
        <Group>
          <RowButton
            testId="open-password"
            icon="lock"
            title="修改密码"
            onClick={() => {
              setPwErr(null);
              setPwOpen(true);
            }}
          />
        </Group>
      </Section>

      <Section>
        <Group>
          <button
            type="button"
            data-testid="logout"
            onClick={() => setOutOpen(true)}
            className="flex min-h-[52px] w-full items-center justify-center px-4 text-body font-medium text-danger hover:bg-danger-soft"
          >
            退出登录
          </button>
        </Group>
      </Section>

      {/* 换难度 */}
      <Dialog
        open={levelOpen}
        onClose={() => setLevelOpen(false)}
        placement="sheet"
        title="英语难度"
        description="从上到下由易到难。"
        busy={levelBusy}
        error={levelErr}
        testId="level-sheet"
        footer={
          <>
            <Button variant="neutral" onClick={() => setLevelOpen(false)} disabled={levelBusy}>
              取消
            </Button>
            <Button
              data-testid="level-confirm"
              disabled={!picked || picked === current}
              busy={levelBusy}
              onClick={() => void confirmLevel()}
            >
              {levelBusy ? '正在更换…' : picked && picked !== current ? `换成「${levelLabel(picked)}」` : '选一档再确认'}
            </Button>
          </>
        }
      >
        <LevelPicker name="account-level" value={picked} onChange={(v) => { setPicked(v); setLevelErr(null); }} disabled={levelBusy} />
        <p className="mb-2 text-footnote text-ink-2">
          已经开始或交过的任务按当时的难度保留，历史成绩不变；新难度从<strong>下一次还没开始的任务</strong>起生效。
        </p>
      </Dialog>

      {/* 改密码 */}
      <Dialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        placement="sheet"
        title="修改密码"
        description="新密码是 6 位数字。改好之后，其它设备需要重新登录。"
        busy={pwBusy}
        error={pwErr}
        testId="password-sheet"
        footer={
          <>
            <Button variant="neutral" onClick={() => setPwOpen(false)} disabled={pwBusy}>
              取消
            </Button>
            <Button type="submit" form="pw-form" busy={pwBusy}>
              {pwBusy ? '正在修改…' : '修改密码'}
            </Button>
          </>
        }
      >
        <form
          id="pw-form"
          onSubmit={(e) => {
            e.preventDefault();
            void changePassword();
          }}
        >
          <Field label="当前密码" type="password" numericPin value={oldPw} onChange={setOldPw} autoComplete="current-password" />
          <Field label="新密码（6 位数字）" type="password" numericPin maxLength={6} value={newPw} onChange={setNewPw} autoComplete="new-password" />
        </form>
      </Dialog>

      {/* 退出 */}
      <Dialog
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title="退出登录？"
        description="这台设备上还没交的阅读草稿会被清掉，这台设备的提醒也会关闭。已经交过的作业和成绩都在服务器上，不受影响。"
        busy={outBusy}
        size="sm"
        testId="logout-dialog"
        footer={
          <>
            <Button variant="neutral" onClick={() => setOutOpen(false)} disabled={outBusy}>
              继续使用
            </Button>
            <Button variant="destructive" busy={outBusy} onClick={() => void logout()} data-testid="logout-confirm">
              {outBusy ? '正在退出…' : '退出登录'}
            </Button>
          </>
        }
      />
    </Page>
  );
}
