/**
 * **测试专用** —— 把仓库里已提交的真实阅读夹具翻成学生端线缆形状。
 *
 * ## 为什么从磁盘读而不是 import
 *
 * 夹具住在 `apps/api/test-fixtures/`，不在 student-web 的构建上下文里。
 * 用 `fs.readFileSync` 读它，**保证它永远进不了生产包** —— 打包器看不到
 * 这条依赖。这也是契约的要求（test-only fixture access must not enter
 * the production bundle）。
 *
 * ## 脱敏边界就在这里
 *
 * 夹具是**老师侧**的，带答案：每题一个 `answer`，MCQ 选项上还有
 * `correct: true`。学生端的响应里这些**一个都不能有** —— 服务端有
 * `stripSnapshotContent` / `stripOptions` 两道白名单，这里照同样的口径
 * 在测试侧复刻一遍，让 mock 出来的响应与真实学生响应同形。
 *
 * **不修改夹具文件**，只读。
 */
import fs from 'node:fs';
import path from 'node:path';

export const READING_FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'api',
  'test-fixtures',
  'ielts-authored-2026-v3',
  'test1-passage1.json',
);

/** 老师侧夹具的形状（只声明本文件用到的字段）。 */
interface FixtureQuestion {
  n: number;
  questionType: string;
  taskType: string;
  instruction: string;
  item: string;
  marks: number;
  /** 老师侧才有 —— 必须在返回给学生之前剥掉。 */
  answer?: unknown;
  options?: Array<{ key: string; text: string; correct?: boolean }>;
}

interface Fixture {
  setCode: string;
  level: string;
  passageTitle: string;
  /** 出处说明，老师侧记录；学生看不到。 */
  note?: string;
  passage: string;
  questions: FixtureQuestion[];
}

export function loadFixture(): Fixture {
  return JSON.parse(fs.readFileSync(READING_FIXTURE_PATH, 'utf8')) as Fixture;
}

export interface WireQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: Record<string, unknown>;
  snapshotOptions: Array<{ key: string; text: string }> | null;
}

/**
 * 老师侧夹具 → 学生端线缆。
 *
 * 与服务端 `getStudentView` 的形状对齐：
 * 每题带自己的 `snapshotContent`（含共享的 passage / passageTitle），
 * `stem` 是「指令 + 空行 + 题目」——IELTS 渲染器的 `splitStem` 按最后一个
 * 空行把它拆回指令与题干，从而把同一指令的题分成一组。
 */
export function fixtureToWireQuestions(fx: Fixture): WireQuestion[] {
  return fx.questions.map((q) => ({
    id: `pq-${q.n}`,
    sortOrder: q.n,
    marks: q.marks,
    questionType: q.questionType,
    snapshotContent: {
      taskType: q.taskType,
      passageTitle: fx.passageTitle,
      passage: fx.passage,
      stem: `${q.instruction}\n\n${q.item}`,
      // **注意这里没有 answer / correctOption / explanation** —— 脱敏就在这一步
    },
    snapshotOptions: q.options ? q.options.map((o) => ({ key: o.key, text: o.text })) : null,
  }));
}

/** 老师侧才有的字段名 —— 测试用它断言「学生响应里一个都不剩」。 */
export const TEACHER_ONLY_KEYS = [
  'answer',
  'correct',
  'correctOption',
  'correctAnswer',
  'explanation',
  'markScheme',
  'note',
  'provenanceTag',
] as const;
