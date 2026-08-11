import { useEffect, useState } from 'react';
import { BASE } from '../lib/api';

/**
 * 「我哪类题弱」——早测 2.0。
 *
 * 为什么把「空着没做」和「做错了」分开显示：
 * 全历史诊断显示，同一批学生做同一份卷子，选择型题目空白率只有 6-12%、
 * 得分率 58-67%；一旦要打字（句子填空 / 流程图 / O-Level 短答），空白率
 * 跳到 36-64%、得分率掉到 19-53%。只报一个得分率，会把「不会做」和
 * 「懒得打字」混成一个数字，而这两件事的补救办法完全不同 —— 前者要讲
 * 解题方法，后者只要把答案打进去就能拿分。
 */

type Skill = {
  taskType: string;
  label: string;
  needsTyping: boolean;
  attempted: number;
  pct: number;
  blankPct: number;
  classPct: number | null;
};

function Bar({ pct, cls }: { pct: number; cls: number | null }) {
  return (
    <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${
          pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : pct >= 30 ? 'bg-amber-500' : 'bg-rose-500'
        }`}
        style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
      />
      {/* 班级平均画一条竖线，学生一眼看出自己是不是落后 */}
      {cls !== null && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-gray-700/60"
          style={{ left: `${Math.max(0, Math.min(100, cls))}%` }}
          title={`班级平均 ${cls}%`}
        />
      )}
    </div>
  );
}

export default function SkillProfileCard({
  name,
  studentId,
}: {
  name: string;
  studentId?: string | null;
}) {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    (async () => {
      try {
        const qs =
          '?name=' + encodeURIComponent(name) +
          (studentId ? '&studentId=' + encodeURIComponent(studentId) : '');
        const r = await fetch(`${BASE}/api/morning-quiz/skill-profile${qs}`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && Array.isArray(j?.skills)) setSkills(j.skills);
      } catch { /* 画像拿不到就不显示，绝不影响看成绩 */ }
    })();
    return () => { cancelled = true; };
  }, [name, studentId]);

  if (!skills || skills.length === 0) return null;

  const weakest = skills[0];
  const shown = open ? skills : skills.slice(0, 3);
  // 空着不答占比高的题型，补救方式和"做错"完全不同，单独点名
  const lazyBlank = skills.filter((s) => s.blankPct >= 30);

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="font-semibold text-gray-900">🎯 我的强弱项</h2>
        <span className="text-xs text-gray-400">近 60 天</span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        按题型统计。竖线是班级平均，条形是你自己。
      </p>

      {lazyBlank.length > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <div className="text-sm font-medium text-amber-900">
            先把空着的题写上 —— 这是最快的提分点
          </div>
          <div className="text-xs text-amber-800 mt-1 leading-relaxed">
            {lazyBlank.map((s) => `${s.label}有 ${s.blankPct}% 直接空着`).join('；')}。
            这类题答案就在原文里，写错也比不写强。
          </div>
        </div>
      )}

      <div className="space-y-3">
        {shown.map((s) => (
          <div key={s.taskType}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm text-gray-800">
                {s.label}
                {s.needsTyping && (
                  <span className="ml-1.5 text-[10px] text-gray-400 align-middle">需打字</span>
                )}
              </span>
              <span className="text-sm tabular-nums text-gray-900 font-medium">
                {s.pct}%
                {s.classPct !== null && (
                  <span className={`ml-1.5 text-xs font-normal ${
                    s.pct >= s.classPct ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {s.pct >= s.classPct ? '↑' : '↓'}{Math.abs(Math.round(s.pct - s.classPct))}
                  </span>
                )}
              </span>
            </div>
            <Bar pct={s.pct} cls={s.classPct} />
            <div className="text-[11px] text-gray-400 mt-1">
              做过 {s.attempted} 题
              {s.blankPct > 0 && ` · 其中 ${s.blankPct}% 空着没做`}
            </div>
          </div>
        ))}
      </div>

      {skills.length > 3 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-sm text-blue-600 hover:underline"
        >
          {open ? '收起' : `展开全部 ${skills.length} 类题型`}
        </button>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
        最该练的是 <span className="font-medium text-gray-800">{weakest.label}</span>
        （{weakest.pct}%）。
      </div>
    </section>
  );
}
