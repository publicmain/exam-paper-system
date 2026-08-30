import type { LessonStage } from './lesson-rules';

/**
 * P8 / P9 —— **服务端决定学生的下一步**（纯函数，无 IO）。
 *
 * 在这之前，课程页把三段并排铺开、每段各挂一个链接，学生自己判断该点
 * 哪个。于是出现了几处真实的断裂：
 *
 * - **阅读根本没有入口**：读段的链接只有在已经有答卷时才存在
 *   （指向逐题详情）。没开始的学生在课程页上找不到任何「开始阅读」——
 *   他必须回去扫码
 * - **词段永远指向翻卡页**：哪怕已经走到「该考」的阶段，点进去还是翻卡，
 *   正式测试的入口只在翻卡完成页里藏着
 * - **做完之后仍是三张卡**：没有总结，学生不知道今天到底考了多少
 *
 * 现在：阶段决定唯一的主要动作，页面只负责显示它。「下一步是什么」是
 * 服务端的判断，不是前端从几个布尔里拼出来的猜测。
 */

export type NextActionKind =
  | 'ready_to_start'
  | 'resume_reading'
  | 'read_result'
  | 'learn_vocab'
  | 'vocab_test'
  /** S12H —— 补段（错题重练）。它一直是三段之一，却从来没有过自己的主行动。 */
  | 'drill'
  | 'summary'
  | 'no_content'
  | 'window_closed'
  | 'level_not_set'
  | 'none';

export interface NextAction {
  kind: NextActionKind;
  /** 按钮上的字 */
  label: string;
  /** 目标路径（不带 query —— 学生身份参数由前端拼） */
  href: string | null;
}

export interface NextActionFacts {
  stage: LessonStage;
  /**
   * P9 —— 今天这个学生有没有课可上，以及为什么没有。
   *
   * `ready`         今天有适合他难度的已发布课程，可以开始
   * `no_content`    今天没排课，或排了但没挂卷子
   * `window_closed` 有课，但此刻不在作答时间内
   * `level_not_set` 他还没定难度，而今天开着好几层 —— 不替他猜
   */
  availability: 'ready' | 'no_content' | 'window_closed' | 'level_not_set';
  /**
   * 正式答卷建了没有（= 有没有 StudentSubmission 行）。
   *
   * 这一条同时就是「能不能进阅读页」的判据 —— 没有答卷，直接打开
   * `/morning-quiz/:id` 连答案都存不下（`no_submission`）。
   *
   * P9 之前答卷**只有扫码才会建**，所以没扫码的学生只能被告知「去扫码」。
   * 现在 `POST /lesson/start` 也会建（账号登录即可），于是同一个事实
   * 对应的下一步从「去扫码」变成了「开始今天的课程」。
   */
  opened: boolean;
  /** 交卷了没有 */
  finalSubmitted: boolean;
  sessionId: string | null;
  submissionId: string | null;

  /**
   * 这次任务开不开得出正式单词测试。
   *
   * 旧任务（`vocabWords = NULL`）开不出 —— 它的考试范围已经无法可靠重建。
   * 不看这一条的话，主按钮会写着「开始单词测试」，点进去却是
   * `insufficient_items` —— 唯一的下一步变成一个死按钮，正是 P8 要消灭的
   * 那种断裂。
   */
  vocabTestAvailable: boolean;
  /**
   * P9 —— 今天到底有没有事情要做（三段的目标任一 > 0）。
   *
   * 全为 0 时三段都被算作「完成」，stage 直接落到 done，学生看到的是
   * 「看今天的总结」—— 点进去是一份空总结。今天没排课就该照实说没排课。
   */
  hasAnyTask: boolean;

  /**
   * S12H —— 补段的目标与进度。**服务端事实**，请求体不参与。
   *
   * 两个都省略 = 调用方还没接线，行为与接线前完全一致（不会凭空冒出
   * 一个 drill 主行动）。接线是下一份合同的事。
   */
  drillTarget?: number;
  drillProgress?: number;
}

