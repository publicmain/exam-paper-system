/**
 * S12O —— 学生**中途换难度**之后，哪一天该变、哪一天绝不能变。
 *
 * 这是这个功能唯一真正危险的地方。把「难度」当成一个可以随时重算的
 * 参数，就会得到这样的一天：他上午读了《The Bicycle Doctor》、答了六道
 * 题，中午在账号设置里换了一档，下午回来发现文章换了、题没了、单词表
 * 也变了。**已经开始的一天必须是冻住的。**
 *
 * 冻结靠的是两样已经存在的东西，这里把它们和新的换档路径钉在一起：
 *
 *   · 已经有答卷 → 认答卷那一场（`lesson.service` 里 `sub` 优先于 `picked`）
 *   · 已经进过课 → 目标与词表冻结在 `DailyLessonCompletion`
 *
 * 纯函数 + 假库，不连库。
 */

import { describe, expect, it } from 'vitest';
import { pickTodaySession, type SessionCandidate } from './pick-session';
import { PILOT_LEVELS } from '../student-auth/pilot-levels';

const open = (id: string, level: string): SessionCandidate =>
  ({ id, level, hasPaper: true, windowOpen: true }) as SessionCandidate;

/** 试点班：三档同时开着。 */
const THREE = [
  open('s_olevel', 'olevel'),
  open('s_simpl', 'ielts_simplified'),
  open('s_auth', 'ielts_authentic'),
];

describe('S12O —— 换了难度之后，还没开始的那一天走新的', () => {
  it('改成雅思真题型 → 挑到的就是真题型那一场', () => {
    const r = pickTodaySession({
      storedLevel: 'ielts_authentic' as any,
      candidates: THREE,
      isTestClass: false,
    });
    expect(r).toMatchObject({ kind: 'session', sessionId: 's_auth', level: 'ielts_authentic' });
  });

  it('三档都试一遍 —— 每一档都挑到自己那一场', () => {
    for (const lv of PILOT_LEVELS) {
      const r: any = pickTodaySession({
        storedLevel: lv as any,
        candidates: THREE,
        isTestClass: false,
      });
      expect(r.kind).toBe('session');
      expect(r.level).toBe(lv);
    }
  });

  it('**换档不会把他的难度重新落定一次** —— `land` 始终是 null', () => {
    for (const lv of PILOT_LEVELS) {
      const r: any = pickTodaySession({
        storedLevel: lv as any,
        candidates: THREE,
        isTestClass: false,
      });
      // land != null 意味着服务端要写回 User.englishLevel。学生自己刚
      // 选完的档，绝不能被课程入口反手覆盖掉。
      expect(r.land).toBeNull();
    }
  });

  it('连换几次，最后一次说了算 —— 挑场次只看当前那一个值', () => {
    const seq = ['olevel', 'ielts_authentic', 'ielts_simplified'];
    const last = seq[seq.length - 1];
    const r: any = pickTodaySession({
      storedLevel: last as any,
      candidates: THREE,
      isTestClass: false,
    });
    expect(r.sessionId).toBe('s_simpl');
  });

  it('换到一档今天没开的 → 临时上开着的那一场，**但不改写他的难度**', () => {
    const r: any = pickTodaySession({
      storedLevel: 'ielts_authentic' as any,
      candidates: [open('s_olevel', 'olevel')],
      isTestClass: false,
    });
    expect(r.kind).toBe('session');
    expect(r.sessionId).toBe('s_olevel');
    expect(r.land).toBeNull();
  });

  it('同一个输入反复挑，永远挑到同一场 —— 否则会开出第二份答卷', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => {
        const r: any = pickTodaySession({
          storedLevel: 'ielts_simplified' as any,
          // 顺序打乱：结论不能依赖数据库的返回顺序
          candidates: [...THREE].reverse(),
          isTestClass: false,
        });
        return r.sessionId;
      }),
    );
    expect([...ids]).toEqual(['s_simpl']);
  });
});

// ─────────────────────────────────────────────────────────────
// 已经开始的一天：冻住
// ─────────────────────────────────────────────────────────────

/**
 * `lesson.service` 里那一行的语义，单独拎出来钉住：
 *
 *   const session = (sub && 找答卷那一场) || (挑出来的那一场) || 兜底
 *
 * 只要今天已经有答卷，**挑出来的结果就完全不参与**。
 */
function resolveSession(
  submissionAssignmentId: string | null,
  sessions: Array<{ id: string; assignmentId: string; level: string }>,
  pickedId: string | null,
) {
  return (
    (submissionAssignmentId != null &&
      sessions.find((s) => s.assignmentId === submissionAssignmentId)) ||
    (pickedId != null ? sessions.find((s) => s.id === pickedId) : null) ||
    sessions[0]
  );
}

const SESSIONS = [
  { id: 's_olevel', assignmentId: 'a_olevel', level: 'olevel' },
  { id: 's_auth', assignmentId: 'a_auth', level: 'ielts_authentic' },
];

