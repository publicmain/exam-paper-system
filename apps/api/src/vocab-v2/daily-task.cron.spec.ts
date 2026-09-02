import { afterEach, describe, expect, it, vi } from 'vitest';
import { VocabularyV2DailyTaskCron } from './daily-task.cron';

const originalFlag = process.env.STUDENT_APP_V2;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.STUDENT_APP_V2;
  else process.env.STUDENT_APP_V2 = originalFlag;
  vi.restoreAllMocks();
});

describe('VocabularyV2DailyTaskCron', () => {
  it('does nothing while the V2 student app is disabled', async () => {
    delete process.env.STUDENT_APP_V2;
    const findMany = vi.fn();
    const startDailySession = vi.fn();
    const cron = new VocabularyV2DailyTaskCron(
      { user: { findMany } } as never,
      { startDailySession } as never,
    );

    await cron.provision(new Date('2026-09-02T00:00:00.000Z'));

    expect(findMany).not.toHaveBeenCalled();
    expect(startDailySession).not.toHaveBeenCalled();
  });

  it('materialises one dated task for every eligible student without a page visit', async () => {
    process.env.STUDENT_APP_V2 = 'on';
    const now = new Date('2026-09-02T00:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);
    const startDailySession = vi.fn().mockResolvedValue({ id: 'daily' });
    const cron = new VocabularyV2DailyTaskCron(
      { user: { findMany } } as never,
      { startDailySession } as never,
    );

    await cron.provision(now);

    expect(findMany).toHaveBeenCalledOnce();
    expect(startDailySession.mock.calls).toEqual([
      ['s1', now],
      ['s2', now],
      ['s3', now],
    ]);
  });

  it('keeps provisioning other students when one account cannot receive a task', async () => {
    process.env.STUDENT_APP_V2 = 'on';
    const findMany = vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
    const startDailySession = vi.fn()
      .mockRejectedValueOnce(new Error('no quality words'))
      .mockResolvedValueOnce({ id: 'daily-s2' });
    const cron = new VocabularyV2DailyTaskCron(
      { user: { findMany } } as never,
      { startDailySession } as never,
    );

    await expect(cron.provision(new Date('2026-09-02T00:00:00.000Z'))).resolves.toBeUndefined();
    expect(startDailySession).toHaveBeenCalledTimes(2);
  });
});
