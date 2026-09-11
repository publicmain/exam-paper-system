/**
 * 分段控件（IOS-05 手机上的「原文 / 题目」、生词本的视图切换）。
 *
 * 两种语义，按用途选：
 *   · `mode="tabs"`   —— 切换的是下面的内容面板：role=tablist / tab，aria-selected，
 *                        左右方向键在各段之间移动（WAI-ARIA Tabs 模式）。
 *   · `mode="toggle"` —— 只是一个筛选值：一组 aria-pressed 按钮。
 * 选中项用实色面 + 加粗，不只靠颜色区分。整条 ≥ 44px 高。
 */
import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type SegmentOption<T extends string> = { value: T; label: ReactNode; controls?: string; testId?: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  mode = 'toggle',
  label,
  className,
}: {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (v: T) => void;
  mode?: 'tabs' | 'toggle';
  /** 整组的读屏名字 */
  label: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (mode !== 'tabs') return;
    const n = options.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = n - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role={mode === 'tabs' ? 'tablist' : 'group'}
      aria-label={label}
      className={`seg seg-wrap ${className ?? ''}`}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            data-testid={o.testId}
            data-on={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            {...(mode === 'tabs'
              ? { role: 'tab', 'aria-selected': on, 'aria-controls': o.controls, tabIndex: on ? 0 : -1 }
              : { 'aria-pressed': on })}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
