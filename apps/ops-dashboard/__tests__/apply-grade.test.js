import { describe, it, expect, beforeEach } from 'vitest';
import { createApplyGrade } from '../apply-grade.js';

/**
 * 审计 S05 —— ops-dashboard `/api/grade` 缺少正式判分约束的整条链路回归。
 *
 * 这个文件不连真实 Postgres：`fakePool()` 造一个最小的内存"数据库"，
 * `query(text, params)` 按 SQL 文本里的关键片段分派（不做真实 SQL 解析，
 * 只认 apply-grade.js 实际会发的那几条语句）。这跟 apps/api 那边给 Prisma
 * 造内存假对象、给 marker-queue-stages.spec.ts 用是同一个思路，只是这里
 * 换成 `pg` 的 `pool.connect()/query()/release()` 形状。
 *
 * 覆盖台账 S05 点名的每一条：班级归属、提交状态、题型、认领、真实操作人、
 * 幂等（重试不重复累加）、并发（conditional update 落空时不盲写）。
 */

const CLASS_ID = 'class-1';
const OTHER_CLASS = 'class-2';

function fakePool(initial) {
  const db = {
    users: initial.users ?? [],
    answerScripts: new Map(initial.answerScripts ?? []),
    paperQuestions: new Map(initial.paperQuestions ?? []),
    questions: new Map(initial.questions ?? []),
    submissions: new Map(initial.submissions ?? []),
    assignments: new Map(initial.assignments ?? []),
    markerAssignments: new Map(initial.markerAssignments ?? []), // submissionId -> {markerId, status}
  };
  // 测试专用旋钮：在"锁住答卷行"那条 SELECT 读完快照之后、我们自己的
  // UPDATE 落地之前，模拟另一个事务抢先把提交状态改掉（真实 FOR UPDATE
  // 行锁下这个窗口理论上关得很死，但 applyGrade 仍必须防御，不能盲写）。
  const afterLockRead = initial.afterLockRead ?? null;
  const calls = [];

  function client() {
    return {
      query: async (text, params = []) => {
        calls.push({ text, params });
        const t = text.toLowerCase();

        if (t.startsWith('begin') || t.startsWith('commit') || t.startsWith('rollback')) {
          return { rows: [], rowCount: 0 };
        }

        if (t.includes('from "user" where email=$1')) {
          const u = db.users.find((x) => x.email === params[0]);
          return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
        }

        if (t.includes('for update of ss')) {
          const scriptId = params[0];
          const script = db.answerScripts.get(scriptId);
          if (!script) return { rows: [], rowCount: 0 };
          const pq = db.paperQuestions.get(script.paperQuestionId);
          const qq = db.questions.get(pq.questionId);
          const sub = db.submissions.get(script.submissionId);
          const asg = db.assignments.get(sub.assignmentId);
          const snapshot = {
            awarded: script.awardedMarks,
            marked_by: script.markedById,
            sub: script.submissionId,
            max: pq.marks,
            qtype: qq.questionType,
            sub_status: sub.status,
            class_id: asg.classId,
          };
          // 快照读完之后才让"并发写"生效 —— 这样 applyGrade 后续的
          // conditional UPDATE 会撞上一个已经变了的真实状态，而不是它自己
          // 刚读到的那份。
          if (afterLockRead) afterLockRead(db);
          return { rows: [snapshot], rowCount: 1 };
        }

        if (t.includes('from "markerassignment" where "submissionid"=$1')) {
          const claim = db.markerAssignments.get(params[0]);
          return { rows: claim ? [claim] : [], rowCount: claim ? 1 : 0 };
        }

        if (t.includes('update "answerscript" set "awardedmarks"')) {
          const [scriptId, marks, reason, markerId] = params;
          const script = db.answerScripts.get(scriptId);
          script.awardedMarks = marks;
          script.markerComment = reason;
          script.markedById = markerId;
          return { rows: [], rowCount: 1 };
        }

        if (t.includes('from "answerscript" a join "paperquestion"') && t.includes('where a."submissionid"=$1')) {
          const subId = params[0];
          const rows = [...db.answerScripts.values()]
            .filter((s) => s.submissionId === subId)
            .map((s) => {
              const pq = db.paperQuestions.get(s.paperQuestionId);
              const qq = db.questions.get(pq.questionId);
              return { awarded: s.awardedMarks, markedById: s.markedById, qtype: qq.questionType };
            });
          return { rows, rowCount: rows.length };
        }

        if (t.includes(`update "studentsubmission" set status='marked'`)) {
          const [subId, auto, manual, total] = params;
          const sub = db.submissions.get(subId);
          if (sub.status !== 'submitted') return { rows: [], rowCount: 0 };
          sub.status = 'marked';
          sub.autoScore = auto;
          sub.manualScore = manual;
          sub.totalScore = total;
          return { rows: [], rowCount: 1 };
        }

        if (t.includes('update "studentsubmission" set "autoscore"=$2,"manualscore"=$3,"totalscore"=$4 where id=$1')) {
          const [subId, auto, manual, total] = params;
          const sub = db.submissions.get(subId);
          sub.autoScore = auto;
          sub.manualScore = manual;
          sub.totalScore = total;
          return { rows: [], rowCount: 1 };
        }

        if (t.startsWith('select status from "studentsubmission"')) {
          const sub = db.submissions.get(params[0]);
          return { rows: sub ? [{ status: sub.status }] : [], rowCount: sub ? 1 : 0 };
        }

        throw new Error('fakePool: unrecognised query — ' + text);
      },
      release: () => {},
    };
  }

  return { connect: async () => client(), db, calls };
}

