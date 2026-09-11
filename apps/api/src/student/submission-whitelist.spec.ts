import { describe, expect, it, vi } from 'vitest';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';
import { MorningQuizController } from '../morning-quiz/morning-quiz.controller';
import { MorningQuizService } from '../morning-quiz/morning-quiz.service';

/**
 * S01（2026-09-11 审计）—— 学生答题 / 恢复 / 详情响应按答题状态的**字段白名单**。
 *
 * ## 原症状（修之前可复现）
 *
 * `GET /student/submissions/:id` 用黑名单脱敏后 `...rest` 原样展开：
 * `PaperQuestion.snapshotAnswer` / `overrideAnswer` / `overrideContent`、
 * `Paper.qaReviewSummary`、题目资源的 `aiPrompt` 都会出现在答题中的响应里。
 * 开卷 / 交卷 / 作业列表把整行原样返回，判分草稿（awardedMarks / autoCorrect /
 * markerComment）与未定稿的 autoScore 也一并下发。
 *
 * ## 这里怎么测
 *
 * 在**每一个**可能藏答案的位置放一个唯一标记（`LEAK·<位置>`），题型覆盖
 * 选择题、判断题、短答、完形 / 词库、段落配对；再把**所有学生侧响应**
 * 序列化后递归搜索：标记一个都不能出现，答案类的键名也不能出现。
 * 真实的 StudentService / 控制器 / MorningQuizService，Prisma 是内存假对象。
 */

const MARK = 'LEAK·';
const m = (where: string) => `${MARK}${where}`;

/** 学生不该看到的键名 —— 值无论是什么都不该出现（递归到任意深度）。 */
const FORBIDDEN_KEYS = [
  'snapshotAnswer', 'overrideAnswer', 'overrideContent', 'answerContent', 'markScheme',
  'correct', 'correctOption', 'correctAnswer', 'acceptedKeys', 'explanation', 'evidence',
  'exampleAnswer', 'rubric', 'solution', 'referenceAnswer', 'qaReviewSummary', 'qaReviewIssues',
  'config', 'aiPrompt', 'markedById', 'provenanceTag', 'sourceRef', 'assignedById',
];
// 注：clientSeq 不在里面 —— 它是客户端自己的保存序号，阅读答题页恢复作答要用。

function forbiddenKeysIn(v: unknown, path = '$', out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => forbiddenKeysIn(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object' && !(v instanceof Date)) {
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.includes(k) && x != null) out.push(`${path}.${k}`);
      forbiddenKeysIn(x, `${path}.${k}`, out);
    }
  }
  return out;
}

function assertClean(label: string, payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text.includes(MARK), `${label} 泄漏了标记：${text.match(/LEAK·[^"\\]*/g)?.join(', ')}`).toBe(false);
  expect(forbiddenKeysIn(payload), `${label} 出现了答案类字段`).toEqual([]);
}

/** 一道题：所有能藏答案的地方都埋标记。 */
function pq(id: string, sortOrder: number, questionType: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    paperId: 'paper-1',
    questionId: `q-${id}`,
    sortOrder,
    marks: 2,
    snapshotContent: {
      stem: `Stem of ${id}`,
      passage: 'A short passage.',
      taskType: questionType === 'mcq' ? 'true_false_not_given' : 'short_answer',
      correctOption: m(`${id}.snapshotContent.correctOption`),
      correctAnswer: m(`${id}.snapshotContent.correctAnswer`),
      acceptedKeys: [m(`${id}.snapshotContent.acceptedKeys`)],
      explanation: m(`${id}.snapshotContent.explanation`),
      evidence: m(`${id}.snapshotContent.evidence`),
      markScheme: [{ point: m(`${id}.snapshotContent.markScheme`), marks: 1 }],
      rubric: m(`${id}.snapshotContent.rubric`),
      exampleAnswer: m(`${id}.snapshotContent.exampleAnswer`),
      wordBank: [{ key: 'A', text: 'harbour', correct: m(`${id}.wordBank.correct`) }],
      ...extra,
    },
    snapshotAnswer: { text: m(`${id}.snapshotAnswer`), explanation: m(`${id}.snapshotAnswer.explanation`) },
    snapshotOptions:
      questionType === 'mcq'
        ? [
            { key: 'A', text: 'TRUE', correct: true, explanation: m(`${id}.snapshotOptions.explanation`) },
            { key: 'B', text: 'FALSE' },
          ]
        : null,
    overrideContent: null,
    overrideAnswer: { text: m(`${id}.overrideAnswer`) },
    question: {
      id: `q-${id}`,
      questionType,
      marks: 2,
      difficulty: 3,
      sourceRef: m(`${id}.question.sourceRef`),
      provenanceTag: m(`${id}.question.provenanceTag`),
      content: { stem: `Master stem ${id}`, answer: m(`${id}.question.content.answer`) },
      answerContent: { text: m(`${id}.question.answerContent`) },
      markScheme: [{ point: m(`${id}.question.markScheme`), marks: 2 }],
      options:
        questionType === 'mcq'
          ? [{ key: 'A', text: 'TRUE', correct: true }, { key: 'B', text: 'FALSE' }]
          : null,
      assets: [
        { id: `as-${id}`, assetType: 'image', storageUrl: '/a.png', altText: 'figure', sortOrder: 0, aiPrompt: m(`${id}.asset.aiPrompt`), aiModel: 'x' },
      ],
    },
  };
}