/**
 * 补段还没做完吗。
 *
 * 只有**两个事实都给了**才作数 —— 缺一个就当作「不知道」，宁可维持既有
 * 行为，也不猜一个学生没做过的任务出来。
 */
export function drillPending(f: {
  drillTarget?: number;
  drillProgress?: number;
}): boolean {
  if (typeof f.drillTarget !== 'number' || typeof f.drillProgress !== 'number') return false;
  if (f.drillTarget <= 0) return false;
  return f.drillProgress < f.drillTarget;
}

/** 补段的主行动。零进度是「开始」，做过一点是「继续」。 */
function drillAction(f: { drillProgress?: number }): NextAction {
  return {
    kind: 'drill',
    label: (f.drillProgress ?? 0) > 0 ? '继续错题重练' : '开始错题重练',
    // 目标路由由客户端的 NEXT_ACTION_ROUTE 决定 —— 这里不给旧端路径。
    href: null,
  };
}

/**
 * 一个阶段**只给一个**主要动作。
 *
 * 读段还没结束时以读段的实际状态为准（stage 只说「还在读」，说不出
 * 「没开始」还是「做了一半」）；读段结束之后完全由 stage 驱动。
 */
export function nextActionOf(f: NextActionFacts): NextAction {
  if (f.stage === 'reading' || f.stage === 'reading_done') {
    // 没有内容可上时**说清楚是哪一种没有**。三种原因对学生的意义完全
    // 不同：还没发布（等老师）、过了时间（今天来不及了）、难度没定
    // （去找老师）。混成一句「今天没有安排文章」等于什么也没说。
    if (f.availability === 'no_content') {
      return { kind: 'no_content', label: '今天的课程还没有发布', href: null };
    }
    if (f.availability === 'window_closed') {
      return { kind: 'window_closed', label: '今天的作答时间已经结束了', href: null };
    }
    if (f.availability === 'level_not_set') {
      return { kind: 'level_not_set', label: '还没有分配难度 —— 找老师设置一下', href: null };
    }
    if (!f.opened) {
      // P9 —— 账号制入口：登录本身就是资格，点一下就能开始。
      // 这里以前是「扫码签到后开始今天的阅读」，因为答卷只有扫码会建。
      return { kind: 'ready_to_start', label: '开始今天的课程', href: null };
    }
    if (!f.finalSubmitted) {
      return {
        kind: 'resume_reading',
        label: '继续做题',
        href: f.sessionId ? `/morning-quiz/${f.sessionId}` : null,
      };
    }
    // 交了卷但阶段还没往前走（比如被系统收尾）—— 先看结果
    return {
      kind: 'read_result',
      label: '看阅读结果',
      href: f.submissionId ? `/my-history/submission/${f.submissionId}` : null,
    };
  }

  if (f.stage === 'vocab_learn') {
    return { kind: 'learn_vocab', label: '学今天的新词', href: '/my-vocab/review' };
  }

  if (f.stage === 'vocab_test') {
    if (!f.vocabTestAvailable) {
      // 旧任务：没有正式测试可开。补段还欠着的话，那才是真正的下一步；
      // 否则给他今天能看的东西（阅读成绩），而不是一个点了会失败的按钮。
      if (drillPending(f)) return drillAction(f);
      return { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' };
    }
    return { kind: 'vocab_test', label: '开始单词测试', href: '/my-vocab/quiz' };
  }

  // 今天一件事都没有 —— done 只是「没有任何目标」的副产物，不是他做完了。
  if (!f.hasAnyTask) {
    if (f.availability === 'window_closed') {
      return { kind: 'window_closed', label: '今天的作答时间已经结束了', href: null };
    }
    if (f.availability === 'level_not_set') {
      return { kind: 'level_not_set', label: '还没有分配难度 —— 找老师设置一下', href: null };
    }
    return { kind: 'no_content', label: '今天的课程还没有发布', href: null };
  }
  // S12H —— summary 是**最后一步**，不是兜底。三段里还有没做完的，
  // 主行动就该是那一段。补段以前没有自己的 kind，于是全部落进这里。
  if (drillPending(f)) return drillAction(f);
  return { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' };
}