function seed(overrides = {}) {
  const teacher = { id: 'teacher-1', email: 'teacher@school.local', role: 'teacher', isActive: true };
  const otherTeacher = { id: 'teacher-2', email: 'other@school.local', role: 'teacher', isActive: true };
  const student = { id: 'student-1', email: 'student@school.local', role: 'student', isActive: true };
  const disabled = { id: 'teacher-3', email: 'gone@school.local', role: 'teacher', isActive: false };

  const base = {
    users: [teacher, otherTeacher, student, disabled],
    answerScripts: [
      ['script-1', { id: 'script-1', submissionId: 'sub-1', paperQuestionId: 'pq-1', awardedMarks: null, markedById: null }],
    ],
    paperQuestions: [['pq-1', { id: 'pq-1', marks: 5, questionId: 'q-1' }]],
    questions: [['q-1', { id: 'q-1', questionType: 'structured' }]],
    submissions: [
      ['sub-1', { id: 'sub-1', assignmentId: 'asg-1', status: 'submitted', autoScore: 0, manualScore: null, totalScore: null }],
    ],
    assignments: [['asg-1', { id: 'asg-1', classId: CLASS_ID }]],
    markerAssignments: [],
  };
  return { ...base, ...overrides, teacher, otherTeacher, student, disabled };
}

describe('applyGrade —— 正常路径与真实操作人', () => {
  it('单题答卷：判完即发布，markedBy 是真实传入的老师邮箱（不是"最早的管理员"）', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '答对两点', s.teacher.email);
    expect(r).toMatchObject({ ok: true, submissionStatus: 'marked', totalScore: 4, maxScore: 5, markedBy: s.teacher.email, ungradedRemaining: 0 });
    expect(pool.db.answerScripts.get('script-1').markedById).toBe(s.teacher.id);
    expect(pool.db.submissions.get('sub-1').status).toBe('marked');
  });

  it('多题答卷：判完一题，另一题还没判 —— 状态不变、返回真实剩余数', async () => {
    const s = seed({
      answerScripts: [
        ['script-1', { id: 'script-1', submissionId: 'sub-1', paperQuestionId: 'pq-1', awardedMarks: null, markedById: null }],
        ['script-2', { id: 'script-2', submissionId: 'sub-1', paperQuestionId: 'pq-1', awardedMarks: null, markedById: null }],
      ],
    });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 3, '', s.teacher.email);
    expect(r).toMatchObject({ ok: true, submissionStatus: 'submitted', ungradedRemaining: 1 });
    expect(pool.db.submissions.get('sub-1').status).toBe('submitted');
  });
});

