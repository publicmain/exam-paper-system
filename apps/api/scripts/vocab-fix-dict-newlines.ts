/**
 * 修复 DictEntry 里的字面 "\n"（反斜杠 + n 两个字符）。
 *
 * 背景：ECDICT 的 CSV 用两字符转义 `\n` 表示释义内的换行，导入时原样入库，
 * 于是学生在点词卡上看到的是
 *     vt. 哄, 诱骗, 耐心地摆弄\nvi. 哄骗\n[计] 同轴电缆
 * 那个 `\n` 是可见脏字符。本脚本把它换成真正的换行。
 *
 * 注意：不要用 SQL 的 LIKE 拼这个模式 —— LIKE 把反斜杠当转义符，
 * 而 replace() 不会，两者需要的字面量不一致，很容易改错（第一次就踩了）。
 * 这里用参数化 + position() 判断，避开 LIKE 的转义语义。
 *
 * 幂等：跑第二次时已无匹配，rowCount = 0。
 *
 * 用法：DATABASE_URL=... npx ts-node scripts/vocab-fix-dict-newlines.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 字面的反斜杠 + n（两个字符），不是换行符本身
const LITERAL = String.fromCharCode(92) + 'n';

(async () => {
  const before = await prisma.$queryRaw<Array<{ n: bigint }>>`
    select count(*)::bigint as n from "DictEntry"
    where position(${LITERAL} in translation) > 0
       or position(${LITERAL} in coalesce(definition,'')) > 0`;
  console.log('含字面 \\n 的词条:', Number(before[0].n));

  const t = await prisma.$executeRaw`
    update "DictEntry" set translation = replace(translation, ${LITERAL}, chr(10))
    where position(${LITERAL} in translation) > 0`;
  console.log('translation 修复:', t, '条');

  const d = await prisma.$executeRaw`
    update "DictEntry" set definition = replace(definition, ${LITERAL}, chr(10))
    where position(${LITERAL} in coalesce(definition,'')) > 0`;
  console.log('definition 修复:', d, '条');

  const after = await prisma.$queryRaw<Array<{ n: bigint }>>`
    select count(*)::bigint as n from "DictEntry"
    where position(${LITERAL} in translation) > 0
       or position(${LITERAL} in coalesce(definition,'')) > 0`;
  console.log('残留:', Number(after[0].n), '(应为 0)');

  const sample = await prisma.dictEntry.findUnique({ where: { word: 'coax' } });
  console.log('\n修复后 coax:', JSON.stringify(sample?.translation));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERR', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
