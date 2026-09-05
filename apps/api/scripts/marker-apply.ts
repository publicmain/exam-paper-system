import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { StudentWordService } from '../src/vocab/student-word.service';
import { VocabService } from '../src/vocab/vocab.service';
import { MistakeService } from '../src/vocab/mistake.service';

/**
 * 把聊天里判好的主观题分数写回数据库 —— 判分流水线的第二步。
 *
 * 流程（2026-09-05 定稿，用户原话「判完直接推」）：
 *   1. `marker-dump.ts --json=<file>` 倒出待批队列（匿名代号 + scriptId）；
 *   2. Claude 在聊天里按 rubric 判，写一份判分文件（格式见下）；
 *   3. 本脚本读判分文件写回、重算总分、submitted → marked。一步到位，
 *      不再等「确认发布」。
 *
 * 零 Anthropic API 调用 —— 判分永远在聊天里做，见 [[ai-api-usage-policy]]。
 *
 * 用法（仓库根目录）：
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/marker-apply.ts \
 *     --file=.local/grades/2026-09-07.json [--dry-run]
 *
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/marker-apply.ts \
 *     --close-legacy --dates=2026-08-25,2026-08-26,2026-08-27 [--dry-run]
 *
 * 判分文件：
 *   {
 *     "dates": ["2026-09-07"],                       // 这些日期的场次全部收尾（见 sweep）
 *     "grades": {
 *       "<scriptId>": { "awardedMarks": 2, "reason": "两点都答到了。" },
 *       ...
 *     }
 *   }
 *
 * 判分文件放 `.local/grades/`（已 gitignore）—— 里面的评语会引学生原话，
 * 不进仓库。2026-08 以前的判分表内嵌在本文件里（见 git 历史）。
 *
 * 行为（与 marker.service.finalize 一致）：
 *   · 每条 grade：更新 AnswerScript 的 awardedMarks / markerComment /
 *     markedById / markedAt；已判过的（markedById 已设）跳过；分数超上限跳过。
 *   · sweep：`dates` 里每个场次的**全部**非练习答卷都进收尾集合，这样
 *     全是客观题、或者一题没写（没有 script 行）的答卷也能翻成 marked。
 *   · 每份答卷：重算 autoScore（客观题 + 非人工判的主观题）、manualScore
 *     （人工判的主观题）、totalScore；主观题全判完才 submitted → marked，
 *     否则只写分数、状态不动。
 *   · 收尾后走一遍生词本 / 错题本采集（best-effort，失败不影响分数）。
 *
 * --close-legacy：清旧账。给定日期的场次里仍是 submitted 的答卷，**不给分**
 *   直接翻成 marked（总分按已判的部分算），未判的主观题只写一条评语说明。
 *   只用于停掉的旧早测班，所以必须带 --class-id=<classId> 把范围锁死在那个班
 *   —— 同一天还有试点班 / 测试班的场次，不能顺手把它们也翻了。
 *   2026-09-05 清 G11 旧早测 08-24 ~ 09-02 的积压用的就是它。
 *
 * --dry-run：只打印会做什么，不写库。
 */

type Grade = { awardedMarks: number; reason: string };
type GradeFile = { dates?: string[]; grades?: Record<string, Grade> };

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};

const DRY_RUN = flag('dry-run');
const CLOSE_LEGACY = flag('close-legacy');
const CLASS_ID = opt('class-id');
const LEGACY_NOTE = '旧早测已停用，本题未判分（不计分）。';
const STRUCTURED = ['structured', 'short_answer', 'essay'];

function loadGradeFile(): { dates: string[]; grades: Record<string, Grade> } {
  const file = opt('file');
  if (!file) throw new Error('缺 --file=<判分文件.json>');
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8')) as GradeFile;
  const dates = Array.isArray(raw.dates) ? raw.dates.map(String) : [];
  const grades: Record<string, Grade> = {};
  for (const [id, g] of Object.entries(raw.grades ?? {})) {
    if (!g || typeof g !== 'object') throw new Error(`grade ${id} 不是对象`);
    const marks = Number((g as Grade).awardedMarks);
    if (!Number.isFinite(marks) || marks < 0 || Math.round(marks * 2) !== marks * 2) {
      throw new Error(`grade ${id} 的 awardedMarks 非法：${(g as Grade).awardedMarks}`);
    }
    const reason = String((g as Grade).reason ?? '').trim();
    if (!reason) throw new Error(`grade ${id} 缺 reason`);
    grades[id] = { awardedMarks: marks, reason };
  }
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`dates 里有非法日期：${d}`);
  }
  return { dates, grades };
}

function parseDates(): string[] {
  const s = opt('dates');
  if (!s) throw new Error('缺 --dates=YYYY-MM-DD[,YYYY-MM-DD…]');
  const dates = s.split(',').map((x) => x.trim()).filter(Boolean);
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`非法日期：${d}`);
  }
  return dates.sort();
}

