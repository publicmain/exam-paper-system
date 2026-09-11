/**
 * 学生端图标（IOS-01）。
 *
 * 全部是本项目自绘的 24×24 线性图标（没有复制任何第三方图标集的路径），可以随代码
 * 自由使用。统一线宽、圆角端点，颜色跟随文字（currentColor），深浅色自动适应。
 *
 * 无障碍：默认 `aria-hidden` —— 图标旁边总有文字。纯图标按钮必须由按钮本身给
 * `aria-label`；只有图标自己承担含义时才传 `label`，它会变成 role="img"。
 * 不用 emoji / 随意 Unicode 拼导航（审计 IOS-01）。
 */
import type { ReactElement } from 'react';

type Shape = ReactElement | ReactElement[];

const dot = (cx: number, cy: number, r = 1.15) => <circle key={`d${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity={1} stroke="none" />;
const p = (d: string, k?: string) => <path key={k ?? d} d={d} />;
const c = (cx: number, cy: number, r: number) => <circle key={`c${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />;

const SHAPES = {
  today: [
    p('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z'),
    p('M4 9.5h16'),
    p('M8.5 2.5v3'),
    p('M15.5 2.5v3'),
    dot(12, 14.5, 1.5),
  ],
  words: [p('M12 6.5C10.3 5.2 8 4.5 4.5 4.5v13c3.5 0 5.8.7 7.5 2 1.7-1.3 4-2 7.5-2v-13c-3.5 0-5.8.7-7.5 2z'), p('M12 6.5v13')],
  records: [p('M3.5 20.5h17'), p('M6 17v-5'), p('M10.5 17V7'), p('M15 17v-7.5'), p('M19.5 17V5')],
  account: [c(12, 8.5, 3.6), p('M4.8 19.8c1.3-3.3 4-5.3 7.2-5.3s5.9 2 7.2 5.3')],
  back: p('M14.5 5.5 8 12l6.5 6.5'),
  forward: p('M9.5 5.5 16 12l-6.5 6.5'),
  down: p('M5.5 9.5 12 16l6.5-6.5'),
  up: p('M5.5 14.5 12 8l6.5 6.5'),
  close: [p('M6.5 6.5l11 11'), p('M17.5 6.5l-11 11')],
  check: p('M5 12.5l4.5 4.5L19 7.5'),
  checkCircle: [c(12, 12, 9), p('M8 12.3l2.8 2.8 5.4-5.6')],
  alert: [p('M10.3 4.9 3.4 17a2 2 0 0 0 1.7 3h13.8a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0z'), p('M12 9.5v4.2'), dot(12, 16.9)],
  info: [c(12, 12, 9), p('M12 11v5.5'), dot(12, 7.9)],
  refresh: [p('M19.5 12a7.5 7.5 0 1 1-2.2-5.3'), p('M19.5 4.5v4h-4')],
  speaker: [p('M4.5 9.5h3l4.5-4v13l-4.5-4h-3z'), p('M15.5 9a4 4 0 0 1 0 6'), p('M18 6.5a7.5 7.5 0 0 1 0 11')],
  search: [c(10.5, 10.5, 6), p('M15 15l5 5')],
  filter: [p('M4 7h8.5'), p('M17.5 7H20'), c(15, 7, 2.2), p('M4 17h2.5'), p('M11.5 17H20'), c(9, 17, 2.2)],
  plus: [p('M12 5v14'), p('M5 12h14')],
  minus: p('M5 12h14'),
  clock: [c(12, 12, 9), p('M12 7.5V12l3 2')],
  calendar: [
    p('M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z'),
    p('M4 9.5h16'),
    p('M8.5 2.5v3'),
    p('M15.5 2.5v3'),
  ],
  flag: [p('M5.5 21V4'), p('M5.5 4.5h11l-2.2 4 2.2 4h-11')],
  trash: [p('M4.5 6.5h15'), p('M9.5 6.5v-2h5v2'), p('M6.5 6.5l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3l.9-12.2')],
  undo: [p('M8.5 5 4 9.5 8.5 14'), p('M4 9.5h10a5.5 5.5 0 0 1 0 11H9')],
  lock: [p('M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z'), p('M8.5 11V8a3.5 3.5 0 0 1 7 0v3')],
  bell: [p('M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z'), p('M10 20.5a2 2 0 0 0 4 0')],
  bellOff: [p('M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z'), p('M10 20.5a2 2 0 0 0 4 0'), p('M4 4l16 16')],
  logout: [p('M14 4.5H6.5v15H14'), p('M10.5 12H20'), p('M16.5 8.5 20 12l-3.5 3.5')],
  offline: [
    p('M3 8.6a13 13 0 0 1 4.2-2.4'),
    p('M10.4 5.6A13 13 0 0 1 21 8.6'),
    p('M6.2 12a8 8 0 0 1 2.7-1.6'),
    p('M13.6 10.4a8 8 0 0 1 4.2 1.6'),
    p('M9.2 15.3a4 4 0 0 1 5.6 0'),
    dot(12, 18.8),
    p('M4 4l16 16'),
  ],
  reading: [p('M6.5 3.5h7l4 4v13h-11z'), p('M13.5 3.5v4h4'), p('M9 12h6'), p('M9 15.5h6')],
  eye: [p('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z'), c(12, 12, 2.8)],
  eyeOff: [p('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z'), c(12, 12, 2.8), p('M4 4l16 16')],
  pause: [p('M9 6v12'), p('M15 6v12')],
  arrowRight: [p('M5 12h14'), p('M13 6l6 6-6 6')],
  textSize: [p('M3.5 18 8 6l4.5 12'), p('M5 14h6'), p('M14.5 18l2.7-7 2.7 7'), p('M15.4 16h3.6')],
  note: [p('M5 4.5h14v9.5L13.5 19.5H5z'), p('M13.5 19.5V14H19')],
  list: [p('M9 6.5h11'), p('M9 12h11'), p('M9 17.5h11'), dot(4.8, 6.5), dot(4.8, 12), dot(4.8, 17.5)],
  split: [p('M4 5.5h16v13H4z'), p('M12 5.5v13')],
  bookmark: p('M7 4.5h10v15.5l-5-3.5-5 3.5z'),
  sparkle: [p('M12 3.5l1.9 5.2 5.1 1.8-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.8z')],
  pencil: [p('M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.7 18.5z'), p('M13.8 7l3.2 3.2')],
  shuffle: [p('M4 7.5h3.5c4.5 0 4.5 9 9 9H20'), p('M4 16.5h3.5c1.7 0 2.7-1.3 3.4-3'), p('M13.1 10.5c.7-1.7 1.7-3 3.4-3H20'), p('M17.5 5 20 7.5 17.5 10'), p('M17.5 14 20 16.5 17.5 19')],
} satisfies Record<string, Shape>;

export type IconName = keyof typeof SHAPES;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  label,
  className,
  filled = false,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** 选中态：闭合形状内填一层淡色（HIG · Tab bars 建议选中用填充图标）。 */
  filled?: boolean;
  /** 只有图标自己承担含义时才给；有旁白文字时别给。 */
  label?: string;
  className?: string;
}) {
  const shape = SHAPES[name] as Shape;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      fillOpacity={filled ? 0.16 : undefined}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `shrink-0 ${className}` : 'shrink-0'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: false })}
    >
      {shape}
    </svg>
  );
}
