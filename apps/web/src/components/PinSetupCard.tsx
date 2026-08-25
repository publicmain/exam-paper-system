import { useState } from 'react';
import { api } from '../lib/api';

/**
 * 扫码成功后的「设置 PIN」卡（2026-08-25，docs/PRD/student-auth-and-home.md §6.3）。
 *
 * 出现条件：扫码响应 pinSet=false。此刻 scanToken 已在 localStorage ——
 * 设置 PIN 的信任根正是「人在教室、扫到了码、选中了自己的名字」。
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
        '没存上，稍后可在扫码后重试',
      );
    } finally {
      setBusy(false);
    }
  };

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
