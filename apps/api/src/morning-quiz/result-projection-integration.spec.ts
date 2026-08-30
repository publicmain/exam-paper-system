/**
 * S12H 返工 1/2 —— **走真实的 `getStudentResult()`**，不是纯函数。
 *
 * v1.0 的复审抓到两个只有在真实构造路径上才看得见的缺陷：
 *
 *   B-2 结果页在把 `[ai-grade] ` 前缀**擦掉之后**才交给
 *       `stripUnreleasedScores`，于是 AI 判的题在出身判定那一步看起来
 *       像「服务端确定性判的」，分数被提前放出去。
 *       纯函数测试看不见它 —— 我上一轮的桩是自己手写的、前缀还在。
 *
 *   B-3 `markedById` 被 `...it` 展开进了学生响应，老师的 id 直接落到
 *       客户端。
 *
 * 所以这一份 spec **只从 `getStudentResult()` 这一头进**，用假 Prisma
 * 喂持久化行，断言最终序列化出去的那份东西。
 */
import { describe, it, expect, vi } from 'vitest';
import { MorningQuizService } from './morning-quiz.service';

const TEACHER_ID = 't_marker_9f3';
const SESSION = 'sess-1';
const STUDENT = 'stu-1';

type ScriptRow = {
  paperQuestionId: string;
  selectedOption: string | null;
  textAnswer: string | null;
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  markedById: string | null;
  markerComment: string | null;
};

type QuestionRow = {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: Record<string, unknown>;
  snapshotOptions: Array<{ key: string; text: string; correct?: boolean }> | null;
  answerContent: Record<string, unknown> | null;
};

function makeSvc(o: {
  status?: string;
  finalSubmittedAt?: Date | null;
  questions: QuestionRow[];
  scripts: ScriptRow[];
}) {
  const prisma: any = {
    morningQuizSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: SESSION,
        paperAssignmentId: 'asg-1',
        classId: 'c1',
        date: new Date('2026-08-30T00:00:00.000Z'),
        quizEnd: new Date('2026-08-30T15:59:00.000Z'),
        makeupStart: null,
        makeupEnd: null,
        paperAssignment: {
          id: 'asg-1',
          paperId: 'paper-1',
          paper: { name: 'The Rooftop Garden, Two Years On' },
        },
      }),
    },
    studentSubmission: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'sub-1',
        status: o.status ?? 'submitted',
        autoScore: 2,
        manualScore: null,
        totalScore: null,
        maxScore: 4,
        submittedAt: new Date('2026-08-30T00:51:00.000Z'),
        finalSubmittedAt:
          o.finalSubmittedAt === undefined ? new Date('2026-08-30T00:51:00.000Z') : o.finalSubmittedAt,
        scripts: o.scripts,
      }),
    },
    paperQuestion: {
      findMany: vi.fn().mockResolvedValue(
        o.questions.map((q) => ({
          id: q.id,
          sortOrder: q.sortOrder,
          marks: q.marks,
          snapshotContent: q.snapshotContent,
          snapshotOptions: q.snapshotOptions,
          question: { questionType: q.questionType, answerContent: q.answerContent },
        })),
      ),
    },
  };
  const svc = new MorningQuizService(prisma, {} as any, {} as any, {} as any, {} as any);
  return { svc, prisma };
}

const mcqQuestion = (over: Partial<QuestionRow> = {}): QuestionRow => ({
  id: 'pq-mcq',
  sortOrder: 1,
  marks: 1,
  questionType: 'mcq',
  snapshotContent: { stem: 'The garden was suggested by a student.', taskType: 'true_false_not_given' },
  snapshotOptions: [
    { key: 'A', text: 'TRUE', correct: true },
    { key: 'B', text: 'FALSE' },
    { key: 'C', text: 'NOT GIVEN' },
  ],
  answerContent: { text: 'A' },
  ...over,
});

const saQuestion = (over: Partial<QuestionRow> = {}): QuestionRow => ({
  id: 'pq-sa',
  sortOrder: 2,
  marks: 2,
  questionType: 'short_answer',
  snapshotContent: { stem: 'What did the students plant along the north wall?' },
  snapshotOptions: null,
  answerContent: { text: 'a row of hedges' },
  ...over,
});

