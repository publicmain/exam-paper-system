import * as fs from 'fs';
import * as path from 'path';

/**
 * 配套词表的来源解析 —— 从一份卷子的 config 找到它的词表。
 *
 * 两个短文层，词表存放方式不同：
 *
 *   **O-Level 基础** —— 卷子走 config.paperKey（`OLEVEL/..._basic_01_
 *   new_shoes_v1/Paper2`），词表集中在 basic-wordlists.json，按 story
 *   字段（`basic-01-new-shoes`）对应。
 *
 *   **雅思轻量** —— 卷子走 config.passageRef（`IELTS/ielts_light_2026/
 *   Test3/P1`），词表**内嵌在各自 fixture 的 wordlist 字段里**。
 *   Test 序号 = 目录内文件排序序号，与 ingest-ielts-batch 的分配一致。
 *
 * 抽成独立模块的原因（2026-08-24）：推送从「建场时推全班」改成「扫码时
 * 推本人」——学生每天扫码选层级，选了哪层就只收哪层的词，例句来自他
 * 当天要读的那篇文章。建场方（morning-quiz.service）和扫码方
 * （attendance.service）都要用这套解析，放在任一边都会造成反向依赖。
 */

export interface WordlistItem {
  word: string;
  context: string;
}

export interface ResolvedWordlist {
  story: string;
  items: WordlistItem[];
}

const FIXTURES = path.join(__dirname, '..', '..', 'test-fixtures');

export function resolveWordlistForPaperConfig(
  cfg: { paperKey?: string; passageRef?: string } | null | undefined,
): ResolvedWordlist | null {
  const paperKey = cfg?.paperKey ?? '';
  const passageRef = cfg?.passageRef ?? '';

  const olevelMatch = paperKey.match(/olevel_(basic_\d+_[a-z0-9_]+?)(?:_v\d+)?\/Paper/);
  if (olevelMatch) {
    const story = olevelMatch[1].replace(/_/g, '-');
    const file = path.join(FIXTURES, 'singapore-olevel-1128', 'basic-wordlists.json');
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      lists: Array<{ story: string; items: WordlistItem[] }>;
    };
    const list = data.lists.find((l) => l.story === story);
    return list ? { story, items: list.items } : null;
  }

  const lightMatch = passageRef.match(/^IELTS\/ielts_light_[^/]*\/Test(\d+)\/P\d+$/);
  if (lightMatch) {
    const dir = path.join(FIXTURES, 'ielts-light-2026');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    const f = files[Number(lightMatch[1]) - 1];
    if (!f) return null;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as {
      wordlist?: Array<{ word: string; example: string }>;
    };
    if (!d.wordlist?.length) return null;
    return {
      story: f.replace(/\.json$/, ''),
      items: d.wordlist.map((w) => ({ word: w.word, context: w.example })),
    };
  }

  return null;
}
