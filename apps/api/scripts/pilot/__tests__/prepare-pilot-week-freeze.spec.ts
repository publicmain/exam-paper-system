/**
 * 发布脚本：已发布内容冻结（PUB01）、断言在提交之前（PUB02）、查重全量分页与
 * 边界（PUB03）—— 不连库的那一半。
 *
 * 真库上的回滚、触发器式故障注入、CLI 输出在 `pilot-publish.db.spec.ts`
 * （需要本机隔离库，默认跳过）。
 */
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prep = require('../prepare-pilot-week');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../content');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sim = require('../content-similarity');

const DATES = content.DATES as string[];
const DAY = DATES[DATES.length - 1];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** 把 `lessonRows` 的结果装成「库里已有」的样子（Json 列读回来的形状，键顺序打乱）。 */
function existingFrom(plans: any[], { submissions = [] as any[], scripts = new Map<string, number>(), sessionStatus = 'active' } = {}) {
  const shuffle = (o: any): any => {
    if (Array.isArray(o)) return o.map(shuffle);
    if (o && typeof o === 'object') return Object.fromEntries(Object.keys(o).reverse().map((k) => [k, shuffle(o[k])]));
    return o;
  };
  const stored = (v: any) => shuffle(v === undefined ? null : JSON.parse(JSON.stringify(v)));
  const papers = new Map();
  const questions = new Map();
  const paperQuestions = new Map();
  const byPaper = new Map();
  const assignments = new Map();
  const sessions = new Map();
  for (const p of plans) {
    papers.set(p.paper.id, { id: p.paper.id, name: p.paper.name, config: stored(p.paper.config), totalMarksTarget: p.paper.totalMarks, totalMarksActual: p.paper.totalMarks });
    for (const q of p.questions) questions.set(q.id, { ...q, content: stored(q.content), answerContent: stored(q.answerContent), options: stored(q.options) });
    for (const pq of p.paperQuestions) {
      const row = { ...pq, snapshotContent: stored(pq.snapshotContent), snapshotAnswer: stored(pq.snapshotAnswer), snapshotOptions: stored(pq.snapshotOptions) };
      paperQuestions.set(pq.id, row);
      byPaper.set(pq.paperId, [...(byPaper.get(pq.paperId) ?? []), row]);
    }
    for (const d of p.deliveries) {
      assignments.set(d.assignmentId, { id: d.assignmentId, paperId: p.paper.id, classId: d.classId, status: 'open' });
      sessions.set(d.sessionId, { id: d.sessionId, date: prep.dayLabel(p.dayIso), classId: d.classId, level: p.level, status: sessionStatus, paperAssignmentId: d.assignmentId });
    }
  }
  return { papers, questions, paperQuestions, paperQuestionsByPaper: byPaper, assignments, sessions, submissions, scriptsByPaperQuestion: scripts };
}

const empty = () => ({
  papers: new Map(),
  questions: new Map(),
  paperQuestions: new Map(),
  paperQuestionsByPaper: new Map(),
  assignments: new Map(),
  sessions: new Map(),
  submissions: [],
  scriptsByPaperQuestion: new Map(),
});

