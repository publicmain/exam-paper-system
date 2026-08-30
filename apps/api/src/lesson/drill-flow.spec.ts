/**
 * S12H —— 补段（错题重练）必须参与流程。
 *
 * 用户验收实测：阅读完成、背词完成、**补段 `还没开始 · 0 / 5`**，
 * 主页却把主按钮写成「看今天的总结」。
 *
 * 两处根因，两条独立的线：
 *
 *   1. `stageAfterSubmit(stage, applied)`（rc11-rules）在正式单词测试交卷时
 *      把 `vocab_test` 无条件推成 `done`，**根本不看补段**。
 *      `clampStage` 是单调取大的，于是持久化的 `done` 压过
 *      `deriveStage` 正确算出来的 `vocab_test`。
 *   2. `nextActionOf`（next-action）**连 drill 这个取值都没有** ——
 *      十个 kind 里没有它，走到最后只能落进 summary。
 *
 * 这份 spec 钉的是：补段没做完 → 阶段不许进 `done`，主行动必须是补段。
 */
import { describe, it, expect } from 'vitest';
import { stageAfterSubmit } from './rc11-rules';
import { nextActionOf, type NextActionFacts } from './next-action';

// 新签名还没有，先用 any 调 —— 这样红的是**行为**，不是编译。
const stageAfter = stageAfterSubmit as unknown as (
  stage: string,
  applied: boolean,
  facts?: { drillSettled: boolean },
) => string;

function facts(over: Partial<NextActionFacts> & Record<string, unknown> = {}): NextActionFacts {
  return {
    stage: 'done',
    availability: 'ready',
    opened: true,
    finalSubmitted: true,
    sessionId: 's1',
    submissionId: 'sub1',
    vocabTestAvailable: true,
    hasAnyTask: true,
    ...over,
  } as NextActionFacts;
}

// ─────────────────────────────────────────────────────────────
// 1. 正式测试交卷不得越过补段
// ─────────────────────────────────────────────────────────────

describe('S12H —— stageAfterSubmit 必须看补段', () => {
  it('补段没做完（5 个目标做了 0 个）→ 停在 vocab_test，不许进 done', () => {
    expect(stageAfter('vocab_test', true, { drillSettled: false })).toBe('vocab_test');
  });

  it('补段做了一半（5 个做了 2 个）→ 仍然停在 vocab_test', () => {
    expect(stageAfter('vocab_test', true, { drillSettled: false })).toBe('vocab_test');
  });

  it('补段做完（5 / 5）→ 照旧进 done', () => {
    expect(stageAfter('vocab_test', true, { drillSettled: true })).toBe('done');
  });

  it('今天没有补段（target 0）→ 视为已完成，进 done', () => {
    expect(stageAfter('vocab_test', true, { drillSettled: true })).toBe('done');
  });

  it('重复交卷幂等：补段没做完时反复调用都停在 vocab_test', () => {
    let s = 'vocab_test';
    for (let i = 0; i < 3; i++) s = stageAfter(s, true, { drillSettled: false });
    expect(s).toBe('vocab_test');
  });

  it('已经 done 的一天不回退', () => {
    expect(stageAfter('done', true, { drillSettled: false })).toBe('done');
    expect(stageAfter('done', true, { drillSettled: true })).toBe('done');
  });

  it('applied=false（没真的写入）时什么都不变', () => {
    expect(stageAfter('vocab_test', false, { drillSettled: true })).toBe('vocab_test');
  });

  it('调用方还没传补段事实时**不冒进** —— 保持现有语义，由调用方补齐', () => {
    // 这一条记录的是过渡期的约定：未接线的调用点行为不变。
    expect(stageAfter('vocab_test', true)).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. NextAction 必须有 drill
// ─────────────────────────────────────────────────────────────

describe('S12H —— nextActionOf 的补段分支', () => {
  it('阅读完成 + 背词完成 + 补段 0 / 5 → kind 是 drill，不是 summary', () => {
    const a = nextActionOf(facts({ drillTarget: 5, drillProgress: 0 } as any));
    expect(a.kind).toBe('drill');
    expect(a.label).toBe('开始错题重练');
  });

  it('补段做了一半 → 继续错题重练', () => {
    const a = nextActionOf(facts({ drillTarget: 5, drillProgress: 2 } as any));
    expect(a.kind).toBe('drill');
    expect(a.label).toBe('继续错题重练');
  });

  it('补段做完 → 回到 summary', () => {
    const a = nextActionOf(facts({ drillTarget: 5, drillProgress: 5 } as any));
    expect(a.kind).toBe('summary');
  });

  it('今天没有补段（target 0）→ summary', () => {
    const a = nextActionOf(facts({ drillTarget: 0, drillProgress: 0 } as any));
    expect(a.kind).toBe('summary');
  });

  it('没有补段事实时保持既有行为 —— summary', () => {
    expect(nextActionOf(facts()).kind).toBe('summary');
  });

  it('响应里不带身份、查询串或旧路由', () => {
    const a = nextActionOf(facts({ drillTarget: 5, drillProgress: 0 } as any));
    expect(a.href ?? '').not.toMatch(/\?|name=|studentId=|\/my-/);
  });

  it('补段没做完时，其它非 drill 的分支一个都不受影响', () => {
    const drill = { drillTarget: 5, drillProgress: 0 } as any;
    expect(nextActionOf(facts({ stage: 'reading', opened: false, ...drill })).kind).toBe('ready_to_start');
    expect(nextActionOf(facts({ stage: 'reading', finalSubmitted: false, ...drill })).kind).toBe('resume_reading');
    expect(nextActionOf(facts({ stage: 'vocab_learn', ...drill })).kind).toBe('learn_vocab');
    expect(nextActionOf(facts({ stage: 'vocab_test', ...drill })).kind).toBe('vocab_test');
    expect(nextActionOf(facts({ stage: 'reading', availability: 'no_content', ...drill })).kind).toBe('no_content');
    expect(nextActionOf(facts({ stage: 'reading', availability: 'window_closed', ...drill })).kind).toBe('window_closed');
    expect(nextActionOf(facts({ stage: 'reading', availability: 'level_not_set', ...drill })).kind).toBe('level_not_set');
    expect(nextActionOf(facts({ hasAnyTask: false, ...drill })).kind).toBe('no_content');
  });
});
