/**
 * PWA 安装相关的共享工具 —— InstallAppCard（成绩页引导卡）和
 * InstallGuideSheet（签到后分机型教程）都用它，检测口径必须一致。
 */

export type Platform = 'iphone' | 'ipad' | 'android' | 'other';

/**
 * 机型检测。iPad 是这里唯一的坑：iPadOS 13 起 Safari 默认报
 * **Macintosh 桌面 UA**，只能靠"自称 Mac 却有多点触控"来识别 ——
 * 真正的 Mac maxTouchPoints 是 0。
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return 'ipad';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export function isWeChat(): boolean {
  return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
}

/** 已经以 App 形态运行（从主屏幕图标打开）。 */
export function isStandalone(): boolean {
  try {
    return (
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

/**
 * Chrome 的 beforeinstallprompt 在页面加载早期发出，必须在模块加载时
 * 就挂监听 —— 等 React 组件挂载再听就错过了。安卓上拿到它就能做
 * 「一键安装」，比截图教程体验好一个量级。
 */
let deferredPrompt: any = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
}

export function getInstallPrompt(): any {
  return deferredPrompt;
}
export function consumeInstallPrompt(): any {
  const p = deferredPrompt;
  deferredPrompt = null;
  return p;
}
export function onInstallPromptReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
