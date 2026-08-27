import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
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

  it('阶段 4A 只注册四条：登录 / 注册 / 今天的课 / 账号', () => {
    expect(new Set(REGISTERED_PATHS)).toEqual(
      new Set(['/login', '/register', '/today', '/account']),
    );
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
      if (t.kind === 'stay') expect(t.reason.length).toBeGreaterThan(3);
    }
  });

  it('**课程路由在 4A 一律标记为 planned**（还没实现，不许真跳）', () => {
    for (const k of ['resume_reading', 'read_result', 'learn_vocab', 'vocab_test', 'summary'] as const) {
      const t = NEXT_ACTION_ROUTE[k];
      expect(t.kind).toBe('navigate');
      if (t.kind === 'navigate') expect(t.planned).toBe(true);
    }
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
   * 身份参数守卫 —— **逐端点白名单，不再整文件豁免**。
   *
   * 旧版把整个 `lib/api.ts` 跳过了。那等于说「API 客户端里怎么写都行」——
   * 而 API 客户端**恰恰是**最可能把 `?name=` 拼进认证后请求的地方。
   *
   * 正确的分寸：`name` / `studentId` 只在**明确列举的 pre-auth 端点**里
   * 正当（那时还没有令牌，姓名是凭据）；**认证后的 URL 与请求体里一律
   * 禁止**。
   */
  const PRE_AUTH_ENDPOINTS = [
    '/student-auth/login',
    '/student-auth/register',
    '/student-auth/registration-status',
  ] as const;

  /** 把 api.ts 按端点切块，返回 {端点, 该块的代码}。 */
  function apiBlocks(): { endpoint: string; body: string; preAuth: boolean }[] {
    const src = stripComments(fs.readFileSync(path.join(SRC, 'lib', 'api.ts'), 'utf8'));
    const out: { endpoint: string; body: string; preAuth: boolean }[] = [];
    // 每个端点从它的路径字面量起，到下一个端点路径为止
    const marks = [...src.matchAll(/['\`]\/student-auth\/[a-z-]+/g)];
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].index!;
      const end = i + 1 < marks.length ? marks[i + 1].index! : src.length;
      const endpoint = marks[i][0].slice(1);
      out.push({
        endpoint,
        body: src.slice(start, end),
        preAuth: (PRE_AUTH_ENDPOINTS as readonly string[]).includes(endpoint),
      });
    }
    return out;
  }

  it('**api.ts 的每个端点都被清点到**（没有整文件豁免）', () => {
    const blocks = apiBlocks();
    const eps = blocks.map((b) => b.endpoint);
    expect(eps).toContain('/student-auth/login');
    expect(eps).toContain('/student-auth/register');
    expect(eps).toContain('/student-auth/registration-status');
    expect(eps).toContain('/student-auth/me');
    expect(eps).toContain('/student-auth/change-pin');
  });

  it('**认证后的端点里不得出现 name / studentId**（URL 或请求体都不行）', () => {
    const hits: string[] = [];
    for (const b of apiBlocks()) {
      if (b.preAuth) continue;
      if (/[?&]name=|[?&]studentId=/.test(b.body)) hits.push(`${b.endpoint} → URL 拼了身份参数`);
      if (/name\s*:|studentId\s*:/.test(b.body)) hits.push(`${b.endpoint} → 请求体带了身份字段`);
    }
    expect(hits).toEqual([]);
  });

  it('**api.ts 之外的任何文件都不得拼身份参数**', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      if (f.endsWith(path.join('lib', 'api.ts'))) continue; // 上面按端点单独查过
      if (/[?&]name=|[?&]studentId=/.test(text)) hits.push(path.relative(SRC, f));
    }
    expect(hits).toEqual([]);
  });

  // ── 反向夹具：证明这个守卫抓得住 ──
  describe('反向夹具 —— 身份参数守卫必须抓得住', () => {
    const scanAuthed = (body: string) => {
      const h: string[] = [];
      if (/[?&]name=|[?&]studentId=/.test(body)) h.push('url');
      if (/name\s*:|studentId\s*:/.test(body)) h.push('body');
      return h;
    };

    it('**认证后 URL 里拼 `?name=` 会被抓到**', () => {
      expect(scanAuthed("request('GET', `/student-auth/me?name=${n}`)")).toContain('url');
    });

    it('**认证后请求体里带 studentId 会被抓到**', () => {
      expect(scanAuthed("request('POST', '/student-auth/change-pin', { body: { studentId: x } })")).toContain('body');
    });

    it('干净的认证后端点不会误报', () => {
      expect(scanAuthed("request('GET', '/student-auth/me', { token })")).toEqual([]);
    });

    it('pre-auth 端点带 name 是正当的 —— 它们走白名单，不进这条扫描', () => {
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).toContain('/student-auth/login');
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).not.toContain('/student-auth/me');
      expect((PRE_AUTH_ENDPOINTS as readonly string[])).not.toContain('/student-auth/change-pin');
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