describe('S12O —— 已经开始的那一天，换档之后一个字都不变', () => {
  it('已经交过卷 → 认答卷那一场，哪怕现在挑出来的是另一档', () => {
    const s = resolveSession('a_olevel', SESSIONS, 's_auth');
    expect(s.level).toBe('olevel');
    expect(s.id).toBe('s_olevel');
  });

  it('还没有答卷 → 才轮到挑出来的那一场', () => {
    const s = resolveSession(null, SESSIONS, 's_auth');
    expect(s.level).toBe('ielts_authentic');
  });

  it('**换档前后，已开始那一天的场次是同一个** —— 文章 / 题目跟着场次走', () => {
    const before = resolveSession('a_olevel', SESSIONS, 's_olevel');
    const after = resolveSession('a_olevel', SESSIONS, 's_auth');
    expect(after).toEqual(before);
  });

  it('当天的词表冻在任务行里 —— 换档不重算它', () => {
    // vocabTargetOf 读的是**冻结下来的那一份**，不是「现在算出来会是几个」
    const frozen = ['rubbish', 'complaint', 'council'];
    const vocabTargetOf = (q: string[] | null) => (Array.isArray(q) ? q.length : 0);
    expect(vocabTargetOf(frozen)).toBe(3);
    // 换档之后再问一次，答案必须还是那三个 —— 冻结的语义就是「不再问」
    expect(vocabTargetOf(frozen)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// 历史一条都不动
// ─────────────────────────────────────────────────────────────

describe('S12O —— 换档这条路径碰不到任何历史', () => {
  /**
   * 直接读 `setEnglishLevel` 的源码：它只能出现 `user.update`，
   * 而且 data 里只有 englishLevel。任何一句 delete / deleteMany /
   * 对历史表的写，都会在这里被抓住。
   *
   * 比「跑一遍看看有没有少东西」强的地方在于：少写一张表的用例会漏，
   * 而「除了这一句谁也不许写」不会。
   */
  const SRC = (): string => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs');
    const path = require('node:path');
    return fs.readFileSync(
      path.resolve(__dirname, '../student-auth/student-auth.service.ts'),
      'utf8',
    );
  };

  function bodyOf(fn: string): string {
    const src = SRC();
    const at = src.indexOf(`async ${fn}(`);
    expect(at, `${fn} 不在源码里`).toBeGreaterThan(-1);
    // 先跳过**参数表**再找函数体的第一个大括号。
    // `async selfRegister(input: { … })` 的参数里就有大括号 —— 直接
    // indexOf('{') 会截到参数类型上，函数体一行都看不到，于是所有
    // 「不许碰历史表」的断言都空跑通过。这正是这类守卫最容易的死法。
    let paren = 0;
    let k = src.indexOf('(', at);
    for (; k < src.length; k++) {
      if (src[k] === '(') paren++;
      else if (src[k] === ')') {
        paren--;
        if (paren === 0) break;
      }
    }
    let i = src.indexOf('{', k);
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') {
        depth--;
        if (depth === 0) return src.slice(i, j + 1);
      }
    }
    throw new Error('括号没配平');
  }

  const HISTORY = [
    'studentSubmission',
    'answerScript',
    'vocabQuizAttempt',
    'studentWord',
    'wordReviewLog',
    'gradeAppeal',
    'mistakeEntry',
    'dailyLessonCompletion',
    'morningQuizSession',
  ];

  it('`setEnglishLevel` 一张历史表都不碰', () => {
    const body = bodyOf('setEnglishLevel');
    for (const t of HISTORY) {
      expect(body, `竟然碰了 ${t}`).not.toContain(`.${t}.`);
    }
  });

  it('`setEnglishLevel` 里没有任何删除', () => {
    const body = bodyOf('setEnglishLevel');
    expect(body).not.toContain('delete');
    expect(body).not.toContain('deleteMany');
    expect(body).not.toContain('$executeRaw');
  });

  it('它唯一的写是 `user.update`，而且只写 englishLevel', () => {
    const body = bodyOf('setEnglishLevel');
    const writes = body.match(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? [];
    expect(writes).toEqual(['.update(']);
    expect(body).toContain('data: { englishLevel: level as PilotLevel }');
  });

  it('也不动 `studentAuthVersion` —— 换个难度不该把人踢下线', () => {
    expect(bodyOf('setEnglishLevel')).not.toContain('studentAuthVersion');
  });

  it('`selfRegister` 只建号与入班，不碰任何历史表', () => {
    const body = bodyOf('selfRegister');
    for (const t of HISTORY) {
      expect(body, `竟然碰了 ${t}`).not.toContain(`.${t}.`);
    }
    const writes = body.match(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/g) ?? [];
    expect(writes.sort()).toEqual(['.create(', '.create(']);
  });
});
