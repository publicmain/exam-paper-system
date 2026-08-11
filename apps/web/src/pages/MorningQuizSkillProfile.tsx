import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner, ErrorState } from '../components/AsyncState';

/**
 * 教师端技能诊断 —— 早测 2.0。
 *
 * 回答的是「明天该重讲什么」，而不是「昨天谁考了几分」。
 *
 * 为什么把「空白率」和「得分率」并排：对全历史作答做的诊断显示，
 * 同一批学生、同一份卷子、同一篇文章，只要作答方式从「选一个」变成
 * 「打字」，空白率就从 6-12% 跳到 36-64%、得分率从 58-67% 掉到 19-53%。
 * 一个只有得分率的表会把「不会做」和「没打字」混成同一个红色格子，
 * 而这两件事的处理办法完全不同 —— 前者要重讲解题法，后者要先解决
 * 学生为什么不动手（设备？打字速度？觉得反正会拼错？）。
 */

const LEVEL_LABEL: Record<string, string> = {
  ielts_authentic: '雅思',
  ielts_simplified: '轻雅思',
  olevel: 'O-Level',
};

type Skill = {
  key: string;
  level: string;
  taskType: string;
  label: string;
  needsTyping: boolean;
  attempted: number;
  pct: number;
  blankPct: number;
};

type Resp = {
  windowDays: number;
  skills: Skill[];
  students: Array<{ name: string; cells: Record<string, { pct: number; attempted: number; blankPct: number }> }>;
};

/** 得分率 → 背景色。刻度对齐雅思 6 分线附近的经验值。 */
function tone(pct: number | undefined) {
  if (pct === undefined) return 'bg-gray-50 text-gray-300';
  if (pct >= 70) return 'bg-emerald-100 text-emerald-900';
  if (pct >= 50) return 'bg-sky-100 text-sky-900';
  if (pct >= 30) return 'bg-amber-100 text-amber-900';
  return 'bg-rose-100 text-rose-900';
}

export default function MorningQuizSkillProfile() {
  const { classId } = useParams();
  const [params, setParams] = useSearchParams();
  const days = params.get('days') ?? '30';
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    api.morningQuizClassSkillProfile(classId!, Number(days))
      .then((r: Resp) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, days]);

  if (loading) return <Spinner />;
  if (err) return <ErrorState message={err} />;
  if (!data || data.skills.length === 0) {
    return <div className="p-6 text-gray-500">这个班在所选窗口内还没有足够的作答数据。</div>;
  }

  // 优先重讲：得分率最低的前 5 类。空白率高的单独标出来，因为补救方式不同。
  const priority = data.skills.slice(0, 5);
  const typingProblem = data.skills.filter((s) => s.blankPct >= 30);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">🎯 技能诊断</h1>
          <p className="text-sm text-gray-500 mt-1">
            按题型看这个班哪里失分 · 近 {data.windowDays} 天
          </p>
        </div>
        <div className="flex gap-1">
          {['14', '30', '90'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { params.set('days', d); setParams(params, { replace: true }); }}
              className={`px-3 py-1.5 rounded-lg text-sm border ${
                days === d ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {d} 天
            </button>
          ))}
        </div>
      </header>

      {typingProblem.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">这些题不是做错，是根本没写</h2>
          <p className="text-sm text-amber-800 mt-1 mb-3">
            空白率 30% 以上的题型。重讲解题方法对这些没用 —— 先弄清楚学生为什么不动手。
          </p>
          <div className="space-y-1.5">
            {typingProblem.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-amber-900">
                  {LEVEL_LABEL[s.level] ?? s.level} · {s.label}
                </span>
                <span className="tabular-nums text-amber-900 font-medium">
                  {s.blankPct}% 空白 <span className="font-normal text-amber-700">（得分率 {s.pct}%）</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-gray-900 mb-3">优先重讲</h2>
        <div className="space-y-2">
          {priority.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <span className="w-6 text-center text-sm font-semibold text-gray-400">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {s.label}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {LEVEL_LABEL[s.level] ?? s.level}
                  </span>
                  {s.needsTyping && (
                    <span className="ml-1.5 text-[10px] text-gray-400">需打字</span>
                  )}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full ${s.pct >= 50 ? 'bg-sky-500' : s.pct >= 30 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.max(2, Math.min(100, s.pct))}%` }}
                  />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold tabular-nums text-gray-900">{s.pct}%</div>
                <div className="text-[11px] text-gray-400 tabular-nums">{s.attempted} 题次</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-1">学生 × 题型</h2>
        <p className="text-xs text-gray-500 mb-3">
          格子里是得分率；做过不足 3 题的组合留空，避免用一两题下结论。
        </p>
        {/* 宽表在窄屏必须自己横向滚动，不能让整页横滚 */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 bg-gray-50 text-left font-medium text-gray-600 px-3 py-2 whitespace-nowrap">
                  学生
                </th>
                {data.skills.map((s) => (
                  <th key={s.key} className="px-2 py-2 font-medium text-gray-600 whitespace-nowrap text-xs">
                    {s.label}
                    <div className="font-normal text-gray-400">{LEVEL_LABEL[s.level] ?? s.level}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((st) => (
                <tr key={st.name} className="border-t border-gray-100">
                  <td className="sticky left-0 bg-white px-3 py-2 whitespace-nowrap text-gray-900">
                    {st.name}
                  </td>
                  {data.skills.map((s) => {
                    const c = st.cells[s.key];
                    return (
                      <td key={s.key} className="px-2 py-2 text-center">
                        <span className={`inline-block min-w-[3rem] rounded px-1.5 py-1 tabular-nums text-xs ${tone(c?.pct)}`}>
                          {c ? `${c.pct}%` : '—'}
                        </span>
                        {c && c.blankPct >= 50 && (
                          <div className="text-[10px] text-rose-500 mt-0.5">空 {c.blankPct}%</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