const mcqScript = (over: Partial<ScriptRow> = {}): ScriptRow => ({
  paperQuestionId: 'pq-mcq',
  selectedOption: 'A',
  textAnswer: 'TRUE',
  awardedMarks: 1,
  autoCorrect: true,
  markedById: null,
  markerComment: null,
  ...over,
});

const saScript = (over: Partial<ScriptRow> = {}): ScriptRow => ({
  paperQuestionId: 'pq-sa',
  selectedOption: null,
  textAnswer: 'hedges along the wall',
  awardedMarks: null,
  autoCorrect: null,
  markedById: null,
  markerComment: null,
  ...over,
});

const itemOf = (r: any, id: string) => r.items.find((x: any) => x.paperQuestionId === id);

// ─────────────────────────────────────────────────────────────
// B-2 —— 运行时的 AI 判分不许被当成确定性判分
// ─────────────────────────────────────────────────────────────

describe('S12H/1 —— 真实 getStudentResult：AI 判的题保持 pending', () => {
  it('库里存的评语以 [ai-grade] 开头 → 逐题状态是 pending_marking，分数不给', async () => {
    const { svc } = makeSvc({
      questions: [saQuestion()],
      scripts: [
        saScript({
          awardedMarks: 2,
          autoCorrect: true,
          markerComment: '[ai-grade] 同义改写，判对',
        }),
      ],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    const it0 = itemOf(r, 'pq-sa');
    expect(it0.gradingStatus, 'AI 判的题被当成了确定性判分').toBe('pending_marking');
    expect(it0.awardedMarks).toBeNull();
    expect(it0.autoCorrect).toBeNull();
    expect(it0.isCorrect).toBeNull();
    expect(it0.markerComment).toBeNull();
  });

  it('精确匹配判对的简答题在没有正面证据时同样保持 pending', async () => {
    const { svc } = makeSvc({
      questions: [saQuestion()],
      scripts: [saScript({ textAnswer: 'a row of hedges', awardedMarks: 2, autoCorrect: true })],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    expect(itemOf(r, 'pq-sa').gradingStatus).toBe('pending_marking');
    expect(itemOf(r, 'pq-sa').awardedMarks).toBeNull();
  });

  it('确定性选择题照常放行（正分与 0 分都是结论）', async () => {
    const { svc } = makeSvc({
      questions: [mcqQuestion(), mcqQuestion({ id: 'pq-mcq2', sortOrder: 3 })],
      scripts: [
        mcqScript(),
        mcqScript({ paperQuestionId: 'pq-mcq2', selectedOption: 'C', awardedMarks: 0, autoCorrect: false }),
      ],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    expect(itemOf(r, 'pq-mcq').gradingStatus).toBe('auto_graded');
    expect(itemOf(r, 'pq-mcq').awardedMarks).toBe(1);
    expect(itemOf(r, 'pq-mcq2').gradingStatus).toBe('auto_graded');
    expect(itemOf(r, 'pq-mcq2').awardedMarks).toBe(0);
  });

  it('整卷总分仍然 pending，且 gradingSummary 与逐题状态一致', async () => {
    const { svc } = makeSvc({
      questions: [mcqQuestion(), saQuestion()],
      scripts: [mcqScript(), saScript()],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    expect(r.scoresPending).toBe(true);
    expect(r.totalScore).toBeNull();
    expect(r.autoScore).toBeNull();
    const s = r.gradingSummary;
    expect(s.autoGraded).toBe(1);
    expect(s.pendingMarking).toBe(1);
    expect(s.autoGraded + s.marked + s.pendingMarking + s.notAnswered).toBe(s.total);
    expect(s.total).toBe(r.items.length);
    const auto = r.items.filter((x: any) => x.gradingStatus === 'auto_graded').length;
    expect(auto).toBe(s.autoGraded);
  });

  it('老师草稿分与评语在定稿前一个字都不给', async () => {
    const { svc } = makeSvc({
      questions: [saQuestion()],
      scripts: [
        saScript({ awardedMarks: 1, markedById: TEACHER_ID, markerComment: '少写了一个要点' }),
      ],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    const it0 = itemOf(r, 'pq-sa');
    expect(it0.gradingStatus).toBe('pending_marking');
    expect(it0.awardedMarks).toBeNull();
    expect(it0.markerComment).toBeNull();
    expect(it0.commentSource).toBeNull();
  });

  it('还没最终提交时连确定性选择题也不给分、不给答案', async () => {
    const { svc } = makeSvc({
      finalSubmittedAt: null,
      questions: [mcqQuestion()],
      scripts: [mcqScript()],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    const it0 = itemOf(r, 'pq-mcq');
    expect(it0.awardedMarks).toBeNull();
    expect(it0.correctAnswer).toBeNull();
    expect(it0.answerDisplay).toBeNull();
    expect(r.gradingSummary).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// B-3 —— 内部字段不许出现在学生响应里
// ─────────────────────────────────────────────────────────────

describe('S12H/1 —— 真实 getStudentResult：markedById 绝不外泄', () => {
  const cases: Array<[string, { status?: string; scripts: ScriptRow[] }]> = [
    ['未定稿 · 老师判过', { scripts: [saScript({ awardedMarks: 1, markedById: TEACHER_ID, markerComment: '再看第三段' })] }],
    ['已定稿 · 老师判过', { status: 'marked', scripts: [saScript({ awardedMarks: 1, markedById: TEACHER_ID, markerComment: '再看第三段' })] }],
    ['未定稿 · AI 判过', { scripts: [saScript({ awardedMarks: 2, autoCorrect: true, markerComment: '[ai-grade] 判对' })] }],
    ['未定稿 · 确定性判过', { scripts: [saScript({ awardedMarks: 0, autoCorrect: false })] }],
  ];
  for (const [label, o] of cases) {
    it(`${label}：响应里既没有 markedById 这个键，也没有那个 id 的值`, async () => {
      const { svc } = makeSvc({ status: o.status, questions: [saQuestion()], scripts: o.scripts });
      const r: any = await svc.getStudentResult(SESSION, STUDENT);
      const blob = JSON.stringify(r);
      expect(blob, 'markedById 这个键泄漏了').not.toContain('markedById');
      expect(blob, '老师的 id 值泄漏了').not.toContain(TEACHER_ID);
      for (const item of r.items) {
        expect(Object.keys(item)).not.toContain('markedById');
      }
    });
  }

  it('该有的公开字段一个不少', async () => {
    const { svc } = makeSvc({
      status: 'marked',
      questions: [mcqQuestion(), saQuestion()],
      scripts: [
        mcqScript(),
        saScript({ awardedMarks: 1, markedById: TEACHER_ID, markerComment: '再看第三段' }),
      ],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    const sa = itemOf(r, 'pq-sa');
    for (const k of [
      'paperQuestionId', 'sortOrder', 'marks', 'questionType', 'snapshotContent',
      'snapshotOptions', 'studentAnswer', 'correctAnswer', 'referenceAnswer',
      'explanation', 'awardedMarks', 'autoCorrect', 'isCorrect', 'markerComment',
      'commentSource', 'gradingStatus', 'answerDisplay',
    ]) {
      expect(Object.keys(sa), `公开字段 ${k} 不见了`).toContain(k);
    }
    expect(sa.gradingStatus).toBe('marked');
    expect(sa.markerComment).toBe('再看第三段');
    expect(sa.commentSource).toBe('teacher');
  });

  it('答案展示仍然是语义的，重复值只发一次，且没有中文标签', async () => {
    const { svc } = makeSvc({
      questions: [saQuestion({ answerContent: { text: 'A Row  of Hedges' } })],
      scripts: [saScript()],
    });
    const r: any = await svc.getStudentResult(SESSION, STUDENT);
    const d = itemOf(r, 'pq-sa').answerDisplay;
    expect(d.primaryKind).toBe('reference');
    expect(d.primaryValue).toBe('A Row  of Hedges');
    expect(d.rubricValue).toBeUndefined();
    expect(JSON.stringify(d)).not.toMatch(/正确答案|参考答案|评分要点/);
  });
});
