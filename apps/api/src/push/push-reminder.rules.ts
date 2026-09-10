/**
 * 每日提醒推给谁 —— 纯规则，不碰库，测试直接钉。
 *
 * 推的对象只有一种人：**订阅了、今天有课、还没交阅读卷、今天还没被提醒过**。
 *
 *   · 没订阅的当然推不到
 *   · 今天没课（周末、没发布内容、班里没排）—— 提醒「课没做完」就是说谎
 *   · 已经交了阅读卷的不打扰。单词那半段不看：交了卷说明人已经在做了，
 *     再推一条只会烦
 *   · 一天一条，靠 `lastSentAt` 落在今天之后判断
 */
export interface ReminderFacts {
  /** 有推送订阅的学生 */
  subscribed: Iterable<string>;
  /** 今天有场次的学生（按班级注册算） */
  hasSessionToday: ReadonlySet<string>;
  /** 今天已经最终交了阅读卷的学生 */
  doneToday: ReadonlySet<string>;
  /** 今天已经收到过提醒的学生 */
  sentToday: ReadonlySet<string>;
}

export function reminderTargets(facts: ReminderFacts): string[] {
  const out = new Set<string>();
  for (const id of facts.subscribed) {
    if (!facts.hasSessionToday.has(id)) continue;
    if (facts.doneToday.has(id)) continue;
    if (facts.sentToday.has(id)) continue;
    out.add(id);
  }
  return [...out];
}

/** 默认 16:30 —— 首发三天 78 份阅读卷里 36 份在 16 点那个小时开的。 */
export const DEFAULT_REMINDER_TIME = '16:30';

/**
 * `PUSH_REMINDER_TIME=HH:MM`（新加坡时间）。领导那个「时间窗」的决定还没
 * 定下来，所以时刻做成环境变量，改一下不用重新部署代码。
 * 格式不对就退回默认，并且**不抛** —— 提醒时刻写错不该让整个 API 起不来。
 */
export function reminderTime(raw = process.env.PUSH_REMINDER_TIME): string {
  const m = String(raw ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return DEFAULT_REMINDER_TIME;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return DEFAULT_REMINDER_TIME;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** cron 表达式：只在工作日（周一到周五）。周末没课，见 reminderTargets。 */
export function reminderCronExpression(raw = process.env.PUSH_REMINDER_TIME): string {
  const [h, m] = reminderTime(raw).split(':').map(Number);
  return `${m} ${h} * * 1-5`;
}

/**
 * 新加坡日历日 → 存库口径（当天 UTC 午夜），与 `MorningQuizSession.date`
 * 同一约定。
 */
export function sgtDayStart(now: Date, tzOffsetMin = 8 * 60): Date {
  const local = new Date(now.getTime() + tzOffsetMin * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** 「今天」在真实时间轴上的起点（SGT 00:00 对应的 UTC 时刻），比 `lastSentAt` 用。 */
export function sgtDayStartInstant(now: Date, tzOffsetMin = 8 * 60): Date {
  return new Date(sgtDayStart(now, tzOffsetMin).getTime() - tzOffsetMin * 60_000);
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** 提醒内容。不带姓名 —— 通知会在锁屏上显示，别人看得见。 */
export const DAILY_REMINDER_PAYLOAD: PushPayload = {
  title: '每日英语',
  body: '今天的课还没做完 —— 阅读加单词，一刻钟左右。',
  url: '/today',
  tag: 'daily-reminder',
};
