/**
 * 回填自动采集：对已经判过分的历史提交补跑一次「批改即采集」。
 *
 * 为什么需要：harvestFromSubmission 挂在 MarkerService.finalize 上，只对
 * **今后**的判分生效。功能上线前已判完的那些卷子，学生的失分词不会自动进
 * 生词本 —— 生词本会是空的，学生第一次打开就没东西可复习。
 *
 * 本脚本直接复用生产服务类（VocabService / StudentWordService），
 * 不重写抽词逻辑，保证与线上行为完全一致。幂等：已在本子里的词自动跳过。
 *
 * 用法：
 *   DATABASE_URL=... npx ts-node scripts/vocab-backfill-harvest.ts [--since 2026-07-27] [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { StudentWordService } from '../src/vocab/student-word.service';
import { VocabService } from '../src/vocab/vocab.service';

const prisma = new PrismaClient();

(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const sinceIdx = args.indexOf('--since');
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : '2026-07-01';

  const vocab = new VocabService(prisma as any);
  const words = new StudentWordService(prisma as any, vocab);

  const subs = await prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
    `select su.id, us.name
     from "StudentSubmission" su
     join "User" us on us.id = su."studentId"
     join "PaperAssignment" pa on pa.id = su."assignmentId"
     join "MorningQuizSession" s on s."paperAssignmentId" = pa.id
     where su.status = 'marked'
       and to_char(s."quizStart",'YYYY-MM-DD') >= $1
     order by us.name`,
    since,
  );

  console.log(`待回填的已判分提交: ${subs.length} 份（since ${since}）${dry ? ' [DRY RUN]' : ''}`);

  let totalAdded = 0;
  const perStudent = new Map<string, number>();
  for (const s of subs) {
    if (dry) continue;
    const r = await words.harvestFromSubmission(s.id);
    if (r.added > 0) {
      totalAdded += r.added;
      perStudent.set(s.name, (perStudent.get(s.name) ?? 0) + r.added);
    }
  }

  console.log(`\n新增生词条目: ${totalAdded}`);
  for (const [name, n] of [...perStudent.entries()].sort((a, b) => b[1] - a[1])) {
    console.log('  ' + name.padEnd(18), n);
  }

  const total = await prisma.studentWord.count();
  console.log(`\nStudentWord 表内总条数: ${total}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERR', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
