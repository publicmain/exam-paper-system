import { describe, expect, it } from 'vitest';
import {
  cjkBigramCollision,
  isSafeDistractor,
  optionText,
  pickDistractors,
  posOf,
} from './vocab-quiz.service';

/**
 * 自测出题的三个纯函数。出题质量的生死线在干扰项：
 * 出现近义词 = 题目有两个对的答案 = 学生答对被判错 —— 比没有自测更糟。
 */

describe('cjkBigramCollision（同义词碰撞探测）', () => {
  it('拦住共享连续两字的近义释义', () => {
    expect(cjkBigramCollision('n. 冲突, 干涉', 'n. 干扰; 干涉')).toBe(true);
    expect(cjkBigramCollision('a. 松的；分散的', 'v. 松开；放松')).toBe(false); // 单字"松"不算
    expect(cjkBigramCollision('n. 迁徙; 迁移', 'v. 迁徙(鸟类)')).toBe(true);
  });

  it('无共享二字组时放行', () => {
    expect(cjkBigramCollision('n. 骨骼', 'n. 轴线')).toBe(false);
    expect(cjkBigramCollision('', 'n. 轴线')).toBe(false);
  });

  it('忽略非汉字（词性缩写、标点、英文）', () => {
    // 两条都带 "n. " 前缀，不能因此误判
    expect(cjkBigramCollision('n. abc 轴', 'n. xyz 骨')).toBe(false);
  });
});

describe('optionText（选项文本）', () => {
  it('取第一行并截断', () => {
    expect(optionText('n. 轴\nn. 中枢')).toBe('n. 轴');
    expect(optionText('x'.repeat(50))).toHaveLength(38);
  });
});

describe('pickDistractors（挑干扰项）', () => {
  const answer = { headword: 'interference', translation: 'n. 干扰, 干涉' };
  const mk = (headword: string, translation: string) => ({ headword, translation });

  it('挑满 3 个、不含答案本身、互不近义', () => {
    const pool = [
      mk('axis', 'n. 轴'),
      mk('interference', 'n. 干扰, 干涉'), // 答案本身 → 必须被跳过
      mk('meddling', 'n. 干预, 干涉'), // 与答案近义 → 必须被跳过
      mk('skeleton', 'n. 骨骼'),
      mk('slot', 'n. 狭缝'),
      mk('groove', 'n. 凹槽, 狭缝'), // 与 slot 近义 → 两者只能进一个
      mk('pattern', 'n. 模式'),
    ];
    for (let seed = 1; seed < 50; seed += 7) {
      const d = pickDistractors(answer, pool, seed)!;
      expect(d).toHaveLength(3);
      const words = d.map((x) => x.headword);
      expect(words).not.toContain('interference');
      expect(words).not.toContain('meddling');
      expect(words.filter((w) => w === 'slot' || w === 'groove').length).toBeLessThanOrEqual(1);
      for (let i = 0; i < d.length; i++)
        for (let j = i + 1; j < d.length; j++)
          expect(cjkBigramCollision(optionText(d[i].translation), optionText(d[j].translation))).toBe(false);
    }
  });

  it('候选不足时返回 null 而不是凑数', () => {
    expect(pickDistractors(answer, [mk('axis', 'n. 轴')], 1)).toBeNull();
    expect(pickDistractors(answer, [], 1)).toBeNull();
  });

  it('跳过空释义的候选', () => {
    const pool = [mk('aaa', ''), mk('bbb', 'n. 轴'), mk('ccc', 'n. 骨骼'), mk('ddd', 'n. 模式')];
    const d = pickDistractors(answer, pool, 3)!;
    expect(d.map((x) => x.headword)).not.toContain('aaa');
    expect(d).toHaveLength(3);
  });

  it('冒犯性词汇绝不进题目 —— 上线首日实测抽出过 negro', () => {
    const pool = [
      mk('negro', 'n. 黑人'),
      mk('skeleton', 'n. 骨骼'),
      mk('slot', 'n. 狭缝'),
      mk('pattern', 'n. 模式'),
      mk('axis', 'n. 轴'),
    ];
    for (let seed = 1; seed < 30; seed += 3) {
      const d = pickDistractors(answer, pool, seed)!;
      expect(d.map((x) => x.headword)).not.toContain('negro');
    }
    expect(isSafeDistractor('negro')).toBe(false);
    expect(isSafeDistractor('ok')).toBe(false); // 太短(<3)也不要
    expect(isSafeDistractor('skeleton')).toBe(true);
  });

  it('词性一致的干扰项优先', () => {
    expect(posOf('n. 轴')).toBe('n');
    expect(posOf('vt. 哄, 诱骗')).toBe('v');
    expect(posOf('a. 松的')).toBe('a');
    expect(posOf('紫外线的')).toBe('');
    // 答案是名词,池里名词管够 → 三个全应是名词
    const pool = [
      mk('coax', 'vt. 哄'),
      mk('slick', 'a. 光滑的'),
      mk('skeleton', 'n. 骨骼'),
      mk('slot', 'n. 狭缝'),
      mk('pattern', 'n. 模式'),
      mk('axis', 'n. 轴'),
    ];
    for (let seed = 1; seed < 30; seed += 3) {
      const d = pickDistractors(answer, pool, seed)!;
      expect(d.every((x) => posOf(x.translation) === 'n')).toBe(true);
    }
  });
});
