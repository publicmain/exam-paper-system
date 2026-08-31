/**
 * S12L —— 把服务端的内部值翻成学生看得懂的话。
 *
 * 走查里学生看到的是 `状态：marked` 和 `交卷时间：2026-08-26T00:51:00.000Z`。
 * 两个都是**内部表示**：前者是判分流水线的枚举，后者是 UTC 的 ISO 串
 * （而学生在新加坡，那个「00:51」其实是早上八点五十一）。
 *
 * 两条规矩：
 *   · **认不出来的值原样返回**，绝不猜。多一个未知状态显示成英文，
 *     好过把它硬翻成一个错的中文。
 *   · 时间按**新加坡时间**显示 —— 这个产品只在一个时区用。
 */

const STATUS_TEXT: Readonly<Record<string, string>> = {
  marked: '已批改',
  submitted: '等老师批改',
  in_progress: '还在作答',
  graded: '已批改',
  returned: '已发回',
  practice: '练习',
  auto_closed: '系统收尾',
};

export function statusLabel(status: string | null | undefined): string {
  const k = String(status ?? '').trim();
  if (!k) return '';
  return STATUS_TEXT[k] ?? k;
}

/**
 * ISO 时刻 → 新加坡时间的「8月26日 08:51」。
 *
 * 解析不了就原样返回 —— 显示一个奇怪的字符串，好过显示 `Invalid Date`。
 */
export function dateTimeLabel(iso: string | null | undefined): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return raw;
  const sgt = new Date(t + 8 * 3600_000);
  const mm = sgt.getUTCMonth() + 1;
  const dd = sgt.getUTCDate();
  const hh = String(sgt.getUTCHours()).padStart(2, '0');
  const mi = String(sgt.getUTCMinutes()).padStart(2, '0');
  return `${mm}月${dd}日 ${hh}:${mi}`;
}

/** 只要日期那一半。 */
export function dateLabel(iso: string | null | undefined): string {
  const full = dateTimeLabel(iso);
  return full.includes(' ') ? full.slice(0, full.indexOf(' ')) : full;
}
