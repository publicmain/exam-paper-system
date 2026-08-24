import { describe, expect, it } from 'vitest';
import { storyKey } from './morning-quiz.service';

/**
 * storyKey —— 终身去重的比对键。
 *
 * 它把 `_v<数字>` 从 setCode / passageRef 里剥掉，让同一个故事的 v1 / v2
 * 被认成同一篇（2026-07-13 的教训：§B fixture 重新校准改了版本号，于是
 * 学生做过的故事全变「没做过」，一周 12 场里 5 场重复）。
 *
 * 但这个规则有个反向的坑，2026-08-24 踩到了：**新内容的 setCode 如果以
 * `_v<数字>` 结尾，会被规范化成另一个已存在的 key**。当时 6 篇全新的雅思
 * 自撰卷用了 `ielts_authored_2026_v6`，剥完变成 `ielts_authored_2026` ——
 * 与库里既有的、内容完全不同的一批撞成同一个 story，6 篇全被判为「已服务」，
 * authentic 候选池瞬间归零，每天走 LRU 回收抽重复卷。改名 `aug2026` 才恢复。
 *
 * 下面这些断言把两个方向都钉死：该合并的合并，不该被误伤的命名要能活下来。
 */

describe('storyKey —— 版本无关的去重键', () => {
  it('剥掉 _vN，让同一故事的不同版本合并', () => {
    expect(storyKey('OLEVEL/ai_authored_olevel_12_senior_sister_v2/Paper2')).toBe(
      'OLEVEL/ai_authored_olevel_12_senior_sister/Paper2',
    );
    expect(storyKey('OLEVEL/x_v1/Paper2')).toBe(storyKey('OLEVEL/x_v2/Paper2'));
  });

  it('没有版本号的 key 原样返回', () => {
    expect(storyKey('IELTS/cambridge_ielts_8/Test3/P3')).toBe('IELTS/cambridge_ielts_8/Test3/P3');
  });

  it('null / undefined 返回空串，不抛异常', () => {
    expect(storyKey(null)).toBe('');
    expect(storyKey(undefined)).toBe('');
  });

  it('⚠️ 以 _vN 结尾的 setCode 会和去掉它的那个撞车 —— 这是命名禁忌', () => {
    // 这条不是「期望的行为」，是把陷阱记录下来：新内容取名时**不能**以
    // _v<数字> 结尾，否则会被认成另一批内容的新版本。
    expect(storyKey('IELTS/ielts_authored_2026_v6/Test1/P1')).toBe(
      storyKey('IELTS/ielts_authored_2026/Test1/P1'),
    );
  });

  it('实际采用的命名（aug2026）不会被误伤', () => {
    expect(storyKey('IELTS/ielts_authored_aug2026/Test1/P1')).toBe(
      'IELTS/ielts_authored_aug2026/Test1/P1',
    );
    expect(storyKey('IELTS/ielts_authored_aug2026/Test1/P1')).not.toBe(
      storyKey('IELTS/ielts_authored_2026/Test1/P1'),
    );
  });

  it('雅思轻量的命名同样安全', () => {
    expect(storyKey('IELTS/ielts_light_2026/Test1/P1')).toBe('IELTS/ielts_light_2026/Test1/P1');
  });

  it('数字结尾但不是 _v 前缀的不受影响', () => {
    // cambridge_ielts_8 里的 8 不是版本号，不能被剥
    expect(storyKey('IELTS/cambridge_ielts_8/Test1/P1')).toBe('IELTS/cambridge_ielts_8/Test1/P1');
    expect(storyKey('OLEVEL/singapore_olevel_1128/Paper2')).toBe('OLEVEL/singapore_olevel_1128/Paper2');
  });
});
