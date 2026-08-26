/**
 * PWA 启动时把 /my-history 变成课程页入口（4.0 阶段 A 的最后一块）。
 *
 * ## 背景
 *
 * 全班的手机主屏图标烧死的 start_url 是 /my-history —— manifest 改了
 * 只对**新安装**生效，已装的 app 不会跟着变，也不能要求 35 个学生
 * 重新保存一遍。但那个页面是我们自己的：让它在「作为 app 启动」这一种
 * 情况下自己跳到 /my-lesson，学生什么都不用做。
 *
 * ## 「作为 app 启动」怎么判定（三个条件缺一不可）
 *
 * 1. **standalone 显示模式** —— 从主屏图标打开才有；浏览器里点链接
 *    进来的不算，他们就是想看成绩。
 * 2. **URL 一个查询参数都没有** —— PWA 启动加载的就是裸的 /my-history。
 *    任何带参数的访问（?name= 深链、?submissionId=、from=lesson）都是
 *    页内导航或分享链接，绝不能弹走。
 * 3. **本地存过名字** —— 没存过名字的人跳过去也是白屏，留在原页走
 *    输名字流程。
 *
 * ## 每会话只跳一次
 *
 * sessionStorage 标记。课程页页脚会链回成绩页（带参数，本就不触发），
 * 但学生手动清地址栏、或某些安卓壳把参数吃掉时，这个标记保证不会
 * 出现「想看成绩永远被弹走」的死循环。PWA 冷启动是新 session，
 * 所以「每次打开 app 落到今天的课」的体验不受影响。
 */

const REDIRECT_FLAG = 'lesson:launch-redirected';

export function isStandaloneDisplay(): boolean {
  try {
    return (
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** 纯判定，方便测试。search 形如 "?a=b" 或 ""。 */
export function shouldRedirectToLesson(input: {
  standalone: boolean;
  search: string;
  savedName: string | null;
  alreadyRedirected: boolean;
}): boolean {
  return (
    input.standalone &&
    (input.search === '' || input.search === '?') &&
    !!input.savedName?.trim() &&
    !input.alreadyRedirected
  );
}

/** 副作用版：判定 + 记标记 + 返回目标 URL（不跳则返回 null）。 */
export function lessonLaunchRedirect(): string | null {
  let saved: string | null = null;
  let flagged = false;
  try {
    saved = localStorage.getItem('mq:history:name');
    flagged = sessionStorage.getItem(REDIRECT_FLAG) === '1';
  } catch {
    return null;
  }
  if (
    !shouldRedirectToLesson({
      standalone: isStandaloneDisplay(),
      search: window.location.search,
      savedName: saved,
      alreadyRedirected: flagged,
    })
  ) {
    return null;
  }
  try {
    sessionStorage.setItem(REDIRECT_FLAG, '1');
  } catch {
    /* ignore */
  }
  const sid = (() => {
    try {
      return localStorage.getItem('mq:history:studentId');
    } catch {
      return null;
    }
  })();
  return (
    '/my-lesson?name=' +
    encodeURIComponent(saved!.trim()) +
    (sid ? '&studentId=' + encodeURIComponent(sid) : '')
  );
}
