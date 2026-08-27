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

describe('G6 路由契约是单一事实源', () => {
  it('**App 里注册的路由集合 === routes.contract 声明的集合**', () => {
    const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
    // App 用 ROUTES.x 注册；把它们抽出来还原成真实路径
    const keys = [...app.matchAll(/path=\{ROUTES\.(\w+)\}/g)].map((m) => m[1]);
    const registered = keys.map((k) => ROUTES[k as keyof typeof ROUTES]);
    expect(new Set(registered)).toEqual(new Set(REGISTERED_PATHS));
    expect(registered).toHaveLength(REGISTERED_PATHS.length);
  });

  it('**加了路由却不登记契约 → 这条测试会红**（反向说明）', () => {
    // 契约里的每一条都必须真的出现在 App.tsx 里
    const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
    for (const key of Object.keys(ROUTES)) {
      expect(app).toContain(`ROUTES.${key}`);
    }
  });

  it('阶段 4A 只注册四条：登录 / 注册 / 今天的课 / 账号', () => {
    expect(new Set(REGISTERED_PATHS)).toEqual(
      new Set(['/login', '/register', '/today', '/account']),
    );
  });

  it('**没有 `/app` 前缀** —— 独立源拥有根路径（D7）', () => {
    for (const p of REGISTERED_PATHS) expect(p.startsWith('/app/')).toBe(false);
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

  it('**URL 里不得拼身份参数**（`?name=` / `&studentId=` 这种）', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      // 允许：registration-status 的查询串（pre-auth，见 api.ts 注释）
      if (f.endsWith(path.join('lib', 'api.ts'))) continue;
      if (/[?&]name=|[?&]studentId=/.test(text)) hits.push(path.relative(SRC, f));
    }
    expect(hits).toEqual([]);
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
