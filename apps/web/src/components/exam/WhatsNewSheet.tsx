import { useEffect, useRef, useState } from 'react';

/**
 * 早测 2.0 新功能引导 —— 签到成功之后、进入试卷之前的一屏。
 *
 * ## 为什么是"一屏 + 一次真做"，而不是多步 tour
 *
 * 2026-08-12 老师反馈：2.0 的新功能上线一周，学生根本没注意到。查了
 * 一圈引导模式的公开数据，指向同一个结论：
 *
 * · 传统多步产品导览有 47% 的人直接跳过、78% 中途放弃，tooltip 有
 *   76.3% 在 3 秒内被关掉。做长导览等于白做。
 * · 只有一个行动按钮的欢迎页转化率 74%，给三个以上选项掉到 41%。
 *   所以底部只留一个「开始答题」。
 * · 情境化（用到时才提示）的功能采纳率是预先讲解的 2.9 倍
 *   （42.6% vs 14.7%）—— 所以这一屏只负责"知道有这回事"，
 *   真正的操作提示留在试卷里第一次用到的地方（见 IELTSReadingPassage
 *   的首次提示条）。
 * · 游戏教程那套「show, don't tell」在这里同样成立，但明尼苏达大学
 *   那篇 direct-instruction vs learn-by-doing 的对比也说明：开头给一句
 *   明确的说明，能让人更快到达同等理解、且犯错更少。所以是
 *   「一句话说明 + 立刻让他真点一次」，不是纯放养也不是纯说明书。
 *
 * ## 这一屏最硬的约束：它在偷考试时间
 *
 * 倒计时挂在固定的 quizEnd（9:00），不是从进卷开始算。学生在这里多停
 * 一秒，答题就少一秒。所以：
 *   · 整屏 15 秒能走完，只讲三件事，不讲第四件；
 *   · 「跳过」始终在右上角，不做"必须看完"的强制流程；
 *   · 演示区的释义全部内置，不发任何网络请求 —— 考场 WiFi 卡一下就
 *     毁掉整个体验，而这一步恰恰是最需要瞬时反馈的。
 *
 * 只讲三件事，是按"学生不知道就会吃亏"排的：
 *   1. 点词查义 —— 手势变了（以前要长按），不说没人会发现；
 *   2. 查过的词自动进生词本 —— 交卷后能复习，属于"白拿的好处"；
 *   3. 主观题要写字 —— 这是全班最大的失分来源（空白率而非正确率）。
 */

const SEEN_KEY = 'mq:whatsnew:v2';

export function hasSeenWhatsNew(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false; // 隐私模式下 localStorage 会抛 —— 宁可多弹一次
  }
}

export function markWhatsNewSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 无所谓 */
  }
}

/** 演示句。刻意用一句和本周考卷无关的中性句子，避免提前泄题。
 *  释义内置：考场网络不稳，这一步必须零延迟。 */
const DEMO_SENTENCE = 'The scientists observed a remarkable pattern in the migration of these birds.';
const DEMO_DICT: Record<string, { ph: string; cn: string; en: string }> = {
  scientists: { ph: '/ˈsaɪəntɪsts/', cn: 'n. 科学家（复数）', en: 'people who study science' },
  observed: { ph: '/əbˈzɜːvd/', cn: 'v. 观察到；注意到', en: 'watched carefully; noticed' },
  remarkable: { ph: '/rɪˈmɑːkəbl/', cn: 'adj. 显著的；非凡的', en: 'unusual or surprising in a good way' },
  pattern: { ph: '/ˈpætn/', cn: 'n. 模式；规律', en: 'a regular way in which something happens' },
  migration: { ph: '/maɪˈɡreɪʃn/', cn: 'n. 迁徙；迁移', en: 'seasonal movement from one place to another' },
  birds: { ph: '/bɜːdz/', cn: 'n. 鸟（复数）', en: 'animals with feathers and wings' },
};
/** 引导学生点的那个词 —— 加呼吸动画。游戏教程里的"闪光提示"。 */
const DEMO_TARGET = 'migration';

