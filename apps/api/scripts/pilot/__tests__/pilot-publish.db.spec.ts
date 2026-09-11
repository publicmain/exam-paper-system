/**
 * 发布脚本 × **真 Postgres** 的集成测试（PUB01 / PUB02 / PUB03，2026-09-11）。
 *
 * 纯函数测试钉得住判断规则，钉不住「事务到底回没回滚」「提交之后才断言」这类
 * 只有真库才会暴露的问题。这里直接跑 CLI（与叶老师发布时同一条命令、同一套
 * 环境闸门），库是本机隔离库，故障用触发器注入。
 *
 * 默认跳过。要跑：
 *
 *   PILOT_IT_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable&connection_limit=1&pgbouncer=true' \
 *     npx vitest run scripts/pilot/__tests__/pilot-publish.db.spec.ts
 *
 * 连接串只接受 127.0.0.1 / localhost；本机起库的办法（含 `pgbouncer=true`
 * 为什么必须加）见 docs/audit-2026-09-11/ledger-pub.md「隔离库集成测试」。
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  IT_URL,
  STUDENTS,
  assertLocalDatabase,
  dayFootprint,
  installDropWordTrigger,
  installTamperTrigger,
  resetDb,
  seedWorld,
} from './helpers/pilot-db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const content = require('../content');
const SCRIPT = path.resolve(__dirname, '..', 'prepare-pilot-week.js');
const PATCH = path.resolve(__dirname, 'helpers', 'patch-content.js');
const DATES = content.DATES as string[];
const DAY = DATES[DATES.length - 1];
const OTHER_DAY = DATES[DATES.length - 2];
const LEVELS = Object.keys(content.LEVELS as Record<string, unknown>);
const dkey = (d: string) => d.replace(/-/g, '');

function runCli(day: string, args: string[] = [], env: Record<string, string> = {}) {
  const url = assertLocalDatabase(IT_URL);
  const res = spawnSync(process.execPath, [SCRIPT, `--day=${day}`, ...args], {
    encoding: 'utf8',
    timeout: 240_000,
    env: {
      PATH: process.env.PATH ?? '',
      SystemRoot: process.env.SystemRoot ?? '',
      // 与 staging 闸门同值 —— 闸门只比字面，连的仍是本机隔离库
      RAILWAY_PROJECT_ID: 'ed8c31c0-6499-4611-830a-64043189f7d0',
      RAILWAY_PROJECT_NAME: 'exam-staging-manual',
      RAILWAY_ENVIRONMENT_NAME: 'production',
      RAILWAY_SERVICE_NAME: 'Postgres',
      DATABASE_PUBLIC_URL: IT_URL,
      RAILWAY_TCP_PROXY_DOMAIN: url.hostname,
      RAILWAY_TCP_PROXY_PORT: url.port,
      P1_CONFIRM: 'S12M_PUBLISH_PILOT_WEEK',
      ...env,
    },
  });
  return { code: res.status, out: res.stdout ?? '', err: res.stderr ?? '' };
}

const suite = IT_URL ? describe : describe.skip;

suite('发布脚本 × 隔离 Postgres', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    assertLocalDatabase(IT_URL);
    prisma = new PrismaClient({ datasources: { db: { url: IT_URL } } });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    await seedWorld(prisma);
  });

  // ── PUB02：检查必须在提交之前 ─────────────────────────────────

  it('PUB02 —— 「动了不该动的东西」整笔回滚，失败时不打印「已发布」', async () => {
    await installTamperTrigger(prisma);
    const r = runCli(DAY);
    expect(r.code, r.out + r.err).not.toBe(0);
    expect(r.err).toMatch(/不该动/);
    // 回滚：卷子、题、场次、学生安排一行都不留，被改的答卷也回到原样
    expect(await dayFootprint(prisma, DAY)).toEqual({ papers: 0, paperQuestions: 0, sessions: 0, assignments: 0, words: 0 });
    const sub = await prisma.studentSubmission.findUnique({ where: { id: 'it_sub' } });
    expect(sub?.status).toBe('marked');
    expect(r.out).not.toMatch(/已发布/);
  });

  it('PUB02 —— 学生今天的词没建全（缺词），后置约束拦下并整笔回滚', async () => {
    await installDropWordTrigger(prisma, 'stu_ol_1');
    const r = runCli(DAY);
    expect(r.code, r.out + r.err).not.toBe(0);
    expect(r.err).toMatch(/stu_ol_1/);
    expect(r.out).not.toMatch(/已发布/);
    expect(await dayFootprint(prisma, DAY)).toEqual({ papers: 0, paperQuestions: 0, sessions: 0, assignments: 0, words: 0 });
  });

  // ── PUB01：已发布内容冻结 ────────────────────────────────────

  it('PUB01 —— 相同内容重跑：零写入、场次原样、成功', async () => {
    expect(runCli(DAY).code).toBe(0);
    const before = await dayFootprint(prisma, DAY);
    expect(before.papers).toBe(LEVELS.length);
    expect(before.sessions).toBe(LEVELS.length * 10);
    const q = await prisma.question.findUnique({ where: { id: `p1_olevel_${dkey(DAY)}_q01` } });
    const pq = await prisma.paperQuestion.findUnique({ where: { id: `p1_olevel_${dkey(DAY)}_pq01` } });

    const again = runCli(DAY);
    expect(again.code, again.out + again.err).toBe(0);
    expect(await dayFootprint(prisma, DAY)).toEqual(before);
    const q2 = await prisma.question.findUnique({ where: { id: q!.id } });
    expect(q2!.updatedAt.getTime(), '相同内容不该再写一遍').toBe(q!.updatedAt.getTime());
    const pq2 = await prisma.paperQuestion.findUnique({ where: { id: pq!.id } });
    expect(pq2).toEqual(pq);
  });

  it('PUB01 —— 被取消的场次，重跑不会被悄悄恢复成 active', async () => {
    expect(runCli(DAY).code).toBe(0);
    const sid = `p1_olevel_${dkey(DAY)}_sess_class_sec27w`;
    await prisma.morningQuizSession.update({ where: { id: sid }, data: { status: 'cancelled' } });
    const again = runCli(DAY);
    expect(again.code, again.out + again.err).toBe(0);
    expect((await prisma.morningQuizSession.findUnique({ where: { id: sid } }))!.status).toBe('cancelled');
  });

  it('PUB01 —— 学生已经开始/交卷的卷子，内容一改就拒绝，题面答案分数一个字不动', async () => {
    expect(runCli(DAY).code).toBe(0);
    const paperDay = dkey(DAY);
    // 两个学生：一个做到一半，一个已交已判
    await prisma.studentSubmission.create({
      data: { id: 'it_started', assignmentId: `p1_olevel_${paperDay}_asg_class_sec27w`, studentId: 'stu_ol_1', maxScore: 14, status: 'in_progress' },
    });
    await prisma.studentSubmission.create({
      data: { id: 'it_marked', assignmentId: `p1_olevel_${paperDay}_asg_class_sec27w`, studentId: 'stu_ol_2', maxScore: 14, status: 'marked', totalScore: 9 },
    });
    await prisma.answerScript.create({
      data: { submissionId: 'it_marked', paperQuestionId: `p1_olevel_${paperDay}_pq01`, selectedOption: 'A', awardedMarks: 1, autoCorrect: true },
    });
    const frozen = await prisma.paperQuestion.findMany({ where: { paperId: `p1_olevel_${paperDay}_paper` }, orderBy: { id: 'asc' } });

    const patched = runCli(DAY, [], {
      NODE_OPTIONS: `--require ${PATCH}`,
      PILOT_PATCH: JSON.stringify({ level: 'olevel', date: DAY, q: 0, stem: 'Choose the correct letter.\n\nA brand-new stem that was edited after publication?' }),
    });
    expect(patched.code, patched.out + patched.err).not.toBe(0);
    expect(patched.err).toMatch(/已被学生使用/);
    expect(patched.err).toMatch(new RegExp(`p1_olevel_${paperDay}_pq01`));
    // 连「明确修订」开关也不放行已被使用的卷子
    const forced = runCli(DAY, ['--revise-unstarted'], {
      NODE_OPTIONS: `--require ${PATCH}`,
      PILOT_PATCH: JSON.stringify({ level: 'olevel', date: DAY, q: 0, marks: 2 }),
    });
    expect(forced.code).not.toBe(0);
    expect(await prisma.paperQuestion.findMany({ where: { paperId: `p1_olevel_${paperDay}_paper` }, orderBy: { id: 'asc' } })).toEqual(frozen);
  });

  it('PUB01 —— 没人开始的卷子：改了内容默认拒绝，加 --revise-unstarted 才更新并列出改了什么', async () => {
    expect(runCli(DAY).code).toBe(0);
    const pqId = `p1_ielts_simplified_${dkey(DAY)}_pq01`;
    const env = {
      NODE_OPTIONS: `--require ${PATCH}`,
      PILOT_PATCH: JSON.stringify({ level: 'ielts_simplified', date: DAY, q: 0, stem: 'Do the following statements agree with the information in the passage?\n\nA corrected statement written before any student opened the paper.' }),
    };
    const refused = runCli(DAY, [], env);
    expect(refused.code, refused.out + refused.err).not.toBe(0);
    expect(refused.err).toMatch(/--revise-unstarted/);
    expect(((await prisma.paperQuestion.findUnique({ where: { id: pqId } }))!.snapshotContent as any).stem).not.toMatch(/corrected statement/);

    const revised = runCli(DAY, ['--revise-unstarted'], env);
    expect(revised.code, revised.out + revised.err).toBe(0);
    expect(revised.out).toMatch(new RegExp(pqId));
    expect(((await prisma.paperQuestion.findUnique({ where: { id: pqId } }))!.snapshotContent as any).stem).toMatch(/corrected statement/);
  });

  // ── PUB03：去重历史完整分页 ─────────────────────────────────

  it('PUB03 —— 历史超过 10000 条时，排在最后的那条近似重复也拦得住', async () => {
    const lesson = content.lessonFor('olevel', DAY);
    await prisma.question.create({
      data: {
        id: 'it_hist_q',
        subjectId: 'it_subject',
        createdById: 'it_teacher',
        questionType: 'short_answer',
        content: {},
        answerContent: {},
        marks: 1,
        estimatedTimeMin: 1,
        difficulty: 3,
      },
    });
    await prisma.paper.create({
      data: {
        id: 'it_hist_paper',
        name: 'Big history',
        subjectId: 'it_subject',
        ownerId: 'it_teacher',
        status: 'archived',
        archivedAt: new Date('2026-01-01T00:00:00Z'),
        durationMin: 30,
        totalMarksTarget: 1,
        totalMarksActual: 1,
        generatedSeed: 1,
        config: {},
      },
    });
    const N = 10_050;
    const rows = Array.from({ length: N }, (_, i) => ({
      id: `it_hist_${String(i).padStart(6, '0')}`,
      paperId: 'it_hist_paper',
      questionId: 'it_hist_q',
      sortOrder: i,
      snapshotContent: {
        passage: i === N - 1 ? lesson.passage : `Filler passage number ${i} about ordinary unrelated topic ${i % 97} and nothing else ${i}.`,
      },
      snapshotAnswer: {},
      marks: 1,
    }));
    for (let i = 0; i < rows.length; i += 2000) await prisma.paperQuestion.createMany({ data: rows.slice(i, i + 2000) });
    await prisma.paperAssignment.create({
      data: { id: 'it_hist_asg', paperId: 'it_hist_paper', classId: 'it_class', assignedById: 'it_teacher', status: 'closed' },
    });
    await prisma.studentSubmission.create({
      data: { id: 'it_hist_sub', assignmentId: 'it_hist_asg', studentId: 'stu_ol_1', maxScore: 1, status: 'marked' },
    });

    const r = runCli(DAY);
    expect(r.code, r.out + r.err).not.toBe(0);
    expect(r.err).toMatch(/近似重复/);
    expect(r.err).toMatch(/olevel/);
    expect(await dayFootprint(prisma, DAY)).toEqual({ papers: 0, paperQuestions: 0, sessions: 0, assignments: 0, words: 0 });
  }, 300_000);

  it('PUB03 —— 以前发过、后来内容包里改掉了的 p1 版本，仍然算「学生读过」', async () => {
    const lesson = content.lessonFor('olevel', DAY);
    // 一份已经不在内容包里的旧 p1 卷子，挂过作业、有学生答过
    await prisma.examBoard.create({ data: { id: 'p1_board', code: 'P1ENG', name: 'Pilot English' } });
    await prisma.subject.create({ data: { id: 'p1_subject', examBoardId: 'p1_board', code: 'ENG', name: 'English Reading', level: 'MULTI_LEVEL' } });
    await prisma.user.create({ data: { id: 'p1_publisher', email: 'p1.publisher@example.invalid', name: 'publisher', passwordHash: 'x', role: 'teacher', isActive: false } });
    await prisma.paper.create({
      data: { id: 'p1_olevel_20260101_paper', name: 'Old version', subjectId: 'p1_subject', ownerId: 'p1_publisher', status: 'published', durationMin: 30, totalMarksTarget: 1, totalMarksActual: 1, generatedSeed: 1, config: {} },
    });
    await prisma.question.create({
      data: { id: 'p1_olevel_20260101_q01', subjectId: 'p1_subject', createdById: 'p1_publisher', questionType: 'short_answer', content: {}, answerContent: {}, marks: 1, estimatedTimeMin: 1, difficulty: 3 },
    });
    await prisma.paperQuestion.create({
      data: { id: 'p1_olevel_20260101_pq01', paperId: 'p1_olevel_20260101_paper', questionId: 'p1_olevel_20260101_q01', sortOrder: 1, snapshotContent: { passage: lesson.passage, stem: 'x' }, snapshotAnswer: {}, marks: 1 },
    });
    await prisma.paperAssignment.create({
      data: { id: 'p1_olevel_20260101_asg', paperId: 'p1_olevel_20260101_paper', classId: 'it_class', assignedById: 'p1_publisher', status: 'closed' },
    });
    await prisma.studentSubmission.create({
      data: { id: 'it_old_p1_sub', assignmentId: 'p1_olevel_20260101_asg', studentId: 'stu_ol_2', maxScore: 1, status: 'marked' },
    });
    const r = runCli(DAY);
    expect(r.code, r.out + r.err).not.toBe(0);
    expect(r.err).toMatch(/近似重复/);
  });

  // ── 正常路径 ───────────────────────────────────────────────

  it('完整发布一天：五档 × 十个班的场次、每个有档位的学生 12 个词，全部在事务里核对过', async () => {
    const r = runCli(OTHER_DAY);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toMatch(/已发布/);
    const fp = await dayFootprint(prisma, OTHER_DAY);
    expect(fp.papers).toBe(LEVELS.length);
    expect(fp.paperQuestions).toBe(LEVELS.length * 10);
    expect(fp.sessions).toBe(LEVELS.length * 10);
    expect(fp.assignments).toBe(LEVELS.length * 10);
    // 有档位的在册学生 + 发布脚本自带的内部冒烟账号（p1_qa_student，olevel），各 12 个词
    const withLevel = STUDENTS.filter((s) => s.level).length;
    expect(fp.words).toBe((withLevel + 1) * 12);
    // 学生自己的词、别人的答卷原样
    expect((await prisma.studentWord.findUnique({ where: { id: 'it_personal_word' } }))!.headword).toBe('serendipity');
    expect((await prisma.studentSubmission.findUnique({ where: { id: 'it_sub' } }))!.status).toBe('marked');
  });
});
