import { describe, expect, it } from 'vitest';
import { dayQuotas, distributeByPos, parseWordList, teachingDaysOfWeek } from './word-list-plan';

describe('parseWordList —— 老师给什么样的文本都能收', () => {
  it('一行一个词；注释、空行、序号、备注、大小写都处理掉', () => {
    const r = parseWordList([
      '# 第 3 周 环境专题',
      '1. Plantation',
      '2) tide, 潮汐',
      '',
      'Estuary\t河口',
      'BARRAGE.',
    ].join('\n'));
    expect(r.words.map((w) => w.headword)).toEqual(['plantation', 'tide', 'estuary', 'barrage']);
    expect(r.words[1].note).toBe('潮汐');
    expect(r.words[2].note).toBe('河口');
    expect(r.rejected).toEqual([]);
  });

  it('*word 与 word! 都是 force', () => {
    const r = parseWordList('*tide\nbarrage!\nestuary');
    expect(r.words.map((w) => [w.headword, w.force])).toEqual([['tide', true], ['barrage', true], ['estuary', false]]);
  });

  it('重复的词只留第一个并报出来；不是单个英文词的拒收', () => {
    const r = parseWordList('tide\nTide\nsea level\n中文\n123\nself-esteem\n"o\'clock"');
    expect(r.words.map((w) => w.headword)).toEqual(['tide', 'self-esteem', "o'clock"]);
    expect(r.duplicates).toEqual([{ line: 2, headword: 'tide' }]);
    expect(r.rejected.map((x) => x.raw)).toEqual(['sea level', '中文', '123']);
  });

  it('Windows 换行也行', () => {
    expect(parseWordList('a\r\nb\r\n').words.map((w) => w.headword)).toEqual(['a', 'b']);
  });
});

describe('dayQuotas —— 每天 5–20，默认往 10 凑', () => {
  it('12 个 → 两天 6/6，不摊成五天', () => expect(dayQuotas(12)).toEqual([6, 6]));
  it('37 个 → 四天 10/9/9/9', () => expect(dayQuotas(37)).toEqual([10, 9, 9, 9]));
  it('60 个 → 五天 12', () => expect(dayQuotas(60)).toEqual([12, 12, 12, 12, 12]));
  it('7 个 → 一天 7', () => expect(dayQuotas(7)).toEqual([7]));
  it('3 个 → 一天 3（少于 5 也只能这样）', () => expect(dayQuotas(3)).toEqual([3]));
  it('100 个刚好装下；101 个装不下', () => {
    expect(dayQuotas(100)).toEqual([20, 20, 20, 20, 20]);
    expect(() => dayQuotas(101)).toThrow(/装不下/);
  });
  it('指定每天 5 个：12 个 → 三天 4/4/4？不行，不到 5 就并天 → 两天 6/6', () => {
    expect(dayQuotas(12, 5)).toEqual([6, 6]);
  });
  it('指定每天 20 个：45 个 → 三天 15/15/15', () => expect(dayQuotas(45, 20)).toEqual([15, 15, 15]));
  it('0 个 → 空', () => expect(dayQuotas(0)).toEqual([]));
});

describe('teachingDaysOfWeek', () => {
  it('周一 → 周一到周五', () => {
    expect(teachingDaysOfWeek('2026-09-14')).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
  });
  it('不是周一 → 报错，免得发错周', () => {
    expect(() => teachingDaysOfWeek('2026-09-15')).toThrow(/不是周一/);
    expect(() => teachingDaysOfWeek('2026-9-14')).toThrow();
  });
});

describe('distributeByPos —— 每天词性混着来', () => {
  const w = (headword: string, pos: string) => ({ headword, pos });
  it('四种词性各 3 个分两天 → 每天都有名/动/形/副', () => {
    const words = [
      w('n1', 'noun'), w('n2', 'noun'), w('n3', 'noun'),
      w('v1', 'verb'), w('v2', 'verb'), w('v3', 'verb'),
      w('a1', 'adjective'), w('a2', 'adjective'), w('a3', 'adjective'),
      w('d1', 'adverb'), w('d2', 'adverb'), w('d3', 'adverb'),
    ];
    const days = distributeByPos(words, [6, 6]);
    expect(days.map((d) => d.length)).toEqual([6, 6]);
    for (const day of days) {
      const posSet = new Set(day.map((x) => x.pos));
      expect(posSet.size).toBe(4);
    }
    expect(days.flat().map((x) => x.headword).sort()).toEqual(words.map((x) => x.headword).sort());
  });

  it('全是名词也能分完，且保持老师给的顺序（顺着切段）', () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((h) => w(h, 'noun'));
    const days = distributeByPos(words, [4, 3]);
    expect(days[0].map((x) => x.headword)).toEqual(['a', 'b', 'c', 'd']);
    expect(days[1].map((x) => x.headword)).toEqual(['e', 'f', 'g']);
  });

  it('9 个名词 + 3 个动词分两天 → 动词不会全挤在一天', () => {
    const words = [
      ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9'].map((h) => w(h, 'noun')),
      ...['v1', 'v2', 'v3'].map((h) => w(h, 'verb')),
    ];
    const days = distributeByPos(words, [6, 6]);
    const verbsPerDay = days.map((d) => d.filter((x) => x.pos === 'verb').length);
    expect(verbsPerDay.every((n) => n >= 1)).toBe(true);
    expect(verbsPerDay.reduce((a, b) => a + b, 0)).toBe(3);
    expect(days.flat()).toHaveLength(12);
  });

  it('配额比词少 → 报错，不悄悄丢词', () => {
    expect(() => distributeByPos([w('a', 'noun'), w('b', 'noun')], [1])).toThrow(/配额/);
  });

  it('没有天 → 空', () => expect(distributeByPos([w('a', 'noun')], [])).toEqual([]));
});
