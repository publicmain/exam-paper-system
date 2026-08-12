import { useState } from 'react';
import {
  consumeInstallPrompt,
  detectPlatform,
  getInstallPrompt,
  type Platform,
} from '../lib/pwa';

/**
 * 签到后的分机型安装教程（一次性整屏）。
 *
 * 老师的要求：明早学生扫码答题时弹一遍教程，教他们把「早测查询」装到
 * 手机主屏幕，**按机型给不同的步骤，必须配图**。
 *
 * 配图没有去网上扒别人的截图 —— 版权是本仓库铁律，而且网图多半是英文
 * 系统、风格杂乱、圈不准按钮。九张分步示意图全部自绘（iPhone 4 张 /
 * iPad 2 张 / 安卓 3 张），界面元素按真机布局复刻，App 名字和图标就是
 * 我们自己的，红圈精确标在要点的位置上。
 *
 * 机型检测自动选步骤（iPad 的分享按钮在右上角、iPhone 在底部 ——
 * 这正是必须分机型的原因），检测错了学生可以手动切换。安卓上若拿到
 * beforeinstallprompt,直接给「一键安装」按钮,截图只作后备。
 *
 * 时间纪律（和 WhatsNewSheet 同一条）：这一屏站在倒计时里。所以
 * 「跳过」常驻右上角；底部 CTA 是「开始答题」而非「去安装」；并明确
 * 告诉学生**交卷后在成绩页也能装**（那里有 InstallAppCard 接住）——
 * 现在只要知道有这回事，不必现在动手。
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

const STEPS: Record<Exclude<Platform, 'other'>, Array<{ img: string; text: string }>> = {
  iphone: [
    { img: '/install-guide/ip1.png', text: '点 Safari 底部中间的「分享」按钮' },
    { img: '/install-guide/ip2.png', text: '往下找，点「添加到主屏幕 / Add to Home Screen」' },
    { img: '/install-guide/ip3.png', text: '点右上角「添加」' },
    { img: '/install-guide/ip4.png', text: '完成！以后在主屏幕点这个图标就行' },
  ],
  ipad: [
    { img: '/install-guide/pad1.png', text: 'iPad 的「分享」按钮在右上角（地址栏旁边）' },
    { img: '/install-guide/pad2.png', text: '点「添加到主屏幕」，再点「添加」' },
  ],
  android: [
    { img: '/install-guide/and1.png', text: '点浏览器右上角「⋮」菜单' },
    { img: '/install-guide/and2.png', text: '点「安装应用」（有的手机叫「添加到主屏幕」）' },
    { img: '/install-guide/and3.png', text: '点「安装」，桌面就有图标了' },
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
  const [canOneTap, setCanOneTap] = useState(() => tab === 'android' && !!getInstallPrompt());
  const [installed, setInstalled] = useState(false);

  return (
    <div className="ui-ios fixed inset-0 z-[60] bg-white overflow-y-auto">
      <div className="max-w-md mx-auto px-5 pb-4 pt-4 min-h-full flex flex-col">
        {/* 跳过永远可见 —— 这一屏站在考试倒计时里 */}
        <div className="flex justify-end -mr-2">
          <button type="button" onClick={onDone} className="hit press text-[15px] text-gray-400 px-3 py-2">
            跳过
          </button>
        </div>

        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-[11px] shadow-sm" />
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">
              把「早测查询」装到你的{TAB_LABEL[tab]}上
            </h1>
            <p className="text-[13px] text-gray-500 mt-0.5">
              装好后随时点开就是成绩和生词本 —— 不用扫码、不用输名字。
            </p>
          </div>
        </div>

        {/* 机型切换：检测会错（iPad 自称 Mac、国产安卓浏览器五花八门），
            给学生自己纠正的口子 */}
        <div className="seg mt-4" role="tablist" aria-label="选择你的设备">
          {(Object.keys(TAB_LABEL) as Array<keyof typeof TAB_LABEL>).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              data-on={tab === k}
              onClick={() => setTab(k)}
            >
              {TAB_LABEL[k]}
              {detected === k && <span className="text-[10px] ml-1 opacity-70">（你的）</span>}
            </button>
          ))}
        </div>

        {/* 安卓一键安装 —— 系统支持时截图教程只是后备 */}
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
            className="press mt-4 w-full min-h-[52px] rounded-[14px] bg-emerald-600 text-white text-[17px] font-semibold active:bg-emerald-700"
          >
            ⚡ 你的手机支持一键安装 —— 点这里
          </button>
        )}
        {installed && (
          <div className="mt-4 rounded-[14px] bg-emerald-50 border border-emerald-200 px-4 py-3 text-[15px] text-emerald-800 font-semibold">
            ✅ 已安装！去主屏幕找「早测查询」图标。
          </div>
        )}

        {/* 分步截图 */}
        <div className="mt-4 space-y-4">
          {STEPS[tab].map((s, i) => (
            <figure key={s.img}>
              <img
                src={s.img}
                alt={`第 ${i + 1} 步`}
                loading={i > 0 ? 'lazy' : undefined}
                className="w-full rounded-[16px] border border-gray-200"
              />
              <figcaption className="mt-1.5 text-[14px] text-gray-700 font-medium">
                {i + 1}. {s.text}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* CTA：先考试。别让教程和倒计时抢学生 —— 交卷后成绩页还有
            一张安装引导卡（InstallAppCard）接住没装的人。 */}
        <div className="mt-auto sticky bottom-0 -mx-5 px-5 pt-3 pb-3 bg-white/95 backdrop-blur border-t border-gray-100">
          <button
            type="button"
            onClick={onDone}
            className="press w-full min-h-[52px] rounded-[16px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700"
          >
            知道了，开始答题
          </button>
          <p className="text-[12px] text-gray-400 text-center mt-2">
            不用现在装 —— 交卷后在成绩页也能装，这个提示只出现一次。
          </p>
        </div>
      </div>
    </div>
  );
}
