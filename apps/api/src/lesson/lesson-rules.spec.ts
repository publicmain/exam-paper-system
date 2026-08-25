import { describe, expect, it } from 'vitest';
import {
  GRACE_MINUTES,
  countsAsStudentDone,
  effectiveLockAt,
  isSegmentComplete,
  lessonComplete,
  lessonProgress,
  readStatus,
  segmentStatus,
  shouldFinalizeOnEod,
  vocabTarget,
  lessonDayKey,
  sgtMidnightInstant,
  drillTarget,
  DRILL_DAILY_CAP,
  readablePaperTitle,
  LESSON_RULES_VERSION,
} from './lesson-rules';

/**
 * 4.0 完成判定（PRD §2.3 / §5.2b）。
 *
 * 完成度要回答的唯一问题是「这孩子今天到底学没学」。下面每一条都是
 * 从这句话推出来的，改判定必须同时递增 LESSON_RULES_VERSION。
 */

describe('系统代交不算完成（幽灵完成，两轮复审都点名）', () => {
  it('学生自己交 / 教师代交 → 算', () => {
    expect(countsAsStudentDone('student')).toBe(true);
    expect(countsAsStudentDone('teacher')).toBe(true);
  });

  it('**system_eod → 不算**', () => {
    // 学生扫码开卷、只读了标题就去上课，晚上被系统替他交卷。
    // 这条断言失败 = 完成度可以被系统凭空发放 = 它不再能回答任何问题。
    expect(countsAsStudentDone('system_eod')).toBe(false);
  });

  it('没有 source（存量数据 / 还没交）→ 不算', () => {
    expect(countsAsStudentDone(null)).toBe(false);
    expect(countsAsStudentDone(undefined)).toBe(false);
  });
});

describe('readStatus', () => {
  const base = { hasSession: true, finalSubmitted: false, submitSource: null, opened: false } as const;

  it('今天没场次 → none（不是学生的锅，算完成）', () => {
    expect(readStatus({ ...base, hasSession: false })).toBe('none');
  });

  it('自己交了 → done', () => {
    expect(readStatus({ ...base, finalSubmitted: true, submitSource: 'student' })).toBe('done');
  });

  it('被系统收尾 → auto_closed，**不是 done**', () => {
    expect(readStatus({ ...base, finalSubmitted: true, submitSource: 'system_eod' })).toBe(
      'auto_closed',
    );
    expect(isSegmentComplete('auto_closed')).toBe(false);
  });

  it('开了卷没交 → partial；没开 → todo', () => {
    expect(readStatus({ ...base, opened: true })).toBe('partial');
    expect(readStatus({ ...base, opened: false })).toBe('todo');
  });
});

describe('vocabTarget —— 目标必须可达成', () => {
  it('积压 200 词、配额 20 → 今天目标 20（不是 200）', () => {
    // 定一个永远达不到的目标，完成度就变成另一笔只涨不落的债，激励反向
    expect(vocabTarget(200, 20)).toBe(20);
  });

  it('到期少于配额 → 按实际', () => {
    expect(vocabTarget(3, 20)).toBe(3);
  });

  it('没有到期词 → 0（→ 段落 none → 算完成）', () => {
    expect(vocabTarget(0, 20)).toBe(0);
    expect(segmentStatus(0, vocabTarget(0, 20))).toBe('none');
  });

  it('配额异常时退回 20，不产生 NaN/负数目标', () => {
    expect(vocabTarget(50, 0)).toBe(20);
    expect(vocabTarget(50, Number.NaN)).toBe(20);
    expect(vocabTarget(-5, 20)).toBe(0);
  });
});

describe('segmentStatus', () => {
  it('target=0 → none', () => expect(segmentStatus(0, 0)).toBe('none'));
  it('做满 → done', () => expect(segmentStatus(20, 20)).toBe('done'));
  it('超额 → 仍是 done（不会因为多做而掉出完成）', () =>
    expect(segmentStatus(25, 20)).toBe('done'));
  it('做了一部分 → partial', () => expect(segmentStatus(8, 20)).toBe('partial'));
  it('一点没动 → todo', () => expect(segmentStatus(0, 20)).toBe('todo'));
});

describe('lessonProgress —— 分母恒为 3', () => {
  it('今天没错题也显示 3/3，不是 2/2', () => {
    // 分母跳来跳去学生会以为系统坏了；「今天没有这一段」本来就该算做完
    const p = lessonProgress({ read: 'done', vocab: 'done', drill: 'none' });
    expect(p).toEqual({ completed: 3, total: 3 });
    expect(lessonComplete({ read: 'done', vocab: 'done', drill: 'none' })).toBe(true);
  });

  it('被系统收卷的读段拉不满这一课', () => {
    const seg = { read: 'auto_closed', vocab: 'done', drill: 'done' } as const;
    expect(lessonProgress(seg)).toEqual({ completed: 2, total: 3 });
    expect(lessonComplete(seg)).toBe(false);
  });
});

