import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * 扫码成功后的「设置 PIN」卡（2026-08-25，docs/PRD/student-auth-and-home.md §6.3）。
 *
 * 出现条件：扫码响应 pinSet=false **且认领窗口开着**。
 *
 * ## 为什么要看窗口
 *
 * 「扫到码 + 点自己的名字」只证明拿到了二维码，不证明是本人 —— 同班
 * 任何人都能抢先给别人设 PIN。所以认领改成教师在课堂上开的短窗：全班
 * 当场注册、当场就能发现「我的名字被人领了」，窗口一关谁也动不了。
 *
 * 窗口关着时本卡**直接跳过**（而不是显示一个按了会报错的表单）——
 * 平时扫码答题的学生根本不该看到它。
 *
 * **可跳过，绝不挡答题**：迟到学生每一秒都是答题时间。跳过不记
 * localStorage —— 下次扫码还会再提，直到设置（判据在服务端）。
 */
export default function PinSetupCard({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // null = 还在问服务端；false = 窗口关着（本卡不该出现）
  const [windowOpen, setWindowOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const w = await api.studentClaimWindow();
        if (!alive) return;
        setWindowOpen(w.open);
        // 窗口没开就别占着屏幕 —— 学生要的是赶紧进卷子
        if (!w.open) onDone();
      } catch {
        // 问不到就当没开，放行去答题。宁可少提示一次，不能挡住答题。
        if (alive) {
          setWindowOpen(false);
          onDone();
        }
      }
    })();
    return () => {
      alive = false;
    };
    // onDone 是父组件每次渲染新建的函数，放进依赖会让这个副作用反复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (pin !== confirm) {
      setErr('两次输入不一致');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.studentSetPin({ pin });
      setSaved(true);
      setTimeout(onDone, 900);
    } catch (e: any) {
      const code = e?.body?.code;
      setErr(
        code === 'pin_too_weak' ? '这个 PIN 太好猜了（如 123456），换一个' :
        code === 'pin_must_be_6_digits' ? 'PIN 必须是 6 位数字' :
        code === 'pin_already_set' ? '已经设置过了 —— 在个人主页可以修改' :
        // 边打字边到点了。让学生找老师，而不是原地重试
        code === 'claim_window_closed' ? '注册时间已结束 —— 请老师给你单独开一次' :
        '没存上，稍后可在扫码后重试',
      );
    } finally {
      setBusy(false);
    }
  };

  // 还在问窗口 / 窗口关着：不渲染任何东西。上面的 effect 已经 onDone()，
  // 这里画一半再消失只会闪一下。
  if (windowOpen !== true && !saved) return null;

  return (
    <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5">
      <div className="bg-white rounded-2xl border shadow-sm p-6 max-w-sm w-full text-center enter">
        {saved ? (
          <>
            <div className="text-4xl mb-2">✅</div>
            <div className="text-lg font-bold text-gray-900">PIN 已设置</div>
            <p className="text-sm text-gray-500 mt-1">以后打开「我的主页」就能登录</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-2">🔑</div>
            <div className="text-lg font-bold text-gray-900">设置一个 6 位 PIN</div>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
              以后在<strong>家里、任何设备</strong>都能登录看成绩、背单词。
              只需要设一次。
            </p>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 位数字"
              autoComplete="new-password"
              className="mt-4 w-full border border-gray-300 rounded-xl px-4 py-3 text-lg tracking-[0.4em] text-center focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="再输一遍"
              autoComplete="new-password"
              className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-3 text-lg tracking-[0.4em] text-center focus:border-blue-500 focus:outline-none"
            />
            {err && <div className="mt-2 text-[13px] text-rose-600">{err}</div>}
            <button
              type="button"
              disabled={busy || pin.length !== 6 || confirm.length !== 6}
              onClick={() => void submit()}
              className="press mt-4 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:bg-gray-300"
            >
              {busy ? '保存中…' : '确认设置'}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="mt-2 w-full py-2 text-[14px] text-gray-400"
            >
              先答题，下次再说
            </button>
          </>
        )}
      </div>
    </div>
  );
}
