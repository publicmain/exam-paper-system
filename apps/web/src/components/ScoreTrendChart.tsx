import { useMemo } from 'react';
import type { TrendWeek } from '../lib/api-student';

/**
 * Tiny inline SVG line chart for the per-student weekly score trend.
 * Deliberately dependency-free — Recharts/Chart.js would be overkill for
 * a 12-point line and the bundle bloat shows up on student phones. Hand-
 * rolling ~50 lines keeps the page load cheap and the styling matches
 * the rest of the portal.
 *
 * Hidden by the parent when `weeks.length < 2`, so we don't worry about
 * the degenerate 0/1-point case here.
 */

const LEVEL_COLOR: Record<string, string> = {
  ielts_authentic: '#2563eb',    // blue-600
  ielts_simplified: '#7c3aed',   // violet-600
  olevel: '#059669',             // emerald-600
};
const LEVEL_LABEL: Record<string, string> = {
  ielts_authentic: '雅思真题',
  ielts_simplified: '轻雅思',
  olevel: 'O-Level',
};

interface Props {
  data: { weeks: TrendWeek[] };
}

export default function ScoreTrendChart({ data }: Props) {
  const { weeks } = data;
  // Group points by level so each level becomes one polyline.
  const series = useMemo(() => {
    const byLevel = new Map<string, TrendWeek[]>();
    for (const w of weeks) {
      const list = byLevel.get(w.level) ?? [];
      list.push(w);
      byLevel.set(w.level, list);
    }
    // Sort each series chronologically.
    for (const list of byLevel.values()) {
      list.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    }
    return Array.from(byLevel.entries()).map(([level, points]) => ({
      level,
      points,
    }));
  }, [weeks]);

  // Distinct week ticks across all series — used to compute x positions.
  const allWeeks = useMemo(() => {
    const set = new Set<string>();
    for (const w of weeks) set.add(w.weekStart);
    return Array.from(set).sort();
  }, [weeks]);

  const W = 560;
  const H = 180;
  const padL = 36;
  const padR = 10;
  const padT = 14;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xFor = (weekStart: string) => {
    const idx = allWeeks.indexOf(weekStart);
    if (idx < 0 || allWeeks.length <= 1) return padL;
    return padL + (idx / (allWeeks.length - 1)) * plotW;
  };
  const yFor = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return padT + (1 - clamped / 100) * plotH;
  };

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="每周平均得分趋势"
      >
        {/* Y gridlines at 0/25/50/75/100% */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yFor(pct)}
              y2={yFor(pct)}
              stroke="#e5e7eb"
              strokeWidth={1}
              strokeDasharray={pct === 0 || pct === 100 ? undefined : '2 3'}
            />
            <text
              x={padL - 6}
              y={yFor(pct) + 3}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="end"
            >
              {pct}%
            </text>
          </g>
        ))}

        {/* X axis tick labels */}
        {allWeeks.map((ws) => (
          <text
            key={ws}
            x={xFor(ws)}
            y={H - 10}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="middle"
          >
            {ws.slice(5)}
          </text>
        ))}

        {/* Series polylines + dots */}
        {series.map((s) => {
          const color = LEVEL_COLOR[s.level] ?? '#6b7280';
          const pts = s.points
            .map((p) => `${xFor(p.weekStart)},${yFor(p.avgPct)}`)
            .join(' ');
          return (
            <g key={s.level}>
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.map((p) => (
                <circle
                  key={p.weekStart}
                  cx={xFor(p.weekStart)}
                  cy={yFor(p.avgPct)}
                  r={3}
                  fill={color}
                >
                  <title>
                    {p.weekStart} · {LEVEL_LABEL[s.level] ?? s.level} · {Math.round(p.avgPct)}% (n={p.submissionCount})
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.level} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: LEVEL_COLOR[s.level] ?? '#6b7280' }}
            />
            {LEVEL_LABEL[s.level] ?? s.level}
          </span>
        ))}
      </div>
    </div>
  );
}
