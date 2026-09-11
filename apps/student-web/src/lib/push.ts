/**
 * 浏览器推送 —— 学生端这一半（2026-09-10）。
 *
 * 走浏览器原生 Push API，不经任何第三方推送平台。流程：
 *
 *   要通知权限 → 注册 public/sw.js → 向浏览器要一份订阅（endpoint + 密钥）
 *   → 交给服务端存起来 → 到点服务端直接发给浏览器厂商的推送服务
 *
 * **这是整个学生端唯一注册 Service Worker 的地方**，而且只在学生自己点
 * 「开启提醒」时才注册（契约测试守着）。那个 worker 不缓存任何东西。
 *
 * iPhone / iPad：Safari 只给**加到主屏幕**的网页推送。没装的时候
 * `PushManager` 根本不存在，这里单独认出来给安装指引，而不是笼统说
 * 「不支持」。
 */
import { api } from './api';

export type PushStatus =
  /** 浏览器没有这套能力 */
  | 'unsupported'
  /** iOS 上还没加到主屏幕 */
  | 'needs_install'
  /** 学生在浏览器里拒绝过通知 —— 网页自己没法再问第二次 */
  | 'denied'
  /** 能开，还没开 */
  | 'off'
  /** 这台设备已经订阅 */
  | 'on';

export interface PushEnv {
  serviceWorker: boolean;
  pushManager: boolean;
  notification: boolean;
  permission: 'default' | 'granted' | 'denied';
  ios: boolean;
  standalone: boolean;
  subscribed: boolean;
}

/** 纯判断，测试直接钉。 */
export function derivePushStatus(env: PushEnv): PushStatus {
  if (env.ios && !env.standalone) return 'needs_install';
  if (!env.serviceWorker || !env.pushManager || !env.notification) return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  return env.subscribed ? 'on' : 'off';
}

export function isIos(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent ?? '';
  // iPadOS 13 起 Safari 自称 Macintosh，只能靠触点数认
  return /iP(hone|ad|od)/.test(ua) || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function readPushEnv(): Promise<PushEnv> {
  const hasSw = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  let subscribed = false;
  if (hasSw && hasPush) {
    try {
      subscribed = (await currentSubscription()) !== null;
    } catch {
      subscribed = false;
    }
  }
  return {
    serviceWorker: hasSw,
    pushManager: hasPush,
    notification: hasNotification,
    permission: hasNotification ? Notification.permission : 'default',
    ios: isIos(),
    standalone: isStandalone(),
    subscribed,
  };
}

export async function pushStatus(token?: string | null): Promise<PushStatus> {
  const env = await readPushEnv();
  // 浏览器里有订阅 ≠ 是这个账号的（审计 UI07）：A 开了提醒、退出、B 登录，这台设备上的
  // 订阅可能还挂在 A 名下。有令牌时问一次服务端；它说不是我的，就按「没开」显示。
  // 服务端不认这个接口（老版本）或网络失败：保持按设备判断，不因为问不到就谎报「没开」。
  if (env.subscribed && token) {
    try {
      const sub = await currentSubscription();
      if (sub) {
        const r = await api.pushStatus(token, { endpoint: sub.endpoint });
        if (r && r.subscribed === false) return derivePushStatus({ ...env, subscribed: false });
      }
    } catch {
      /* 问不到就按设备状态 */
    }
  }
  return derivePushStatus(env);
}

/** VAPID 公钥是 base64url，PushManager 要的是字节。 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * 开启。**必须在点击手势里调**：Safari 只在用户手势里给通知权限，所以
 * 第一件事就是要权限，别的异步动作都排在它后面。
 */
export async function enablePush(token: string): Promise<PushStatus> {
  if (!('Notification' in window)) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const cfg = await api.pushConfig(token);
  if (!cfg.enabled || !cfg.publicKey) throw new Error('push_disabled');

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
    });
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('bad_subscription');
  await api.pushSubscribe(token, {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return 'on';
}

export async function disablePush(token: string): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.pushUnsubscribe(token, { endpoint });
}

/**
 * 退出 / 换人 / 令牌失效时，解除**这台设备**上的提醒订阅（审计 UI07）。
 *
 * 浏览器里的订阅是设备级的，不认账号：A 开了提醒、退出、B 登录，如果不解绑，
 * B 的设备上会继续收到 A 的个人提醒，页面还会按「浏览器有订阅」显示成已开启。
 *   · 有有效令牌（主动退出）→ 先告诉服务端删掉这条订阅，再在本地退订；
 *   · 令牌已失效（被撤销 / 过期）→ 只能本地退订：端点随之作废，服务端下次发送
 *     会被推送服务拒绝并清理。
 * 全程尽力而为：不支持推送 / 没订阅 / 网络失败都不影响退出本身。
 */
export async function releasePushForThisDevice(token: string | null): Promise<void> {
  let sub: PushSubscription | null = null;
  try {
    sub = await currentSubscription();
  } catch {
    return;
  }
  if (!sub) return;
  const endpoint = sub.endpoint;
  if (token) {
    try {
      await api.pushUnsubscribe(token, { endpoint });
    } catch {
      /* 服务端没删成：本地退订后端点也会失效 */
    }
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* 退订失败不阻塞退出 */
  }
}
