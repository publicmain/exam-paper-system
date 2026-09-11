import { useState } from 'react';
import { IOS_INSTALL_HINT } from './PushSettings';
import { usePush } from './usePush';

/** 只存一个 '1'：这个人说过「不用了」。不存身份、不存令牌。 */
const PUSH_NUDGE_KEY = 'sw:push-nudge-dismissed';

function dismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_NUDGE_KEY) === '1';
  } catch {
    return false;
  }
}
function remember(): void {
  try {
    localStorage.setItem(PUSH_NUDGE_KEY, '1');
  } catch {
    // 存不进去就下次再问一遍，不是大事
  }
}

/**
 * 首页的一次性提示 —— 没有它，账号页里那个开关没人会发现。
 *
 * 只在两种情况下出现：能开但没开；iOS 上还没装到主屏幕。说过「不用了」
 * 就不再出现。已经开了、浏览器不支持、拒绝过 —— 都不打扰。
 */
export function PushNudge() {
  const [hidden, setHidden] = useState(dismissed);
  // 先看设备再问服务端；说过「不用了」的一个请求都不发
  const { cfg, status, busy, error, enable } = usePush({ lazyConfig: true, active: !hidden });
  if (hidden || cfg === 'loading' || !cfg || !cfg.enabled) return null;
  if (status !== 'off' && status !== 'needs_install') return null;

  const close = () => {
    remember();
    setHidden(true);
  };

  return (
    <section
      data-testid="push-nudge"
      className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-4"
      aria-label="开启提醒"
    >
      {status === 'off' ? (
        <>
          <p className="text-sm text-ink">
            要不要每个上课日 <strong>{cfg.reminderTime}</strong> 提醒你一下？课做完了就不会响。
          </p>
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="app-primary flex-1"
              disabled={busy}
              onClick={() => void enable().then(() => remember())}
            >
              {busy ? '正在开…' : '开启提醒'}
            </button>
            <button type="button" className="min-h-[44px] px-4 text-sm text-ink-3" onClick={close}>
              不用了
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink">{IOS_INSTALL_HINT}</p>
          <button type="button" className="mt-3 min-h-[44px] text-sm text-accent" onClick={close}>
            知道了
          </button>
        </>
      )}
    </section>
  );
}
