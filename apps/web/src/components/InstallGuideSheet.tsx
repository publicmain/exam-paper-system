import { useState } from 'react';
import {
  consumeInstallPrompt,
  detectPlatform,
  getInstallPrompt,
  type Platform,
} from '../lib/pwa';

/**
 * 签到后的分机型安装向导 —— **一步一屏**。
 *
 * ## 2026-08-12 真机打回后的重写
 *
 * 第一版把所有步骤竖排在一页里,老师用 iPhone 实测发现一个致命问题:
 * 学生扫码进来的根本**不是 Safari**,而是 iOS 相机/扫码器的
 * 「小窗口浏览器」(in-app browser) —— 底部只有 返回/地址栏/「···」,
 * **没有分享按钮**,「添加到主屏幕」在这种窗口里根本不存在。
 * 教程第一步就对不上学生眼前的屏幕,后面全部作废。
 *
 * 所以 iPhone/iPad 的第一步永远是**逃回真 Safari**:点右下角「···」→
 * 「在 Safari 中打开」。这一步配了按老师实拍截图复刻的示意图。
 * 逃生失败的兜底:「拷贝网址」按钮,自己打开 Safari 粘贴 ——
 * 无论被关在哪种小窗口里,这条路永远走得通。
 *
 * ## 为什么一步一屏(集百家之所长)
 *
 * 多邻国/游戏新手引导的通行做法:同一时刻只给一张图、一句话,
 * 上一步/下一步由学生自己点(本项目已两次验证"节奏必须在学生手里")。
 * 一页竖排五张图,学生扫两眼就滑到底 —— 和没看一样。
 *
 * 机型自动检测(iPadOS 自称 Mac,靠 maxTouchPoints 识破),检测错了
 * 顶部页签可手动切。安卓拿到 beforeinstallprompt 时直接给一键安装。
 *
 * 时间纪律不变:「跳过」常驻;最后一步 CTA 是「知道了,开始答题」;
 * 不用现在装,交卷后成绩页有 InstallAppCard 接住。
 */

const SEEN_KEY = 'mq:installguide:v1';

export function hasSeenInstallGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
export function markInstallGuideSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

interface Step {
  img: string;
  title: string;
  desc: string;
  /** iPhone 第 0 步专用：显示「拷贝网址」兜底按钮 */
  copyUrl?: boolean;
}

const STEPS: Record<Exclude<Platform, 'other'>, Step[]> = {
  iphone: [
    {
      img: '/install-guide/ip0.png',
      title: '先回到真正的 Safari',
      desc: '扫码打开的是一个「小窗口」，里面装不了 App。点右下角「···」，选「在 Safari 中打开」。（如果你底部已经有 ⬆︎ 分享按钮，说明已经在 Safari 里，直接下一步。）',
      copyUrl: true,
    },
    {
      img: '/install-guide/ip1.png',
      title: '点底部中间的「分享」按钮',
      desc: '就是那个带向上箭头的方框 ⬆︎，在 Safari 屏幕最底下一排的正中间。',
    },
    {
      img: '/install-guide/ip2.png',
      title: '选「添加到主屏幕」',
      desc: '菜单往下滑一点就能看到。英文系统叫 Add to Home Screen。',
    },
    {
      img: '/install-guide/ip3.png',
      title: '点右上角「添加」',
      desc: '名字保持「早测查询」就行，不用改。',
    },
    {
      img: '/install-guide/ip4.png',
      title: '完成！',
      desc: '主屏幕多了一个蓝色图标。以后点它就直接看到自己的成绩和生词本，不用扫码、不用输名字。',
    },
  ],
  ipad: [
    {
      img: '/install-guide/ip0.png',
      title: '先回到真正的 Safari',
      desc: '如果是扫码打开的「小窗口」（没有分享按钮），点「···」选「在 Safari 中打开」。已经在 Safari 里就直接下一步。',
      copyUrl: true,
    },
    {
      img: '/install-guide/pad1.png',
      title: '点右上角的「分享」按钮',
      desc: 'iPad 的分享按钮 ⬆︎ 在地址栏旁边的右上角 —— 和 iPhone 位置不一样。',
    },
    {
      img: '/install-guide/pad2.png',
      title: '选「添加到主屏幕」，再点「添加」',
      desc: '完成后主屏幕就有「早测查询」图标了。',
    },
  ],
  android: [
    {
      img: '/install-guide/and1.png',
      title: '点右上角「⋮」菜单',
      desc: '用 Chrome 或手机自带浏览器打开时，右上角都有这个三个点的菜单。',
    },
    {
      img: '/install-guide/and2.png',
      title: '点「安装应用」',
      desc: '有的手机叫「添加到主屏幕 / Add to Home Screen」，是同一个东西。',
    },
    {
      img: '/install-guide/and3.png',
      title: '点「安装」，完成！',
      desc: '桌面出现「早测查询」图标，以后点它就直接看成绩，不用扫码。',
    },
  ],
};

const TAB_LABEL: Record<Exclude<Platform, 'other'>, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  android: '安卓',
};