describe('PUB01 —— 判定：新建 / 未变 / 改了', () => {
  it('lessonRows 是纯函数：同一天两次算出一模一样的行', () => {
    expect(prep.sameJson(prep.dayRows(DAY), prep.dayRows(DAY))).toBe(true);
  });

  it('sameJson 与键顺序无关，undefined 键等于没有', () => {
    expect(prep.sameJson({ a: 1, b: { c: 2, d: undefined } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(prep.sameJson({ a: 1 }, { a: 2 })).toBe(false);
    expect(prep.sameJson(undefined, null)).toBe(true);
  });

  it('库里什么都没有 → 五档都是「新建」，要建的行齐全', () => {
    const plans = prep.dayRows(DAY);
    const plan = prep.planDay(plans, empty());
    expect(plan.levels.map((l: any) => l.state)).toEqual(plans.map(() => 'new'));
    expect(plan.levels.every((l: any) => l.create.paper && l.create.questions.length === 10 && l.create.paperQuestions.length === 10)).toBe(true);
    expect(plan.deliveries.createSessions).toHaveLength(plans.length * 10);
    expect(() => prep.assertPlanAllowed(plan)).not.toThrow();
  });

  it('库里与内容包一致（Json 读回来键顺序变了也算一致）→ 全部「未变」，放行', () => {
    const plans = prep.dayRows(DAY);
    const plan = prep.planDay(plans, existingFrom(plans));
    expect(plan.levels.map((l: any) => l.state)).toEqual(plans.map(() => 'unchanged'));
    expect(plan.levels.flatMap((l: any) => l.changes)).toEqual([]);
    expect(plan.deliveries.createSessions).toEqual([]);
    expect(plan.deliveries.keptSessions).toBe(plans.length * 10);
    expect(() => prep.assertPlanAllowed(plan)).not.toThrow();
  });

  it('内容包改了一题 → 那一档「改了」，精确列出是哪一行、哪几个字段', () => {
    const plans = prep.dayRows(DAY);
    const existing = existingFrom(plans);
    const edited = clone(plans);
    edited[0].paperQuestions[2].snapshotContent.stem = 'edited stem';
    edited[0].questions[2].content.stem = 'edited stem';
    edited[0].paperQuestions[3].marks += 1;
    const plan = prep.planDay(edited, existing);
    expect(plan.levels[0].state).toBe('changed');
    expect(plan.levels[0].changes).toEqual([
      { table: 'Question', id: edited[0].questions[2].id, fields: ['content'] },
      { table: 'PaperQuestion', id: edited[0].paperQuestions[2].id, fields: ['snapshotContent'] },
      { table: 'PaperQuestion', id: edited[0].paperQuestions[3].id, fields: ['marks'] },
    ]);
    expect(plan.levels.slice(1).every((l: any) => l.state === 'unchanged')).toBe(true);
  });

  it('使用情况按卷子统计：做到一半、已交、已判、作答行都算「用过」', () => {
    const plans = prep.dayRows(DAY);
    const paperId = plans[1].paper.id;
    const existing = existingFrom(plans, {
      submissions: [
        { status: 'in_progress', assignment: { paperId } },
        { status: 'marked', assignment: { paperId } },
      ],
      scripts: new Map([[plans[1].paperQuestions[0].id, 3]]),
    });
    const plan = prep.planDay(plans, existing);
    expect(plan.levels[1].usage).toEqual({ submissions: 2, byStatus: { in_progress: 1, marked: 1 }, scripts: 3, used: true });
    expect(plan.levels[0].usage.used).toBe(false);
  });
});

describe('PUB01 —— 放不放行', () => {
  const setup = (used: boolean) => {
    const plans = prep.dayRows(DAY);
    const existing = existingFrom(plans, used ? { submissions: [{ status: 'submitted', assignment: { paperId: plans[0].paper.id } }] } : {});
    const edited = clone(plans);
    edited[0].paperQuestions[0].snapshotAnswer.rubric = 'changed after publication';
    return prep.planDay(edited, existing);
  };

  it('学生用过的卷子：改了就拒绝 —— --revise-unstarted 也不行；原因里有题目 id 与答卷数', () => {
    const plan = setup(true);
    for (const revise of [false, true]) {
      expect(() => prep.assertPlanAllowed(plan, { revise })).toThrow(/已被学生使用（答卷 1 份：submitted 1；作答 0 条）/);
    }
    expect(() => prep.assertPlanAllowed(plan)).toThrow(new RegExp(plan.levels[0].changes[0].id));
  });

  it('没人用过的卷子：默认拒绝并提示 --revise-unstarted；明确加上才放行', () => {
    const plan = setup(false);
    expect(() => prep.assertPlanAllowed(plan)).toThrow(/--revise-unstarted/);
    expect(() => prep.assertPlanAllowed(plan, { revise: true })).not.toThrow();
  });

  it('卷子里多出内容包没有的题：停下来，不删', () => {
    const plans = prep.dayRows(DAY);
    const existing = existingFrom(plans);
    existing.paperQuestionsByPaper.get(plans[0].paper.id).push({ id: `${plans[0].paper.id.replace(/_paper$/, '')}_pq11` });
    const plan = prep.planDay(plans, existing);
    expect(plan.levels[0].extra).toHaveLength(1);
    expect(() => prep.assertPlanAllowed(plan, { revise: true })).toThrow(/内容包没有的题/);
  });

  it('场次挂错了作业 / 班：停下来；不是 active 的场次只记下来、不改', () => {
    const plans = prep.dayRows(DAY);
    const existing = existingFrom(plans, { sessionStatus: 'cancelled' });
    const plan = prep.planDay(plans, existing);
    expect(plan.deliveries.notActive).toHaveLength(plans.length * 10);
    expect(() => prep.assertPlanAllowed(plan)).not.toThrow();
    const sid = plans[0].deliveries[0].sessionId;
    existing.sessions.get(sid).classId = 'p1_class_other';
    expect(() => prep.assertPlanAllowed(prep.planDay(plans, existing))).toThrow(new RegExp(sid));
  });
});

/** 只记账的假事务：写入调用逐一记下。 */
function recorder() {
  const calls: Array<{ op: string; args: any }> = [];
  const model = (name: string) =>
    new Proxy({}, { get: (_t, op: string) => async (args: any) => { calls.push({ op: `${name}.${op}`, args }); return { count: args?.data?.length ?? 1 }; } });
  const tx = new Proxy({}, { get: (_t, name: string) => model(name) });
  return { tx, calls };
}

describe('PUB01 —— 写入：新的一天一次批量建，重跑零写入，修订只改改了的', () => {
  it('新的一天：卷子 / 题 / 卷题 / 作业 / 场次各一次 createMany，没有 update', async () => {
    const plans = prep.dayRows(DAY);
    const { tx, calls } = recorder();
    await prep.writeDay(tx, prep.planDay(plans, empty()), prep.makeReport());
    expect(calls.map((c) => c.op)).toEqual([
      'paper.createMany',
      'question.createMany',
      'paperQuestion.createMany',
      'paperAssignment.createMany',
      'morningQuizSession.createMany',
    ]);
    expect(calls[2].args.data).toHaveLength(plans.length * 10);
    expect(calls[4].args.data.every((s: any) => s.status === 'active')).toBe(true);
    // 主观题不写自动分依据：options 不给值（落库为 NULL）
    const shortAnswer = calls[1].args.data.find((q: any) => q.questionType === 'short_answer');
    expect(shortAnswer.options).toBeUndefined();
  });

  it('重跑（全部未变）：一次写都没有 —— 场次状态也不碰', async () => {
    const plans = prep.dayRows(DAY);
    const { tx, calls } = recorder();
    const report = prep.makeReport();
    await prep.writeDay(tx, prep.planDay(plans, existingFrom(plans, { sessionStatus: 'cancelled' })), report);
    expect(calls).toEqual([]);
    expect(report.counts['Paper.unchanged']).toBe(plans.length);
    expect(report.notes.join('\n')).toMatch(/不是 active.*保持原状/);
  });

  it('明确修订（--revise-unstarted 放行后）：只 update 改了的那几行，并记下 id', async () => {
    const plans = prep.dayRows(DAY);
    const existing = existingFrom(plans);
    const edited = clone(plans);
    edited[2].paperQuestions[4].snapshotContent.stem = 'fixed typo';
    edited[2].questions[4].content.stem = 'fixed typo';
    const plan = prep.planDay(edited, existing);
    prep.assertPlanAllowed(plan, { revise: true });
    const { tx, calls } = recorder();
    const report = prep.makeReport();
    await prep.writeDay(tx, plan, report);
    expect(calls.map((c) => `${c.op}:${c.args.where?.id ?? ''}`)).toEqual([
      `question.update:${edited[2].questions[4].id}`,
      `paperQuestion.update:${edited[2].paperQuestions[4].id}`,
    ]);
    expect(report.notes).toContain(`修订 ${edited[2].paperQuestions[4].id}`);
  });
});

describe('PUB02 —— 「不该动的」核对', () => {
  const snap = { submissions_hash: 'a', other_words_hash: 'b', submissions: 1, scripts: 2, attempts: 3, reviews: 4, mistakes: 5, appeals: 6, dlc: 7, s12f_words: 8, fixture_words: 9 };

  it('一样就是空', () => {
    expect(prep.foreignChanges(snap, { ...snap })).toEqual([]);
  });

  it('答卷指纹、非试点生词、每一类计数，动一个报一个', () => {
    expect(prep.foreignChanges(snap, { ...snap, submissions_hash: 'x' })).toEqual(['StudentSubmission']);
    expect(prep.foreignChanges(snap, { ...snap, other_words_hash: 'x' })).toEqual(['非试点 StudentWord']);
    for (const k of ['submissions', 'scripts', 'attempts', 'reviews', 'mistakes', 'appeals', 'dlc', 's12f_words', 'fixture_words']) {
      expect(prep.foreignChanges(snap, { ...snap, [k]: -1 })).toEqual([k]);
    }
  });

  it('--check 不要确认串，其余闸门一道不少；发布仍然要确认串', () => {
    const env = {
      ...prep.EXPECTED_RAILWAY,
      DATABASE_PUBLIC_URL: 'postgresql://u:p@proxy.example.test:41234/railway',
      RAILWAY_TCP_PROXY_DOMAIN: 'proxy.example.test',
      RAILWAY_TCP_PROXY_PORT: '41234',
      P1_CONFIRM: '',
    };
    expect(() => prep.assertEnvGates(env)).toThrow(/确认串/);
    expect(() => prep.assertEnvGates(env, { requireConfirmation: false })).not.toThrow();
    expect(() => prep.assertEnvGates({ ...env, RAILWAY_PROJECT_ID: 'x' }, { requireConfirmation: false })).toThrow();
  });
});

describe('PUB03 —— 查重历史完整分页', () => {
  /** 一个只会回答 paperQuestion.findMany 的假事务，按 id 排序、`id > after` 翻页。 */
  function historyTx(n: number) {
    const all = Array.from({ length: n }, (_, i) => ({ id: `h_${String(i).padStart(6, '0')}`, snapshotContent: { passage: `p${i}` } }));
    const calls: any[] = [];
    const tx = {
      paperQuestion: {
        findMany: async (args: any) => {
          calls.push(args);
          const after = args.where?.id?.gt;
          return all.filter((r) => !after || r.id > after).slice(0, args.take);
        },
      },
    };
    return { tx, calls };
  }

  it('10,050 条历史：按 id 分页取完，一条不少（原来 take: 10000 截断）', async () => {
    const { tx, calls } = historyTx(10_050);
    const { rows, pages } = await prep.deliveredHistory(tx, { pageSize: 2000 });
    expect(rows).toHaveLength(10_050);
    expect(rows[rows.length - 1].id).toBe('h_010049');
    expect(pages).toBe(6);
    expect(calls.every((c) => c.orderBy?.id === 'asc' && c.take === 2000)).toBe(true);
  });

  it('恰好整页时多取一页确认到底了', async () => {
    const { tx } = historyTx(4000);
    const { rows, pages } = await prep.deliveredHistory(tx, { pageSize: 2000 });
    expect(rows).toHaveLength(4000);
    expect(pages).toBe(3);
  });

  it('口径：挂过作业且有答卷；只排除正在发布的那几份卷子（p1 的旧版本也在历史里）；不按归档状态过滤', async () => {
    const { tx, calls } = historyTx(1);
    await prep.deliveredHistory(tx, { excludePaperIds: ['p1_olevel_20260915_paper'] });
    const where = calls[0].where;
    expect(where.paper).toEqual({ assignments: { some: { submissions: { some: {} } } } });
    expect(where.paperId).toEqual({ notIn: ['p1_olevel_20260915_paper'] });
    expect(JSON.stringify(where)).not.toMatch(/archived|status|startsWith/);
    expect(prep.HISTORY_PAGE_SIZE).toBeLessThanOrEqual(5000);
  });
});

describe('PUB03 —— 查重引擎的边界（沿用 shingle containment，不另起一套）', () => {
  const lesson = content.lessonFor('olevel', DAY);
  const other = content.lessonFor('ielts_authentic', DAY);

  it('同一篇文章换个标题再发：标题不参与比较，照样拦', () => {
    const hit = sim.findNearDuplicate([{ id: 'new', text: lesson.passage }], [{ id: 'old', text: lesson.passage }], 0.25, 5);
    expect(hit).toMatchObject({ candidateId: 'new', previousId: 'old', similarity: 1, threshold: 0.25, shingleSize: 5, algorithm: sim.ALGORITHM_VERSION });
  });

  it('近似改写（每 12 个词换掉 1 个）仍在阈值之上', () => {
    const words = lesson.passage.split(/\s+/);
    const rewritten = words.map((w: string, i: number) => (i % 12 === 5 ? 'altered' : w)).join(' ');
    expect(sim.containmentSimilarity(rewritten, lesson.passage, 5)).toBeGreaterThanOrEqual(0.25);
    expect(sim.findNearDuplicate([{ id: 'new', text: rewritten }], [{ id: 'old', text: lesson.passage }], 0.25, 5)).not.toBeNull();
  });

  it('不相干的两篇不误伤', () => {
    expect(sim.findNearDuplicate([{ id: 'a', text: lesson.passage }], [{ id: 'b', text: other.passage }], 0.25, 5)).toBeNull();
  });

  it('同一道题换了指令再发：只比指令之后的题目本身，照样拦', () => {
    const item = sim.questionItem(lesson.questions[0].stem);
    const a = `Choose the correct letter, A, B, C or D.\n\n${item}`;
    const b = `Answer the question below.\n\n${item}`;
    expect(sim.findNearDuplicate([{ id: 'a', text: sim.questionItem(a) }], [{ id: 'b', text: sim.questionItem(b) }], 0.8, 4)).not.toBeNull();
  });

  it('短于一个片段的题目：一模一样才算重复（v1 恒为 0，永远查不出）', () => {
    expect(sim.containmentSimilarity('Why did he leave?', 'why did he leave', 4)).toBe(1);
    expect(sim.containmentSimilarity('Why did he leave?', 'Why did she stay?', 4)).toBe(0);
    expect(sim.findNearDuplicate([{ id: 'a', text: 'Who won?' }], [{ id: 'b', text: 'who won' }], 0.8, 4)).toMatchObject({ similarity: 1 });
    // 一边短一边长：不做模糊比较
    expect(sim.containmentSimilarity('Who won?', lesson.passage, 4)).toBe(0);
    // 空文本
    expect(sim.containmentSimilarity('', '', 4)).toBe(0);
  });

  it('够长的文本：v2 与 v1 的相似度逐位相同（只改短文本兜底与性能）', () => {
    const v1 = (left: string, right: string, size: number) => {
      const a = sim.shingles(left, size);
      const b = sim.shingles(right, size);
      if (!a.size || !b.size) return 0;
      let overlap = 0;
      for (const value of a) if (b.has(value)) overlap += 1;
      return overlap / Math.min(a.size, b.size);
    };
    const texts = Object.values(content.LEVELS as Record<string, any[]>).flat().slice(0, 12).map((d) => d.passage);
    for (const x of texts) for (const y of texts) expect(sim.containmentSimilarity(x, y, 5)).toBe(v1(x, y, 5));
  });
});
