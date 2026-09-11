import { Button, Notice } from '../ui';
import { usePush } from './usePush';

export const IOS_INSTALL_HINT =
  'iPhone / iPad 上要先把网页装到主屏幕才能收提醒：在 Safari 点底部「分享」→「添加到主屏幕」，然后从主屏幕打开，再回到这里开启。';

/**
 * 账号页的「提醒」一节。服务端没开这个功能（没配密钥）→ 整节不渲染，
 * 学生不会看到一个开不了的开关。
 */
export function PushSettings() {
  const { cfg, status, busy, error, enable, disable } = usePush();
  if (cfg === 'loading' || !cfg || !cfg.enabled) return null;

  return (
    <section data-testid="push-box" className="mb-8">
      <h2 className="text-base font-medium mb-1">提醒</h2>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {status === 'loading' ? (
        <p className="text-sm text-ink-3">正在看这台设备支不支持…</p>
      ) : status === 'on' ? (
        <>
          <p className="text-sm text-ink-2 mb-3">
            已开启。每个上课日 <strong>{cfg.reminderTime}</strong>，当天的课还没做完就会提醒你一下。
          </p>
          <Button type="button" disabled={busy} onClick={() => void disable()}>
            {busy ? '正在关…' : '关闭提醒'}
          </Button>
        </>
      ) : status === 'off' ? (
        <>
          <p className="text-sm text-ink-2 mb-3">
            每个上课日 <strong>{cfg.reminderTime}</strong>，课还没做完就提醒你一下。只在这台设备上生效。
          </p>
          <Button type="button" disabled={busy} onClick={() => void enable()}>
            {busy ? '正在开…' : '开启提醒'}
          </Button>
        </>
      ) : status === 'needs_install' ? (
        <p className="text-sm text-ink-2">{IOS_INSTALL_HINT}</p>
      ) : status === 'denied' ? (
        <p className="text-sm text-ink-2">
          这个浏览器已经拒绝了本站的通知。要重新开启，得在浏览器的网站设置里把通知改回「允许」，再回到这里。
        </p>
      ) : (
        <p className="text-sm text-ink-2">这个浏览器不支持提醒。</p>
      )}
    </section>
  );
}