describe('applyGrade —— 缺失的约束（审计 S05 逐条）', () => {
  it('班级归属：脚本不属于配置的班级，拒绝且不写库', async () => {
    const s = seed({ assignments: [['asg-1', { id: 'asg-1', classId: OTHER_CLASS }]] });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.teacher.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/class/);
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBeNull();
  });

  it('提交状态：还在 in_progress 的答卷不能判分', async () => {
    const s = seed({ submissions: [['sub-1', { id: 'sub-1', assignmentId: 'asg-1', status: 'in_progress' }]] });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.teacher.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/in_progress/);
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBeNull();
  });

  it('题型：MCQ 题不许人工覆写自动分', async () => {
    const s = seed({ questions: [['q-1', { id: 'q-1', questionType: 'mcq' }]] });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.teacher.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/MCQ/i);
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBeNull();
  });

  it('认领：被另一个老师在网页判分界面认领中，拒绝', async () => {
    const s = seed({ markerAssignments: [['sub-1', { markerId: 'teacher-2', status: 'active' }]] });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.teacher.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/claim/i);
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBeNull();
  });

  it('认领：认领人正是这次判分的操作人本人，放行', async () => {
    const s = seed({ markerAssignments: [['sub-1', { markerId: 'teacher-1', status: 'active' }]] });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.teacher.email);
    expect(r.ok).toBe(true);
  });

  it('真实操作人：邮箱查无此人，拒绝', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', 'nobody@school.local');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown markerEmail/);
  });

  it('真实操作人：学生账号不能判分', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.student.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/role=student/);
  });

  it('真实操作人：停用账号不能判分', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', s.disabled.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/deactivated/);
  });

  it('缺 markerEmail：拒绝，不猜"最早的管理员"', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 4, '', undefined);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/markerEmail/);
  });

  it('分数越界：超过满分拒绝', async () => {
    const s = seed();
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 99, '', s.teacher.email);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/0\.\.5/);
  });
});

describe('applyGrade —— 幂等与并发（重试/并发不重复累加）', () => {
  it('已经判过的题：重复调用不再累加，原样返回 already:true', async () => {
    const s = seed({
      answerScripts: [['script-1', { id: 'script-1', submissionId: 'sub-1', paperQuestionId: 'pq-1', awardedMarks: 3, markedById: 'teacher-1' }]],
    });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 5, '改一下', s.teacher.email);
    expect(r).toMatchObject({ ok: true, already: true });
    // 没有被改成新调用传入的 5 分 —— 幂等跳过，不覆盖已有判分。
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBe(3);
  });

  it('并发：锁行读完快照后提交被别处改动，conditional update 落空时不盲写，如实报告当前状态', async () => {
    const s = seed({
      // 我们读到快照时状态还是 submitted（不然连 checkSubmissionGradable
      // 都过不了）；`afterLockRead` 模拟锁行读完、我们自己的 UPDATE 落地
      // 之前，另一个事务（正式判分服务）抢先把它 finalize 成了 returned。
      afterLockRead: (db) => {
        db.submissions.get('sub-1').status = 'returned';
      },
    });
    const pool = fakePool(s);
    const applyGrade = createApplyGrade(pool, CLASS_ID);
    const r = await applyGrade('script-1', 5, '', s.teacher.email);
    expect(r.ok).toBe(true);
    expect(r.submissionStatus).toBe('returned'); // 如实报告，不是盲写成 'marked'
    expect(r.note).toMatch(/concurrently/);
    // AnswerScript 这一格的分数仍然被记下来了（这题本身没有冲突，只是提交
    // 级别的汇总/状态迁移撞上了并发，因此不重新 finalize）。
    expect(pool.db.answerScripts.get('script-1').awardedMarks).toBe(5);
    // 提交行没有被盲写成 'marked'，保持并发写入之后的真实状态。
    expect(pool.db.submissions.get('sub-1').status).toBe('returned');
  });
});
