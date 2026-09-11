/**
 * 写稿时的「档位体检」：篇幅、超纲词、超纲词清单（2026-09-11）。
 *
 *   npx ts-node apps/api/scripts/content/level-check.ts --week=week3 [--level=olevel]
 *
 * 直接读 `pilot/content/<week>/` 下的档位模块，**不需要词表和翻译已经生成**
 * —— 写完一篇就能跑，超纲的词当场列出来，改完再跑，一轮十几秒。
 *
 * 门槛与内容测试共用 `pilot/content/level-gates.js`，这里过了测试就过。
 */
import * as fs from 'fs';
import * as path from 'path';
import { difficultyProfile } from '../../src/vocab-v2/cefr-difficulty';
import { wordPolicyFor } from '../../src/vocab-v2/level-policy';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LEVEL_GATES } = require('../pilot/content/level-gates');

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WEEK = arg('week') ?? 'week3';
const ONLY = arg('level');
const DIR = path.resolve(__dirname, '..', 'pilot', 'content', WEEK);

type Day = { date: string; title: string; passage: string };

const modules = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  .map((f) => require(path.join(DIR, f)))
  .filter((m) => typeof m.LEVEL === 'string' && Array.isArray(m.DAYS))
  .filter((m) => !ONLY || m.LEVEL === ONLY);

let failures = 0;
for (const mod of modules) {
  const gate = LEVEL_GATES[mod.LEVEL];
  const difficulty = wordPolicyFor(mod.LEVEL).contextDifficulty;
  for (const day of mod.DAYS as Day[]) {
    const text = day.passage.replace(/^Paragraph \S+\s*/gm, '');
    const p = difficultyProfile(text, difficulty);
    const [lo, hi] = gate.words;
    const lengthOk = p.words >= lo && p.words <= hi;
    const hardOk = gate.maxHard == null || p.hardRatio <= gate.maxHard;
    const mark = lengthOk && hardOk ? '✓' : '✗';
    if (!lengthOk || !hardOk) failures += 1;
    console.log(
      `${mark} ${mod.LEVEL.padEnd(20)} ${day.date}  ${String(p.words).padStart(4)} 词${lengthOk ? '' : `（要 ${lo}–${hi}）`}` +
        `  超纲 ${(p.hardRatio * 100).toFixed(1)}%${hardOk ? '' : `（上限 ${(gate.maxHard * 100).toFixed(1)}%）`}  ${day.title}`,
    );
    if (p.hardWords.length) {
      const uniq = [...new Set(p.hardWords.map((w: string) => w.toLowerCase()))];
      console.log(`    超纲词（${p.ceiling ?? '不限'} 以上）：${uniq.join(', ')}`);
    }
  }
}
console.log(failures ? `\n${failures} 篇不合档，改完再跑。` : '\n全部合档。');
process.exitCode = failures ? 1 : 0;