const QUESTIONS = [
  pq('pq-tfng', 1, 'mcq'),
  pq('pq-mcq', 2, 'mcq'),
  pq('pq-sa', 3, 'short_answer'),
  pq('pq-cloze', 4, 'short_answer', { uiKind: 'cloze' }),
  // 老师在这份卷子里改过题干：学生看改过的版本，但改动里的答案同样不出
  { ...pq('pq-edit', 5, 'short_answer'), overrideContent: { stem: 'Edited stem', correctAnswer: m('pq-edit.overrideContent.correctAnswer') } },
];

function script(pqId: string, over: Record<string, unknown> = {}) {
  const q = QUESTIONS.find((x) => x.id === pqId)!;
  return {
    id: `sc-${pqId}`,
    submissionId: 'sub-1',
    paperQuestionId: pqId,
    selectedOption: q.question.questionType === 'mcq' ? 'A' : null,
    textAnswer: q.question.questionType === 'mcq' ? null : 'my answer',
    // 系统收卷后又被重新打开（system_eod → in_progress）的答卷：旧的判分还留在行上
    awardedMarks: 2,
    autoCorrect: true,
    markerComment: m(`${pqId}.markerComment`),
    markedById: 'teacher-1',
    markedAt: new Date(),
    clientSeq: 7,
    updatedAt: new Date('2026-09-11T01:00:00Z'),
    paperQuestion: q,
    ...over,
  };
}

function submission(status: string, over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    assignmentId: 'as-1',
    studentId: 'stu-a',
    status,
    startedAt: new Date('2026-09-11T00:30:00Z'),
    submittedAt: null,
    finalSubmittedAt: null,
    submitSource: null,
    autoFinalizeReason: m('submission.autoFinalizeReason'),
    autoScore: 7,
    manualScore: 3,
    totalScore: 10,
    maxScore: 10,
    assignment: {
      id: 'as-1',
      paperId: 'paper-1',
      classId: 'c-1',
      assignedById: 'teacher-1',
      assignedAt: new Date('2026-09-10T00:00:00Z'),
      startAt: null,
      dueAt: null,
      durationMin: 30,
      status: 'open',
      class: { id: 'c-1', name: 'IAL26W', classCode: 'IAL26W' },
      paper: {
        id: 'paper-1',
        name: 'Reading 11 Sep',
        subjectId: 'eng',
        durationMin: 30,
        totalMarksActual: 10,
        examDate: null,
        ownerId: 'teacher-1',
        generatedSeed: 42,
        config: { mode: 'passage_pick', answerKey: m('paper.config') },
        qaReviewSummary: m('paper.qaReviewSummary'),
        qaReviewIssues: [{ note: m('paper.qaReviewIssues') }],
        questions: QUESTIONS,
      },
    },
    scripts: QUESTIONS.map((q) => script(q.id)),
    ...over,
  };
}

function studentService(sub: Record<string, any>) {
  const prisma: any = {
    studentSubmission: {
      findUnique: vi.fn(async () => sub),
      findFirst: vi.fn(async () => sub),
      update: vi.fn(async () => sub),
    },
    paperAssignment: {
      findUnique: vi.fn(async () => ({
        id: 'as-1', paperId: 'paper-1', classId: 'c-1', dueAt: null, morningQuizSession: null,
        class: { enrollments: [{ role: 'student', userId: 'stu-a' }] },
      })),
      findMany: vi.fn(async () => [
        {
          ...sub.assignment,
          paper: { id: 'paper-1', name: 'Reading', subjectId: 'eng', durationMin: 30, totalMarksActual: 10 },
          submissions: [sub],
        },
      ]),
    },
    paperQuestion: { findFirst: vi.fn(async () => ({ id: 'pq-sa' })) },
    answerScript: { upsert: vi.fn(async () => script('pq-sa')) },
  };
  return { svc: new StudentService(prisma), prisma };
}

const STUDENT = { id: 'stu-a', role: 'student' };
const req = { ip: '10.0.0.1' } as any;

