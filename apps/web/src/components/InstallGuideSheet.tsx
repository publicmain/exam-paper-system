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
 * 「小窗口浏览器」(in-app browser),底部没有分享按钮 —— 教程第一步
 * 就对不上学生眼前的屏幕。
 *
 * 第二版我让学生「逃回真 Safari」再操作;老师随后用真机逐步实拍了
 * 全流程,实拍推翻了这个绕路:小窗口的「···」菜单里就有「共享」,
 * 共享面板里直接有「添加到主屏幕」,根本不用逃。当前步骤与截图
 * 全部来自老师的实拍(见 STEPS 注释)。「拷贝网址」兜底保留 ——
 * 旧系统若没有共享入口,拷贝→自己开 Safari→粘贴永远走得通。
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
  /** 竖屏截图（iPhone）—— 限高显示，不然一张图占两屏 */
  portrait?: boolean;
  /** 兜底：显示「拷贝网址」按钮 */
  copyUrl?: boolean;
}

/**
 * 步骤截图全部是老师 2026-08-12 用真机逐步实拍的（红色箭头也是老师
 * 标注的），存放于 public/install-guide/real-*.jpg。此前两版用自绘
 * 示意图都被真机打回 —— 示意图画的是"我以为的界面"，实拍才是学生
 * 眼前的界面。
 *
 * 实拍还推翻了我一个假设：iPhone 扫码小窗口**不需要**逃回 Safari ——
 * 「···」菜单里就有「共享」，共享面板里直接有「添加到主屏幕」。
 */
const STEPS: Record<Exclude<Platform, 'other'>, Step[]> = {
  iphone: [
    {
      img: '/install-guide/real-ip-1.jpg',
      title: '点右下角的「···」',
      desc: '扫码打开的页面，底部最右边有一个「···」按钮 —— 点它。',
      portrait: true,
      copyUrl: true,
    },
    {
      img: '/install-guide/real-ip-2.jpg',
      title: '点「共享」',
      desc: '弹出的菜单里，点最上面的「共享」（带 ⬆︎ 图标）。',
      portrait: true,
    },
    {
      img: '/install-guide/real-ip-3.jpg',
      title: '点「View More / 查看更多」',
      desc: '分享面板下面一排圆形按钮，最右边那个 ∨ 就是。',
      portrait: true,
    },
    {
      img: '/install-guide/real-ip-4.jpg',
      title: '点「添加到主屏幕」',
      desc: '在展开的列表里，图标是一个带 + 的方框。',
      portrait: true,
    },
    {
      img: '/install-guide/real-ip-5.jpg',
      title: '点右上角「添加」，完成！',
      desc: '名字保持「早测查询」不用改；「作为网页 App 打开」保持打开。添加后主屏幕就有蓝色图标了。',
      portrait: true,
    },
  ],
  ipad: [
    {
      img: '/install-guide/real-pad-1.jpg',
      title: '点右上角的「分享」按钮',
      desc: 'iPad 的分享按钮 ⬆︎ 在右上角、地址栏旁边 —— 和 iPhone 位置不一样。',
    },
    {
      img: '/install-guide/real-pad-2.jpg',
      title: '点「查看更多」',
      desc: '分享面板里那排圆形按钮的最后一个 ∨。',
    },
    {
      img: '/install-guide/real-pad-3.jpg',
      title: '点「添加到主屏幕」',
      desc: '在展开列表的最下面。',
    },
    {
      img: '/install-guide/real-pad-4.jpg',
      title: '点「添加」，完成！',
      desc: '名字保持「早测查询」，「作为网页 App 打开」保持打开。',
    },
  ],
  android: [
    {
      img: '/install-guide/real-and-1.jpg',
      title: '关键：必须用 Chrome 的相机扫码',
      desc: '打开 Chrome，点搜索栏右边的相机图标，用它扫墙上的二维码。⚠️ 用系统相机或其他扫码工具打开的页面装不了 App —— 这一步没做对，后面全都看不到。',
    },
    {
      img: '/install-guide/real-and-2.jpg',
      title: '点右上角「⋮」菜单',
      desc: '页面打开后，Chrome 右上角三个点。',
    },
    {
      img: '/install-guide/real-and-3.jpg',
      title: '点「安装并创建快捷方式」',
      desc: '菜单中间偏下的位置（有的手机叫「安装应用」或「添加到主屏幕」）。',
    },
    {
      img: '/install-guide/real-and-4.jpg',
      title: '选「安装」',
      desc: '注意选上面的「安装」—— 下面的「创建快捷方式」只是个书签，不是 App。',
    },
    {
      img: '/install-guide/real-and-5.jpg',
      title: '弹窗里再点「安装」，完成！',
      desc: '桌面出现「早测查询 · Morning Quiz」图标，以后点它就直接看成绩。',
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
            alt={`第 ${step + 1} 步截图`}
            className={`mt-3 rounded-[16px] border border-gray-200 ${
              s.portrait ? 'max-h-[52vh] w-auto mx-auto' : 'w-full'
            }`}
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
