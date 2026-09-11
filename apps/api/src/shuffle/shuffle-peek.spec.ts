/**
 * S08 收尾：答题页 GET /morning-quiz/sessions/:id 不再隐式写库。
 *
 * 原来 getStudentView() 调 shuffle.getOrCreate() —— 第一次打开就 upsert 一行乱序表，
 * 所以这条 GET 只能「本人写」，教师只读视角打不开。乱序本来就是确定性的（种子 =
 * sha256(studentId.paperId)），库里那行只是缓存；改用只读的 peek() 之后：
 *   · 答题页 GET 零写库（真实 MorningQuizService + 真实 ShuffleService + 记账假库）；
 *   · peek 给出的顺序与之后作答 / 交卷时 getOrCreate 落库的完全一样。
 */
import { describe, expect, it, vi } from 'vitest';
import { ShuffleService, computeShuffle } from './shuffle.service';
import { MorningQuizService } from '../morning-quiz/morning-quiz.service';

const QUESTIONS = [
  { id: 'pq-1', sortOrder: 1, marks: 1, snapshotStem: 'Q1', snapshotOptions: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }], question: { questionType: 'mcq' } },
  { id: 'pq-2', sortOrder: 2, marks: 1, snapshotStem: 'Q2', snapshotOptions: [{ key: 'A', text: 'w' }, { key: 'B', text: 'x' }, { key: 'C', text: 'y' }], question: { questionType: 'mcq' } },
  { id: 'pq-3', sortOrder: 3, marks: 2, snapshotStem: 'Q3', snapshotOptions: null, question: { questionType: 'short_answer' } },
];

const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

/** 按模型名给读方法返回值；任何写方法都记一笔。 */
function recordingPrisma(reads: Record<string, Record<string, (...a: any[]) => unknown>>) {
  const writes: string[] = [];
  const prisma: any = new Proxy({}, {
    get(_t, model) {
      if (typeof model !== 'string' || model === 'then') return undefined;
      if (model === '$transaction') return async (fn: any) => fn(prisma);
      return new Proxy({}, {
        get(_t2, op) {
          if (typeof op !== 'string' || op === 'then') return undefined;
          return async (...args: any[]) => {
            if (WRITE_OPS.has(op)) {
              writes.push(`${model}.${op}`);
              return {};
            }
            const fn = reads[model]?.[op];
            return fn ? fn(...args) : op === 'findMany' ? [] : null;
          };
        },
      });
    },
  });
  return { prisma, writes };
}

describe('ShuffleService.peek —— 只读，且与 getOrCreate 同一份', () => {
  it('**没有缓存行：在内存里算，不写库**；结果与 getOrCreate 之后落库的完全一样', async () => {
    const { prisma, writes } = recordingPrisma({ paperQuestion: { findMany: () => QUESTIONS } });
    const svc = new ShuffleService(prisma);
    const peeked = await svc.peek('stu-a', 'paper-1');
    expect(writes).toEqual([]);
    const created = await svc.getOrCreate('stu-a', 'paper-1');
    expect(writes).toEqual(['questionShuffleMap.upsert']);
    expect(peeked).toEqual(created);
    expect(peeked).toEqual(computeShuffle('stu-a', 'paper-1', QUESTIONS));
  });

  it('**有有效的缓存行：原样返回**（不重算、不写）', async () => {
    const row = { seed: 'cafe', questionOrder: [2, 0, 1], optionOrders: { 'pq-1': [3, 2, 1, 0], 'pq-2': [2, 1, 0] } };
    const { prisma, writes } = recordingPrisma({ paperQuestion: { findMany: () => QUESTIONS }, questionShuffleMap: { findUnique: () => row } });
    const out = await new ShuffleService(prisma).peek('stu-a', 'paper-1');
    expect(out).toEqual(row);
    expect(writes).toEqual([]);
  });

  it('**缓存行已过期（卷子改过题数）：只读地重算，不删旧行**（删 / 重建留给之后的 getOrCreate）', async () => {
    const stale = { seed: 'old', questionOrder: [0, 1], optionOrders: {} };
    const { prisma, writes } = recordingPrisma({ paperQuestion: { findMany: () => QUESTIONS }, questionShuffleMap: { findUnique: () => stale } });
    const out = await new ShuffleService(prisma).peek('stu-a', 'paper-1');
    expect(out).toEqual(computeShuffle('stu-a', 'paper-1', QUESTIONS));
    expect(writes).toEqual([]);
  });
});

describe('GET /morning-quiz/sessions/:id —— getStudentView 零写库（真实服务）', () => {
  it('**打乱顺序的卷子 + 已有作答要恢复：全程一行都不写**', async () => {
    const { prisma, writes } = recordingPrisma({
      morningQuizSession: {
        findUnique: () => ({
          id: 's1', status: 'active', classId: 'c-1', level: 'olevel', paperAssignmentId: 'as-1',
          date: new Date('2026-09-11T00:00:00Z'), quizEnd: new Date('2099-01-01T00:00:00Z'),
          makeupStart: null, makeupEnd: null,
          paperAssignment: { id: 'as-1', paperId: 'paper-1', classId: 'c-1' },
        }),
      },
      studentSubmission: { findFirst: () => ({ id: 'sub-1', status: 'in_progress', finalSubmittedAt: null }) },
      paper: { findUnique: () => ({ config: {}, status: 'published', qaTeacherAction: null, name: 'Reading' }) },
      paperQuestion: { findMany: () => QUESTIONS },
      answerScript: { findMany: () => [{ paperQuestionId: 'pq-1', selectedOption: 'B', textAnswer: null, clientSeq: 3 }] },
    });
    const shuffle = new ShuffleService(prisma);
    const peek = vi.spyOn(shuffle, 'peek');
    const getOrCreate = vi.spyOn(shuffle, 'getOrCreate');
    const mq = new MorningQuizService(prisma, {} as any, shuffle, {} as any, {} as any);
    const out: any = await mq.getStudentView('s1', 'stu-a');
    expect(writes).toEqual([]);
    expect(getOrCreate).not.toHaveBeenCalled();
    expect(peek).toHaveBeenCalled();
    // 顺序照确定性乱序给出：与以后作答时 getOrCreate 落库的一致
    const map = computeShuffle('stu-a', 'paper-1', QUESTIONS);
    const ids = (out.questions ?? out.paperQuestions ?? []).map((q: any) => q.id ?? q.paperQuestionId);
    if (ids.length) expect(ids).toEqual(map.questionOrder.map((i) => QUESTIONS[i].id));
  });
});
