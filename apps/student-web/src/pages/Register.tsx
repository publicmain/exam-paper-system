/**
 * 第一次使用 —— **自己注册**：班级码 + 姓名 + 自设 PIN + 自选难度。
 *
 * ## 和上一版的区别
 *
 * 上一版只有「姓名 + 密码」，走的是 `/student-auth/register` ——
 * 那条路**认领**教师已经建好的一行，所以老师得先把每个人建出来、
 * 还得替他把难度设好。试点要请真人进来，这个前提站不住。
 *
 * 现在走 `/student-auth/self-register`：真的建号、真的入班、难度由学生
 * 自己挑。仍然不是公开注册 —— 没有班级码就进不来。
 *
 * ## 两次密码只发一次
 *
 * 确认框**只在客户端比对**。两次都发给服务端不会更安全（服务端拿它做
 * 不了任何新判断），却会让 PIN 在网络与日志里多出现一次。
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { adoptSession } from '../lib/auth-store';
import { selfRegisterErrorText } from '../lib/errors';
import type { PilotLevelId } from '../lib/levels';
import { ROUTES } from '../routes.contract';
import { Button, Card, Field, LevelPicker, Notice, Screen, Title } from '../ui';

/** 与服务端 `validatePinFormat` 的第一道闸同口径：6 位纯数字。 */
const SIX_DIGITS = /^\d{6}$/;

export default function RegisterPage() {
  const nav = useNavigate();
  const [classCode, setClassCode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [level, setLevel] = useState<PilotLevelId | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** 本地能判的先在本地判掉 —— 每一条都指向具体是哪一栏错了。 */
  function localError(): string | null {
    if (!classCode.trim()) return '请填班级码 —— 老师会把它发给你。';
    if (!name.trim()) return '请填你的姓名。';
    if (!SIX_DIGITS.test(pin)) return '密码要正好 6 位数字。';
    if (pin !== pin2) return '两次输入的密码不一样 —— 再确认一下。';
    if (!level) return '请挑一档难度 —— 拿不准就选第一档，之后能在账号设置里改。';
    return null;
  }

  async function submit() {
    // 双击、手抖连点、弱网重发都会走到这里 —— 第一发还没回来就一律不发。
    if (busy) return;
    const bad = localError();
    if (bad) {
      setErr(bad);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await api.selfRegister({
        classCode: classCode.trim(),
        name: name.trim(),
        pin,
        englishLevel: level!,
      });
      adoptSession(r.token, r.student);
      nav(ROUTES.today, { replace: true });
    } catch (e) {
      setErr(selfRegisterErrorText(e));
    } finally {
      // 失败之后按钮必须能再按 —— 卡在「注册中」比报错更糟。
      setBusy(false);
    }
  }

  return (
    <Screen center width="narrow">
      <Card>
        <Title>第一次使用</Title>
        {err ? <Notice kind="error">{err}</Notice> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-sm text-slate-600 mb-4">
            班级码是老师发给你的一串字母数字，用来确认你是被邀请的人。
            姓名和密码都由你自己定 —— 密码别告诉别人。
          </p>
          <Field label="班级码" value={classCode} onChange={setClassCode} autoComplete="off" />
          <Field label="姓名" value={name} onChange={setName} autoComplete="name" />
          <Field
            label="设置 6 位数字密码"
            type="password"
            value={pin}
            onChange={setPin}
            autoComplete="new-password"
          />
          <Field
            label="再输一次"
            type="password"
            value={pin2}
            onChange={setPin2}
            autoComplete="new-password"
          />
          <p className="text-sm text-slate-600 mb-2">挑一档你想上的难度：</p>
          <LevelPicker name="register-level" value={level} onChange={setLevel} disabled={busy} />
          <Button type="submit" disabled={busy}>
            {busy ? '注册中…' : '注册并进入'}
          </Button>
          <p className="text-center text-sm text-slate-500 mt-5">
            <Link to={ROUTES.login} className="text-blue-600 underline">
              已经注册过了，去登录
            </Link>
          </p>
        </form>
      </Card>
    </Screen>
  );
}
