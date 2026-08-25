/**
 * 学生数据导出时的匿名代号（2026-08-25 外部审查 P0-7）。
 *
 * 判分流程会把答卷 dump 出来贴进对话交给 Claude 判。姓名 + 成绩 +
 * 答题内容合起来是**可识别的个人数据**（PDPC 口径），而判分根本不需要
 * 知道学生叫什么 —— 判完靠 scriptId 写回，全程与姓名无关。
 *
 * 所以导出默认用代号。性质：
 *   · **稳定** —— 同一学生在任何一次导出里都是同一个代号，
 *     「这两份是同一个人」的判断仍然成立；
 *   · **不可逆** —— 拿到代号无法反推 studentId 或姓名（单向 hash + 截断）；
 *   · **可能碰撞** —— 一万个桶对 35 人的班绰绰有余；真需要精确身份时
 *     用 --with-names，那是显式决策。
 */
export function anonId(studentId: string): string {
  let h = 2166136261;
  for (const ch of studentId) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return 'S-' + (Math.abs(h) % 10000).toString().padStart(4, '0');
}
