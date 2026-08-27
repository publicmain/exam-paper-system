/** 移动优先的最小外壳。**不是最终视觉设计** —— 阶段 4A 只求能用、能读。 */
import type { ReactNode } from 'react';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
      <main className="flex-1 w-full max-w-md mx-auto px-5 py-8 flex flex-col justify-center">
        {children}
      </main>
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">{children}</div>;
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
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm text-slate-600 mb-1.5">{props.label}</span>
      <input
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500"
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete={props.autoComplete}
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
      className="w-full rounded-xl bg-blue-600 text-white py-3 text-base font-medium disabled:bg-slate-300"
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
              <span className="text-sm text-slate-500 ml-2">{c.classes.join(' · ')}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
