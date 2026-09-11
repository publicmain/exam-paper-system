/**
 * 学生难度的时间线与「某一天实际分配给他的阅读」（UI01 / T01 / T06，2026-09-11）。
 *
 * ## 为什么要有
 * 原来学生首页和教师统计都拿**现在的** `User.englishLevel` 去匹配过去每一天的场次：
 * 学生从 A 档改到 B 档，过去没做的 A 档欠账整批消失，又冒出一批当时根本没分配给他的
 * B 档欠账；教师那边同样被改写。
 *
 * ## 历史事实的优先级（学生端和教师端共用这一个函数，口径才能一致）
 *   1. 他在那一天（同一个班）**有答卷**的场次 —— 这是既成事实，与现在的档位无关；
 *      那天那班只认有答卷的，不再按档位另算一份。
 *   2. 没有答卷：按**那一天结束时**他所在的档位（`StudentLevelChange` 记录推出来）
 *      找那一档的场次；今天还没结束 → 用现在的档位（改档影响的就是今天及以后没冻结的任务）。
 *   3. 取消的场次（`status = cancelled`）：没交过的不算欠；已最终交卷的留档，算完成、不算欠。
 *   4. 入班当天（新加坡时间）之前的场次不算他的。
 *
 * ## 历史限制（台账里写明）
 *   · 记录从本次上线起才有。上线前从没改过档的学生不受影响；上线前改过档、又有上线前
 *     没开始的日子的，那些日子只能按「上线时的档位」算（与旧口径相同）—— 不猜他当时在哪档，
 *     也不往库里补造记录。`levelBasis` 标明每一天用的是哪种依据。
 *   · 教师在花名册改档（users.service）尚未写记录；10 分钟一次的 cron 会把「记录里最后的
 *     档位 ≠ 现在的档位」补记成一条 observed 变更（时间取发现时刻）。
 */

export type LevelBasis =
  /** 那天结束前有记录的改档，按记录 */
  | 'level_log'
  /** 那天在第一条记录之前：用第一条记录的 fromLevel（= 上线/开始记录时的档位） */
  | 'before_first_record'
  /** 从没有任何记录：用现在的档位（旧口径） */
  | 'current'
  /** 今天：用现在的档位 */
  | 'today';

export interface LevelChangeRow {
  fromLevel: string | null;
  toLevel: string;
  changedAt: Date;
  /** student_self | teacher | observed | baseline */
  source?: string;
}

/** `YYYY-MM-DD`（新加坡）那一天结束的时刻（= 次日 00:00 SGT）。 */
export function sgtDayEndMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00.000Z`) + 86_400_000 - 8 * 3600_000;
}

/** 某一天（新加坡日期）结束时学生所在的档位。 */
export function levelOnDate(
  dateKey: string,
  changes: readonly LevelChangeRow[],
  currentLevel: string | null,
  todayKey: string,
): { level: string | null; basis: LevelBasis } {
  if (dateKey >= todayKey) return { level: currentLevel, basis: 'today' };
  const end = sgtDayEndMs(dateKey);
  const sorted = [...changes].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  let before: LevelChangeRow | null = null;
  let after: LevelChangeRow | null = null;
  for (const change of sorted) {
    if (change.changedAt.getTime() < end) before = change;
    else if (!after) after = change;
  }
  if (before) return { level: before.toLevel, basis: 'level_log' };
  if (after) {
    // baseline 行只记「开始记录那一刻他在哪档」，之前的日子只能按它算（= 旧口径）；
    // 真正的改档行有 fromLevel，就是改之前那一档（null = 那时还没定档，没有阅读任务）
    const level = after.source === 'baseline' ? after.toLevel : after.fromLevel;
    return { level, basis: 'before_first_record' };
  }
  return { level: currentLevel, basis: 'current' };
}

export interface ReadingAssignmentRow {
  assignmentId: string;
  classId: string;
  title: string | null;
  session: { id: string; date: Date; level: string; status: string };
  /** 这个学生在这份卷上的答卷（practice 已排除）；没有就是 null */
  submission: {
    id: string;
    status: string;
    finalSubmittedAt: Date | null;
    submitSource: string | null;
    scripts: number;
  } | null;
}

export type ReadingState = 'not_started' | 'in_progress' | 'completed' | 'awaiting_marking' | 'auto_closed';

export interface AssignedReading extends ReadingAssignmentRow {
  date: string;
  /** 这一天为什么算他的 */
  basis: 'submission' | LevelBasis;
  /** 按那天事实推出来的档位（有答卷时就是那份卷的档位） */
  level: string;
  cancelled: boolean;
  state: ReadingState;
  /** 学生自己最终交了（system_eod 不算） */
  completed: boolean;
  /** 答卷状态是 submitted（等老师批） */
  awaitingMarking: boolean;
  /** 还欠着：没取消、没完成 */
  owed: boolean;
}

function readingState(submission: ReadingAssignmentRow['submission']): ReadingState {
  if (!submission) return 'not_started';
  if (submission.finalSubmittedAt && submission.submitSource === 'system_eod') return 'auto_closed';
  if (submission.finalSubmittedAt) return submission.status === 'submitted' ? 'awaiting_marking' : 'completed';
  return submission.scripts > 0 ? 'in_progress' : 'not_started';
}

/**
 * 一个学生每一天实际被分配的阅读（见文件头的优先级）。`rows` 是他所在各班的场次
 *（任意档位），`joinedAtByClass` 是各班入班时刻。只返回今天及以前的。
 */
export function assignedReadingFor(input: {
  rows: readonly ReadingAssignmentRow[];
  joinedAtByClass: ReadonlyMap<string, Date>;
  changes: readonly LevelChangeRow[];
  currentLevel: string | null;
  todayKey: string;
}): AssignedReading[] {
  const sgtKey = (date: Date) => new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const dateKeyOf = (row: ReadingAssignmentRow) => row.session.date.toISOString().slice(0, 10);
  const eligible = input.rows.filter((row) => {
    const joined = input.joinedAtByClass.get(row.classId);
    if (!joined) return false;
    const key = dateKeyOf(row);
    return key >= sgtKey(joined) && key <= input.todayKey;
  });
  // 同一天同一个班，他有答卷的就是事实
  const submittedDays = new Set(eligible.filter((row) => row.submission).map((row) => `${row.classId}|${dateKeyOf(row)}`));
  const out: AssignedReading[] = [];
  for (const row of eligible) {
    const key = dateKeyOf(row);
    const cancelled = row.session.status === 'cancelled';
    const state = readingState(row.submission);
    const completed = state === 'completed' || state === 'awaiting_marking';
    let basis: AssignedReading['basis'];
    if (row.submission) {
      basis = 'submission';
    } else {
      if (submittedDays.has(`${row.classId}|${key}`)) continue;
      const { level, basis: levelBasis } = levelOnDate(key, input.changes, input.currentLevel, input.todayKey);
      if (!level || level !== row.session.level) continue;
      basis = levelBasis;
    }
    // 取消的场次：没最终交过的不算他的任务；交过的留档（算完成，不算欠）
    if (cancelled && !completed) continue;
    out.push({
      ...row,
      date: key,
      basis,
      level: row.session.level,
      cancelled,
      state,
      completed,
      awaitingMarking: row.submission?.status === 'submitted',
      owed: !cancelled && !completed,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.assignmentId.localeCompare(b.assignmentId));
}
