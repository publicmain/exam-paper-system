import { Group, Row, Section } from '../design/List';
import { InlineStatus } from '../design/Status';
import { Switch } from '../design/Switch';
import { usePush } from './usePush';

export const IOS_INSTALL_HINT =
  'iPhone / iPad 上要先把网页装到主屏幕才能收提醒：在 Safari 点底部「分享」→「添加到主屏幕」，然后从主屏幕打开，再回到这里开启。';

/**
 * 账号页的「提醒」一节。
 *
 * 服务端没开这个功能（没配密钥）→ 整节不渲染，学生不会看到一个开不了的开关。
 * 设备不支持 / 需要先装到主屏幕 / 浏览器已拒绝 —— 开关不出现，改成一句说明为什么、怎么办。
 * 开关的「开」只代表**这台设备、这个账号**（审计 UI07：状态按已认证账号判断）。
 */
export function PushSettings() {
  const { cfg, status, busy, error, enable, disable } = usePush();
  if (cfg === 'loading' || !cfg || !cfg.enabled) return null;

  const explain =
    status === 'needs_install'
      ? IOS_INSTALL_HINT
      : status === 'denied'
        ? '这个浏览器已经拒绝了本站的通知。要重新开启，得在浏览器的网站设置里把通知改回「允许」，再回到这里。'
        : status === 'unsupported'
          ? '这个浏览器不支持提醒。'
          : null;

  return (
    <Section title="提醒" testId="push-box" footer={status === 'on' || status === 'off' ? '只对这台设备上的这个账号生效；退出登录会自动关掉。' : undefined}>
      <Group>
        <Row
          icon="bell"
          title="上课日提醒"
          subtitle={
            status === 'loading'
              ? '正在看这台设备支不支持…'
              : status === 'on'
                ? `已开启。每个上课日 ${cfg.reminderTime}，当天的课还没做完就提醒你一下。`
                : `每个上课日 ${cfg.reminderTime}，当天的课还没做完就提醒你一下。`
          }
        >
          {status === 'on' || status === 'off' ? (
            <Switch
              testId="push-switch"
              label="上课日提醒"
              checked={status === 'on'}
              busy={busy}
              onChange={(next) => void (next ? enable() : disable())}
            />
          ) : null}
        </Row>
        {explain ? (
          <div className="px-4 py-3 text-footnote text-ink-2">{explain}</div>
        ) : null}
      </Group>
      {error ? (
        <div className="mt-2">
          <InlineStatus tone="error">{error}</InlineStatus>
        </div>
      ) : null}
    </Section>
  );
}
