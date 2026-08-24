import * as fs from 'fs';
import * as path from 'path';
import { isoWeekSGT } from './iso-week';
import type { ResolvedWordlist } from './wordlist-source';

/**
 * 每周小主线（2026-08-24 研究性分析 #3）。
 *
 * 背景数据：伴随式采集人均每周只进 ~1.5 个核心词，按 Nation 的
 * 3000 词族 / 95% 覆盖率门槛，这个速度永远到不了阅读自学的起点；
 * 但吞吐数据（人均单日 4.5 次评分）又撑不起「每天 10 个主线新词」
 * 的大词书。折中是**有限游戏**：每周一份 15 词的小主线，随本周
 * 第一次扫码推入，学生看得到「本周已学 X/15」的终点。
 *
 * 词表来源：`test-fixtures/weekly-track/<ISO周>.json`，按层级分轨。
 * 试点只配两个轻量层（雅思轻量 / O-Level 基础）；没配轨的层级
 * 返回 null，推送静默跳过 —— 扩层只需在 json 里加一个键，零代码。
 *
 * 选词规约（authoring 时人工执行 + attach 前脚本复核）：
 *   · 全部是 ECDICT 原形条目（推送端还有存在性过滤兜底）
 *   · 不得与**当周该层级各卷的参考答案**撞词（防泄题）
 *   · 例句为自撰简单句，必含该词原形
 */

const FIXTURES = path.join(__dirname, '..', '..', 'test-fixtures');

interface TrackFile {
  week: string;
  tracks: Record<string, Array<{ word: string; context: string }>>;
}

/** 该层级在指定时刻所在 ISO 周的主线词表；没配则 null。 */
export function resolveWeeklyTrack(level: string, at: Date): ResolvedWordlist | null {
  const week = isoWeekSGT(at);
  const file = path.join(FIXTURES, 'weekly-track', `${week}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as TrackFile;
    const items = data.tracks?.[level];
    if (!Array.isArray(items) || !items.length) return null;
    return {
      // 这个 story 会成为 StudentWord.sourcePassageTitle —— 前端按它
      // 精确匹配「本周主线」，卡片上显示「来自《每周主线 2026-W35》」
      story: `每周主线 ${week}`,
      items: items
        .filter((i) => typeof i?.word === 'string' && i.word.trim())
        .map((i) => ({ word: i.word.trim(), context: (i.context ?? '').trim() })),
    };
  } catch {
    return null; // 文件损坏不挡扫码
  }
}