describe('S01 · 未交卷：所有学生侧响应递归搜不到答案标记', () => {
  it('GET /student/submissions/:id（答题中刷新 / 恢复）', async () => {
    const { svc } = studentService(submission('in_progress'));
    const out = await new StudentController(svc).getOwn('sub-1', STUDENT, req);
    assertClean('getOwn(in_progress)', out);
    // 渲染所需的仍在：题干、选项文字、配图、自己的作答
    const q1 = (out as any).assignment.paper.questions[0];
    expect(q1.snapshotContent.stem).toBe('Stem of pq-tfng');
    expect(q1.snapshotOptions).toEqual([{ key: 'A', text: 'TRUE' }, { key: 'B', text: 'FALSE' }]);
    expect(q1.question.assets[0]).toMatchObject({ storageUrl: '/a.png', altText: 'figure' });
    expect((out as any).assignment.paper.questions[4].snapshotContent.stem).toBe('Edited stem');
    expect((out as any).scripts[0]).toMatchObject({ paperQuestionId: 'pq-tfng', selectedOption: 'A' });
    // 判分信息一概不给（包括系统收卷后重开留下的旧判分）
    for (const s of (out as any).scripts) {
      expect(s.awardedMarks).toBeNull();
      expect(s.autoCorrect).toBeNull();
      expect(s.markerComment).toBeNull();
    }
    expect((out as any)).toMatchObject({ autoScore: null, manualScore: null, totalScore: null, scoresPending: true });
  });

  it('POST /student/submissions（开卷 / 恢复）', async () => {
    const { svc } = studentService(submission('in_progress'));
    const out = await new StudentController(svc).openSubmission({ assignmentId: 'as-1' }, STUDENT, req);
    assertClean('openSubmission', out);
    expect(out).toMatchObject({ id: 'sub-1', status: 'in_progress', autoScore: null });
  });

  it('PATCH /student/submissions/:id/scripts（自动保存）', async () => {
    const { svc } = studentService(submission('in_progress'));
    const out = await new StudentController(svc).saveScript('sub-1', { paperQuestionId: 'pq-sa', textAnswer: 'x' }, STUDENT, req);
    assertClean('saveScript', out);
    expect(out).toMatchObject({ paperQuestionId: 'pq-sa', awardedMarks: null, autoCorrect: null });
  });

  it('GET /student/assignments（作业列表里的 mySubmission）', async () => {
    const { svc } = studentService(submission('in_progress'));
    const out = await new StudentController(svc).myAssignments(STUDENT);
    assertClean('myAssignments', out);
    expect((out as any)[0].mySubmission).toMatchObject({ id: 'sub-1', autoScore: null });
  });

  it('暂存提交（9:00 收卷，finalSubmittedAt 为空）：同样不给判分与答案', async () => {
    const { svc } = studentService(submission('submitted', { submittedAt: new Date() }));
    const out: any = await new StudentController(svc).getOwn('sub-1', STUDENT, req);
    assertClean('getOwn(submitted, 未最终提交)', out);
    for (const s of out.scripts) expect(s.autoCorrect).toBeNull();
    expect(out.totalScore).toBeNull();
  });

  it('GET /morning-quiz/sessions/:id（阅读答题页，含恢复作答）', async () => {
    const sub = submission('in_progress');
    const prisma: any = {
      morningQuizSession: {
        findUnique: vi.fn(async () => ({
          id: 's1', status: 'active', classId: 'c-1', level: 'olevel', paperAssignmentId: 'as-1',
          date: new Date('2026-09-11T00:00:00Z'), quizEnd: new Date('2099-01-01T00:00:00Z'),
          makeupStart: null, makeupEnd: null,
          paperAssignment: { id: 'as-1', paperId: 'paper-1', classId: 'c-1' },
        })),
      },
      attendance: { findUnique: vi.fn(async () => null) },
      studentSubmission: { findFirst: vi.fn(async () => ({ id: 'sub-1', status: 'in_progress', finalSubmittedAt: null })) },
      paper: { findUnique: vi.fn(async () => ({ config: { mode: 'passage_pick' }, status: 'published', qaTeacherAction: null })) },
      paperQuestion: { findMany: vi.fn(async () => QUESTIONS) },
      answerScript: { findMany: vi.fn(async () => sub.scripts) },
    };
    const mq = new MorningQuizService(prisma, {} as any, {} as any, {} as any, {} as any);
    const out = await mq.getStudentView('s1', 'stu-a');
    assertClean('getStudentView', out);
    expect((out as any).existingAnswers['pq-sa']).toMatchObject({ textAnswer: 'my answer' });
  });

  it('GET /morning-quiz/student-result（窗口已关、从未最终提交）：分数与答案两道门都关着', async () => {
    const sub = submission('in_progress');
    const prisma: any = {
      morningQuizSession: {
        findUnique: vi.fn(async () => ({
          id: 's1', paperAssignmentId: 'as-1', classId: 'c-legacy', date: new Date('2026-09-01T00:00:00Z'),
          quizEnd: new Date('2026-09-01T01:00:00Z'), makeupStart: null, makeupEnd: null,
          paperAssignment: { id: 'as-1', paperId: 'paper-1', paper: { name: 'Reading' } },
        })),
      },
      studentSubmission: { findFirst: vi.fn(async () => ({ ...sub, scripts: sub.scripts })) },
      paperQuestion: { findMany: vi.fn(async () => QUESTIONS) },
    };
    const mq = new MorningQuizService(prisma, {} as any, {} as any, {} as any, {} as any);
    const out: any = await mq.getStudentResult('s1', 'stu-a');
    // 结果页本来就要回题干与作答；这里只查答案 / 评语 / 判分标记
    const text = JSON.stringify(out);
    expect(text.includes(MARK), text.match(/LEAK·[^"\\]*/g)?.join(', ')).toBe(false);
    expect(out.answersPending).toBe(true);
    expect(out.scoresPending).toBe(true);
  });

  it('POST /morning-quiz/sessions/:id/open 与 /submit（开卷 / 交卷的返回体）', async () => {
    const sub = submission('in_progress');
    const student: any = {
      openSubmission: vi.fn(async () => ({ ...sub, assignment: undefined, scripts: undefined })),
      finalSubmit: vi.fn(async () => ({ ...sub, status: 'submitted', finalSubmittedAt: new Date(), assignment: undefined, scripts: undefined })),
    };
    const svc: any = { findSubmissionForSession: vi.fn(async () => ({ id: 'sub-1' })) };
    const prisma: any = { morningQuizSession: { findUnique: vi.fn(async () => ({ paperAssignmentId: 'as-1' })) } };
    const c = new MorningQuizController(svc, student, {} as any, {} as any, {} as any, {} as any, prisma);
    const opened = await c.openSession('s1', STUDENT, req);
    assertClean('openSession', opened);
    expect(opened).toMatchObject({ id: 'sub-1', status: 'in_progress', autoScore: null });
    const submitted = await c.submit('s1', STUDENT, req, { final: true });
    assertClean('submit', submitted);
    // 交卷那一刻只有 MCQ 部分分 —— 定稿前不给（2026-08-14 成绩发布口径）
    expect(submitted).toMatchObject({ id: 'sub-1', status: 'submitted', autoScore: null, totalScore: null, scoresPending: true });
  });
});

describe('S01 · 他人答卷拒绝；已发布历史按规则展示', () => {
  it('读别人的答卷 → 403，不返回任何内容', async () => {
    const { svc } = studentService(submission('in_progress', { studentId: 'stu-b' }));
    await expect(new StudentController(svc).getOwn('sub-1', STUDENT, req)).rejects.toMatchObject({ status: 403 });
  });

  it('已最终提交、未判完：确定性判的选择题放出对错与得分，人判题与评语、整卷分数仍等定稿', async () => {
    const sub = submission('submitted', { submittedAt: new Date(), finalSubmittedAt: new Date() });
    sub.scripts = sub.scripts.map((s: any) => ({ ...s, markedById: null, markerComment: null }));
    const { svc } = studentService(sub);
    const out: any = await new StudentController(svc).getOwn('sub-1', STUDENT, req);
    assertClean('getOwn(final, 未判)', out);
    const byPq = Object.fromEntries(out.scripts.map((s: any) => [s.paperQuestionId, s]));
    expect(byPq['pq-mcq']).toMatchObject({ autoCorrect: true, awardedMarks: 2 });
    expect(out.totalScore).toBeNull();
  });

  it('已发布（marked）：整卷分数、逐题得分与评语放出；答案键仍不经这个接口', async () => {
    const sub = submission('marked', { submittedAt: new Date(), finalSubmittedAt: new Date() });
    sub.scripts = sub.scripts.map((s: any) => ({ ...s, markerComment: '[ai-grade] 要点齐全' }));
    const { svc } = studentService(sub);
    const out: any = await new StudentController(svc).getOwn('sub-1', STUDENT, req);
    expect(out).toMatchObject({ status: 'marked', autoScore: 7, manualScore: 3, totalScore: 10, scoresPending: false });
    expect(out.scripts[2]).toMatchObject({ awardedMarks: 2, autoCorrect: true, markerComment: '要点齐全' });
    expect(forbiddenKeysIn(out)).toEqual([]);
    expect(JSON.stringify(out).includes(MARK)).toBe(false);
  });
});
