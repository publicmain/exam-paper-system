import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { VocabTeacherService } from '../src/vocab/vocab-teacher.service';
import { VocabService } from '../src/vocab/vocab.service';

/**
 * 把某一篇基础层短文的配套词表推给一个班。
 *
 * 复用 VocabTeacherService.pushWords —— 已在别人本子里的词自动跳过
 * （保留原有 FSRS 进度），所以重复推送安全。逐词带各自的原文例句。
 *
 *   列出词表：   npx ts-node apps/api/scripts/push-basic-wordlist.ts --list
 *   演练：       ... --story basic-01-new-shoes --class <classId>
 *   执行：       ... --story basic-01-new-shoes --class <classId> --apply
 *   全部 5 篇：  ... --all --class <classId> --apply
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, 'basic-wordlists.json'), 'utf-8'));

  if (process.argv.includes('--list')) {
    console.log('\n=== 基础层词表 ===\n');
    for (const l of data.lists) {
      console.log(`  ${l.story.padEnd(26)} ${l.title.padEnd(22)} ${l.items.length} 词`);
      console.log(`    ${l.items.map((i: any) => i.word).join(', ')}\n`);
    }
    await prisma.$disconnect();
    return;
  }

  const classId = arg('class');
  if (!classId) throw new Error('缺 --class <classId>；用 --list 只看词表');
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true },
  });
  if (!cls) throw new Error(`找不到班级 ${classId}`);

  const wanted = process.argv.includes('--all') ? null : arg('story');
  const lists = wanted ? data.lists.filter((l: any) => l.story === wanted) : data.lists;
  if (!lists.length) throw new Error(`没有匹配的词表：${wanted}`);

  const APPLY = process.argv.includes('--apply');
  const admin = await prisma.user.findFirst({
    where: { role: 'admin', isActive: true },
    select: { id: true, role: true },
  });
  if (!admin) throw new Error('找不到 admin');

  const students = await prisma.classEnrollment.count({
    where: { classId, role: 'student', user: { isActive: true } },
  });

  console.log(`\n=== 推送词表 ${APPLY ? '(执行)' : '(演练)'} ===`);
  console.log(`班级：${cls.name}   在册学生：${students} 人\n`);

  const vocab = new VocabService(prisma as any);
  const teacher = new VocabTeacherService(prisma as any, vocab as any);

  for (const l of lists) {
    if (!APPLY) {
      console.log(`  ${l.title}：${l.items.length} 词 × ${students} 人 = ${l.items.length * students} 条`);
      continue;
    }
    const r = await teacher.pushWords(
      { classId, items: l.items },
      { id: admin.id, role: admin.role, ip: null },
    );
    console.log(
      `  ✓ ${l.title.padEnd(22)} 新增 ${String(r.created).padStart(3)} 条 · ` +
        `跳过已有 ${String(r.skipped).padStart(3)} 条` +
        (r.notFound.length ? ` · ⚠ 查不到: ${r.notFound.join(',')}` : ''),
    );
  }

  if (!APPLY) console.log('\n加 --apply 才写库。\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
