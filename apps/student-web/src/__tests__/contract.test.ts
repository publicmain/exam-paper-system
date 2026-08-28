import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  LESSON_ROUTES,
  LESSON_STAGE_LABEL,
  NEXT_ACTION_KINDS,
  NEXT_ACTION_ROUTE,
  REGISTERED_PATHS,
  ROUTES,
  fallbackPath,
} from '../routes.contract';

const SRC = path.resolve(__dirname, '..');

function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allSourceFiles(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const SOURCES = allSourceFiles(SRC).filter((f) => !f.includes('__tests__'));

/**
 * **先剥注释，再扫代码。**
 *
 * 这些守卫要禁的是「新端**用**了旧路由 / 旧身份键」，不是「新端的注释里
 * **提到**它们」——恰恰相反，注释里写清「我们为什么不碰这些」是有价值的，
 * 一刀切的 grep 会把这种解释也判死，逼着后人把理由删掉。
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 块注释（含 JSDoc）
    .replace(/(^|[^:])\/\/.*$/gm, '$1');  // 行注释（别误伤 https://）
}

const readAll = () =>
  SOURCES.map((f) => ({ f, text: stripComments(fs.readFileSync(f, 'utf8')) }));

// ─────────────────────────────────────────────────────────────
// G6 —— 注册的路由集合必须等于契约
// ─────────────────────────────────────────────────────────────

/**
 * 把 App.tsx 里**每一条** `<Route>` 的 path 抽出来，不管它写成什么形状：
 *   path={ROUTES.today}      → 契约常量
 *   path="/legacy"           → 字面量
 *   path={someVar}           → 计算值
 *   path="*"                 → 通配兜底
 *
 * 旧版只认第一种，字面量和计算值**直接漏过** —— 有人手写一条
 * `<Route path="/legacy" …>` 守卫是绿的。这就是这次加固要堵的洞。
 */
type RouteDecl = { raw: string; kind: 'contract' | 'literal' | 'computed' | 'wildcard' };

export function extractRouteDecls(appSource: string): RouteDecl[] {
  const out: RouteDecl[] = [];
  for (const m of appSource.matchAll(/<Route\s[^>]*?path=(\{[^}]*\}|"[^"]*"|'[^']*')/g)) {
    const raw = m[1];
    if (/^\{ROUTES\.\w+\}$/.test(raw)) out.push({ raw, kind: 'contract' });
    else if (/^["'][*]["']$/.test(raw)) out.push({ raw, kind: 'wildcard' });
    else if (/^["']/.test(raw)) out.push({ raw, kind: 'literal' });
    else out.push({ raw, kind: 'computed' });
  }
  return out;
}

describe('G6 路由契约是单一事实源', () => {
  const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
  const decls = extractRouteDecls(app);

  it('**每一条 Route 都被清点到**（不只是 ROUTES.x 那种写法）', () => {
    // App.tsx 里 <Route 的出现次数必须等于抽取到的条数 —— 抽漏了就红
    const rawCount = (app.match(/<Route\s/g) ?? []).length;
    expect(decls).toHaveLength(rawCount);
    expect(rawCount).toBeGreaterThan(0);
  });

  it('**只允许契约路由 + 一条刻意的通配兜底**', () => {
    const bad = decls.filter((d) => d.kind === 'literal' || d.kind === 'computed');
    expect(bad.map((b) => b.raw)).toEqual([]);
    expect(decls.filter((d) => d.kind === 'wildcard')).toHaveLength(1);
  });

  it('**注册的路由集合 === routes.contract 声明的集合**', () => {
    const registered = decls
      .filter((d) => d.kind === 'contract')
      .map((d) => ROUTES[d.raw.slice('{ROUTES.'.length, -1) as keyof typeof ROUTES]);
    expect(new Set(registered)).toEqual(new Set(REGISTERED_PATHS));
    expect(registered).toHaveLength(REGISTERED_PATHS.length);
  });

  it('契约里的每一条都真的被注册了', () => {
    for (const key of Object.keys(ROUTES)) expect(app).toContain(`ROUTES.${key}`);
  });

  it('**阶段 6A 注册九条**：四条外壳 + 五条课程路由', () => {
    expect(new Set(REGISTERED_PATHS)).toEqual(
      new Set([
        '/login', '/register', '/today', '/account',
        '/lesson/reading', '/lesson/reading/result',
        '/lesson/vocab', '/lesson/test', '/lesson/summary',
      ]),
    );
  });

  it('**五条课程路由都在 ROUTES 里**（不再是「计划中」的常量）', () => {
    for (const p of Object.values(LESSON_ROUTES)) {
      expect(REGISTERED_PATHS, `${p} 没进注册表`).toContain(p);
    }
    expect(Object.keys(LESSON_STAGE_LABEL).sort()).toEqual(Object.keys(LESSON_ROUTES).sort());
  });

  it('**没有 `/app` 前缀** —— 独立源拥有根路径（D7）', () => {
    for (const p of REGISTERED_PATHS) expect(p.startsWith('/app/')).toBe(false);
  });

  // ── 反向夹具：证明这个守卫真的抓得住 ──
  describe('反向夹具 —— 守卫必须抓得住未登记的路由', () => {
    it('**字面量 `/legacy` 会被识别为 literal**', () => {
      const fake = '<Route path="/legacy" element={<X />} />';
      const d = extractRouteDecls(fake);
      expect(d).toHaveLength(1);
      expect(d[0].kind).toBe('literal');
    });

    it('**计算值 `path={someVar}` 会被识别为 computed**', () => {
      const fake = '<Route path={legacyPath} element={<X />} />';
      expect(extractRouteDecls(fake)[0].kind).toBe('computed');
    });

    it('**混进一条字面量路由时，「只允许契约 + 通配」这条判据会红**', () => {
      const fake =
        '<Route path={ROUTES.today} element={<A />} />' +
        '<Route path="/legacy" element={<B />} />' +
        '<Route path="*" element={<C />} />';
      const d = extractRouteDecls(fake);
      const bad = d.filter((x) => x.kind === 'literal' || x.kind === 'computed');
      // 真实断言是 expect(bad).toEqual([])；这里证明它此时非空 → 会红
      expect(bad).toHaveLength(1);
      expect(bad[0].raw).toBe('"/legacy"');
    });

    it('通配兜底只允许一条', () => {
      const fake = '<Route path="*" element={<A />} /><Route path="*" element={<B />} />';
      expect(extractRouteDecls(fake).filter((x) => x.kind === 'wildcard')).toHaveLength(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G9 —— 十个 NextActionKind 必须全部有目标
// ─────────────────────────────────────────────────────────────

describe('G9 NextActionKind 映射穷尽', () => {
  it('**恰好十个取值**（与后端类型联合一致，不是九个）', () => {
    expect(NEXT_ACTION_KINDS).toHaveLength(10);
    expect(new Set(NEXT_ACTION_KINDS)).toEqual(
      new Set([
        'ready_to_start', 'resume_reading', 'read_result', 'learn_vocab',
        'vocab_test', 'summary', 'no_content', 'window_closed',
        'level_not_set', 'none',
      ]),
    );
  });

  it('**十个全部有映射目标，一个不漏**', () => {
    for (const k of NEXT_ACTION_KINDS) {
      expect(NEXT_ACTION_ROUTE[k], `kind ${k} 没有映射`).toBeDefined();
    }
    expect(Object.keys(NEXT_ACTION_ROUTE).sort()).toEqual([...NEXT_ACTION_KINDS].sort());
  });

  it('停留态必须给出原因，不能是空话', () => {
    for (const k of NEXT_ACTION_KINDS) {
      const t = NEXT_ACTION_ROUTE[k];
      if (t.kind === 'stay' || t.kind === 'start') expect(t.reason.length).toBeGreaterThan(3);
    }
  });

  it('**五个可跳转的 kind 都指向已注册的课程路由**（不再是 planned 占位）', () => {
    const want = {
      resume_reading: '/lesson/reading',
      read_result: '/lesson/reading/result',
      learn_vocab: '/lesson/vocab',
      vocab_test: '/lesson/test',
      summary: '/lesson/summary',
    } as const;
    for (const [k, path] of Object.entries(want)) {
      const t = NEXT_ACTION_ROUTE[k as keyof typeof want];
      expect(t.kind).toBe('navigate');
      if (t.kind === 'navigate') {
        expect(t.path).toBe(path);
        expect(REGISTERED_PATHS, `${path} 必须是已注册路由`).toContain(t.path);
      }
    }
  });

  it('**只有 ready_to_start 是「留在原地但有主行动」**', () => {
    const starts = NEXT_ACTION_KINDS.filter((k) => NEXT_ACTION_ROUTE[k].kind === 'start');
    expect(starts).toEqual(['ready_to_start']);
    const stays = NEXT_ACTION_KINDS.filter((k) => NEXT_ACTION_ROUTE[k].kind === 'stay');
    expect(stays.sort()).toEqual(['level_not_set', 'no_content', 'none', 'window_closed']);
  });

  it('映射目标不指向任何旧路由', () => {
    for (const k of NEXT_ACTION_KINDS) {
      const t = NEXT_ACTION_ROUTE[k];
      if (t.kind !== 'navigate') continue;
      expect(t.path).not.toMatch(/my-history|my-lesson|my-vocab|my-mistakes|morning-quiz|scan/);
    }
  });
});

describe('未知 URL 的落点', () => {
  it('已登录 → /today', () => expect(fallbackPath(true)).toBe('/today'));
  it('**未登录 → /login，不是姓名页**', () => expect(fallbackPath(false)).toBe('/login'));
});

// ─────────────────────────────────────────────────────────────
// G1 —— 旧路由 / 旧存储键的静态扫描
//
// 注意分寸：`name` / `studentId` 在**登录、注册、消歧**的请求体里是
// 正当的 pre-auth 凭据字段，不能一刀切地 grep 掉。这里禁的是
// **canonical URL 里的身份参数**与**身份持久化**。
// ─────────────────────────────────────────────────────────────

describe('G1 新端不得出现旧路由与旧身份键', () => {
  const BANNED = [
    '/my-history', '/my-lesson', '/my-vocab', '/my-mistakes',
    '/morning-quiz', '/scan', '/student/', '/practice/',
    'mq:history:name', 'mq:history:studentId',
    'then=', 'after=submit', 'adoptHandoff', '#h=',
  ];

  it('**旧路由与旧身份键一个都不出现**', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      for (const b of BANNED) {
        if (text.includes(b)) hits.push(`${path.relative(SRC, f)} → ${b}`);
      }
    }
    expect(hits).toEqual([]);
  });

  /**
   * 全量清点 —— **不按前缀，按调用点**。
   *
   * 旧版只发现 `/student-auth/*`：它拿路径字面量当锚点，凡是别的前缀
   * （`/lesson/*`、`/vocab/*`、`/morning-quiz/*`）一律看不见。等新端开始
   * 调这些接口，守卫会**静默地什么都不查**，而测试仍然是绿的。
   *
   * 现在改成从 `request(...)` 的**调用点**切块：
   *
   *   · 前缀无关 —— 任何路径都会被清点到；
   *   · 边界精确 —— 块就是那一次调用的实参，类型声明落不进来
   *     （`StudentCandidate.studentId`、`MeResult.name` 是**响应**字段，
   *     本来就该带身份，禁的是**请求**里带）；
   *   · 未分类即失败 —— 新加一个端点而没在下面登记，清点表对不上就红。
   */

  /** **只有这三个**是 pre-auth：还没有令牌，姓名是凭据。 */
  const PRE_AUTH_ENDPOINTS = [
    '/student-auth/login',
    '/student-auth/register',
    '/student-auth/registration-status',
  ] as const;

  /**
   * 已登记的全部端点 —— 新增端点必须同时改这里，否则「未分类」测试会红。
   * 这正是它存在的意义：让「悄悄加一个带身份的请求」变成一件做不到的事。
   */
  const KNOWN_ENDPOINTS = [
    ...PRE_AUTH_ENDPOINTS,
    '/student-auth/me',
    '/student-auth/change-pin',
    // 阶段 6A：今天的课。两条都是**认证后**端点 —— 零身份参数。
    '/lesson/today',
    '/lesson/start',
  ] as const;

  /** 从 `(` 开始按深度取平衡括号内的实参文本，跳过字符串里的括号。 */
  function balanced(src: string, open: number): string {
    let depth = 0;
    let quote: string | null = null;
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) return src.slice(open, i + 1);
      }
    }
    return src.slice(open);
  }

  type ApiCall = { endpoint: string; block: string; preAuth: boolean };

  /**
   * 清点 api.ts 里的**每一次**请求，与路由前缀无关。
   *
   * 扫描范围取**整个方法块**（签名 + 调用），不只是 `request(...)` 的实参：
   * 身份完全可以藏在签名里再原样传下去（`login: (body: { name: string })`
   * → `request(..., { body })`），只看调用点就漏了。块从它所属的属性定义
   * 起算，因此上面那些**响应类型**声明落不进来。
   */
  /**
   * 路径不是字面量、静态判不出来的调用，用这个占位**上报**。
   *
   * 之前这里是 `if (!p) continue` —— 一次 `request('GET', SOME_PATH, …)`
   * 会被静默跳过，于是「没有未分类的端点」照样绿。**判不出来必须判红**，
   * 不能当作没看见：守卫的价值全在这一条上。
   */
  const DYNAMIC = '<dynamic/unclassified>';

  function apiCallsIn(rawSrc: string): ApiCall[] {
    const src = stripComments(rawSrc);
    const props = [...src.matchAll(/\n {2}(\w+):/g)].map((m) => m.index!);
    const out: ApiCall[] = [];
    for (const m of src.matchAll(/\brequest\s*(<[^>]*>)?\s*\(/g)) {
      // helper 自身的声明不是一次调用 —— 只跳过它，不跳过任何调用点
      if (/\bfunction\s*$/.test(src.slice(Math.max(0, m.index! - 16), m.index!))) continue;
      const open = m.index! + m[0].length - 1;
      const call = balanced(src, open);
      const p = call.match(/['"`](\/[A-Za-z0-9\-_/:]+)/);
      const endpoint = p ? p[1] : DYNAMIC;
      const from = props.filter((i) => i < m.index!).pop();
      out.push({
        endpoint,
        block: src.slice(from ?? m.index!, open + call.length),
        preAuth: (PRE_AUTH_ENDPOINTS as readonly string[]).includes(endpoint),
      });
    }
    return out;
  }

  function apiCalls(): ApiCall[] {
    return apiCallsIn(fs.readFileSync(path.join(SRC, 'lib', 'api.ts'), 'utf8'));
  }

  /** 认证后的调用里，身份只能出现在这两个位置之一 —— 都不允许。 */
  function identityHits(call: string): string[] {
    const h: string[] = [];
    if (/[?&](name|studentId)=/.test(call)) h.push('url');
    if (/\b(name|studentName|studentId)\s*:/.test(call)) h.push('body');
    return h;
  }

  it('**每一次请求都被清点到 —— 与路由前缀无关**', () => {
    const eps = apiCalls().map((c) => c.endpoint);
    // 旧版只认 /student-auth/*；这条钉住的是「清点器本身是前缀无关的」
    expect(eps.length).toBeGreaterThanOrEqual(KNOWN_ENDPOINTS.length);
    for (const e of KNOWN_ENDPOINTS) expect(eps).toContain(e);
  });

  it('**没有未分类的端点**（新增一个而不登记就会红）', () => {
    const unknown = apiCalls()
      .map((c) => c.endpoint)
      .filter((e) => !(KNOWN_ENDPOINTS as readonly string[]).includes(e));
    expect(unknown, '有请求没在 KNOWN_ENDPOINTS 里登记').toEqual([]);
  });

  it('**恰好三个 pre-auth 端点可以带身份**，多一个都不行', () => {
    expect(PRE_AUTH_ENDPOINTS).toHaveLength(3);
    const preAuth = [...new Set(apiCalls().filter((c) => c.preAuth).map((c) => c.endpoint))];
    expect(preAuth.sort()).toEqual([...PRE_AUTH_ENDPOINTS].sort());
  });

  it('**其余请求一律按已认证处理：URL 与请求体都不得带身份**', () => {
    const hits: string[] = [];
    for (const c of apiCalls()) {
      if (c.preAuth) continue;
      for (const where of identityHits(c.block)) hits.push(`${c.endpoint} → ${where} 带了身份`);
    }
    expect(hits).toEqual([]);
  });

  it('**没有绕过 request() 的裸 fetch**（否则清点就是漏的）', () => {
    let total = 0;
    for (const { f, text } of readAll()) {
      const n = (stripComments(text).match(/\bfetch\s*\(/g) ?? []).length;
      total += n;
      if (n && !f.endsWith(path.join('lib', 'api.ts'))) {
        expect.fail(`${path.relative(SRC, f)} 绕过 request() 直接 fetch`);
      }
    }
    expect(total, 'api.ts 里应当只有 request() 内部那一处 fetch').toBe(1);
  });

  it('**api.ts 之外的任何文件都不得拼身份参数**', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      if (f.endsWith(path.join('lib', 'api.ts'))) continue; // 上面按调用点单独查过
      if (/[?&]name=|[?&]studentId=/.test(text)) hits.push(path.relative(SRC, f));
    }
    expect(hits).toEqual([]);
  });

  // ── 反向夹具：证明这个守卫抓得住 ──
  describe('反向夹具 —— 身份参数守卫必须抓得住', () => {
    it('**认证后 URL 里拼 `?name=` 会被抓到**（阶段 5A 的真实反例）', () => {
      const fake = "request<Lesson>('GET', `/lesson/today?name=${encodeURIComponent(n)}`, { token })";
      expect(identityHits(fake)).toContain('url');
    });

    it('**vocab 请求体里带 studentId 会被抓到**', () => {
      const fake = "request('POST', '/vocab/mark-known', { body: { studentId: id, word }, token })";
      expect(identityHits(fake)).toContain('body');
    });

    it('**路径是变量、静态判不出来 → 判红为 <dynamic/unclassified>，不是静默跳过**', () => {
      const fake = [
        'export const api = {',
        "  peek: (token: string) => request<unknown>('GET', SOME_PATH, { token }),",
        '};',
      ].join('\n');
      const found = apiCallsIn(fake);
      expect(found).toHaveLength(1);
      expect(found[0].endpoint).toBe(DYNAMIC);
      // 而且它进不了白名单 —— 未分类端点那条断言会因此变红
      expect((KNOWN_ENDPOINTS as readonly string[]).includes(DYNAMIC)).toBe(false);
      expect(found[0].preAuth).toBe(false);
    });

    it('**helper 自身的声明不算调用**（否则它会被误报成 dynamic）', () => {
      const fake = 'async function request<T>(method: string, path: string) { return null; }';
      expect(apiCallsIn(fake)).toEqual([]);
    });

    it('**未登记的新端点会被抓到**', () => {
      const unknown = ['/morning-quiz/history-by-name'];
      expect(unknown.filter((e) => !(KNOWN_ENDPOINTS as readonly string[]).includes(e))).toEqual([
        '/morning-quiz/history-by-name',
      ]);
    });

    it('干净的认证后端点不会误报', () => {
      expect(identityHits("request('GET', '/student-auth/me', { token })")).toEqual([]);
      expect(identityHits("request('POST', '/vocab/review', { body: { word }, token })")).toEqual([]);
    });

    it('**不误伤响应类型与 pre-auth 消歧载荷**', () => {
      // 响应里出现 name / studentId 是正当的：那是服务端**返回**的身份
      const src = fs.readFileSync(path.join(SRC, 'lib', 'api.ts'), 'utf8');
      expect(src).toMatch(/interface StudentCandidate[\s\S]*studentId: string/);
      // 但它落在类型声明里，不在任何 request() 调用块内 —— 所以扫描看不到它
      const inCalls = apiCalls().some((c) => /interface|StudentCandidate\b/.test(c.block));
      expect(inCalls, '类型声明被误切进调用块了').toBe(false);
    });

    it('pre-auth 端点带 name 是正当的 —— 它们走白名单，不进这条扫描', () => {
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).toContain('/student-auth/login');
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).not.toContain('/student-auth/me');
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).not.toContain('/student-auth/change-pin');
      // 而且它们**确实**带了身份 —— 否则说明白名单在保护一个空集
      const login = apiCalls().find((c) => c.endpoint === '/student-auth/login')!;
      expect(identityHits(login.block).length).toBeGreaterThan(0);
    });
  });
  it('**只写一个命名空间下的存储键**，且不碰别人的', () => {
    const writes: string[] = [];
    for (const { f, text } of readAll()) {
      for (const m of text.matchAll(/(?:setItem|removeItem)\(\s*([A-Za-z_]\w*|'[^']*')/g)) {
        writes.push(`${path.relative(SRC, f)}:${m[1]}`);
      }
    }
    // 只允许 identity.ts 里通过 TOKEN_KEY 常量写，外加它自己的探针
    for (const w of writes) {
      expect(w).toMatch(/identity\.ts:(TOKEN_KEY|probe)/);
    }
  });

  it('**没有注册 Service Worker**（4A 不做 PWA 缓存）', () => {
    for (const { text } of readAll()) {
      expect(text).not.toContain('serviceWorker.register');
    }
  });

  it('**不把自己的公开 origin 写死** —— 它由服务端运行期下发', () => {
    for (const { f, text } of readAll()) {
      const m = text.match(/https?:\/\/[a-z0-9.-]+/gi) ?? [];
      for (const url of m) {
        expect(url, `${path.relative(SRC, f)} 写死了 origin ${url}`).toMatch(
          /example\.invalid|localhost/,
        );
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 部署包 —— 静态断言
//
// 本机的 Docker 守护进程不可用，跑不了容器级检查；真正的验证在 staging
// 上做（部署后打真实 URL）。但那是一次性的人工动作，回归靠不住 ——
// 所以把「部署配置必须具备哪些性质」钉在这里，改坏了 CI 会红。
// ─────────────────────────────────────────────────────────────

describe('部署包', () => {
  const ROOT = path.resolve(SRC, '..');
  // 同 stripComments 的道理：扫的是**指令**，不是解释它们的注释。
  const stripHash = (t: string) =>
    t
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
  const nginx = stripHash(fs.readFileSync(path.join(ROOT, 'nginx.conf'), 'utf8'));
  const docker = stripHash(fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8'));

  it('**SPA 兜底**：任意路径回 index.html', () => {
    expect(nginx).toMatch(/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/);
  });

  it('**index.html 不缓存** —— 否则新版发布后学生拿旧 index、引用到已不存在的资源，白屏且刷新无效', () => {
    const block = nginx.match(/location = \/index\.html\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/no-store/);
  });

  it('**指纹化资源可长期不可变缓存**', () => {
    const block = nginx.match(/location \/assets\/\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/immutable/);
    expect(block).toMatch(/max-age=31536000/);
  });

  it('**带 X-Student-App: v2 身份头**', () => {
    expect(nginx).toMatch(/add_header\s+X-Student-App\s+"v2"/);
  });

  it('**不沿用 spike 的身份** —— 真应用不该顶着一次性验证件的头', () => {
    expect(nginx).not.toContain('X-Spike-Service');
    expect(nginx).not.toContain('student-web-origin');
  });

  it('**API 地址是构建期参数；新端自己的 origin 不编进镜像**', () => {
    expect(docker).toMatch(/ARG VITE_API_URL/);
    expect(docker).not.toMatch(/STUDENT_APP_ORIGIN/);
  });

  it('**没有 service worker / manifest**（4A/4B1 都不做 PWA）', () => {
    const pub = path.join(ROOT, 'public');
    const files = fs.existsSync(pub) ? fs.readdirSync(pub) : [];
    expect(files.filter((f) => /sw\.js|manifest/.test(f))).toEqual([]);
    expect(nginx).not.toContain('sw.js');
  });
});

// ─────────────────────────────────────────────────────────────
// 依赖可复现性
//
// 容器的构建上下文是 apps/student-web 本身（--path-as-root），仓库根的
// lockfile 不在上下文里。所以这里单独存一份，容器用 npm ci 装。
// 代价是两份 lockfile 可能漂移 —— 这几条就是防漂移的。
// ─────────────────────────────────────────────────────────────

describe('依赖可复现性', () => {
  const ROOT = path.resolve(SRC, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lockPath = path.join(ROOT, 'package-lock.json');

  it('**应用级 lockfile 存在** —— 没有它容器只能 npm install，产物不可复现', () => {
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it('**Dockerfile 用 npm ci，不是 npm install**', () => {
    const d = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
    expect(d).toMatch(/RUN npm ci/);
    expect(d).not.toMatch(/RUN npm install/);
    expect(d).toMatch(/COPY package\.json package-lock\.json/);
  });

  it('**.dockerignore 不能把 lockfile 排除掉**（排除了 npm ci 会直接失败）', () => {
    const ign = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');
    expect(ign).not.toMatch(/package-lock/);
  });

  it('**lockfile 与 package.json 的依赖集合一致**（防两份 lockfile 漂移）', () => {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const rootEntry = lock.packages?.[''] ?? {};
    expect(rootEntry.dependencies ?? {}).toEqual(pkg.dependencies ?? {});
    expect(rootEntry.devDependencies ?? {}).toEqual(pkg.devDependencies ?? {});
  });

  it('lockfile 是 npm v3 格式（npm ci 需要）', () => {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    expect(lock.lockfileVersion).toBeGreaterThanOrEqual(3);
  });
});
