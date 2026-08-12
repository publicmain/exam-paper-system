import { useEffect, useState } from 'react';
import {
  consumeInstallPrompt,
  detectPlatform,
  getInstallPrompt,
  isStandalone,
  isWeChat,
  onInstallPromptReady,
} from '../lib/pwa';

/**
 * 「把成绩页装到主屏幕」引导卡（PWA 安装向导）。
 *
 * PWA 的技术底子（manifest / 图标 / Service Worker / iOS meta）5 月就
 * 齐了,但从没有任何页面告诉学生它存在 —— 安装率自然是零。这张卡
 * 补上最后一公里:在学生**刚查完成绩**的页面上,用他此刻的心情
 * （"下次还要再输一遍名字？"）推一把。
 *
 * 平台差异是这张卡存在的全部原因:
 *   Android/Chrome  有 beforeinstallprompt API —— 一个按钮拉起系统
 *                   安装弹窗,零解释成本。
 *   iOS/Safari      **没有任何安装 API**,只能教学生手动操作:
 *                   分享按钮 → 添加到主屏幕。步骤必须配图标示意,
 *                   纯文字描述"分享按钮"学生找不到。
 *   已安装(standalone) 不再显示 —— 任务完成。
 *   微信内置浏览器  装不了,显示会误导,直接隐藏。
 */

const DISMISS_KEY = 'mq:pwa:nudge-dismissed';

export default function InstallAppCard() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [canPrompt, setCanPrompt] = useState(() => getInstallPrompt() !== null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const off = onInstallPromptReady(() => setCanPrompt(true));
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      off();
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const platform = detectPlatform();
  const isIos = platform === 'iphone' || platform === 'ipad';

  // 桌面不推(学生场景是手机)、微信里装不了、装完就闭嘴
  if (dismissed || installed || isStandalone() || platform === 'other' || isWeChat()) return null;
  // Android 上 Chrome 认为不可安装(已装过/不满足条件)时也不硬推
  if (!isIos && !canPrompt) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/icons/icon-192.png" alt="" className="w-11 h-11 rounded-[10px] shadow-sm shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-gray-900">把「早测查询」装到主屏幕</div>
            <div className="text-xs text-gray-600 mt-0.5">
              随时点开就是你的成绩和生词本，不用再扫码、不用再输名字。
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="不再提示"
          className="shrink-0 text-gray-400 text-lg leading-none px-1.5 py-1"
        >
          ×
        </button>
      </div>

      {isIos ? (
        // iOS 没有安装 API —— 教手动操作，步骤配符号，纯文字找不到按钮
        <ol className="mt-3 space-y-1.5 text-[13px] text-gray-700">
          <li>
            ① 点 Safari {platform === 'ipad' ? '右上角' : '底部中间'}的分享按钮{' '}
            <span className="inline-block border border-gray-400 rounded px-1 text-[12px] leading-4 align-middle">
              ⬆︎
            </span>
          </li>
          <li>② 往下滑，选「<strong>添加到主屏幕</strong>」</li>
          <li>③ 点右上角「添加」—— 桌面就有 📊 图标了</li>
          <li className="text-gray-500">
            看不到分享按钮？说明在扫码小窗口里 —— 先点右下角「···」→「在 Safari 中打开」。
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={async () => {
            const p = consumeInstallPrompt();
            if (!p) return;
            try {
              await p.prompt();
            } catch { /* 用户取消 */ }
          }}
          className="mt-3 w-full py-2.5 rounded-lg bg-indigo-600 active:bg-indigo-700 text-white text-sm font-semibold touch-manipulation"
        >
          一键安装
        </button>
      )}
    </div>
  );
}
