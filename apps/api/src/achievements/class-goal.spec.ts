import { describe, expect, it } from 'vitest';
import { CLASS_GOAL_MIN_MEMBERS, classGoalProgress, type MemberReadings } from './class-goal';

const member = (id: string, readings: MemberReadings['readings']): MemberReadings => ({ studentId: id, readings });
const r = (date: string, completed: boolean, over: Partial<{ cancelled: boolean; finalSubmittedAt: Date | null }> = {}) => ({
  date,
  completed,
  cancelled: false,
  finalSubmittedAt: completed ? new Date(`${date}T08:00:00.000Z`) : null,
  ...over,
});

const WEEK = '2026-09-14';
const TODAY = '2026-09-16'; // 周三

describe('班级周目标', () => {
  it('**按实际分配归一化**：分母是本周到今天为止每个人实际分到的份数之和；今天以后的不算', () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      member(`s${i}`, [r('2026-09-14', true), r('2026-09-15', i < 3), r('2026-09-16', false), r('2026-09-17', false)]),
    );
    expect(classGoalProgress({ weekStart: WEEK, todayKey: TODAY, members })).toEqual({
      visible: true,
      weekStart: WEEK,
      weekEnd: '2026-09-20',
      activeMembers: 5,
      assigned: 15,
      completed: 8,
      pct: 53,
      catchUp: 0,
    });
  });

  it('**补做单独数**：本周交的上周的卷不进本周完成率', () => {
    const members = Array.from({ length: 5 }, (_, i) =>
      member(`s${i}`, [
        r('2026-09-14', true),
        r('2026-09-10', true, { finalSubmittedAt: new Date('2026-09-15T08:00:00.000Z') }), // 上周四的卷，本周二补交
      ]),
    );
    const p = classGoalProgress({ weekStart: WEEK, todayKey: TODAY, members });
    expect(p).toMatchObject({ visible: true, assigned: 5, completed: 5, pct: 100, catchUp: 5 });
  });

  it('取消的场次不进分母；这周没分配的成员不算有效成员（新生 / 没有这档场次）', () => {
    const members = [
      ...Array.from({ length: 5 }, (_, i) => member(`s${i}`, [r('2026-09-14', true), r('2026-09-15', false, { cancelled: true })])),
      member('new', []),
    ];
    expect(classGoalProgress({ weekStart: WEEK, todayKey: TODAY, members })).toMatchObject({ visible: true, activeMembers: 5, assigned: 5, completed: 5 });
  });

  it(`**有效成员不足 ${CLASS_GOAL_MIN_MEMBERS} 人 → 不给任何数字**（小班能从数字反推出个人）`, () => {
    const members = Array.from({ length: 4 }, (_, i) => member(`s${i}`, [r('2026-09-14', i === 0)]));
    const p = classGoalProgress({ weekStart: WEEK, todayKey: TODAY, members });
    expect(p).toEqual({ visible: false, reason: 'small_group', weekStart: WEEK, weekEnd: '2026-09-20' });
    expect(p).not.toHaveProperty('completed');
  });

  it('周末看：分母截到周日；下周一看上周目标不会把下周的任务算进来', () => {
    const members = Array.from({ length: 5 }, (_, i) => member(`s${i}`, [r('2026-09-18', true), r('2026-09-21', false)]));
    expect(classGoalProgress({ weekStart: WEEK, todayKey: '2026-09-22', members })).toMatchObject({ visible: true, assigned: 5, completed: 5 });
  });
});
