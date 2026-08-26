import type { LessonStage } from './lesson-rules';

/**
 * P8 —— **服务端决定学生的下一步**（纯函数，无 IO）。
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
  | 'scan_required'
  | 'resume_reading'
  | 'read_result'
  | 'learn_vocab'
  | 'vocab_test'
  | 'summary'
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
  /** 今天有没有安排文章 */
  hasSession: boolean;
  /**
   * 卷子给他开出来没有（= 有没有 StudentSubmission 行）。
   *
   * 这一条同时就是「能不能进阅读页」的判据：答卷是**扫码时**建的，
   * 没有它，直接打开 `/morning-quiz/:id` 连答案都存不下
   * （`no_submission` / `no_attendance_record`）。浏览器实测抓到 ——
   * 先前这里给的是「开始今天的阅读」，点进去看得到题、答完存不上。
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
}

/**
 * 一个阶段**只给一个**主要动作。
 *
 * 读段还没结束时以读段的实际状态为准（stage 只说「还在读」，说不出
 * 「没开始」还是「做了一半」）；读段结束之后完全由 stage 驱动。
 */
export function nextActionOf(f: NextActionFacts): NextAction {
  if (f.stage === 'reading' || f.stage === 'reading_done') {
    if (!f.hasSession) {
      // 今天没排文章 —— 不给一个点了会失望的按钮
      return { kind: 'none', label: '今天没有安排文章', href: null };
    }
    if (!f.opened) {
      // 卷子还没为他开出来 —— 入口在老师投屏的二维码上，课程页给不出
      // 一个能替他扫码的链接。给一句实话，不给一个点了会失败的按钮。
      return { kind: 'scan_required', label: '扫码签到后开始今天的阅读', href: null };
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
      // 旧任务：没有正式测试可开。给他今天能看的东西（阅读成绩），
      // 而不是一个点了会失败的按钮。
      return { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' };
    }
    return { kind: 'vocab_test', label: '开始单词测试', href: '/my-vocab/quiz' };
  }

  return { kind: 'summary', label: '看今天的总结', href: '/my-lesson/summary' };
}
