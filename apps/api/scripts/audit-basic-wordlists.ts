import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { VocabService } from '../src/vocab/vocab.service';
import { isInSyllabus } from '../src/vocab/student-word.service';

/**
 * 基础层词表审计。三件必须成立的事：
 *
 *   1 可查   —— 每个词都能被 vocab.service.lookup 落到 DictEntry 原形。
 *               查不到的词推下去，学生复习卡片是空的。
 *   2 有据   —— 每条 context 必须逐字出自配套短文。生词本的卖点就是
 *               「他自己读过的那一句」，编一句出来等于自毁卖点。
 *   3 难度   —— 报出 bnc 词频与考纲标签，人工确认没有偏到 GRE 或
 *               偏到人人都会的词。
 *
 * 只读。
 */
const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const prisma = new PrismaClient();

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, 'basic-wordlists.json'), 'utf-8'));
  const vocab = new VocabService(prisma as any);

  let fails = 0;
  const all: any[] = [];

  for (const list of data.lists) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(DIR, `${list.story}.json`), 'utf-8'),
    );
    const passage: string = fixture.sections
      .map((s: any) => s.passage ?? '')
      .reduce((a: string, b: string) => (a.length > b.length ? a : b), '');
    const flat = passage.replace(/\s+/g, ' ');

    console.log(`\n=== ${list.title}（${list.items.length} 词）===`);
    for (const it of list.items) {
      const hit = await vocab.lookup(it.word);
      const problems: string[] = [];
      if (!hit) problems.push('词典查不到');
      // context 允许省略句末标点后的部分，故按前缀去尾比对
      const ctx = it.context.replace(/\s+/g, ' ').trim();
      if (!flat.includes(ctx)) problems.push('例句不在原文中');
      // 词本身也应出现在例句里。按词首 4 字母匹配以容纳屈折
      // （shake↔shaking、fold↔folds），比后缀剥离稳。
      const head = it.word.toLowerCase().slice(0, Math.min(4, it.word.length));
      if (!ctx.toLowerCase().includes(head)) problems.push('例句里没有这个词');
      // 考纲范围（2026-08-14 教师定）：只考雅思 / O-Level。
      // 只出现在托福 / GRE 里的词不收 —— 本校两条通道都不考那两个试。
      if (hit) {
        const e0 = await prisma.dictEntry.findUnique({ where: { word: hit.word } });
        if (!isInSyllabus(e0?.tag)) {
          problems.push(`超考纲(只有 ${(e0?.tag ?? []).join(',') || '无标签'})`);
        }
      }

      if (problems.length) {
        fails++;
        console.log(`  ✗ ${it.word.padEnd(12)} ${problems.join(' / ')}`);
      } else {
        const e = await prisma.dictEntry.findUnique({ where: { word: hit!.word } });
        all.push({ word: hit!.word, bnc: e?.bnc ?? null, tag: e?.tag?.join(',') ?? '' });
        console.log(
          `  ✓ ${it.word.padEnd(12)} → ${String(hit!.word).padEnd(12)} ` +
            `bnc=${String(e?.bnc ?? '-').padStart(6)} ${(e?.tag ?? []).join(',')}`,
        );
      }
    }
  }

  const withBnc = all.filter((a) => typeof a.bnc === 'number' && a.bnc > 0);
  withBnc.sort((a, b) => a.bnc - b.bnc);
  console.log('\n=== 难度分布（bnc 越小越常用）===');
  console.log(`  最常用: ${withBnc.slice(0, 3).map((a) => `${a.word}(${a.bnc})`).join(' ')}`);
  console.log(`  最生僻: ${withBnc.slice(-3).map((a) => `${a.word}(${a.bnc})`).join(' ')}`);
  const tooRare = withBnc.filter((a) => a.bnc > 13000);
  if (tooRare.length) {
    console.log(`  ⚠ 偏生僻(bnc>13000): ${tooRare.map((a) => a.word).join(', ')}`);
  }
  console.log(`\n合计 ${all.length} 词，${fails} 项不合格\n`);

  await prisma.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
