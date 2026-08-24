/**
 * ECDICT 释义的展示过滤（2026-08-25 浏览器实测发现）。
 *
 * 释义放宽到多行后，ECDICT 里的专业义项行跟着漏了出来 ——
 * borrow 的第三行是「[计] 借位; 借位数」，对基础层学生是纯噪音，
 * 还可能被当成主义项记住。以 [标签] 开头的行（[计]/[医]/[化]/[经]/
 * [律]/[机] …）一律滤掉；万一整条释义全是专业行（纯术语词条），
 * 保底放回原始行 —— 显示噪音好过显示空白。
 */
export function displayTranslation(translation: string, maxLines = 6): string {
  const lines = (translation ?? '').split('\n');
  const clean = lines.filter((l) => !/^\s*\[[^\]]{1,8}\]/.test(l));
  return (clean.length ? clean : lines).slice(0, maxLines).join('\n');
}