export default function WhatsNewSheet({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const liveRef = useRef<HTMLDivElement | null>(null);

  // 点过一次之后，把焦点挪到释义上，读屏用户也能听到结果
  useEffect(() => {
    if (picked && liveRef.current) liveRef.current.focus();
  }, [picked]);

  function tap(raw: string) {
    const key = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (!DEMO_DICT[key]) return;
    setPicked(key);
    setTried(true);
  }

  const entry = picked ? DEMO_DICT[picked] : null;

  return (
    <div className="ui-ios fixed inset-0 z-[60] bg-white overflow-y-auto">
      <div className="max-w-md mx-auto px-5 pb-8 pt-4 min-h-full flex flex-col">
        {/* 跳过永远可见 —— 迟到的学生一秒都不该被拦住 */}
        <div className="flex justify-end -mr-2">
          <button
            type="button"
            onClick={onDone}
            className="hit press text-[15px] text-gray-400 px-3 py-2"
          >
            跳过
          </button>
        </div>

        <div className="mt-1">
          <div className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">早测更新了</div>
          <h1 className="text-[26px] font-bold text-gray-900 mt-1 leading-tight">
            这三件事，以前做不到
          </h1>
        </div>

        {/* ① 点词查义 —— 唯一需要动手学的，所以放第一个并且当场练 */}
        <section className="mt-4 rounded-[16px] border border-gray-200 overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                1
              </span>
              <h2 className="text-[17px] font-semibold text-gray-900">看不懂的词，点一下就有意思</h2>
            </div>
            {/* 亲手点过之后这句话就是废话了 —— 收掉，把高度让给下面那条
                关于"别空着"的提醒，那是全班最大的失分来源。 */}
            {!tried && (
              <p className="text-[14px] text-gray-500 mt-1.5 ml-7">
                考试中随时可以查，不用长按，轻轻一点就行。
              </p>
            )}
          </div>

          {/* 演示区：真点一次。说明书看十遍不如自己点一下 */}
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3.5">
            <p className="text-[12px] text-gray-400 mb-1.5">
              {tried ? '就是这样 —— 文章里任何一个词都可以点。' : '试试看：点一下这句话里的任何一个词'}
            </p>
            <p className="text-[16px] leading-[1.85] text-gray-800 font-serif select-none">
              {DEMO_SENTENCE.split(/(\s+)/).map((tok, i) => {
                if (!tok.trim()) return <span key={i}>{tok}</span>;
                const key = tok.toLowerCase().replace(/[^a-z]/g, '');
                const known = !!DEMO_DICT[key];
                const isTarget = key === DEMO_TARGET && !tried;
                const isPicked = key === picked;
                return (
                  <span
                    key={i}
                    onClick={() => tap(tok)}
                    className={[
                      known ? 'cursor-pointer rounded px-0.5' : '',
                      isPicked ? 'bg-blue-600 text-white' : '',
                      isTarget ? 'wn-pulse' : '',
                    ].join(' ')}
                  >
                    {tok}
                  </span>
                );
              })}
            </p>

            {/* 迷你词卡 —— 和考试里真正弹出来的那张长得一样 */}
            {entry && (
              <div
                ref={liveRef}
                tabIndex={-1}
                aria-live="polite"
                className="mt-3 rounded-[14px] bg-white border border-gray-200 px-4 py-3 outline-none"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[19px] font-semibold text-gray-900">{picked}</span>
                  <span className="text-[13px] text-gray-500">{entry.ph}</span>
                </div>
                <div className="text-[15px] text-gray-900 mt-1">{entry.cn}</div>
                <div className="text-[13px] text-gray-500 mt-1 pt-1 border-t border-gray-100">
                  {entry.en}
                </div>
                <div className="text-[12px] text-emerald-600 mt-2">已存入生词本</div>
              </div>
            )}
          </div>
        </section>

        {/* ② 生词本 —— 白拿的好处，不需要学操作，一句话带过 */}
        <section className="mt-3 rounded-[16px] border border-gray-200 px-4 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              2
            </span>
            <h2 className="text-[17px] font-semibold text-gray-900">查过的词，自动存进生词本</h2>
          </div>
          <p className="text-[14px] text-gray-500 mt-1 ml-7">
            不用抄。交卷后在「我的记录」里复习，系统会挑你快忘的词。
          </p>
        </section>

        {/* ③ 主观题 —— 全班最大的失分来源，所以单列一条 */}
        <section className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-bold text-white bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              3
            </span>
            <h2 className="text-[17px] font-semibold text-amber-900">要写字的题，别空着</h2>
          </div>
          <p className="text-[14px] text-amber-800/80 mt-1 ml-7">
            输入框现在能写好几行。空着一定是 0 分，写几个词就有可能得分 ——
            上次全班丢分最多的就是这里。
          </p>
        </section>

        {/* 单一 CTA。给第二个按钮只会稀释这一个。
            sticky 是必须的：学生点开演示词之后卡片会长出一截，实测把
            按钮顶出了视口 —— 那一刻正是他最可能想走的时候，却看不见
            出口。钉在底部，永远一眼可见。 */}
        <div className="mt-auto sticky bottom-0 -mx-5 px-5 pt-3 pb-2 bg-white/95 backdrop-blur border-t border-gray-100">
          <button
            type="button"
            onClick={onDone}
            className="press w-full min-h-[52px] rounded-[16px] bg-blue-600 text-white text-[17px] font-semibold active:bg-blue-700"
          >
            开始答题
          </button>
          <p className="text-[12px] text-gray-400 text-center mt-2">
            这个提示只出现一次，之后不会再打扰你。
          </p>
        </div>
      </div>
    </div>
  );
}
