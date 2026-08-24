/**
 * 「你是不是想找 ×××？」—— 姓名输错时的相近候选（2026-08-24 学生十问
 * 修复 #9）。
 *
 * 本系统的学生身份就是姓名字符串：输错一个字 = student_not_found =
 * 静默失败，页面上没有任何可操作的引导。这里对在读名册做一次便宜的
 * 编辑距离匹配，把「差一个字」的候选还给学生点选。
 *
 * 隐私权衡：这会向输入了相近姓名的人暴露真实学生姓名。可接受 ——
 * 整套 /my-history 本就是「知道姓名即可查」的模型（校园网 IP 门禁在
 * 前），建议名单最多 3 个且必须足够相近，不构成名册枚举通道（乱输
 * 一个不相近的名字什么都拿不到）。
 */

/** 经典 Levenshtein，O(len_a × len_b)。中文姓名 2–4 字，代价可忽略。 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * 从名册里挑与输入相近的姓名（去重、最多 limit 个）。
 *
 * 「相近」的门槛按长度走：
 *   · 2–3 字的中文名：编辑距离 ≤ 1（差一个字/多打漏打一个字）
 *   · 更长的（4 字名 / 拼音名）：距离 ≤ 2
 * 忽略空白差异（「孙 爱迪」→「孙爱迪」）。完全相同的不算建议 ——
 * 那说明是别的原因（如账号停用），提示错名字反而误导。
 */
export function closeNames(input: string, roster: string[], limit = 3): string[] {
  const norm = (s: string) => s.replace(/\s+/g, '');
  const q = norm(input);
  if (!q) return [];
  const scored: Array<{ name: string; d: number }> = [];
  const seen = new Set<string>();
  for (const name of roster) {
    if (seen.has(name)) continue;
    seen.add(name);
    const t = norm(name);
    if (t === q) continue;
    const maxD = Math.max(q.length, t.length) <= 3 ? 1 : 2;
    if (Math.abs(t.length - q.length) > maxD) continue;
    const d = editDistance(q, t);
    if (d <= maxD) scored.push({ name, d });
  }
  return scored.sort((a, b) => a.d - b.d).slice(0, limit).map((s) => s.name);
}