// 本机通过 `railway run -s Postgres -e production` 跑：那里只有公网代理地址
// （DATABASE_PUBLIC_URL）能连上，DATABASE_URL 指向的 postgres.railway.internal
// 只在 Railway 内网可达。与 prepare-pilot-week.js 同一口径。
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

/** 这些日期（新加坡自然日）的场次对应的 paperAssignmentId。 */
async function assignmentsOfDates(
  dates: string[],
  classId?: string,
): Promise<Array<{ id: string; date: string; level: string | null; className: string }>> {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const rangeStart = new Date(`${sorted[0]}T00:00:00.000Z`);
  const rangeEnd = new Date(
    new Date(`${sorted[sorted.length - 1]}T00:00:00.000Z`).getTime() + 86_400_000,
  );
  const sessions = await prisma.morningQuizSession.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd }, ...(classId ? { classId } : {}) },
    select: { date: true, level: true, paperAssignmentId: true, class: { select: { name: true } } },
  });
  return sessions
    .filter((s) => sorted.includes(s.date.toISOString().slice(0, 10)))
    .map((s) => ({
      id: s.paperAssignmentId,
      date: s.date.toISOString().slice(0, 10),
      level: s.level,
      className: s.class?.name ?? '?',
    }));
}

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h;
}

/** 与 marker-dump.ts 同一套匿名代号（src/common/anon-id.ts）。 */
const anon = (studentId: string) => `S-${String(Math.abs(hash(studentId)) % 10000).padStart(4, '0')}`;

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error('库里没有 admin 用户，无法记录 markedById');
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}以 admin 身份操作：${admin.name} (${admin.id})`);

  const submissionIds = new Set<string>();
  let dates: string[] = [];
  let grades: Record<string, Grade> = {};

  if (CLOSE_LEGACY) {
    dates = parseDates();
    if (!CLASS_ID) throw new Error('--close-legacy 必须带 --class-id=<classId>，把范围锁死在停掉的那个班');
    console.log(`清旧账模式：${dates.join(', ')}  班级 ${CLASS_ID}`);
  } else {
    ({ dates, grades } = loadGradeFile());
    console.log(
      `判分文件：${Object.keys(grades).length} 条；收尾日期：${dates.join(', ') || '（无）'}`,
    );
  }

  // ── 1. 逐条写回 ────────────────────────────────────────────
  let scriptsWritten = 0;
  let scriptsSkipped = 0;
  for (const [scriptId, { awardedMarks, reason }] of Object.entries(grades)) {
    const script = await prisma.answerScript.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        awardedMarks: true,
        markedById: true,
        submissionId: true,
        paperQuestion: { select: { marks: true, question: { select: { questionType: true } } } },
      },
    });
    if (!script) {
      console.warn(`  跳过 ${scriptId} —— 找不到`);
      scriptsSkipped++;
      continue;
    }
    if (!STRUCTURED.includes(script.paperQuestion.question.questionType)) {
      console.warn(
        `  跳过 ${scriptId} —— 不是主观题（${script.paperQuestion.question.questionType}）`,
      );
      scriptsSkipped++;
      continue;
    }
    if (awardedMarks > script.paperQuestion.marks) {
      console.warn(`  跳过 ${scriptId} —— ${awardedMarks} 分超过满分 ${script.paperQuestion.marks}`);
      scriptsSkipped++;
      continue;
    }
    if (script.markedById && script.awardedMarks != null) {
      console.log(`  跳过 ${scriptId} —— 已判过`);
      scriptsSkipped++;
      submissionIds.add(script.submissionId);
      continue;
    }
    if (!DRY_RUN) {
      await prisma.answerScript.update({
        where: { id: scriptId },
        data: { awardedMarks, markerComment: reason, markedById: admin.id, markedAt: new Date() },
      });
    }
    scriptsWritten++;
    submissionIds.add(script.submissionId);
  }
  if (Object.keys(grades).length > 0) {
    console.log(`\n写回 ${scriptsWritten} 条，跳过 ${scriptsSkipped} 条。\n`);
  }

  // ── 2. sweep：把这些日期的全部非练习答卷拉进收尾集合 ─────────
  const assignments = await assignmentsOfDates(dates, CLOSE_LEGACY ? CLASS_ID : undefined);
  if (dates.length > 0) {
    const swept = await prisma.studentSubmission.findMany({
      where: {
        assignmentId: { in: assignments.map((a) => a.id) },
        status: CLOSE_LEGACY ? 'submitted' : { not: 'practice' },
      },
      select: { id: true },
    });
    for (const s of swept) submissionIds.add(s.id);
    const where = assignments.map((a) => `${a.date} ${a.className}/${a.level}`).join('；');
    console.log(
      `sweep：${dates.join(', ')} 共 ${assignments.length} 个场次，${swept.length} 份答卷进收尾集合（${where}）。\n`,
    );
  }

  // ── 3. 逐份重算 + 收尾 ─────────────────────────────────────
  let finalized = 0;
  let partial = 0;
  const closedIds: string[] = [];
  for (const submissionId of submissionIds) {
    const sub = await prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        scripts: {
          include: { paperQuestion: { include: { question: { select: { questionType: true } } } } },
        },
      },
    });
    if (!sub) continue;
    const who = anon(sub.studentId);

    let autoScore = 0;
    let manualScore = 0;
    const ungradedIds: string[] = [];
    for (const s of sub.scripts) {
      const t = s.paperQuestion.question.questionType;
      if (t === 'mcq') {
        autoScore += s.awardedMarks ?? 0;
        continue;
      }
      if (s.awardedMarks == null) {
        ungradedIds.push(s.id);
        continue;
      }
      if (s.markedById != null) manualScore += s.awardedMarks;
      else autoScore += s.awardedMarks;
    }
    const totalScore = autoScore + manualScore;

    if (ungradedIds.length > 0 && !CLOSE_LEGACY) {
      if (!DRY_RUN) {
        await prisma.studentSubmission.update({
          where: { id: submissionId },
          data: { autoScore, manualScore, totalScore },
        });
      }
      console.log(
        `  ${who}: 未收尾 —— 还有 ${ungradedIds.length} 道主观题没判  ${totalScore}/${sub.maxScore}`,
      );
      partial++;
      continue;
    }

    if (CLOSE_LEGACY && ungradedIds.length > 0 && !DRY_RUN) {
      await prisma.answerScript.updateMany({
        where: { id: { in: ungradedIds }, markerComment: null },
        data: { markerComment: LEGACY_NOTE },
      });
    }

    let flipped = 0;
    if (!DRY_RUN) {
      const updated = await prisma.studentSubmission.updateMany({
        where: { id: submissionId, status: 'submitted' },
        data: { status: 'marked', autoScore, manualScore, totalScore },
      });
      flipped = updated.count;
      if (flipped === 0) {
        await prisma.studentSubmission.update({
          where: { id: submissionId },
          data: { autoScore, manualScore, totalScore },
        });
      }
    } else {
      flipped = sub.status === 'submitted' ? 1 : 0;
    }
    if (flipped) {
      finalized++;
      if (CLOSE_LEGACY) closedIds.push(submissionId);
      const note = ungradedIds.length ? ` 未判 ${ungradedIds.length} 题` : '';
      console.log(
        `  ${who}: ${CLOSE_LEGACY ? '清旧账' : '收尾'}  ${totalScore}/${sub.maxScore} (auto=${autoScore} manual=${manualScore}${note})`,
      );
    } else {
      console.log(`  ${who}: 只更新分数（状态已是 ${sub.status}）  ${totalScore}/${sub.maxScore}`);
    }
  }

  // ── 4. 生词本 / 错题本「批改即采集」（best-effort）────────────
  //
  // 采集本来只挂在 MarkerService.finalize 上，而真实判分走的是本脚本，
  // 所以这里复用同一个生产服务类。失败绝不影响已写好的分数。
  if (!DRY_RUN && !CLOSE_LEGACY) {
    const vocabSvc = new VocabService(prisma as any);
    const wordsSvc = new StudentWordService(prisma as any, vocabSvc);
    const mistakeSvc = new MistakeService(prisma as any);
    let harvested = 0;
    let harvestFailed = 0;
    let mkAdded = 0;
    let mkFailed = 0;
    for (const submissionId of submissionIds) {
      try {
        harvested += (await wordsSvc.harvestFromSubmission(submissionId)).added;
      } catch (e: any) {
        harvestFailed++;
        console.warn(`  生词本采集失败 ${submissionId}: ${e?.message ?? e}`);
      }
      try {
        const row = await prisma.studentSubmission.findUnique({
          where: { id: submissionId },
          select: { assignment: { select: { morningQuizSession: { select: { date: true } } } } },
        });
        const d = row?.assignment?.morningQuizSession?.date;
        const quizDay = (d ?? new Date()).toISOString().slice(0, 10);
        mkAdded += (await mistakeSvc.collectFromSubmission(submissionId, quizDay)).added;
      } catch (e: any) {
        mkFailed++;
        console.warn(`  错题本采集失败 ${submissionId}: ${e?.message ?? e}`);
      }
    }
    const hf = harvestFailed ? `（${harvestFailed} 份失败）` : '';
    const mf = mkFailed ? `（${mkFailed} 份失败）` : '';
    console.log(`\n生词本采集 +${harvested}${hf}；错题本采集 +${mkAdded}${mf}`);
  }

  console.log(
    `\n=== ${DRY_RUN ? 'dry-run 完成（没写库）' : '完成'} ===\n` +
      `  写回：${scriptsWritten} 条\n  收尾：${finalized} 份\n  未收尾：${partial} 份\n`,
  );
  if (CLOSE_LEGACY && closedIds.length) {
    console.log(`清掉的答卷 ID（记进交接日志）：\n${closedIds.map((id) => '  ' + id).join('\n')}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
