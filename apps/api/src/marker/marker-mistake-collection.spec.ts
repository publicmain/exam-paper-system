import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { MarkerService } from './marker.service';

/**
 * 阶段 12D —— 判分定稿之后**自动采集错题**。
 *
 * ## 这里在补的是什么
 *
 * `MistakeService.collectFromSubmission()` 早就写好了，而且写得很仔细
 * （收录门槛、快照冻结、幂等唯一键）。但在这次改动之前，**整个
 * `src/` 里没有一个调用点** —— 只有三个 `scripts/` 脚本调它。
 * 也就是说：走真实 API 判完分的答卷，分数会更新、生词本会采集，
 * **错题本一条都不会生成**。错题本页面（阶段 12B）因此可能永远是空的，
 * 而没有任何地方会报错。
 *
 * ## 两条不能含糊的规矩
 *
 * **① 日期取场次的日期，不是「今天」。** 补判前几天的卷子时，把错题记到
 * 今天名下，学生的错题本时间线就是错的（而且「隔天连对两次销账」那套
 * 规则也会跟着算歪）。所以 `quizDay` 只能来自
 * `PaperAssignment.morningQuizSession.date`。
 *
 * **② 采集失败绝不影响判分。** 与生词本采集同一条哲学：它是判分成功之后
 * 的 best-effort 副作用。判分已经落库了，采集挂了只能记一条 warn，
 * 不能回滚、不能让接口报错、也不能连累另一个采集器。
 */

const MARKER = { id: 'teacher-1', role: 'teacher', ip: null };

/** 场次日期在库里是 `@db.Date` —— Prisma 给回 UTC 零点的 Date。 */
const SESSION_DATE = new Date('2026-08-27T00:00:00.000Z');

