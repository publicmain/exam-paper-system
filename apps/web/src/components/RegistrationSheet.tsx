import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { markRegistered } from '../lib/registration';

/**
 * 全屏注册卡（2026-08-26，docs/PRD/student-registration.md §2.1）。
 *
 * 教师定案：像普通网站注册 —— 密码 + 昵称 + 头像（可选），仅此而已。
 * **没有「稍后再说」**：卡一旦弹出必须完成注册才能继续（也是教师定的）。
 *
 * 头像上传不走任何存储服务：canvas 裁到 128×128 JPEG，data URL 直接
 * 进 User.avatar 文本列 —— 35 人 × ~15KB，为这个引对象存储不值得。
 */

const PRESETS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐧', '🦄', '🐳', '🦉', '🐨', '🐙', '🚀'];

async function fileToAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('图片读不出来'));
      img.src = url;
    });
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    // 居中裁方
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    // 质量往下探，确保 ≤64KB（服务端硬闸 90k 字符）
    for (const q of [0.8, 0.6, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', q);
      if (out.length <= 64_000) return out;
    }
    return canvas.toDataURL('image/jpeg', 0.3);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RegistrationSheet({
  name: initialName,
  studentId: initialStudentId,
  candidates,
  onDone,
}: {
  name: string;
  studentId?: string;
  candidates?: { studentId: string; name: string; classes: string[] }[];
  onDone: (student: { id: string; name: string }) => void;
}) {
  // 同名多人：先选班级
  const [pickedId, setPickedId] = useState(initialStudentId ?? '');
  const [avatar, setAvatar] = useState<string>('emoji:' + PRESETS[0]);
  const [nickname, setNickname] = useState(initialName);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const needPick = (candidates?.length ?? 0) > 1 && !pickedId;

  const submit = async () => {
    if (pw !== pw2) {
      setErr('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r: any = await api.studentRegister({
        name: initialName,
        studentId: pickedId || undefined,
        password: pw,
        nickname: nickname.trim() || undefined,
        avatar,
      });
      if (r.needDisambiguation) {
        setErr('请先选择你的班级');
        setBusy(false);
        return;
      }
      // 成功即登录
      localStorage.setItem('auth_token', r.token);
      try {
        localStorage.setItem('mq:history:name', r.student.name);
        localStorage.setItem('mq:history:studentId', r.student.id);
      } catch { /* ignore */ }
      markRegistered(r.student.id);
      onDone(r.student);
    } catch (e: any) {
      const code = e?.body?.code;
      setErr(
        code === 'password_too_weak' ? '这个密码太好猜了（如 123456），换一个' :
        code === 'password_too_short' ? '密码至少 6 位' :
        code === 'password_too_long' ? '密码最多 32 位' :
        code === 'already_registered' ? '这个名字已经注册过了。是你本人但忘了密码？找老师重置。' :
        code === 'student_not_found' ? '花名册里没有这个名字，请联系老师' :
        code === 'avatar_too_large' ? '图片太大，换一张试试' :
        (e?.message ?? '注册没成功，稍后再试'),
      );
      setBusy(false);
    }
  };

  return (
    <div className="ui-ios fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center px-5 py-8">
        <div className="bg-white rounded-2xl border shadow-sm p-6 max-w-sm w-full">
          <div className="text-lg font-bold text-gray-900">你好，{initialName}</div>
          <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
            完善你的账号 —— 以后在<strong>任何设备</strong>都能登录看成绩、上今天的课。
          </p>

          {needPick && (
            <div className="mt-4">
              <div className="text-[13px] font-semibold text-gray-700 mb-2">你是哪个班的？</div>
              <div className="space-y-2">
                {candidates!.map((c) => (
                  <button
                    key={c.studentId}
                    type="button"
                    onClick={() => setPickedId(c.studentId)}
                    className="w-full border rounded-xl px-4 py-2.5 text-left text-[14px] hover:border-blue-400"
                  >
                    {c.name} <span className="text-gray-400">· {c.classes.join(' / ')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needPick && (
            <>
              {/* 头像（可选） */}
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-gray-700 mb-2">头像（可选）</div>
                <div className="grid grid-cols-6 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAvatar('emoji:' + p)}
                      className={`aspect-square rounded-xl text-xl flex items-center justify-center border-2 ${
                        avatar === 'emoji:' + p ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-100'
                      }`}
                      aria-label={`选择头像 ${p}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-[13px] text-blue-600"
                  >
                    或上传照片
                  </button>
                  {avatar.startsWith('data:') && (
                    <img src={avatar} alt="已上传的头像" className="w-8 h-8 rounded-lg object-cover" />
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setAvatar(await fileToAvatar(f));
                      } catch {
                        setErr('图片处理失败，换一张试试');
                      }
                    }}
                  />
                </div>
              </div>

              {/* 昵称 */}
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-gray-700 mb-1">昵称</div>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* 密码 */}
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-gray-700 mb-1">
                  密码 <span className="font-normal text-gray-400">至少 6 位，字母数字都行</span>
                </div>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value.slice(0, 32))}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value.slice(0, 32))}
                  placeholder="再输一遍"
                  autoComplete="new-password"
                  className="mt-2 w-full border border-gray-300 rounded-xl px-4 py-2.5 text-[15px] focus:border-blue-500 focus:outline-none"
                />
              </div>

              {err && <div className="mt-3 text-[13px] text-rose-600">{err}</div>}

              <button
                type="button"
                disabled={busy || pw.length < 6 || pw2.length < 6}
                onClick={() => void submit()}
                className="press mt-5 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:bg-gray-300"
              >
                {busy ? '注册中…' : '完成注册'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
