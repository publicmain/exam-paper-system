import type { EnglishLevel } from '@prisma/client';

/**
 * P9 —— 账号制课程入口：**服务端替学生挑今天该上哪一场**（纯函数，无 IO）。
 *
 * ## 为什么需要它
 *
 * 在这之前，「学生今天做哪份卷子」是**扫码**决定的：他扫哪张码就进哪一
 * 场，服务端只负责校验。改成账号制之后没有人替他做这个选择，服务端必须
 * 自己算出来 —— 而且要算得**确定**：同一个学生同一天反复调用必须落到
 * 同一场，否则会创建出两份正式答卷（答卷唯一性是按 assignmentId 的，
 * 不同场次就是不同 assignment，唯一索引拦不住）。
 *
 * 所以这里绝不依赖数据库的返回顺序 —— 候选场次先按固定顺序排好再挑。
 *
 * ## 与 P4 的关系
 *
 * P4 的 `decideLevel` 回答的是「学生要进这一场，准不准」；这里回答的是
 * 「没有人指定场次时，该进哪一场」。两者共用同一套难度语义：
 *
 *   · 学生属性  User.englishLevel        —— 他现在在哪层，会变，只有一份
 *   · 任务快照  MorningQuizSession.level —— 那一场是哪层，历史，永不改写
 *
 * 「默认层今天没开 → 可以临时参加别的层，但**不改写**他的难度」这条也
 * 原样沿用 P4，只是判断方向反过来。
 */

/** 稳定排序用的固定层序 —— 数据库返回顺序不参与决策。 */
const LEVEL_ORDER: EnglishLevel[] = ['ielts_authentic', 'ielts_simplified', 'olevel'] as EnglishLevel[];

function levelRank(l: EnglishLevel): number {
  const i = LEVEL_ORDER.indexOf(l);
  return i < 0 ? LEVEL_ORDER.length : i;
}

export interface SessionCandidate {
  id: string;
  level: EnglishLevel;
  /** 这一场有没有挂卷子。没挂就没内容可上。 */
  hasPaper: boolean;
  /** 这一场此刻还能不能作答（正式窗口或补考窗口）。 */
  windowOpen: boolean;
}

export type PickResult =
  /** 选定了一场。`land` 非空表示要顺便把这一层落定成学生的难度（P4 首次落定）。 */
  | { kind: 'session'; sessionId: string; level: EnglishLevel; land: EnglishLevel | null }
  /** 今天这个班一场可用的都没有（没排、没挂卷子）。 */
  | { kind: 'no_content' }
  /** 有内容，但此刻都不在作答时间内。**不能谎称没有内容**。 */
  | { kind: 'window_closed' }
  /**
   * 学生还没定难度，而今天开着好几层 —— 不替他猜。
   *
   * 偷偷选一层的代价是：他做了错难度的卷子，而 P4 的首次落定会把这个
   * 错误**固化成他的长期难度**。宁可让他去找老师。
   */
  | { kind: 'level_not_set' };

export interface PickInput {
  storedLevel: EnglishLevel | null | undefined;
  /** 今天这个班的场次（调用方只传 status=active 的）。 */
  candidates: ReadonlyArray<SessionCandidate>;
  /** 【测试】班：教师随意进，不校验也不落定难度（与 P4 一致）。 */
  isTestClass: boolean;
}

export function pickTodaySession(input: PickInput): PickResult {
  // 没挂卷子的场次等于没有内容 —— 排在最前面滤掉，免得它把
  // 「今天没排课」误报成「窗口关了」。
  const withPaper = [...input.candidates].filter((s) => s.hasPaper);
  if (withPaper.length === 0) return { kind: 'no_content' };

  // 确定性：固定层序 + id 兜底，与数据库返回顺序无关。
  const sorted = withPaper.sort(
    (a, b) => levelRank(a.level) - levelRank(b.level) || a.id.localeCompare(b.id),
  );
  const open = sorted.filter((s) => s.windowOpen);
  if (open.length === 0) return { kind: 'window_closed' };

  // 测试班：取第一场，不落定难度
  if (input.isTestClass) {
    return { kind: 'session', sessionId: open[0].id, level: open[0].level, land: null };
  }

  const stored = input.storedLevel ?? null;

  if (stored != null) {
    const mine = open.find((s) => s.level === stored);
    // ① 他那层今天开着 —— 正常路径
    if (mine) return { kind: 'session', sessionId: mine.id, level: mine.level, land: null };
    // ② 他那层今天没开 —— 临时参加别的层（P4 的既定规则），**不改写难度**
    return { kind: 'session', sessionId: open[0].id, level: open[0].level, land: null };
  }

  // ③ 还没定难度，今天只开了一层 —— 进它，并把这一层落定（P4 首次落定）
  if (open.length === 1) {
    return { kind: 'session', sessionId: open[0].id, level: open[0].level, land: open[0].level };
  }

  // ④ 还没定难度，却有好几层可选 —— 不猜
  return { kind: 'level_not_set' };
}
