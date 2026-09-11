/**
 * 老页面共用的基础件 —— 2026-09-11 起全部落在 `design/` 的设计系统上。
 *
 * 导出名与参数保持不变（各页 `import … from '../ui'` 不用改），外观换成新的
 * token：实色内容面、不模糊不叠阴影、主色对比 ≥ 4.5:1、命中区 ≥ 44px。
 * 新页面直接用 `design/` 里的 Page / FocusLayout / Button / Dialog / Status。
 */
import { useId } from 'react';
import type { ReactNode } from 'react';
import { PILOT_LEVEL_CHOICES, type PilotLevelId } from './lib/levels';
import { Button as DsButton } from './design/Button';
import { BackButton } from './design/Page';
import { InlineStatus, StatusView } from './design/Status';

/** 正文最大宽度。`narrow` 是登录这类单卡页面，其余跟着屏幕放宽。 */
const WIDTH = {
  wide: 'max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl',
  narrow: 'max-w-md',
} as const;

export function Screen({
  children,
  center = false,
  width = 'wide',
}: {
  children: ReactNode;
  /** 垂直居中（登录 / 注册 / 空状态这类只有一张卡的页面） */
  center?: boolean;
  width?: keyof typeof WIDTH;
}) {
  return (
    <main
      id="main"
      className={`safe-x mx-auto flex w-full ${WIDTH[width]} min-h-[100dvh] flex-col py-5 sm:py-8 safe-top safe-bottom text-ink${
        center ? ' justify-center' : ''
      }`}
    >
      {children}
    </main>
  );
}

/**
 * 顶部返回条。常用的出口必须在顶部够得着（S12L）。
 */
export function TopBar({
  title,
  onBack,
  backLabel = '返回',
  right,
}: {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex min-h-[44px] items-center gap-2">
      {onBack ? (
        <div className="-ml-2">
          <BackButton label={backLabel} onClick={onBack} />
        </div>
      ) : null}
      {title ? <h1 className="truncate text-title3 text-ink">{title}</h1> : null}
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

/**
 * 「这个功能暂时不开放」。明说三件事：为什么进不来、你的东西还在、它不影响今天的完成度。
 */
export function Unavailable({
  title,
  note,
  actions,
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Screen center width="narrow">
      <Card>
        <StatusView
          kind="paused"
          compact
          title={<span data-testid="unavailable-title">{title}</span>}
          message={note}
          secondary={actions ? <div className="flex flex-col gap-2">{actions}</div> : undefined}
        />
      </Card>
    </Screen>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-group bg-surface p-5 sm:p-7">{children}</div>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-center text-title2 text-ink">{children}</h1>;
}

export function Field(props: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  /**
   * 数字密码：手机上先弹数字键盘（2026-09-05 盲测 P2-18）。只是键盘提示，
   * 不过滤字符 —— 旧账号的密码允许字母，登录时不能把它们吃掉。
   */
  numericPin?: boolean;
  maxLength?: number;
  /** 输入框下方的说明 / 就地错误 */
  hint?: ReactNode;
  invalid?: boolean;
}) {
  // label 与输入框显式关联，读屏能报出「姓名」「密码」（2026-09-06 第五轮盲测 21）
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-callout font-medium text-ink-2">
        {props.label}
      </label>
      <input
        id={id}
        className={`w-full min-h-[50px] rounded-control border bg-surface px-4 py-3 text-body text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/15 ${
          props.invalid ? 'border-danger' : 'border-control'
        }`}
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete={props.autoComplete}
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.hint ? hintId : undefined}
        {...(props.numericPin ? { inputMode: 'numeric' as const } : {})}
        {...(props.maxLength ? { maxLength: props.maxLength } : {})}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint ? (
        <div id={hintId} className={`mt-1.5 text-footnote ${props.invalid ? 'text-danger' : 'text-ink-3'}`}>
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

export function Button(props: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; busy?: boolean }) {
  return (
    <DsButton block type={props.type} disabled={props.disabled} busy={props.busy} onClick={props.onClick}>
      {props.children}
    </DsButton>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  return (
    <div className="mb-4">
      <InlineStatus tone={kind === 'error' ? 'error' : 'info'} role="alert">
        {children}
      </InlineStatus>
    </div>
  );
}

/** 同名消歧。选中的 studentId **只活在这一次请求里** —— 不进 URL、不落盘。 */
export function CandidatePicker(props: {
  candidates: { studentId: string; name: string; classes?: string[] }[];
  onPick: (studentId: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-callout text-ink-2">有几位同学同名 —— 哪一个是你？</p>
      <div className="list-inset overflow-hidden rounded-group border border-line bg-surface">
        {props.candidates.map((c) => (
          <button
            key={c.studentId}
            type="button"
            onClick={() => props.onPick(c.studentId)}
            className="flex min-h-[52px] w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-2"
          >
            <span className="font-medium text-ink">{c.name}</span>
            {c.classes?.length ? (
              <>
                <span aria-hidden className="text-ink-4">
                  ·
                </span>
                <span className="text-footnote text-ink-3">{c.classes.join(' · ')}</span>
              </>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 五档难度的选择器 —— 注册页和账号页共用同一个。
 *
 * 用**原生 radio**：键盘上下键、读屏「五选一，当前第几个」、「必须显式选一个」原生就有。
 * 每一档带一句「这一档是给谁的」；标签是中文，内部 id 只出现在 `value` 里。
 * 选中态同时用边框、底色和对勾表示，不只靠颜色。
 */
export function LevelPicker(props: {
  name: string;
  value: PilotLevelId | null;
  onChange: (v: PilotLevelId) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="英语难度" className="mb-4 flex flex-col gap-2">
      {PILOT_LEVEL_CHOICES.map((c) => {
        const on = props.value === c.id;
        return (
          <label
            key={c.id}
            className={`flex min-h-[62px] cursor-pointer gap-3 rounded-control border px-4 py-3 transition-colors ${
              on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2'
            } ${props.disabled ? 'cursor-not-allowed' : ''}`}
          >
            {/*
              `aria-label` 是显式的，不靠外面那层 <label> 的文字：包住的 label 里既有档名又有
              整句说明，读屏会连成一长串；不加时有些辅助树会退回用 `value` 报名字 —— 那正是
              学生不该听到的内部标识。
            */}
            <input
              type="radio"
              name={props.name}
              value={c.id}
              aria-label={c.label}
              aria-describedby={`${props.name}-${c.id}-blurb`}
              checked={on}
              disabled={props.disabled}
              onChange={() => props.onChange(c.id)}
              className="mt-1 h-5 w-5 shrink-0 accent-accent"
            />
            <span>
              <span className={`block ${on ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>{c.label}</span>
              <span id={`${props.name}-${c.id}-blurb`} className="mt-0.5 block text-footnote text-ink-3">
                {c.blurb}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
