/**
 * S12J —— 验收账号的**真实度**。
 *
 * 用户第一次真人走查失败之后，S12H 修了服务端、S12I 修了界面。剩下的一半
 * 是**数据本身不像真的**：
 *
 *   · 历史卷子的「原文」是一句占位符，点开「查看原文」看到的是
 *     `【S12F 合成阅读 · …】学生在这一天读到的就是这段文字。`；
 *   · 没有一道题存过证据句，所以错题重练永远走「定位没有存下来」那一支，
 *     S12I 刚做的精确高亮**一次都验不到**；
 *   · 到期的词几乎全被标成「教过」，于是 S12I 的教学卡也验不到；
 *   · 历史任务行的 `readSource` 是 `lesson`，而连续天数只认
 *     `student` / `teacher`，主页因此显示 0 天。
 *
 * 这一份 spec 钉的是**夹具计划本身**（纯函数，不连库），外加走查清单的
 * 几条陈旧期望。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);
const FIXTURE = path.resolve(__dirname, '..', 'prepare-s12f-acceptance-account.js');
const PLAN_FILE = path.resolve(__dirname, '..', '..', '..', '..', '..', 'docs', 'manual-s12f-acceptance-test-plan.md');

type Q = {
  questionId: string;
  paperQuestionId: string;
  sortOrder: number;
  taskType: string;
  questionType: string;
  marks: number;
  options: Array<{ key: string; text: string }> | null;
  answerText?: string;
  evidence?: string;
};
type Day = {
  dayIso: string;
  title: string;
  paperId: string;
  passage?: string;
  marked: boolean;
  totalScore: number | null;
  maxScore: number;
  questions: Q[];
  scripts: Array<{ kind: string; awarded: number | null; marks: number }>;
};
type Plan = {
  todayIso: string;
  readingDays: Day[];
  lessonDays: Array<{ dayIso: string; readTarget: number; readSource?: string }>;
  attempts: any[];
  words: any[];
  reviewLogs: any[];
  mistakes: any[];
  appeals: any[];
  today: any;
};

const fx = requireCjs(FIXTURE) as {
  CANDIDATE_WORDS: string[];
  buildPlan(i: { todayIso: string; words: string[] }): Plan;
  RESERVED_LOOKUP_WORD: string;
};

const DAY = '2026-09-02';
const plan = (): Plan => fx.buildPlan({ todayIso: DAY, words: fx.CANDIDATE_WORDS.slice(0, 50) });

/** 一份卷子的原文 —— 计划里应该有它；没有就是缺陷本身。 */
function passageOf(d: Day | any): string {
  return typeof d.passage === 'string' ? d.passage : '';
}

const allPapers = (p: Plan): Array<Day | any> => [...p.readingDays, p.today];

// ─────────────────────────────────────────────────────────────
// 1. 原文必须是真的文章
// ─────────────────────────────────────────────────────────────

