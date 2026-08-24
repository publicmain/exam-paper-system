import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { resolveWordlistForPaperConfig as resolveWordlist } from './wordlist-source';

/**
 * 配套词表的来源解析。
 *
 * 两个短文层（O-Level 基础、雅思轻量）都是「读短文 + 背词」的设计，
 * 建场时自动把词表推进全班的生词本。但两者的词表放在不同地方：
 *   · O-Level 基础 → basic-wordlists.json 集中存放，按 story 索引
 *   · 雅思轻量     → 内嵌在每篇 fixture 的 wordlist 字段里
 *
 * 2026-08-24 加雅思轻量时，推送函数只认第一种，于是那一层在注册表里
 * 标了 pushesWordlist 却一个词也推不出去 —— 学生答完题没有词可背，
 * 这一层的设计就废了一半。下面用真实 fixture 验证两条来源都取得到。
 */

const FIX = path.join(__dirname, '..', '..', 'test-fixtures');



describe('配套词表来源', () => {
  it('O-Level 基础：按 paperKey 找到集中词表', () => {
    const r = resolveWordlist({ paperKey: 'OLEVEL/ai_authored_olevel_basic_01_new_shoes_v1/Paper2' });
    expect(r).not.toBeNull();
    expect(r!.story).toBe('basic-01-new-shoes');
    expect(r!.items.length).toBeGreaterThanOrEqual(8);
  });

  it('雅思轻量：按 passageRef 找到内嵌词表 —— 这条曾经完全断掉', () => {
    const r = resolveWordlist({ passageRef: 'IELTS/ielts_light_2026/Test1/P1' });
    expect(r).not.toBeNull();
    expect(r!.items.length).toBe(8);
    expect(r!.items[0]).toHaveProperty('word');
    expect(r!.items[0]).toHaveProperty('context');
  });

  it('雅思轻量每一篇都取得到词表（Test 序号 = 文件排序序号）', () => {
    const dir = path.join(FIX, 'ielts-light-2026');
    const n = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
    for (let i = 1; i <= n; i++) {
      const r = resolveWordlist({ passageRef: `IELTS/ielts_light_2026/Test${i}/P1` });
      expect(r, `Test${i}`).not.toBeNull();
      expect(r!.items.length, `Test${i}`).toBe(8);
    }
  });

  it('O-Level 基础每一篇都取得到词表', () => {
    const dir = path.join(FIX, 'singapore-olevel-1128');
    const papers = fs.readdirSync(dir).filter((f) => /^basic-\d+/.test(f));
    for (const f of papers) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const r = resolveWordlist({ paperKey: `OLEVEL/${d.setCode}/Paper2` });
      expect(r, f).not.toBeNull();
      expect(r!.items.length, f).toBeGreaterThanOrEqual(8);
    }
  });

  it('不需要词表的层（雅思真题 / O-Level 标准）返回 null，不误推', () => {
    expect(resolveWordlist({ passageRef: 'IELTS/ielts_authored_aug2026/Test1/P1' })).toBeNull();
    expect(resolveWordlist({ paperKey: 'OLEVEL/ai_authored_olevel_46_recipe_card_v1/Paper2' })).toBeNull();
    expect(resolveWordlist({})).toBeNull();
  });
});

describe('卷内嵌词表（2026-08-24 高层级词表）', () => {
  it('config.wordlist 优先于一切：原样返回并带 story', () => {
    const r = resolveWordlist({
      paperKey: 'IELTS/authentic_c15_t1_p2/Paper1',
      wordlist: [
        { word: 'sediment', context: 'Fine sediment settled on the reef flat.' },
        { word: 'erosion', context: 'Erosion outpaced calcification.' },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.story).toBe('IELTS/authentic_c15_t1_p2/Paper1');
    expect(r!.items.map((i) => i.word)).toEqual(['sediment', 'erosion']);
  });

  it('空的 / 全脏的 wordlist 不拦路：继续走 paperKey/passageRef 解析', () => {
    const r = resolveWordlist({
      paperKey: 'OLEVEL/ai_authored_olevel_basic_01_new_shoes_v1/Paper2',
      wordlist: [],
    });
    expect(r).not.toBeNull();
    expect(r!.story).toBe('basic-01-new-shoes');
    const dirty = resolveWordlist({ wordlist: [{ word: '   ' } as any] });
    expect(dirty).toBeNull();
  });

  it('高层级卷子没配 wordlist 时仍返回 null（推送静默跳过，不报错）', () => {
    expect(resolveWordlist({ passageRef: 'IELTS/cambridge15/Test1/P2' })).toBeNull();
  });
});
