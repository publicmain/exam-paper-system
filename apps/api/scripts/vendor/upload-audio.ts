import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

/**
 * 把 encode-audio.js 转出来的 MP3 上传进 WordAudio（2026-09-10）。
 *
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/vendor/upload-audio.ts \
 *     --dir=.local/piper/mp3 --voice=en_GB-alba-medium [--force] [--dry-run]
 *
 * 幂等：已有的词跳过（createMany skipDuplicates）。换音色重传加 --force，
 * 会先把这批词的旧行删掉。
 *
 * 为什么放 Postgres 不放 Railway 卷：API 服务上确实挂着一个卷，但把文件
 * 弄上去没有顺手的路（railway run 跑在本机，不在容器里）；25 MB 进库对
 * 数据库来说不算什么，一个端点 + 一年缓存就能服务。
 */
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } },
});

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const DIR = resolve(process.cwd(), arg('dir') ?? '.local/piper/mp3');
const VOICE = arg('voice') ?? 'en_GB-alba-medium';
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');
const CHUNK = 150;

(async () => {
  const manifest: Record<string, string> = JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8'));
  const entries = Object.entries(manifest);
  const onDisk = new Set(readdirSync(DIR));
  const missing = entries.filter(([, f]) => !onDisk.has(f));
  if (missing.length) {
    console.error(`manifest 里有 ${missing.length} 个文件不在目录里，例如 ${missing[0][1]}`);
    process.exit(1);
  }
  console.log(`${entries.length} 个词，音色 ${VOICE}${FORCE ? '，--force 覆盖' : ''}${DRY ? '，dry-run' : ''}`);

  const before = await prisma.wordAudio.count();
  let inserted = 0;
  let bytes = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const slice = entries.slice(i, i + CHUNK);
    const rows = slice.map(([headword, file]) => {
      const buf = readFileSync(resolve(DIR, file));
      bytes += buf.length;
      return { headword: headword.toLowerCase(), voice: VOICE, contentType: 'audio/mpeg', bytes: buf, byteLength: buf.length };
    });
    if (DRY) continue;
    if (FORCE) {
      await prisma.wordAudio.deleteMany({ where: { headword: { in: rows.map((r) => r.headword) } } });
    }
    const r = await prisma.wordAudio.createMany({ data: rows, skipDuplicates: true });
    inserted += r.count;
    process.stdout.write(`\r  ${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
  }
  const after = DRY ? before : await prisma.wordAudio.count();
  console.log(`\n写入 ${inserted} 行（${(bytes / 1024 / 1024).toFixed(1)} MB），表里现在 ${after} 行（之前 ${before}）。`);
})()
  .catch((e) => {
    console.error('ERR', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
