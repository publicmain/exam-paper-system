/**
 * VOC14 · 内容生成 running 任务的租约 / 超时回收 / 重试上限 / 退避 / 幂等发布（审计 2026-09-11 §5.3）。
 *
 * 全部在内存假库上跑，生成函数注入（零网络、零付费调用）。
 * 原症状：worker 只领 queued/failed，进程中途死掉留下的 running 永远没人管；领取不是原子的，
 * 两个实例同时跑同一条会双倍付费、各发布一次；失败后每 5 分钟立刻重打。
 */
import { describe, expect, it, vi } from 'vitest';
import { CONTENT_JOB_POLICY, runVocabularyContentBatch } from './content-producer';
import { newDb } from './testing/vocab-fixtures';

const T0 = new Date('2026-09-11T02:00:00.000Z');
const plus = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;

const GOOD = (headword: string, tag = 'A') => ({
  candidate: {
    definition: `meaning of ${headword}`,
    shortExample: `We saw the ${headword} near school today.`,
    shortTranslation: `我们今天在学校附近看到了${headword}（${tag}）。`,
    alternateExample: `My sister wrote a short story about the ${headword} last week.`,
    alternateTranslation: `我姐姐上周写了一个关于${headword}的小故事（${tag}）。`,
    alternateTopic: 'daily life',
    collocations: [],
    wordFamily: [],
    confusionWords: [],
    memoryHint: null,
  },
  provider: `test_provider_${tag}`,
  shortProvenance: null,
  alternateProvenance: null,
});

function seedJob(db: any, headword: string, job: Partial<{ status: string; attempts: number; startedAt: Date | null; completedAt: Date | null; contentVersion: number }> = {}) {
  db.seed('vocabularyLexeme', { id: `lex-${headword}`, listName: 'ngsl', listVersion: 't', rank: 1, headword });
  db.seed('vocabularySense', { id: `sense-${headword}`, lexemeId: `lex-${headword}`, senseKey: 'noun:01', pos: 'noun', definition: `a ${headword}`, translation: `n. ${headword}`, qualityStatus: 'ready', contentVersion: job.contentVersion ?? 1 });
  return db.seed('vocabularyContentJob', {
    id: `job-${headword}`,
    senseId: `sense-${headword}`,
    requestedVersion: 2,
    provider: 'test',
    status: job.status ?? 'queued',
    attempts: job.attempts ?? 0,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
  });
}

const jobRow = (db: any, headword: string) => db.rows('vocabularyContentJob', { id: `job-${headword}` })[0];
const contexts = (db: any, headword: string) => db.rows('vocabularyContext', { senseId: `sense-${headword}` });
const run = (db: any, now: Date, generate: (job: any) => Promise<any>) =>
  runVocabularyContentBatch(db as any, 10, { now: () => now, generate, enqueue: false });

