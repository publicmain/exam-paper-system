/**
 * P8.5 —— 未交卷答案草稿的两条规则（纯函数，无 IO）。
 *
 * 1. **哪次写该落库** —— 客户端按题单调递增的序号，服务端只接受更大的。
 * 2. **恢复时 MCQ 该高亮哪个选项** —— 原始 key 翻回学生这次看到的字母。
 *
 * 两条都是实测抓到的缺陷的直接结果：
 *
 * - 改之前是无条件 upsert。发送顺序「旧 → 新 → 延迟到达的旧」之后，
 *   库里留下的是**旧答案** —— 学生改过的答案被自己上一次请求的重试
 *   覆盖掉。重试、弱网、双击、debounce 撞车都会走到这条路上。
 * - 恢复时直接把库里的原始 key 发回前端。选项在交付时被打乱并重新标了
 *   A/B/C/D，于是学生点了「the school」，刷新回来亮的是「the harbour」
 *   —— 系统悄悄改了他的答案。
 */

/**
 * 这次写入该不该落库。
 *
 * @param stored   库里那行的 clientSeq（历史行 / 老客户端写的 = null）
 * @param incoming 请求带来的 clientSeq（老客户端不带 = undefined）
 */
export function acceptsWrite(
  stored: number | null | undefined,
  incoming: number | undefined,
): boolean {
  // 不带序号的调用（老客户端、内部调用）—— 无条件写。升级期间不能把
  // 还没刷新页面的学生挡在外面。
  if (incoming == null) return true;
  // 库里没有序号 —— 放行，让第一次带序号的写入接管这一行。
  if (stored == null) return true;
  // 相等也拒：重试打的是**同一次写**，第一次已经落库了。反过来说，
  // 重试必须沿用原来的序号 —— 换个更大的号重试，等于让这次重试有资格
  // 盖掉学生在重试期间写下的新答案。
  return stored < incoming;
}

/** `acceptsWrite` 的 Prisma where 形态 —— 两者必须表达同一个条件。 */
export function seqWhereClause(incoming: number): {
  OR: Array<{ clientSeq: null } | { clientSeq: { lt: number } }>;
} {
  return { OR: [{ clientSeq: null }, { clientSeq: { lt: incoming } }] };
}

/**
 * 原始选项 key → 学生这次看到的字母。
 *
 * @param optionOrder 打乱表：`optionOrder[显示位置] = 原始位置`
 * @param optionKeys  原始 snapshotOptions 的 key，按原始顺序
 * @param originalKey 库里存的那个 key
 * @returns 显示字母；这题没打乱或 key 不在选项里时返回 null（照原样用）
 */
export function displayKeyOf(
  optionOrder: number[] | undefined,
  optionKeys: string[],
  originalKey: string,
): string | null {
  if (!optionOrder) return null;
  const originalIdx = optionKeys.indexOf(originalKey);
  if (originalIdx < 0) return null;
  const displayedIdx = optionOrder.indexOf(originalIdx);
  if (displayedIdx < 0) return null;
  return String.fromCharCode(65 + displayedIdx);
}
