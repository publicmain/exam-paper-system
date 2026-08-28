import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 阶段 5A 的端点矩阵 —— **从代码推导，不信文档里的数字**。
 *
 * 计划里写的是「vocab 19 + lesson 2 + morning-quiz 3」。这个文件从
 * 控制器源码把端点数出来，逐条断言范围与接线，任何一条被漏掉或被意外
 * 拉进来都会红。
 *
 * 为什么用源码扫描而不是起 Nest 应用：起应用要连库、要装配全部模块，
 * 而这里要验的是**接线是否齐全**，源码层面就能给出确定答案，且跑得起来
 * 不依赖任何环境。
 */

const SRC = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8');

/** 扫一个控制器里的所有 HTTP 端点，连同其装饰器与方法体。 */
function endpoints(file: string) {
  const lines = read(file).split('\n');
  const marks: { i: number; method: string; route: string; decorators: string[] }[] = [];
  let deco: string[] = [];
  lines.forEach((l, i) => {
    // 只认**行首**的真实装饰器 —— 注释里提到 @Public 的地方不算，
    // 否则一句「以下三个接口…非 @Public」就能让扫描器把下一个端点判错。
    const d = l.match(/^\s*@(Public|RequireStudentToken|RateLimit)\(/);
    if (d) deco.push(d[1]);
    const m = l.match(/@(Get|Post|Patch|Delete)\('([^']*)'\)/);
    if (m) {
      marks.push({ i, method: m[1].toUpperCase(), route: m[2], decorators: deco });
      deco = [];
    }
  });
  return marks.map((m, idx) => ({
    ...m,
    body: lines.slice(m.i, idx + 1 < marks.length ? marks[idx + 1].i : lines.length).join('\n'),
  }));
}

const vocab = endpoints('vocab/vocab.controller.ts');
const lesson = endpoints('lesson/lesson.controller.ts');
const mq = endpoints('morning-quiz/morning-quiz.controller.ts');

/** 学生端 = 带 @Public()（教师端走 JWT 守卫，不在本阶段范围）。 */
const isStudentFacing = (e: { decorators: string[] }) => e.decorators.includes('Public');
/** 有身份 = 方法体里取过 name / studentName。 */
const takesIdentity = (e: { body: string }) =>
  /@Query\('name'\)|studentName:\s*z\.string|(\bname):\s*z\.string/.test(e.body);
/** 已接线 = 走了共享的 identityOf / resolveIdentity / authStudentId。 */
const wired = (e: { body: string }) =>
  /identityOf\(|resolveIdentity\(|authStudentId|studentAuth/.test(e.body);

describe('端点矩阵 —— 从代码推导', () => {
  it('vocab 控制器：24 个端点，其中 **19 个是带身份的学生端**', () => {
    expect(vocab).toHaveLength(24);
    const teacher = vocab.filter((e) => !isStudentFacing(e));
    expect(teacher.map((e) => e.route).sort()).toEqual(
      ['class/:classId/engagement', 'class/:classId/stats', 'class/:classId/top', 'push'].sort(),
    );
    const student = vocab.filter(isStudentFacing);
    expect(student).toHaveLength(20); // 含 lookup
    const withIdentity = student.filter(takesIdentity);
    expect(withIdentity).toHaveLength(19);
    // lookup 是纯查词典，没有身份 —— 因此不在范围内
    expect(student.find((e) => e.route === 'lookup')).toBeDefined();
    expect(takesIdentity(student.find((e) => e.route === 'lookup')!)).toBe(false);
  });

  it('**vocab 的 19 个带身份端点全部已接线**（一个不漏）', () => {
    const unwired = vocab.filter(isStudentFacing).filter(takesIdentity).filter((e) => !wired(e));
    expect(unwired.map((e) => `${e.method} /vocab/${e.route}`)).toEqual([]);
  });

  it('lesson：today / start 本就是 id 优先；vocab-taught / vocab-cursor 本轮接线', () => {
    const byRoute = Object.fromEntries(lesson.map((e) => [e.route, e]));
    for (const r of ['today', 'start']) {
      expect(byRoute[r], `缺 ${r}`).toBeDefined();
      expect(wired(byRoute[r])).toBe(true);
    }
    for (const r of ['vocab-taught', 'vocab-cursor']) {
      expect(byRoute[r], `缺 ${r}`).toBeDefined();
      expect(wired(byRoute[r])).toBe(true);
    }
  });

  it('**morning-quiz：只接 D2 范围内的三个**，其余不得被拉进来', () => {
    const byRoute = Object.fromEntries(mq.map((e) => [`${e.method} ${e.route}`, e]));
    for (const k of ['GET history-by-name', 'GET history-detail', 'POST appeals']) {
      expect(byRoute[k], `缺 ${k}`).toBeDefined();
      expect(wired(byRoute[k]), `${k} 未接线`).toBe(true);
    }
    // 明确排除的：范围外，不得出现已认证接线
    for (const k of ['GET upcoming-for-name', 'GET history-by-name/trend', 'GET skill-profile']) {
      const e = byRoute[k];
      if (!e) continue;
      expect(wired(e), `${k} 不在阶段 5A 范围内，却被接线了`).toBe(false);
    }
  });

  it('**阅读三件套走 JWT，不该被改写**', () => {
    const byRoute = Object.fromEntries(mq.map((e) => [`${e.method} ${e.route}`, e]));
    for (const k of ['GET sessions/:id', 'PATCH sessions/:id/answer', 'POST sessions/:id/submit']) {
      const e = byRoute[k];
      if (!e) continue;
      expect(takesIdentity(e), `${k} 不该收姓名`).toBe(false);
    }
  });
});

describe('身份解析逻辑没有被复制成多份', () => {
  it('**只有一处定义资格谓词**', () => {
    const files = ['common/authenticated-student.ts', 'vocab/student-word.service.ts',
      'morning-quiz/morning-quiz.service.ts', 'morning-quiz/morning-quiz.controller.ts'];
    const defs = files.filter((f) => /export function authenticatedStudentWhere/.test(read(f)));
    expect(defs).toEqual(['common/authenticated-student.ts']);
  });

  it('**只有一处定义 identityOf**', () => {
    const files = ['common/student-identity-input.ts', 'vocab/vocab.controller.ts',
      'lesson/lesson.controller.ts', 'morning-quiz/morning-quiz.controller.ts'];
    const defs = files.filter((f) => /export function identityOf/.test(read(f)));
    expect(defs).toEqual(['common/student-identity-input.ts']);
  });

  it('**没有把令牌姓名塞回姓名解析器**', () => {
    for (const f of ['common/student-identity-input.ts', 'vocab/vocab.controller.ts',
      'lesson/lesson.controller.ts', 'morning-quiz/morning-quiz.controller.ts']) {
      const code = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      expect(code, `${f} 用 auth.name 当姓名传下去了`).not.toMatch(
        /studentName:\s*(auth|studentAuth)[?.]*\.name/,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 逐端点表驱动 —— 每个在范围内的端点各出一条测试
//
// 为什么不是「一条测试扫全部」：一条聚合断言红了只告诉你「有东西错了」，
// 逐端点则直接把端点名印在失败的测试标题里。19 + 2 + 3 条，漏哪条一目了然。
// ─────────────────────────────────────────────────────────────

type Ep = { method: string; route: string; body: string };

/** 带有效令牌、且**一个身份参数都不传**时仍然合法 —— 身份字段必须可选。 */
const identityIsOptional = (e: Ep) =>
  /@Query\('name'\)\s*\w+\?:/.test(e.body) ||
  /@Query\('name'\)\s*\w+:\s*string\s*\|\s*undefined/.test(e.body) ||
  /(studentName|name):\s*z\.string\(\)[^,\n]*\.optional\(\)/.test(e.body);

/** 拿得到令牌身份 —— 要么经共享的 identityOf，要么直接读 req.studentAuth。 */
const readsToken = (e: Ep) => /identityOf\(|resolveIdentity\(|studentAuth|authStudentId/.test(e.body);

/** 令牌要能进到 handler，必须先注入 req。 */
const injectsReq = (e: Ep) => /@Req\(\)/.test(e.body);

const IN_SCOPE: { group: string; eps: Ep[] }[] = [
  { group: 'vocab', eps: vocab.filter(isStudentFacing).filter(takesIdentity) },
  { group: 'lesson', eps: lesson.filter((e) => ['today', 'start', 'vocab-taught', 'vocab-cursor'].includes(e.route)) },
  {
    group: 'morning-quiz',
    // 按「方法 + 路径」精确取三个 —— morning-quiz 下另有一个教师端的
    // GET /appeals（申诉列表），同名不同方法，不能按 route 模糊匹配。
    eps: mq.filter((e) =>
      ['GET history-by-name', 'GET history-detail', 'POST appeals'].includes(
        `${e.method} ${e.route}`)),
  },
];

describe('逐端点：带令牌、零身份参数时可用', () => {
  it('**在范围内的端点恰好 24 个 = 19 + 2 + 3**（今日课的 today/start 另计）', () => {
    const counts = Object.fromEntries(IN_SCOPE.map((g) => [g.group, g.eps.length]));
    expect(counts).toEqual({ vocab: 19, lesson: 4, 'morning-quiz': 3 });
    // lesson 的 4 = 本轮接线的 2（vocab-taught / vocab-cursor）
    //            + 本就已是 id 优先、只做验证不改写的 2（today / start）
  });

  for (const { group, eps } of IN_SCOPE) {
    for (const e of eps) {
      const title = `${e.method} /${group}/${e.route}`;
      it(`${title} —— 注入 req、读令牌、身份参数可省`, () => {
        expect(injectsReq(e), `${title} 没注入 @Req()，令牌根本进不来`).toBe(true);
        expect(readsToken(e), `${title} 没有读取令牌身份`).toBe(true);
        expect(identityIsOptional(e), `${title} 的身份字段仍是必填 —— 零身份参数会被 400`).toBe(true);
      });
    }
  }
});

describe('逐端点：旧客户端（无令牌、带姓名）不受影响', () => {
  for (const { group, eps } of IN_SCOPE) {
    for (const e of eps) {
      const title = `${e.method} /${group}/${e.route}`;
      it(`${title} —— 姓名入参仍然存在`, () => {
        // 姓名字段被删掉 = 旧客户端当场 400。阶段 5A 明确要求保留到阶段 16。
        expect(
          /@Query\('name'\)|studentName|(\bname):\s*z\.string/.test(e.body),
          `${title} 把姓名入参删了 —— 旧客户端会挂`,
        ).toBe(true);
      });
    }
  }
});