function mockPrisma(opts: {
  /** 没有场次 = 不是早测卷（比如课堂作业）。 */
  session?: { date: Date } | null;
  subStatus?: string;
  /** updateMany 的返回条数；0 = 被别人抢先定稿了。 */
  updatedCount?: number;
  scripts?: Array<{ type: 'mcq' | 'short_answer'; awardedMarks: number | null; markedById: string | null }>;
} = {}) {
  const scripts = opts.scripts ?? [
    { type: 'mcq' as const, awardedMarks: 1, markedById: null },
    { type: 'short_answer' as const, awardedMarks: 2, markedById: MARKER.id },
  ];
  const sub = {
    id: 'sub-1',
    status: opts.subStatus ?? 'submitted',
    autoScore: 0,
    scripts: scripts.map((s, i) => ({
      id: `script-${i}`,
      awardedMarks: s.awardedMarks,
      markedById: s.markedById,
      paperQuestion: { question: { questionType: s.type } },
    })),
  };
  const dayRow = {
    assignment: {
      morningQuizSession: opts.session === undefined ? { date: SESSION_DATE } : opts.session,
    },
  };
  const updateManyArgs: any[] = [];
  return {
    _captured: { updateManyArgs },
    studentSubmission: {
      // 三种调用共用一个桩：靠**投影形状**区分是哪一次
      //   · select.assignment  → 取场次日期那一次
      //   · include.scripts    → 定稿前的预检
      //   · 其余               → 最后返回给调用方的那一行
      findUnique: vi.fn().mockImplementation((args: any) => {
        if (args?.select?.assignment) return Promise.resolve(dayRow);
        if (args?.include?.scripts) return Promise.resolve(sub);
        return Promise.resolve({ ...sub, status: 'marked' });
      }),
      updateMany: vi.fn().mockImplementation((args: any) => {
        updateManyArgs.push(args);
        return Promise.resolve({ count: opts.updatedCount ?? 1 });
      }),
    },
    markerAssignment: {
      findUnique: vi.fn().mockResolvedValue({
        submissionId: 'sub-1',
        status: 'active',
        markerId: MARKER.id,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function stubs() {
  return {
    studentWords: {
      harvestFromSubmission: vi.fn().mockResolvedValue({ added: 0, candidates: 0 }),
    } as any,
    mistakes: {
      collectFromSubmission: vi.fn().mockResolvedValue({ added: 0 }),
    } as any,
  };
}

function makeSvc(prisma: any, s = stubs()) {
  return { svc: new MarkerService(prisma, s.studentWords, s.mistakes as any), ...s };
}

describe('阶段 12D —— 判分定稿触发错题采集', () => {
  beforeEach(() => vi.clearAllMocks());

  it('**定稿成功 → 恰好采集一次**，带答卷 id 与场次那一天', async () => {
    const prisma = mockPrisma();
    const { svc, mistakes } = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    expect(mistakes.collectFromSubmission).toHaveBeenCalledTimes(1);
    expect(mistakes.collectFromSubmission).toHaveBeenCalledWith('sub-1', '2026-08-27');
  });

  it('**日期取的是场次那一天，不是今天**（补判旧卷时最要命的一条）', async () => {
    const prisma = mockPrisma({ session: { date: new Date('2026-07-31T00:00:00.000Z') } });
    const { svc, mistakes } = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    const [, day] = mistakes.collectFromSubmission.mock.calls[0];
    expect(day).toBe('2026-07-31');
    expect(day).not.toBe(new Date().toISOString().slice(0, 10));
  });

  it('**日期格式恒为 YYYY-MM-DD**，而且不受本机时区影响', async () => {
    const prisma = mockPrisma({ session: { date: new Date('2026-01-05T00:00:00.000Z') } });
    const { svc, mistakes } = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    const [, day] = mistakes.collectFromSubmission.mock.calls[0];
    expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(day).toBe('2026-01-05');
  });

  it('**没有早测场次就不采集**，绝不用「今天」凑一个日期', async () => {
    const prisma = mockPrisma({ session: null });
    const { svc, mistakes, studentWords } = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    expect(mistakes.collectFromSubmission).not.toHaveBeenCalled();
    // 生词本采集与场次无关，照常进行
    expect(studentWords.harvestFromSubmission).toHaveBeenCalledTimes(1);
  });
});

describe('阶段 12D —— best-effort 隔离', () => {
  beforeEach(() => vi.clearAllMocks());

  it('**采集炸了也不影响判分结果**：分数照落、状态照 marked、接口照常返回', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(new Error('db down'));
    const { svc } = makeSvc(prisma, s);

    const out = await svc.finalize('sub-1', MARKER);

    const data = prisma._captured.updateManyArgs[0].data;
    expect(data.status).toBe('marked');
    expect(data.autoScore).toBe(1);
    expect(data.manualScore).toBe(2);
    expect(data.totalScore).toBe(3);
    expect(prisma.markerAssignment.update).toHaveBeenCalledTimes(1);
    expect(out).toBeTruthy();
  });

  it('**采集炸了不许连累生词本采集**', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(new Error('db down'));
    const { svc } = makeSvc(prisma, s);
    await svc.finalize('sub-1', MARKER);
    expect(s.studentWords.harvestFromSubmission).toHaveBeenCalledTimes(1);
  });

  it('**生词本采集炸了也不许连累错题采集**（两个各自 try/catch）', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.studentWords.harvestFromSubmission = vi.fn().mockRejectedValue(new Error('dict down'));
    const { svc } = makeSvc(prisma, s);
    await svc.finalize('sub-1', MARKER);
    expect(s.mistakes.collectFromSubmission).toHaveBeenCalledTimes(1);
    expect(s.mistakes.collectFromSubmission).toHaveBeenCalledWith('sub-1', '2026-08-27');
  });

  it('**取日期那一步炸了，判分照样成功**，只是不采集', async () => {
    const prisma = mockPrisma();
    prisma.studentSubmission.findUnique = vi.fn().mockImplementation((args: any) => {
      if (args?.select?.assignment) return Promise.reject(new Error('timeout'));
      if (args?.include?.scripts) {
        return Promise.resolve({
          id: 'sub-1',
          status: 'submitted',
          autoScore: 0,
          scripts: [
            { id: 's0', awardedMarks: 1, markedById: null, paperQuestion: { question: { questionType: 'mcq' } } },
          ],
        });
      }
      return Promise.resolve({ id: 'sub-1', status: 'marked' });
    });
    const { svc, mistakes } = makeSvc(prisma);
    const out = await svc.finalize('sub-1', MARKER);
    expect(prisma._captured.updateManyArgs[0].data.status).toBe('marked');
    expect(mistakes.collectFromSubmission).not.toHaveBeenCalled();
    expect(out).toBeTruthy();
  });

  it('**还有没判完的题 → 直接拒绝**，两个采集器都不碰', async () => {
    const prisma = mockPrisma({
      scripts: [{ type: 'short_answer', awardedMarks: null, markedById: null }],
    });
    const { svc, mistakes, studentWords } = makeSvc(prisma);
    await expect(svc.finalize('sub-1', MARKER)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.studentSubmission.updateMany).not.toHaveBeenCalled();
    expect(mistakes.collectFromSubmission).not.toHaveBeenCalled();
    expect(studentWords.harvestFromSubmission).not.toHaveBeenCalled();
  });

  it('**被别人抢先定稿 → 409**，两个采集器都不碰', async () => {
    const prisma = mockPrisma({ updatedCount: 0 });
    const { svc, mistakes, studentWords } = makeSvc(prisma);
    await expect(svc.finalize('sub-1', MARKER)).rejects.toBeInstanceOf(ConflictException);
    expect(mistakes.collectFromSubmission).not.toHaveBeenCalled();
    expect(studentWords.harvestFromSubmission).not.toHaveBeenCalled();
    // 认领也不该被释放
    expect(prisma.markerAssignment.update).not.toHaveBeenCalled();
  });

  it('**采集在事务之外**：更新与释放认领都已经完成才轮到它', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    const order: string[] = [];
    prisma.studentSubmission.updateMany = vi.fn().mockImplementation((args: any) => {
      order.push('update');
      prisma._captured.updateManyArgs.push(args);
      return Promise.resolve({ count: 1 });
    });
    prisma.markerAssignment.update = vi.fn().mockImplementation(() => {
      order.push('release');
      return Promise.resolve({});
    });
    s.mistakes.collectFromSubmission = vi.fn().mockImplementation(() => {
      order.push('mistakes');
      return Promise.resolve({ added: 0 });
    });
    const { svc } = makeSvc(prisma, s);
    await svc.finalize('sub-1', MARKER);
    expect(order).toEqual(['update', 'release', 'mistakes']);
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 —— 采集失败的那行日志不许泄漏异常内容
//
// 采集这一步直接压在 Prisma 上。Prisma 的异常**会把连接串写进 message**
// （`postgresql://user:password@host:port/db`），驱动层的错误还会在
// `stack` / `cause` 里带上查询片段。把 `e.message` 插进日志，等于把生产库
// 的凭据写进日志系统 —— 而日志的留存期、可见范围、导出路径都和数据库
// 完全不是一套。
//
// 所以这条判据是**失败关闭**的：catch 里**根本不看**那个异常。
// 不是「过滤掉敏感词」——过滤永远漏，而且下一种驱动会换一种格式。
// ─────────────────────────────────────────────────────────────

/** 只要日志里出现其中任何一段，就说明异常内容漏出来了。 */
const SENTINEL_URL = 'postgresql://sentinel-user:sentinel-password@sentinel-host:6789/sentinel-db';
const SENTINEL_PARTS = [
  SENTINEL_URL,
  'postgresql://',
  'sentinel-user',
  'sentinel-password',
  'sentinel-host',
  '6789',
  'sentinel-db',
  'SENTINEL-STACK',
  'SENTINEL-CAUSE',
];

/** 一个「长得像 Prisma 异常」的错误：message / stack / cause 全带哨兵。 */
function sentinelError(): Error {
  const cause = new Error(`cause frame SENTINEL-CAUSE ${SENTINEL_URL}`);
  const e = new Error(`Can't reach database server at ${SENTINEL_URL}`) as Error & { cause?: unknown };
  e.stack = `Error: ${e.message}\n    at SENTINEL-STACK (${SENTINEL_URL})`;
  e.cause = cause;
  return e;
}

describe('阶段 12D 返工 —— 采集失败的日志必须失败关闭', () => {
  let warns: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    warns = [];
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((...args: unknown[]) => {
      // 把**每一个**参数都收进来 —— 泄漏可能藏在 context 参数里
      warns.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) ?? String(a))).join(' '));
    });
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('**Prisma 式异常：日志里一个哨兵片段都没有**', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(sentinelError());
    const { svc } = makeSvc(prisma, s);

    await svc.finalize('sub-1', MARKER);

    const all = warns.join('\n');
    expect(warns).toHaveLength(1); // 只有错题采集那一条
    for (const part of SENTINEL_PARTS) {
      expect(all, `日志里泄漏了「${part}」`).not.toContain(part);
    }
    // 而且确实记了点什么 —— 不能靠「什么都不记」来通过这条
    expect(all).toContain('mistake harvest failed');
    expect(all).toContain('sub-1');
  });

  it('**扔的不是 Error 也不许被隐式字符串化**', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    // 一个 toString 会吐出连接串的对象 —— 模板串拼接会立刻中招
    const hostile = {
      toString: () => SENTINEL_URL,
      url: SENTINEL_URL,
    };
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(hostile);
    const { svc } = makeSvc(prisma, s);

    await svc.finalize('sub-1', MARKER);

    const all = warns.join('\n');
    for (const part of SENTINEL_PARTS) {
      expect(all, `日志里泄漏了「${part}」`).not.toContain(part);
    }
    expect(all).toContain('mistake harvest failed');
  });

  it('**扔字符串同样不许漏**', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(SENTINEL_URL);
    const { svc } = makeSvc(prisma, s);
    await svc.finalize('sub-1', MARKER);
    expect(warns.join('\n')).not.toContain('sentinel-password');
  });

  it('**日志失败关闭之后，判分与两个采集器的行为一个字都没变**', async () => {
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockRejectedValue(sentinelError());
    const { svc } = makeSvc(prisma, s);

    const out = await svc.finalize('sub-1', MARKER);

    const data = prisma._captured.updateManyArgs[0].data;
    expect(data.status).toBe('marked');
    expect(data.autoScore).toBe(1);
    expect(data.manualScore).toBe(2);
    expect(data.totalScore).toBe(3);
    expect(prisma.markerAssignment.update).toHaveBeenCalledTimes(1);
    expect(s.studentWords.harvestFromSubmission).toHaveBeenCalledTimes(1);
    expect(s.mistakes.collectFromSubmission).toHaveBeenCalledTimes(1);
    expect(s.mistakes.collectFromSubmission).toHaveBeenCalledWith('sub-1', '2026-08-27');
    expect(out).toBeTruthy();
  });

  it('**成功那条日志仍然只有 id / 日期 / 条数**', async () => {
    const logs: string[] = [];
    (Logger.prototype.log as unknown as { mockImplementation: (f: (...a: unknown[]) => void) => void })
      .mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      });
    const prisma = mockPrisma();
    const s = stubs();
    s.mistakes.collectFromSubmission = vi.fn().mockResolvedValue({ added: 3 });
    const { svc } = makeSvc(prisma, s);

    await svc.finalize('sub-1', MARKER);

    const line = logs.find((l) => l.includes('mistake harvest')) ?? '';
    expect(line).toContain('sub-1');
    expect(line).toContain('2026-08-27');
    expect(line).toContain('3');
    // 成功路径上没有异常可谈，更不该出现任何连接串片段
    for (const part of SENTINEL_PARTS) expect(line).not.toContain(part);
    expect(warns).toEqual([]);
  });
});
