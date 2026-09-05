/**
 * 移动优先的最小外壳。
 *
 * ## S12L —— 宽屏不再只用中间那一条
 *
 * 原来是死的 `max-w-md`（448px）。手机上正好，iPad 上剩 320px 空白，
 * 1366 的笔记本上左右各空 459px —— 正文只占三分之一屏。学生的原话是
 * 「电脑上只有中间一条」。
 *
 * 现在按断点放宽：448 → 672（md）→ 896（lg）→ 1024（xl）。375px 一个字
 * 都没变，仍然单列、仍然不横向溢出。
 *
 * `justify-center` 也去掉了：它让一张短卡片在 900px 高的屏幕上飘在正中，
 * 内容一多又突然跳到顶部。登录 / 注册那种只有一张卡的页面显式传
 * `center` 保留原样。
 */
import type { ReactNode } from 'react';
import { PILOT_LEVEL_CHOICES, type PilotLevelId } from './lib/levels';

/** 正文最大宽度。`narrow` 是登录这类单卡页面，其余一律跟着屏幕放宽。 */
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
    <div className="ui-ios min-h-[100dvh] text-slate-900 flex flex-col">
      <main
        className={`flex-1 w-full ${WIDTH[width]} mx-auto px-4 sm:px-6 py-5 sm:py-8 safe-top safe-bottom flex flex-col${
          center ? ' justify-center' : ''
        }`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * 顶部返回条。
 *
 * S12L —— 「返回」以前挂在长页面的**最底部**：生词本 50 个词要滚到底才
 * 找得到出口。常用的动作必须在顶部够得着。
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
    <div className="mb-5 flex min-h-[44px] items-center gap-3">
      {onBack ? (
        <button
          type="button"
          data-testid="top-back"
          onClick={onBack}
          className="min-h-[44px] -ml-2 px-2 rounded-xl text-[15px] font-medium text-[#007aff] hover:bg-white/70"
        >
          ← {backLabel}
        </button>
      ) : null}
      {title ? <h1 className="text-xl font-semibold tracking-[-0.015em] truncate">{title}</h1> : null}
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

/**
 * 「这个功能暂时不开放」。
 *
 * 一个空页面比一个报错更让人不安 —— 学生会以为自己的数据没了。所以这里
 * 明说三件事：为什么进不来、你的东西还在、它不影响今天的完成度。
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
        <div className="text-center">
          <p className="text-3xl mb-3" aria-hidden="true">🛠</p>
          <h1 data-testid="unavailable-title" className="text-lg font-semibold mb-2">
            {title}
          </h1>
          {note ? <div className="text-sm text-slate-600 leading-relaxed">{note}</div> : null}
          {actions ? <div className="mt-5 flex flex-col gap-2">{actions}</div> : null}
        </div>
      </Card>
    </Screen>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="app-glass rounded-[22px] p-5 sm:p-7">{children}</div>;
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-xl font-semibold text-center mb-6">{children}</h1>;
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
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm text-slate-600 mb-1.5">{props.label}</span>
      <input
        className="w-full min-h-[50px] rounded-[14px] border border-slate-300/80 bg-white/90 px-4 py-3 text-base outline-none focus:border-[#007aff] focus:ring-4 focus:ring-blue-500/10"
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete={props.autoComplete}
        {...(props.numericPin ? { inputMode: 'numeric' as const } : {})}
        {...(props.maxLength ? { maxLength: props.maxLength } : {})}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function Button(props: { children: ReactNode; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
      className="app-primary w-full px-5 py-3 text-base disabled:bg-slate-300 disabled:shadow-none"
    >
      {props.children}
    </button>
  );
}

export function Notice({ kind, children }: { kind: 'error' | 'info'; children: ReactNode }) {
  const cls = kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700';
  return <div role="alert" className={`rounded-xl px-4 py-3 text-sm mb-4 ${cls}`}>{children}</div>;
}

/** 同名消歧。选中的 studentId **只活在这一次请求里** —— 不进 URL、不落盘。 */
export function CandidatePicker(props: {
  candidates: { studentId: string; name: string; classes?: string[] }[];
  onPick: (studentId: string) => void;
}) {
  return (
    <div>
      <p className="text-sm text-slate-600 mb-3">有几位同学同名 —— 哪一个是你？</p>
      <div className="flex flex-col gap-2">
        {props.candidates.map((c) => (
          <button
            key={c.studentId}
            onClick={() => props.onPick(c.studentId)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-left"
          >
            <span className="font-medium">{c.name}</span>
            {c.classes?.length ? (
              <>
                <span aria-hidden className="text-slate-400 mx-1">·</span>
                <span className="text-sm text-slate-500">{c.classes.join(' · ')}</span>
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
 * 用**原生 radio**，不是一排 `<button>`：键盘的上下键、读屏软件的
 * 「五选一，当前第几个」、以及「必须显式选一个」这三件事，原生控件
 * 免费给，手搓的按钮组要一件件补回来。
 *
 * 每张卡都带一句「这一档是给谁的」—— 一个十五岁的人不该靠猜内部枚举
 * 决定自己上哪一层。标签是中文，`id` 只出现在 `value` 里。
 */
export function LevelPicker(props: {
  name: string;
  value: PilotLevelId | null;
  onChange: (v: PilotLevelId) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="英语难度" className="flex flex-col gap-2 mb-4">
      {PILOT_LEVEL_CHOICES.map((c) => {
        const on = props.value === c.id;
        return (
          <label
            key={c.id}
            className={`flex min-h-[62px] gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
              on ? 'border-[#007aff] bg-blue-50/80 shadow-[0_0_0_1px_rgba(0,122,255,.08)]' : 'border-slate-200 bg-white/70 hover:bg-white'
            }`}
          >
            {/*
              `aria-label` 是显式的，不靠外面那层 <label> 的文字。
              两个理由：① 包住的 label 里既有档名又有整句说明，读屏会把
              两段连起来念一长串；② 不加时，有些辅助树会退回用 `value`
              报名字 —— 那正好是学生绝不该听到的内部标识 `olevel`。
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
              className="mt-1 shrink-0"
            />
            <span>
              <span className="block font-medium">{c.label}</span>
              <span id={`${props.name}-${c.id}-blurb`} className="block text-sm text-slate-600 mt-0.5">
                {c.blurb}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
