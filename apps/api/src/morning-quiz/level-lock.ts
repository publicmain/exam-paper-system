import type { EnglishLevel } from '@prisma/client';

/**
 * P4 —— 学生难度的**单一事实来源**规则（纯函数，无 IO）。
 *
 * 事实来源只有 `User.englishLevel` 一个。这里把「这次扫码该落到哪一层、
 * 要不要写库、要不要拒绝」这三个判断从 attendance.service 的六道门里
 * 摘出来，因为它们是纯逻辑，值得被单独钉死：扫码链路本身要起数据库
 * 才能跑，而难度规则错一次，学生就被锁进错的层。
 *
 * 三种难度信息的语义**必须分清**（混淆过一次就会写出「改了难度连历史
 * 成绩一起变」的 bug）：
 *   · 学生属性  User.englishLevel        —— 他现在在哪层，会变，只有一份
 *   · 任务快照  MorningQuizSession.level —— 那一场是哪层，历史，永不改写
 *   · 临时输入  sessionIdOverride        —— 这次点了哪个按钮，用完即弃
 */

export type LevelDecision =
  /** 已落定且与本场一致，或本人那层今天没开 —— 直接放行，不写库 */
  | { kind: 'proceed' }
  /** 尚未落定 —— 放行，并把本场的层写成他的难度（仅当库里仍是 null） */
  | { kind: 'land'; level: EnglishLevel }
  /** 已落定但这次要进别的层，而他那层今天正开着 —— 拒绝，让他回正确的场 */
  | { kind: 'locked'; lockedLevel: EnglishLevel; correctSessionId: string };

export interface LevelDecisionInput {
  /** 学生当前难度（库里的值）。null = 尚未落定 */
  storedLevel: EnglishLevel | null | undefined;
  /** 这次实际要进的场次 */
  session: { id: string; level: EnglishLevel };
  /** 今天这个班开着的所有场次（含本场） */
  activeSiblings: ReadonlyArray<{ id: string; level: EnglishLevel }>;
  /**
   * 【测试】班：教师的测试旋转门。测试用的扫码**绝不**落定或校验难度，
   * 否则教师试一遍就把自己（或被借用的测试学生）锁进某一层了。
   */
  isTestClass: boolean;
}

export function decideLevel(input: LevelDecisionInput): LevelDecision {
  // 测试班：什么都不管，随便进（教师明确要求「随意测试随意进入」）
  if (input.isTestClass) return { kind: 'proceed' };

  const stored = input.storedLevel ?? null;

  // ① 尚未落定 —— 这次进哪层，哪层就是他的难度
  if (stored == null) return { kind: 'land', level: input.session.level };

  // ② 已落定且本场就是那层 —— 正常路径，绝大多数扫码走这里
  if (stored === input.session.level) return { kind: 'proceed' };

  // ③ 已落定但要进别的层。只有在他那层**今天真的开着**时才拒绝 ——
  //    否则（学校今天没排他那层）拒绝就等于把他挡在早测门外，代价远
  //    大于让他临时做一次别的层。此时同样**不改写**他的难度。
  const correct = input.activeSiblings.find((s) => s.level === stored);
  if (!correct) return { kind: 'proceed' };

  return { kind: 'locked', lockedLevel: stored, correctSessionId: correct.id };
}