describe('S12J —— 历史原文', () => {
  it('**一份都不许**留着 S12F 的占位符', () => {
    for (const d of allPapers(plan())) {
      expect(passageOf(d), `${d.title} 还是占位原文`).not.toContain('S12F 合成阅读');
      expect(passageOf(d)).not.toContain('学生在这一天读到的就是这段文字');
    }
  });

  it('夹具源码里也不能再有那句占位原文', () => {
    // 计划对象里看不到它 —— 因为它是在 `writeAll` 里现拼的。
    // 不扫源码的话，「没有占位符」这条断言会假绿。
    const src = fs.readFileSync(FIXTURE, 'utf8');
    expect(src, '夹具还在拼占位原文').not.toContain('S12F 合成阅读');
    expect(src).not.toContain('学生在这一天读到的就是这段文字');
  });

  it('每一份都够长，撑得起「查看原文」这件事', () => {
    for (const d of allPapers(plan())) {
      expect(passageOf(d).length, `${d.title} 的原文太短`).toBeGreaterThanOrEqual(900);
    }
  });

  it('每一份都是**多个自然段**，不是一整块', () => {
    for (const d of allPapers(plan())) {
      const paras = passageOf(d).split(/\n\s*\n/).filter((x) => x.trim().length > 0);
      expect(paras.length, `${d.title} 只有 ${paras.length} 段`).toBeGreaterThanOrEqual(3);
    }
  });

  it('13 份标题各不相同', () => {
    const titles = allPapers(plan()).map((d) => d.title);
    expect(titles.length).toBe(13);
    expect(new Set(titles).size).toBe(13);
    for (const t of titles) expect(t.trim().length).toBeGreaterThan(8);
  });

  it('题干不是「第 N 题（taskType）」这种模板', () => {
    for (const d of plan().readingDays) {
      for (const q of d.questions) {
        const stem = (q as any).stem ?? '';
        expect(stem.length, `${d.title} 第 ${q.sortOrder} 题没有题干`).toBeGreaterThan(20);
        expect(stem, `${d.title} 第 ${q.sortOrder} 题还是模板题干`).not.toMatch(/第 \d+ 题（/);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 证据句必须能精确定位
// ─────────────────────────────────────────────────────────────

describe('S12J —— 证据句', () => {
  it('绝大多数题都带证据句', () => {
    const qs = plan().readingDays.flatMap((d) => d.questions);
    const withEvidence = qs.filter((q) => (q.evidence ?? '').trim() !== '');
    expect(withEvidence.length, '没有一道题存了证据句').toBeGreaterThanOrEqual(
      Math.ceil(qs.length * 0.8),
    );
  });

  it('每一条非空证据句都是**它自己那份原文**的逐字子串', () => {
    for (const d of plan().readingDays) {
      const passage = passageOf(d);
      for (const q of d.questions) {
        const ev = (q.evidence ?? '').trim();
        if (!ev) continue;
        expect(
          passage.includes(ev),
          `${d.title} 第 ${q.sortOrder} 题的证据句在原文里找不到`,
        ).toBe(true);
      }
    }
  });

  it('证据句不许来自**别的卷子**', () => {
    const p = plan();
    for (const d of p.readingDays) {
      for (const q of d.questions) {
        const ev = (q.evidence ?? '').trim();
        if (!ev) continue;
        const others = p.readingDays.filter((x) => x.paperId !== d.paperId);
        const strayHome = others.find((x) => passageOf(x).includes(ev));
        expect(
          strayHome,
          `${d.title} 第 ${q.sortOrder} 题的证据句同时出现在《${strayHome?.title}》里`,
        ).toBeUndefined();
      }
    }
  });

  it('**故意留一条空证据句**，好让客户端的诚实兜底也被验到', () => {
    const empty = plan()
      .readingDays.flatMap((d) => d.questions)
      .filter((q) => (q.evidence ?? '').trim() === '');
    expect(empty.length, '一条空证据句都没留，兜底那一支验不到').toBeGreaterThanOrEqual(1);
  });

  it('证据句与答案是确定性的：同样输入两次，逐字节相同', () => {
    const a = JSON.stringify(plan().readingDays.map((d) => d.questions));
    const b = JSON.stringify(plan().readingDays.map((d) => d.questions));
    expect(a).toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 分数仍然自洽（冻结项，不许被内容改动带坏）
// ─────────────────────────────────────────────────────────────

describe('S12J —— 分数记账没被内容改动带坏', () => {
  it('判完的卷子：逐题得分之和 == 总分，且不超满分', () => {
    for (const d of plan().readingDays) {
      if (!d.marked) {
        expect(d.totalScore).toBeNull();
        continue;
      }
      const sum = d.scripts.reduce((a, s) => a + (s.awarded ?? 0), 0);
      expect(sum, `${d.title} 的逐题得分之和对不上`).toBe(d.totalScore);
      expect(d.totalScore!).toBeLessThanOrEqual(d.maxScore);
    }
  });

  it('12 份阅读、10 判完 2 待判，仍然成立', () => {
    const p = plan();
    expect(p.readingDays.length).toBe(12);
    expect(p.readingDays.filter((d) => d.marked).length).toBe(10);
    expect(p.readingDays.filter((d) => !d.marked).length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 生词：真的有没教过的
// ─────────────────────────────────────────────────────────────

describe('S12J —— 没教过的词', () => {
  it('到期词里**至少六个**是真的没教过的', () => {
    const untaughtDue = plan().words.filter((w: any) => !w.taught && w.dueHours < 0);
    expect(untaughtDue.length, `只有 ${untaughtDue.length} 个到期且没教过的词`).toBeGreaterThanOrEqual(6);
  });

  it('没教过 = 没有 firstTaughtAt、reps 为 0、也没有复习流水', () => {
    const p = plan();
    const untaught = p.words.filter((w: any) => !w.taught);
    for (const w of untaught) {
      expect(w.firstTaughtDaysAgo, `${w.headword} 被伪造了首教时间`).toBeNull();
      expect(w.reps, `${w.headword} 有复习次数却算没教过`).toBe(0);
      const logs = p.reviewLogs.filter((r: any) => r.wordId === w.id);
      expect(logs.length, `${w.headword} 有复习流水却算没教过`).toBe(0);
    }
  });

  it('**第一张到期卡就是没教过的词** —— 教学卡当场就能看到', () => {
    const due = plan()
      .words.filter((w: any) => w.dueHours < 0)
      .sort((a: any, b: any) => a.dueHours - b.dueHours);
    // 服务端按 due 升序发卡；最早到期的那一批里必须有没教过的
    const firstSix = due.slice(0, 6);
    expect(
      firstSix.some((w: any) => !w.taught),
      '最先发出的六张卡全是复习卡，教学卡验不到',
    ).toBe(true);
  });

  it('教过且到期的词仍然够开一场四题型的正式测试', () => {
    const ok = plan().words.filter(
      (w: any) =>
        w.taught &&
        w.dueHours < 0 &&
        w.reps > 0 &&
        /^[A-Za-z]{4,12}$/.test(w.surfaceForm) &&
        new RegExp(`\\b${w.surfaceForm}\\b`, 'i').test(w.contextSentence),
    );
    expect(ok.length).toBeGreaterThanOrEqual(4);
  });

  it('50 个词、到期 / 将来的分布不变', () => {
    const w = plan().words;
    expect(w.length).toBe(50);
    expect(w.filter((x: any) => x.dueHours < 0).length).toBe(21);
    expect(w.filter((x: any) => x.dueHours > 0).length).toBe(29);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 连续天数：历史课要用真实的完成来源
// ─────────────────────────────────────────────────────────────

describe('S12J —— 课程连续天数', () => {
  it('有阅读的历史任务行用 `student` 作为完成来源', () => {
    const withRead = plan().lessonDays.filter((l) => l.readTarget > 0);
    expect(withRead.length).toBeGreaterThan(8);
    for (const l of withRead) {
      expect(l.readSource, `${l.dayIso} 的完成来源是 ${l.readSource}，连续天数认不了`).toBe('student');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 走查清单不能留着过时的期望
// ─────────────────────────────────────────────────────────────

describe('S12J —— 走查清单', () => {
  const md = () => fs.readFileSync(PLAN_FILE, 'utf8');

  it('不再写死「四道题」', () => {
    expect(md(), '清单里还写着固定的四道题').not.toMatch(/四道题|四道|出现四道题的卷子/);
  });

  it('不再保留「连续天数会显示 0」那条免责说明', () => {
    expect(md()).not.toContain('会显示 0');
  });

  it('补段排在总结**之前**', () => {
    const t = md();
    const drill = t.indexOf('错题重练');
    const summary = t.indexOf('今日总结');
    expect(drill).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(-1);
    expect(drill, '总结排在了补段前面').toBeLessThan(summary);
  });

  it('写明先教后考、逐题判分、答案只出一行、原文可看', () => {
    const t = md();
    expect(t).toMatch(/教学卡|先教|我看过了/);
    expect(t).toMatch(/自动判分|立刻.*判/);
    expect(t).toMatch(/只.*一行|不会出现两行|一行/);
    expect(t).toContain('查看原文');
  });

  it('仍然是 23 步，且一步都没有被勾掉', () => {
    const t = md();
    const steps = (t.match(/^### \d+\. /gm) ?? []).length;
    expect(steps).toBe(23);
    expect(t).not.toMatch(/^- \[x\]/m);
  });

  it('说清楚上一次失败的走查不计成绩', () => {
    expect(md()).toMatch(/不计|重新开始|从第 1 步|作废/);
  });
});
