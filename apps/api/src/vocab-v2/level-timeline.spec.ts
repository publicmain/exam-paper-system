/** UI01 · level-timeline 纯函数（学生首页与教师统计共用的历史事实口径）。 */
import { describe, expect, it } from 'vitest';
import { assignedReadingFor, levelOnDate, sgtDayEndMs } from './level-timeline';

const at = (iso: string) => new Date(iso);

describe('levelOnDate', () => {
  it('新加坡的一天在 UTC 16:00 结束', () => {
    expect(new Date(sgtDayEndMs('2026-09-07')).toISOString()).toBe('2026-09-07T16:00:00.000Z');
  });

  it('今天及以后：现在的档位', () => {
    expect(levelOnDate('2026-09-10', [], 'olevel', '2026-09-10')).toEqual({ level: 'olevel', basis: 'today' });
  });

  it('那天结束前有改档记录：按记录；在第一条记录之前：按它的 fromLevel', () => {
    const changes = [{ fromLevel: 'olevel', toLevel: 'ielts_light', changedAt: at('2026-09-08T03:00:00.000Z'), source: 'student_self' }];
    expect(levelOnDate('2026-09-07', changes, 'ielts_light', '2026-09-10')).toEqual({ level: 'olevel', basis: 'before_first_record' });
    expect(levelOnDate('2026-09-08', changes, 'ielts_light', '2026-09-10')).toEqual({ level: 'ielts_light', basis: 'level_log' });
  });

  it('23:59 SGT 改的档算那一天；00:00 SGT 之后改的算第二天', () => {
    const late = [{ fromLevel: 'olevel', toLevel: 'ielts_light', changedAt: at('2026-09-08T15:59:00.000Z') }];
    const next = [{ fromLevel: 'olevel', toLevel: 'ielts_light', changedAt: at('2026-09-08T16:00:00.000Z') }];
    expect(levelOnDate('2026-09-08', late, 'ielts_light', '2026-09-10').level).toBe('ielts_light');
    expect(levelOnDate('2026-09-08', next, 'ielts_light', '2026-09-10').level).toBe('olevel');
  });

  it('baseline 行之前的日子按 baseline 的档位（旧口径）；fromLevel=null 的首次定档之前没有档位', () => {
    expect(levelOnDate('2026-09-01', [{ fromLevel: null, toLevel: 'olevel', changedAt: at('2026-09-11T02:00:00.000Z'), source: 'baseline' }], 'olevel', '2026-09-12'))
      .toEqual({ level: 'olevel', basis: 'before_first_record' });
    expect(levelOnDate('2026-09-01', [{ fromLevel: null, toLevel: 'olevel', changedAt: at('2026-09-11T02:00:00.000Z'), source: 'student_self' }], 'olevel', '2026-09-12').level)
      .toBeNull();
  });
});

describe('assignedReadingFor', () => {
  const row = (id: string, date: string, level: string, extra: Partial<{ status: string; submission: any }> = {}) => ({
    assignmentId: id,
    classId: 'c1',
    title: id,
    session: { id: `m-${id}`, date: at(`${date}T00:00:00.000Z`), level, status: extra.status ?? 'active' },
    submission: extra.submission ?? null,
  });
  const base = { joinedAtByClass: new Map([['c1', at('2026-09-01T00:00:00.000Z')]]), changes: [], currentLevel: 'olevel', todayKey: '2026-09-10' };

  it('system_eod 自动收卷的仍然欠着；学生自己交的算完成；status=submitted 记待批', () => {
    const out = assignedReadingFor({
      ...base,
      rows: [
        row('a', '2026-09-07', 'olevel', { submission: { id: 's1', status: 'submitted', finalSubmittedAt: at('2026-09-07T05:00:00.000Z'), submitSource: 'system_eod', scripts: 0 } }),
        row('b', '2026-09-08', 'olevel', { submission: { id: 's2', status: 'submitted', finalSubmittedAt: at('2026-09-08T05:00:00.000Z'), submitSource: 'student', scripts: 3 } }),
      ],
    });
    expect(out.map((r) => [r.assignmentId, r.state, r.owed, r.awaitingMarking])).toEqual([
      ['a', 'auto_closed', true, true],
      ['b', 'awaiting_marking', false, true],
    ]);
  });

  it('未来的场次不算；取消且只开了卷（没交）的不算', () => {
    const out = assignedReadingFor({
      ...base,
      rows: [
        row('future', '2026-09-11', 'olevel'),
        row('cancelled', '2026-09-08', 'olevel', { status: 'cancelled', submission: { id: 's', status: 'in_progress', finalSubmittedAt: null, submitSource: null, scripts: 2 } }),
      ],
    });
    expect(out).toEqual([]);
  });
});