describe('VOC14 租约与回收', () => {
  it('领取后进程崩溃（running 超过租约）：下一轮回收并发布，尝试次数 +1，记 lease_expired_reclaimed', async () => {
    const db = newDb();
    seedJob(db, 'harbour', { status: 'running', attempts: 1, startedAt: plus(-20 * MIN) });
    const generate = vi.fn(async (job: any) => GOOD(job.sense.lexeme.headword));
    const result = await run(db, T0, generate);
    expect(result).toEqual(expect.objectContaining({ published: 1, reclaimed: 1 }));
    expect(jobRow(db, 'harbour')).toEqual(expect.objectContaining({ status: 'published', attempts: 2 }));
    expect(db.rows('vocabularySense', { id: 'sense-harbour' })[0]).toEqual(expect.objectContaining({ contentVersion: 2, qualityStatus: 'ready' }));
    expect(contexts(db, 'harbour')).toHaveLength(2);
  });

  it('租约内的 running 不动；租约过期但次数已用完：定格 failed，不再调用生成（不再付费）', async () => {
    const db = newDb();
    seedJob(db, 'alive', { status: 'running', attempts: 1, startedAt: plus(-5 * MIN) });
    seedJob(db, 'dead', { status: 'running', attempts: CONTENT_JOB_POLICY.maxAttempts, startedAt: plus(-60 * MIN) });
    const generate = vi.fn(async (job: any) => GOOD(job.sense.lexeme.headword));
    const result = await run(db, T0, generate);
    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ exhausted: 1 }));
    expect(jobRow(db, 'alive').status).toBe('running');
    expect(jobRow(db, 'dead')).toEqual(expect.objectContaining({ status: 'failed', errorCode: 'lease_expired_attempts_exhausted' }));
  });

  it('网络失败 / 超时：记 failed + 原因；退避期内不重试；退避后重试；用满次数后永不再试', async () => {
    const db = newDb();
    seedJob(db, 'flaky');
    const generate = vi.fn(async () => {
      const error = new Error('The operation was aborted due to timeout');
      error.name = 'TimeoutError';
      throw error;
    });
    await run(db, T0, generate);
    expect(jobRow(db, 'flaky')).toEqual(expect.objectContaining({ status: 'failed', attempts: 1, errorCode: expect.stringContaining('timeout') }));
    await run(db, plus(1 * MIN), generate);
    expect(generate).toHaveBeenCalledTimes(1);
    await run(db, plus(1 * MIN + CONTENT_JOB_POLICY.backoffMs[1] + 1), generate);
    expect(generate).toHaveBeenCalledTimes(2);
    await run(db, plus(3 * MIN + CONTENT_JOB_POLICY.backoffMs[1] + CONTENT_JOB_POLICY.backoffMs[2]), generate);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(jobRow(db, 'flaky').attempts).toBe(CONTENT_JOB_POLICY.maxAttempts);
    await run(db, plus(24 * 60 * MIN), generate);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(db.rows('vocabularySense', { id: 'sense-flaky' })[0].contentVersion).toBe(1);
  });

  it('两个 worker 同时跑：每条只被领取、生成、发布一次', async () => {
    const db = newDb();
    for (const word of ['alpha', 'bravo', 'charlie']) seedJob(db, word);
    db.yieldsPerStatement = 3;
    const generate = vi.fn(async (job: any) => GOOD(job.sense.lexeme.headword));
    const [a, b] = await Promise.all([run(db, T0, generate), run(db, T0, generate)]);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(a.published + b.published).toBe(3);
    for (const word of ['alpha', 'bravo', 'charlie']) {
      expect(jobRow(db, word)).toEqual(expect.objectContaining({ status: 'published', attempts: 1 }));
      expect(contexts(db, word)).toHaveLength(2);
    }
  });

  it('慢 worker 的租约过期被别人接手后才回来：它的发布被栅栏挡掉，内容是接手者的，版本只升一次', async () => {
    const db = newDb();
    seedJob(db, 'slow');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const slowWorker = run(db, T0, async (job: any) => {
      await gate;
      return GOOD(job.sense.lexeme.headword, 'stale');
    });
    // 等慢 worker 领取成功
    for (let i = 0; i < 50 && jobRow(db, 'slow').status !== 'running'; i += 1) await new Promise((resolve) => setImmediate(resolve));
    expect(jobRow(db, 'slow').status).toBe('running');
    const fresh = await run(db, plus(CONTENT_JOB_POLICY.leaseMs + MIN), async (job: any) => GOOD(job.sense.lexeme.headword, 'fresh'));
    expect(fresh).toEqual(expect.objectContaining({ published: 1, reclaimed: 1 }));
    release();
    const stale = await slowWorker;
    expect(stale).toEqual(expect.objectContaining({ published: 0, superseded: 1 }));
    expect(jobRow(db, 'slow')).toEqual(expect.objectContaining({ status: 'published', provider: 'test_provider_fresh' }));
    expect(contexts(db, 'slow').every((row: any) => String(row.translation).includes('fresh'))).toBe(true);
    expect(db.rows('vocabularySense', { id: 'sense-slow' })[0].contentVersion).toBe(2);
  });

  it('损坏的内容（过不了质量门）：标 rejected，词义不标 ready、不写例句', async () => {
    const db = newDb();
    seedJob(db, 'broken');
    await db.vocabularySense.update({ where: { id: 'sense-broken' }, data: { qualityStatus: 'needs_translation' } });
    const bad = GOOD('broken');
    bad.candidate.shortExample = 'Numbers went down.';
    const result = await run(db, T0, async () => bad);
    expect(result).toEqual(expect.objectContaining({ rejected: 1, published: 0 }));
    expect(jobRow(db, 'broken').status).toBe('rejected');
    expect(db.rows('vocabularySense', { id: 'sense-broken' })[0].qualityStatus).toBe('needs_translation');
    expect(contexts(db, 'broken')).toHaveLength(0);
  });

  it('这个版本已经发布过（词义已是 v2）：重复任务不覆盖内容', async () => {
    const db = newDb();
    seedJob(db, 'done', { contentVersion: 2 });
    const result = await run(db, T0, async (job: any) => GOOD(job.sense.lexeme.headword, 'dup'));
    expect(result).toEqual(expect.objectContaining({ published: 0, superseded: 1 }));
    expect(contexts(db, 'done')).toHaveLength(0);
  });
});
