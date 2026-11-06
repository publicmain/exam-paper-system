import { describe, expect, it, vi } from 'vitest';
import { LearningReportController } from './learning-report.controller';

describe('learning report endpoints', () => {
  const actor = { id: 'teacher', role: 'teacher' };
  function setup() {
    const svc = { today: vi.fn(async () => ({})), weekly: vi.fn(async () => ({})) };
    return { svc, controller: new LearningReportController(svc as never) };
  }
  it('passes the selected date and class to the report service', () => {
    const { svc, controller } = setup();
    controller.today(actor, 'class', '2026-11-05');
    expect(svc.today).toHaveBeenCalledWith(actor, 'class', '2026-11-05');
    controller.week(actor, '2026-11-02', 'class');
    expect(svc.weekly).toHaveBeenCalledWith(actor, { weekStart: '2026-11-02', classId: 'class' });
  });
  it('keeps default date and scope behavior', () => {
    const { svc, controller } = setup();
    controller.today(actor, 'class'); controller.week(actor);
    expect(svc.today).toHaveBeenCalledWith(actor, 'class', undefined);
    expect(svc.weekly).toHaveBeenCalledWith(actor, { weekStart: null, classId: null });
  });
  it.each(['2026-02-30', 'invalid'])('rejects invalid dates before service calls: %s', (date) => {
    const { svc, controller } = setup();
    expect(() => controller.today(actor, 'class', date)).toThrow();
    expect(() => controller.week(actor, date, 'class')).toThrow();
    expect(svc.today).not.toHaveBeenCalled(); expect(svc.weekly).not.toHaveBeenCalled();
  });
  it('rejects an oversized class id', () => {
    const { svc, controller } = setup();
    expect(() => controller.week(actor, undefined, 'x'.repeat(81))).toThrow();
    expect(svc.weekly).not.toHaveBeenCalled();
  });
});
