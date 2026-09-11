import { useCallback, useEffect, useState } from 'react';
import { api, type PushConfig } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { disablePush, enablePush, pushStatus, type PushStatus } from '../lib/push';

/**
 * 提醒开关的状态机 —— 账号页的开关和首页的一次性提示共用。
 *
 * `cfg` 是服务端说的：功能开没开、几点提醒。`status` 是这台设备的：
 * 支不支持、有没有装到主屏幕、权限给没给、订没订。两者分开 ——
 * 服务端关着就整段不显示，与这台设备无关。
 *
 * `lazyConfig`：先看设备（不发请求），只有设备**可能**要显示东西时
 * （能开没开 / iOS 没装）才去问服务端。首页每次打开都跑这个 hook，
 * 不支持的设备、已经开了的设备不该为它多发一个请求。
 * `active: false` 则什么都不做（首页那条说过「不用了」之后）。
 */
export function usePush(opts: { lazyConfig?: boolean; active?: boolean } = {}) {
  const lazyConfig = opts.lazyConfig ?? false;
  const active = opts.active ?? true;
  const [cfg, setCfg] = useState<PushConfig | null | 'loading'>('loading');
  const [status, setStatus] = useState<PushStatus | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const token = readToken();
    if (!token) return;
    let alive = true;
    const loadConfig = () =>
      api
        .pushConfig(token)
        .then((c) => alive && setCfg(c))
        .catch((e) => {
          if (!alive) return;
          if (handleAuthFailure(e)) return;
          setCfg(null);
        });
    void pushStatus(token)
      .then((s) => {
        if (!alive) return;
        setStatus(s);
        if (!lazyConfig || s === 'off' || s === 'needs_install') void loadConfig();
        else setCfg(null);
      })
      .catch(() => {
        if (!alive) return;
        setStatus('unsupported');
        if (!lazyConfig) void loadConfig();
        else setCfg(null);
      });
    return () => {
      alive = false;
    };
  }, [active, lazyConfig]);

  const enable = useCallback(async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      setStatus(await enablePush(token));
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setError('没能开启，等下再试一次。');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await disablePush(token);
      setStatus('off');
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setError('没能关闭，等下再试一次。');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { cfg, status, busy, error, enable, disable };
}