describe('effectiveLockAt —— 23:59 不是一个可用的边界', () => {
  const dayEnd = new Date('2026-08-26T15:59:00Z'); // 23:59 SGT

  it('白天开的卷 → 就锁在 23:59', () => {
    const started = new Date('2026-08-26T01:00:00Z'); // 09:00 SGT
    expect(effectiveLockAt({ dayEnd, startedAt: started }).toISOString()).toBe(
      dayEnd.toISOString(),
    );
  });

  it('23:58 开卷 → 给满 30 分钟，不是 2 分钟', () => {
    const started = new Date('2026-08-26T15:58:00Z');
    const got = effectiveLockAt({ dayEnd, startedAt: started });
    expect(got.getTime() - started.getTime()).toBe(GRACE_MINUTES * 60_000);
  });

  it('宽限不能无限延 —— 硬顶在次日 01:00', () => {
    const started = new Date('2026-08-26T16:50:00Z'); // 次日 00:50 SGT
    const got = effectiveLockAt({ dayEnd, startedAt: started });
    // 次日 01:00 SGT = 17:00Z
    expect(got.toISOString()).toBe('2026-08-26T17:00:00.000Z');
  });

  it('没有 startedAt → 老老实实 23:59', () => {
    expect(effectiveLockAt({ dayEnd, startedAt: null }).toISOString()).toBe(dayEnd.toISOString());
  });
});

describe('shouldFinalizeOnEod —— 一道没答的卷子当没开过', () => {
  it('0 题 → 不最终化', () => expect(shouldFinalizeOnEod(0)).toBe(false));
  it('答了就最终化', () => expect(shouldFinalizeOnEod(1)).toBe(true));
});

describe('日期口径 —— 标签 vs 瞬刻（生产 E2E 抓到的 off-by-one）', () => {
  // 2026-08-25 15:45 SGT = 07:45 UTC
  const afternoon = new Date('2026-08-25T07:45:00Z');

  it('lessonDayKey：下午三点算出来必须是**今天**', () => {
    // 第一版这里返回 08-24，于是永远匹配不到今天的场次
    expect(lessonDayKey(afternoon).toISOString()).toBe('2026-08-25T00:00:00.000Z');
  });

  it('lessonDayKey：SGT 凌晨 0:30（前一天 16:30 UTC）也算新的一天', () => {
    expect(lessonDayKey(new Date('2026-08-24T16:30:00Z')).toISOString()).toBe(
      '2026-08-25T00:00:00.000Z',
    );
  });

  it('lessonDayKey：SGT 23:30（同日 15:30 UTC）仍是当天', () => {
    expect(lessonDayKey(new Date('2026-08-25T15:30:00Z')).toISOString()).toBe(
      '2026-08-25T00:00:00.000Z',
    );
  });

  it('sgtMidnightInstant：是真实零点，与标签差 8 小时', () => {
    expect(sgtMidnightInstant(afternoon).toISOString()).toBe('2026-08-24T16:00:00.000Z');
  });

  it('两者**不是**同一个值 —— 这就是当初混用的地方', () => {
    expect(lessonDayKey(afternoon).getTime()).not.toBe(sgtMidnightInstant(afternoon).getTime());
  });
});

describe('drillTarget —— 补段同样要可达成', () => {
  it('积压 20 道 → 今天只练 5 道', () => {
    // 打开一看「今天要练 20 道」，最合理的反应就是不做
    expect(drillTarget(20)).toBe(DRILL_DAILY_CAP);
  });
  it('少于上限按实际；空队列 → 0（→ none → 算完成）', () => {
    expect(drillTarget(3)).toBe(3);
    expect(drillTarget(0)).toBe(0);
    expect(segmentStatus(0, drillTarget(0))).toBe('none');
  });
});

describe('readablePaperTitle —— 别把内部 setCode 摔到学生脸上', () => {
  it('生产里的真实卷名', () => {
    expect(
      readablePaperTitle(
        'Morning Quiz OLEVEL/ai_authored_olevel_basic_05_the_queue_v1/Paper2 (2026-08-25)',
      ),
    ).toBe('The Queue');
  });

  it('剑桥真题也能读', () => {
    expect(readablePaperTitle('Morning Quiz IELTS/cambridge_0510_s23_library_card/Paper1')).toBe(
      'Library Card',
    );
  });

  it('认不出来就返回 null（宁可不显示，也别显示编号）', () => {
    expect(readablePaperTitle(null)).toBeNull();
    expect(readablePaperTitle('')).toBeNull();
    expect(readablePaperTitle('Morning Quiz X/12345/Paper1')).toBeNull();
  });
});

describe('LESSON_RULES_VERSION', () => {
  it('是个正整数，且改判定时必须递增', () => {
    // 这条测试本身拦不住忘记递增，但它把「版本号是判定的一部分」这件事
    // 写进了测试文件 —— 改规则的人会在同一个文件里看到它。
    expect(Number.isInteger(LESSON_RULES_VERSION)).toBe(true);
    expect(LESSON_RULES_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('v2 = 补段加了每日上限（drillTarget）', () => {
    // v1 没有上限，课程页出现过「0/20 道」。加上限改变了完成判定，
    // 所以必须换版本 —— 否则改口径前后的完成率不可比。
    expect(LESSON_RULES_VERSION).toBeGreaterThanOrEqual(2);
    expect(drillTarget(20)).toBeLessThan(20);
  });
});
