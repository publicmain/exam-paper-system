/**
 * 内容难度体检：拿 CEFR-J 词表给每天每档的文章算超纲词比例。
 *
 *   npx ts-node apps/api/scripts/content-difficulty.ts [--day=2026-09-07]
 *
 * 不连数据库，直接读内容包 —— 出卷前就能跑，不合档的当场打回。
 */
import { difficultyProfile } from '../src/vocab-v2/cefr-difficulty';
import { wordPolicyFor } from '../src/vocab-v2/level-policy';

const content = require('./pilot/content');
const levels: string[] = Array.isArray(content.LEVELS) ? content.LEVELS : Object.keys(content.LEVELS);
const dates: string[] = Array.isArray(content.DATES) ? content.DATES : Object.values(content.DATES).flat();

const dayArg = process.argv.find((a) => a.startsWith('--day='))?.slice('--day='.length);
const days = dayArg ? [dayArg] : dates;

console.log('档位'.padEnd(20), '难度上限  文章词数  超纲词  占比   标题');
for (const day of days) {
  console.log(`\n=== ${day} ===`);
  for (const level of levels) {
    let lesson: any;
    try {
      lesson = content.lessonFor(level, day);
    } catch {
      continue;
    }
    if (!lesson) continue;
    const passage: string =
      lesson.passage ?? lesson.questions?.[0]?.passage ?? lesson.questions?.[0]?.snapshotContent?.passage ?? '';
    if (!passage) continue;
    const difficulty = wordPolicyFor(level as never).contextDifficulty ?? 3;
    const p = difficultyProfile(passage, difficulty);
    const pct = (p.hardRatio * 100).toFixed(1) + '%';
    console.log(
      level.padEnd(20),
      String(p.ceiling ?? '不限').padEnd(8),
      String(p.words).padStart(6),
      String(p.hardWords.length).padStart(7),
      pct.padStart(7),
      ' ',
      (lesson.title ?? lesson.paperName ?? '').slice(0, 34),
    );
  }
}
