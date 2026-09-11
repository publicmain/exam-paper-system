/**
 * 开关（设置页的「上课日提醒」这类即时生效的二元设置）。
 *
 * `role="switch"` + `aria-checked`，读屏念「开 / 关」。视觉 51×31，命中区是整行或 ≥ 44px。
 * 开：主色实底 + 白色圆钮在右；关：填充色底 + 圆钮在左 —— 位置本身就区分状态，不只靠颜色。
 * `busy` 时显示进度，不响应重复点击。
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  busy = false,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 读屏名字 */
  label: string;
  disabled?: boolean;
  busy?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      data-testid={testId}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="grid min-h-[44px] min-w-[56px] shrink-0 place-items-center disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`relative block h-[31px] w-[51px] rounded-full transition-colors ${
          checked ? 'bg-accent-fill' : 'bg-fill-strong'
        } ${disabled && !busy ? 'opacity-70' : ''}`}
      >
        <span
          className={`absolute top-[2px] grid h-[27px] w-[27px] place-items-center rounded-full bg-accent-on shadow-raised transition-[left] ${
            checked ? 'left-[22px]' : 'left-[2px]'
          }`}
        >
          {busy ? <span className="spinner !h-3.5 !w-3.5 !border-2" /> : null}
        </span>
      </span>
    </button>
  );
}