export default function InstallGuideSheet({ onDone }: { onDone: () => void }) {
  const detected = detectPlatform();
  const [tab, setTab] = useState<Exclude<Platform, 'other'>>(
    detected === 'other' ? 'iphone' : detected,
  );
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [canOneTap, setCanOneTap] = useState(() => !!getInstallPrompt());
  const [installed, setInstalled] = useState(false);

  const steps = STEPS[tab];
  const s = steps[step];
  const last = step === steps.length - 1;

  function switchTab(k: Exclude<Platform, 'other'>) {
    setTab(k);
    setStep(0); // 换机型从头开始 —— 步骤不通用
    setCopied(false);
  }

  async function copyUrl() {
    const url = `${window.location.origin}/my-history`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // 剪贴板被拒（旧系统/权限）：退化为选中提示
      window.prompt('长按选中后拷贝这个网址：', url);
    }
  }

  return (
    <div className="ui-ios fixed inset-0 z-[60] bg-white overflow-y-auto">
      <div className="max-w-md mx-auto px-5 pb-4 pt-4 min-h-full flex flex-col">
        {/* 跳过永远可见 —— 这一屏站在考试倒计时里 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="w-9 h-9 rounded-[9px] shadow-sm" />
            <div className="text-[16px] font-bold text-gray-900">把「早测查询」装到手机上</div>
          </div>
          <button type="button" onClick={onDone} className="hit press text-[15px] text-gray-400 px-3 py-2 -mr-3">
            跳过
          </button>
        </div>

        {/* 机型页签：检测会错（iPadOS 自称 Mac、国产浏览器五花八门） */}
        <div className="seg mt-3" role="tablist" aria-label="选择你的设备">
          {(Object.keys(TAB_LABEL) as Array<keyof typeof TAB_LABEL>).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              data-on={tab === k}
              onClick={() => switchTab(k)}
            >
              {TAB_LABEL[k]}
              {detected === k && <span className="text-[10px] ml-1 opacity-70">（你的）</span>}
            </button>
          ))}
        </div>

        {/* 安卓一键安装 —— 系统支持时向导只是后备 */}
        {tab === 'android' && canOneTap && !installed && (
          <button
            type="button"
            onClick={async () => {
              const p = consumeInstallPrompt();
              setCanOneTap(false);
              if (!p) return;
              try {
                await p.prompt();
                const r = await p.userChoice;
                if (r?.outcome === 'accepted') setInstalled(true);
              } catch {
                /* 用户取消 */
              }
            }}
            className="press mt-3 w-full min-h-[50px] rounded-[14px] bg-emerald-600 text-white text-[16px] font-semibold active:bg-emerald-700"
          >
            ⚡ 你的手机支持一键安装 —— 点这里最快
          </button>
        )}
        {installed && (
          <div className="mt-3 rounded-[14px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-[15px] text-emerald-800 font-semibold">
            ✅ 已安装！去主屏幕找「早测查询」图标。
          </div>
        )}

        {/* 当前步骤：一屏只讲一件事 */}
        <div className="mt-4 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-white bg-blue-600 rounded-full min-w-[20px] h-5 px-1 inline-flex items-center justify-center shrink-0">
              {step + 1}
            </span>
            <h2 className="text-[19px] font-bold text-gray-900 leading-snug">{s.title}</h2>
          </div>
          <p className="text-[14px] text-gray-600 mt-1.5 leading-relaxed">{s.desc}</p>
          <img
            src={s.img}
            alt={`第 ${step + 1} 步示意图`}
            className="mt-3 w-full rounded-[16px] border border-gray-200"
          />
          {s.copyUrl && (
            <button
              type="button"
              onClick={copyUrl}
              className="press mt-3 w-full min-h-[44px] rounded-[12px] bg-gray-100 text-gray-800 text-[14px] font-semibold active:bg-gray-200"
            >
              {copied ? '✅ 已拷贝 —— 打开 Safari，粘贴到地址栏' : '也可以：拷贝网址，自己去 Safari 打开'}
            </button>
          )}
        </div>

        {/* 底部：进度点 + 上一步/下一步。节奏在学生手里。 */}
        <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-3 bg-white/95 backdrop-blur border-t border-gray-100">
          <div className="flex justify-center gap-1.5 mb-3" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-5 bg-blue-600' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((x) => x - 1)}
                className="press min-h-[50px] px-5 rounded-[14px] bg-gray-100 text-gray-700 text-[16px] font-semibold active:bg-gray-200"
              >
                上一步
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onDone() : setStep((x) => x + 1))}
              className="press flex-1 min-h-[50px] rounded-[14px] bg-blue-600 text-white text-[16px] font-semibold active:bg-blue-700"
            >
              {last ? '知道了，开始答题' : `下一步 · ${step + 1}/${steps.length}`}
            </button>
          </div>
          <p className="text-[12px] text-gray-400 text-center mt-2">
            不用现在装 —— 交卷后在成绩页也能装，这个提示只出现一次。
          </p>
        </div>
      </div>
    </div>
  );
}
