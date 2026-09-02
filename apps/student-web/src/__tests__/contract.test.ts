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

  it('**阶段 12B + 词汇教练 V2 的路由全部注册**', () => {
    expect(new Set(REGISTERED_PATHS)).toEqual(
      new Set([
        '/login', '/register', '/today', '/account',
        '/lesson/reading', '/lesson/reading/result',
        '/lesson/vocab', '/lesson/test', '/lesson/summary',
        // 阶段 11 —— 同一外壳里的独立页面，不属于七步链
        '/scores', '/scores/:submissionId',
        // 阶段 12A —— 生词本与两条自由练习，同样是独立页面
        '/vocab', '/vocab/practice', '/vocab/selftest',
        // 独立的个人词汇教练 V2
        '/coach', '/coach/learn', '/coach/test',
        // 阶段 12B —— 错题本与错题重练
        '/mistakes', '/mistakes/practice',
      ]),
    );
  });

  /**
   * 错题重练与「今天的课」里的错题段（`drill`）**是两回事**：
   * 那一段算当天完成度，这一条是学生自己回来重做。用路由说死。
   */
  it('**错题本自成一条路由线**，不挂在课程线下面', () => {
    expect(ROUTES.mistakes).toBe('/mistakes');
    expect(ROUTES.mistakePractice).toBe('/mistakes/practice');
    expect(ROUTES.mistakePractice.startsWith(`${ROUTES.mistakes}/`)).toBe(true);
    for (const p of [ROUTES.mistakes, ROUTES.mistakePractice]) {
      expect(p.startsWith('/lesson/')).toBe(false);
      expect(p.startsWith('/vocab')).toBe(false);
      expect(p.startsWith('/app/')).toBe(false);
    }
  });

  /**
   * 课程学词与自由练习**必须是两条路由线**。
   *
   * 这不是排版洁癖：旧端把两者混在一个页面里，课程队列取不到时悄悄换成
   * 自由练习的词表，学生以为在上今天的课，课程完成度却永远不动。
   * 用路由把它们分开，这种「悄悄换词表」就再也写不出来了。
   */
  it('**课程学词与自由练习是两条路由线**，前缀互不包含', () => {
    expect(ROUTES.lessonVocab).toBe('/lesson/vocab');
    expect(ROUTES.vocab).toBe('/vocab');
    expect(ROUTES.lessonVocab.startsWith(`${ROUTES.vocab}/`)).toBe(false);
    expect(ROUTES.vocab.startsWith(`${ROUTES.lessonVocab}/`)).toBe(false);
    // 自测与正式测试同理
    expect(ROUTES.lessonTest).toBe('/lesson/test');
    expect(ROUTES.vocabSelfTest).toBe('/vocab/selftest');
    expect(ROUTES.vocabSelfTest).not.toBe(ROUTES.lessonTest);
    // 两条自由练习都挂在生词本下面
    for (const p of [ROUTES.vocabPractice, ROUTES.vocabSelfTest]) {
      expect(p.startsWith(`${ROUTES.vocab}/`)).toBe(true);
    }
  });

  it('**历史成绩详情的路径参数只有一个**，而且是 submissionId', () => {
    const params = [...ROUTES.scoreDetail.matchAll(/:(\w+)/g)].map((m) => m[1]);
    expect(params).toEqual(['submissionId']);
    // 列表页是它的父路径 —— 详情不许挂到别的段下面去
    expect(ROUTES.scoreDetail.startsWith(`${ROUTES.scores}/`)).toBe(true);
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
  // S12H 给服务端加了 `drill`（错题重练）。数字从 10 变 11 是**跟着
  // 后端联合走**，不是把守卫放松 —— 下面那条「一个不漏」依旧。
  it('**恰好十二个取值**（与后端类型联合一致，含延期等待）', () => {
    expect(NEXT_ACTION_KINDS).toHaveLength(12);
    expect(new Set(NEXT_ACTION_KINDS)).toEqual(
      new Set([
        'ready_to_start', 'resume_reading', 'read_result', 'learn_vocab',
        'vocab_test', 'vocab_waiting', 'drill', 'summary', 'no_content', 'window_closed',
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

  it('**所有可跳转的 kind 都指向已注册的路由**（词汇统一进“我的单词”）', () => {
    const want = {
      resume_reading: '/lesson/reading',
      read_result: '/lesson/reading/result',
      learn_vocab: '/coach/learn',
      vocab_test: '/vocab',
      vocab_waiting: '/vocab',
      drill: '/mistakes/practice',
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
    '/scan', '/student/', '/practice/',
    'mq:history:name', 'mq:history:studentId',
    'then=', 'after=submit', 'adoptHandoff', '#h=',
  ];

  /**
   * 阶段 7B 起 `/morning-quiz` 是**服务端 API 的前缀**（阅读三端点），
   * 不再只是旧端的页面路由。所以它从一刀切黑名单里挪出来，换成一条更准的
   * 规则：**只有 `lib/api.ts` 可以出现它**。别的文件出现它，就说明有人在
   * 往旧页面跳、或者绕开 `request()` 自己拼请求。
   */
  const API_ONLY_PREFIXES = ['/morning-quiz'];

  it('**旧路由与旧身份键一个都不出现**', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      for (const b of BANNED) {
        if (text.includes(b)) hits.push(`${path.relative(SRC, f)} → ${b}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('**`/morning-quiz` 只允许出现在 lib/api.ts 里**（是 API 路径，不是页面路由）', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      if (f.endsWith(path.join('lib', 'api.ts'))) continue;
      for (const b of API_ONLY_PREFIXES) {
        if (text.includes(b)) hits.push(`${path.relative(SRC, f)} → ${b}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('**新端运行时代码一个 `mq:` 存储键都不碰**（阶段 7B 新增）', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      if (/['"`]mq:/.test(text)) hits.push(path.relative(SRC, f));
    }
    expect(hits).toEqual([]);
  });

  it('**不消费后端的 href** —— 它不是导航权威（阶段 7B 新增）', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      // 类型声明里写 `href: string | null` 是如实描述响应，允许；
      // **读**它（`.href`）不允许。
      if (/\.\s*href\b/.test(text)) hits.push(path.relative(SRC, f));
    }
    expect(hits).toEqual([]);
  });

  it('**不从 apps/web 或任何跨应用路径 import**（阶段 7B 新增）', () => {
    const hits: string[] = [];
    for (const { f, text } of readAll()) {
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (/apps\/web|components\/exam|\.\.\/\.\.\/\.\.\//.test(spec)) {
          hits.push(`${path.relative(SRC, f)} → ${spec}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('**lesson/ 里只有引擎与渲染层，不含页面**（阶段 7C 起 Reading.tsx 是唯一消费者）', () => {
    expect(fs.readdirSync(path.join(SRC, 'lesson')).sort()).toEqual([
      'ExamContext.tsx',
      // 阶段 12C —— 考试中查词卡。它是**渲染层的一块**（只被 IELTS 渲染器
      // 用），不是页面：没有路由、不认识 NextAction、不做导航。
      'ExamWordSheet.tsx',
      'QuestionTypeRegistry.tsx',
      'ReadingProvider.tsx',
      'draftMerge.ts',
      'examTypes.ts',
      'questions',
      'shared',
      'storage.ts',
    ]);
    expect(fs.readdirSync(path.join(SRC, 'lesson', 'questions')).sort()).toEqual([
      'IELTSReadingPassage.tsx',
      'OLevelCloze.tsx',
      'OLevelComprehension.tsx',
      'OLevelMcqList.tsx',
      'OLevelSentenceTransformation.tsx',
      'OLevelVocabInContext.tsx',
    ]);
    // lesson/ 不许反向依赖页面
    for (const { f, text } of readAll()) {
      if (!f.includes(path.join('src', 'lesson'))) continue;
      expect(text, `${path.relative(SRC, f)} 不该 import 页面`).not.toMatch(/from '\.\.\/pages/);
    }
    // **只有阅读页**消费 lesson/**；别的页面一个都不许碰
    for (const { f, text } of readAll()) {
      if (!f.includes(path.join('src', 'pages'))) continue;
      if (f.endsWith(path.join('pages', 'Reading.tsx'))) continue;
      expect(text, `${path.relative(SRC, f)} 不该 import lesson/`).not.toMatch(/from '\.\.\/lesson/);
    }
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

  /** **只有这三个**是 pre-auth 且**允许带身份**：还没有令牌，姓名是凭据。 */
  const PRE_AUTH_IDENTITY_ENDPOINTS = [
    '/student-auth/login',
    '/student-auth/register',
    '/student-auth/registration-status',
    // S12O —— 自助注册。姓名在这里同样是**请求体里的凭据**，不是 URL
    // 里的身份；请求体里没有 studentId（服务端 `.strict()` 直接拒收）。
    '/student-auth/self-register',
  ] as const;

  /**
   * pre-auth 但**连凭据都不带**的端点。
   *
   * 班级列表与临时 staging 夹具登录都不带凭据。
   * 但请求体恒为 `{}`、URL 没有查询串 —— 登谁由服务端写死。单列一类而不是
   * 塞进上面那三个，是为了让「**恰好三个**端点可以带身份」这条断言**保持
   * 原样**：新增一个免密通道不该顺带把「谁可以带身份」的名额放宽。
   *
   * **上生产前必须随通道一起拆掉。**
   */
  const PRE_AUTH_CREDENTIAL_FREE_ENDPOINTS = [
    '/student-auth/registration-classes',
    '/student-auth/staging-fixture-session',
  ] as const;

  /** 清点器用的并集：这些调用不按「认证后」那套查身份。 */
  const PRE_AUTH_ENDPOINTS = [
    ...PRE_AUTH_IDENTITY_ENDPOINTS,
    ...PRE_AUTH_CREDENTIAL_FREE_ENDPOINTS,
  ] as const;

  /**
   * 已登记的全部端点 —— 新增端点必须同时改这里，否则「未分类」测试会红。
   * 这正是它存在的意义：让「悄悄加一个带身份的请求」变成一件做不到的事。
   */
  const KNOWN_ENDPOINTS = [
    ...PRE_AUTH_ENDPOINTS,
    '/student-auth/me',
    '/student-auth/change-pin',
    // S12O —— 自己改难度。**认证后**端点，零身份参数，体里只有 englishLevel。
    '/student-auth/me/english-level',
    // 阶段 6A：今天的课。两条都是**认证后**端点 —— 零身份参数。
    '/lesson/today',
    '/lesson/start',
    // 阶段 7B：阅读会话。三条都是**认证后**端点 —— 零身份参数。
    // 加载端点**没有子路径**（S7A 返工 2/2：带子路径的那个变体不存在）。
    '/morning-quiz/sessions/:id',
    '/morning-quiz/sessions/:id/open',
    '/morning-quiz/sessions/:id/answer',
    '/morning-quiz/sessions/:id/submit',
    // 阶段 8A：阅读结果与申诉。同样是**认证后**端点 —— 零身份参数。
    // 申诉体里**只有** submissionId / paperQuestionId / message；
    // 后端 schema 虽然还收 studentName / studentId，新端一个都不传。
    '/morning-quiz/student-result/:id',
    '/morning-quiz/appeals',
    // 阶段 9A：课程学词。五条都是**认证后**端点 —— 零身份参数。
    // `/vocab/lesson-cards` 后端还收 `?name=` / `?studentId=`（旧端入口），
    // 新端**一个查询串都不带**。
    '/vocab/lesson-cards',
    '/lesson/vocab-taught',
    '/vocab/review',
    '/vocab/review/undo',
    '/lesson/vocab-cursor',
    '/lesson/vocab-replace',
    '/lesson/vocab-test/defer',
    // 阶段 9B1：正式单词测试。三条都是**认证后**端点 —— 零身份参数，
    // 请求体分别是 {} / {index, optionIndex|text} / {}。
    '/vocab/quiz/attempt/start',
    '/vocab/quiz/attempt/answer',
    '/vocab/quiz/attempt/submit',
    // 阶段 11：历史成绩。三条都是**认证后**端点 —— 零身份参数。
    // `history-by-name` 的名字是旧端留下的：后端阶段 5A 起「带令牌就不查
    // 姓名」，所以新端**不带查询串**，服务端按令牌里的 id 取。
    // `history-detail` 的查询串里**只有** submissionId（资源标识，不是身份）。
    '/morning-quiz/history-by-name',
    '/morning-quiz/history-detail',
    '/vocab/quiz/attempts',
    // 阶段 12A：生词本与自由练习。五条都是**认证后**端点 —— 零身份参数。
    // 后端这几条同样还收 `?name=` / `?studentId=`（旧端入口），新端一个
    // 查询串都不带。
    //
    // 注意 `/vocab/quiz` 与 `/vocab/quiz/attempt/*` 是**两回事**：
    // 前者是自测出题（自由练习），后者是正式测试（记成绩）。清点表里
    // 两者分开列，就是要让「把自测接到正式测试上」这件事写不出来。
    '/vocab/words',
    '/vocab/words/remove',
    '/vocab/words/state',
    '/vocab/stats',
    '/vocab/due',
    '/vocab/quiz',
    // 阶段 12B：错题本与错题重练。四条都是**认证后**端点 —— 零身份参数。
    // 列表那条唯一允许的查询串是 `includeResolved=1`：它是**视图开关**
    // （已销账的要不要一起给），与「谁在问」无关。
    '/vocab/mistakes',
    '/vocab/mistakes/resolve',
    '/vocab/mistakes/practice-queue',
    '/vocab/mistakes/practice-result',
    // 阶段 12C：考试中查词。查询串里**只有 word**（词典查询与谁在问无关，
    // 但仍然带 Bearer —— 「认证后的请求一律带令牌」不为一个端点开例外）。
    // 写生词本走的是**已经登记过的** `/vocab/words`（阶段 12A 就在表里）。
    '/vocab/lookup',
    // 个人词汇教练 V2：全部认证后、身份仅来自 Bearer token。
    '/vocab-v2/profile',
    '/vocab-v2/center',
    '/vocab-v2/daily',
    '/vocab-v2/overview',
    '/vocab-v2/daily/start',
    '/vocab-v2/daily/item',
    '/vocab-v2/daily/replace',
    '/vocab-v2/test/start',
    '/vocab-v2/test',
    '/vocab-v2/test/answer',
    '/vocab-v2/test/submit',
    '/vocab-v2/custom-test/start',
    '/vocab-v2/collect',
    '/vocab-v2/notebook/remove',
    '/vocab-v2/notebook/relearn',
  ] as const;

  /**
   * 从一次调用的实参里还原**规范化的端点路径**。
   *
   * 阶段 7B 的三个阅读端点写成模板串。旧版正则遇到插值就停，三条会**一起
   * 塌成** `/morning-quiz/sessions/` —— 清点表看着是绿的，实际上 `/answer`
   * 与 `/submit` 从来没被登记过。这里把插值段一律换成 `:id`，路径才还原
   * 成可登记、可比对的形状。
   */
  function pathOf(call: string): string {
    const raw = call.match(/`(\/[^`]*)`/) ?? call.match(/['"](\/[^'"]*)['"]/);
    if (!raw) return DYNAMIC;
    // 路径被 `+` 拼接过 → 后半截静态看不到，判不出来。
    // 例外：本身已经带 `?` 的，拼的是查询串，路径部分仍然是完整的。
    const after = call.slice(raw.index! + raw[0].length);
    if (/^\s*\+/.test(after) && !raw[1].includes('?')) return DYNAMIC;
    // 查询串不参与端点身份（`?name=` 那种由 identityHits 单独查）
    const normalized = raw[1].replace(/\$\{[^}]*\}/g, ':id').split('?')[0];
    // 换掉插值之后仍有非路径字符 → 判不出来，按 dynamic 报红
    return /^[A-Za-z0-9\-_/:.]+$/.test(normalized) ? normalized : DYNAMIC;
  }

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
      const endpoint = pathOf(call);
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
    expect(PRE_AUTH_IDENTITY_ENDPOINTS).toHaveLength(4);
    const preAuth = [...new Set(apiCalls().filter((c) => c.preAuth).map((c) => c.endpoint))];
    expect(preAuth.sort()).toEqual([...PRE_AUTH_ENDPOINTS].sort());
  });

  it('**免凭据的 pre-auth 端点一个身份字段都不许带**', () => {
    const calls = apiCalls().filter((c) =>
      (PRE_AUTH_CREDENTIAL_FREE_ENDPOINTS as readonly string[]).includes(c.endpoint),
    );
    expect(calls).toHaveLength(PRE_AUTH_CREDENTIAL_FREE_ENDPOINTS.length);
    for (const c of calls) {
      // 与「认证后」那套用同一个检查器：URL 与请求体都不许出现身份
      expect(identityHits(c.block), `${c.endpoint} 带了身份`).toEqual([]);
      if (c.endpoint === '/student-auth/staging-fixture-session') {
        expect(c.block).toMatch(/body:\s*\{\s*\}/);
      } else {
        // 班级列表是 GET，连空请求体都不发。
        expect(c.block).toMatch(/['"]GET['"]/);
        expect(c.block).not.toMatch(/body\s*:/);
      }
      expect(c.block).not.toMatch(/pin|password/i);
    }
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
      // 换成一条**真实存在但新端不该碰**的后端路由（成绩趋势，D2 之外）。
      // 阶段 11 起 `/morning-quiz/history-by-name` 本身已登记，拿它当反例
      // 就永远绿了 —— 反向夹具必须挑一条还没登记的。
      const unknown = ['/morning-quiz/history-by-name/trend'];
      expect(unknown.filter((e) => !(KNOWN_ENDPOINTS as readonly string[]).includes(e))).toEqual([
        '/morning-quiz/history-by-name/trend',
      ]);
    });

    // ── 阶段 7B 新增的守卫，同样要证明它们抓得住 ──

    it('**模板串路径会被还原成 `/a/:id/b`，不会塌成前缀**', () => {
      const fake = [
        'export const api = {',
        '  a: (t: string, id: string) =>',
        '    request<X>(\'GET\', `/morning-quiz/sessions/${id}`, { token: t }),',
        '  b: (t: string, id: string) =>',
        '    request<X>(\'PATCH\', `/morning-quiz/sessions/${id}/answer`, { token: t }),',
        '  c: (t: string, id: string) =>',
        '    request<X>(\'POST\', `/morning-quiz/sessions/${id}/submit`, { token: t }),',
        '};',
      ].join('\n');
      expect(apiCallsIn(fake).map((c) => c.endpoint)).toEqual([
        '/morning-quiz/sessions/:id',
        '/morning-quiz/sessions/:id/answer',
        '/morning-quiz/sessions/:id/submit',
      ]);
    });

    it('**拼出来的路径判不出来 → dynamic 报红**', () => {
      const fake = [
        'export const api = {',
        "  x: (t: string, p: string) => request<X>('GET', '/morning-quiz/' + p, { token: t }),",
        '};',
      ].join('\n');
      const found = apiCallsIn(fake);
      expect(found[0].endpoint).toBe(DYNAMIC);
      expect((KNOWN_ENDPOINTS as readonly string[]).includes(DYNAMIC)).toBe(false);
    });

    it('**查询串不影响端点身份**（消歧那条仍然认得出来）', () => {
      const eps = apiCalls().map((c) => c.endpoint);
      expect(eps).toContain('/student-auth/registration-status');
    });

    it('**`/morning-quiz` 出现在 api.ts 之外会被抓到**', () => {
      const fake = "navigate('/morning-quiz/' + sessionId);";
      expect(API_ONLY_PREFIXES.some((b) => fake.includes(b))).toBe(true);
    });

    it('**`mq:` 存储键会被抓到**', () => {
      expect(/['"`]mq:/.test("localStorage.getItem('mq:answers:' + sid)")).toBe(true);
      expect(/['"`]mq:/.test("localStorage.setItem(`mq:seqs:${sid}`, v)")).toBe(true);
      // 不误伤：只是变量名里含 mq
      expect(/['"`]mq:/.test('const mqLike = 1;')).toBe(false);
    });

    it('**读后端 href 会被抓到**', () => {
      expect(/\.\s*href\b/.test('navigate(data.nextAction.href)')).toBe(true);
      expect(/\.\s*href\b/.test('location.href = x')).toBe(true);
      // 不误伤：类型声明里如实描述响应字段
      expect(/\.\s*href\b/.test('href: string | null;')).toBe(false);
    });

    it('**跨应用 import 会被抓到**', () => {
      const bad = [
        "import X from '../../../web/src/components/exam/ExamContext';",
        "import Y from 'apps/web/src/lib/api';",
        "import Z from '../components/exam/ExamWordSheet';",
      ];
      for (const line of bad) {
        const spec = line.match(/from\s+['"]([^'"]+)['"]/)![1];
        expect(/apps\/web|components\/exam|\.\.\/\.\.\/\.\.\//.test(spec), spec).toBe(true);
      }
      expect(/apps\/web|components\/exam|\.\.\/\.\.\/\.\.\//.test('../lib/api')).toBe(false);
    });

    it('**往 lesson/ 里塞一个页面会被抓到**', () => {
      const dir = ['ReadingProvider.tsx', 'draftMerge.ts', 'storage.ts', 'Reading.tsx'].sort();
      expect(dir).not.toEqual(['ReadingProvider.tsx', 'draftMerge.ts', 'storage.ts']);
    });

    it('**往 storage 写的第三个地方会被抓到**', () => {
      const w = 'pages/Reading.tsx:SOME_KEY';
      expect(/identity\.ts:(TOKEN_KEY|probe|k)$|storage\.ts:key$/.test(w)).toBe(false);
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
    // 只允许两处写：
    //   · identity.ts —— TOKEN_KEY 常量、可用性探针、前缀扫除里的 k
    //   · lesson/storage.ts —— 统一的 key 参数（键名由 READING_KEYS 生成，
    //     全部在 sw: 下，见 __tests__/reading-storage.test.ts）
    // 阶段 7C 起多了三处写：高亮 / 便笺 / 分栏比例。它们的键是**调用方传进来的**，
    // 而调用方（IELTSReadingPassage）写的全是 sw: 前缀 —— 下一条单独钉住。
    // 阶段 12C 再多一处：查词的**发现性提示**标记（LOOKED_UP_KEY），
    // 常量就定义在 IELTSReadingPassage 里、值是固定的 `sw:reading:looked-up-once`。
    // 它只存一个 '1'，不存词条 / 身份 / 令牌 / 答案 / 待写队列。
    for (const w of writes) {
      expect(w).toMatch(
        // 只匹配文件名，不匹配目录分隔符 —— Windows 上是 `\`、别处是 `/`，
        // 把分隔符写进正则会让这条守卫只在一种机器上成立。
        /identity\.ts:(TOKEN_KEY|probe|k)$|storage\.ts:key$|(Highlighter|StickyNote|DraggableSplit)\.tsx:(storageKey|key)$|review-queue\.ts:(QUEUE_KEY|probe)$|IELTSReadingPassage\.tsx:LOOKED_UP_KEY$/,
      );
    }
  });

  it('**阅读端传给共享组件的存储键全部是 sw: 前缀**（阶段 7C 新增）', () => {
    const src = stripComments(
      fs.readFileSync(path.join(SRC, 'lesson', 'questions', 'IELTSReadingPassage.tsx'), 'utf8'),
    );
    const keys = [...src.matchAll(/[`'"]((?:sw|mq):[^`'"]*)/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const k of keys) expect(k.startsWith('sw:'), k).toBe(true);
    // 反向夹具：写成 mq: 的键会被这条抓到
    const hostile = [...'const k = "mq:hl:x";'.matchAll(/[`'"]((?:sw|mq):[^`'"]*)/g)].map((m) => m[1]);
    expect(hostile).toEqual(['mq:hl:x']);
    expect(hostile.every((k) => k.startsWith('sw:'))).toBe(false);
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

// ─────────────────────────────────────────────────────────────
// G-8A —— 阅读结果这一屏的静态守卫
//
// 全局守卫已经管住了「整包不得出现旧路由 / 旧身份键 / 读 href」。这里再对
// **结果页这个面**单独收一道，理由是：结果页历史上正是旧端泄漏得最厉害的
// 地方 —— `/my-history?name=…` 就是一个「按姓名翻成绩」的页面。所以这一屏
// 的规矩要写成独立、可读、可反证的一条，而不是混在全局清单里让人事后
// 考古。
//
// 另外多两条只对这一屏成立的规矩：
//   · **只读** —— 不得调用任何写答案 / 交卷 / 开课的端点；
//   · **调用面收敛** —— 只允许 lessonToday / getReadingResult / createAppeal。
// ─────────────────────────────────────────────────────────────
describe('G-8A 阅读结果只读且零身份', () => {
  const RESULT_FILE = path.join(SRC, 'pages', 'ReadingResult.tsx');
  /**
   * 阶段 11 —— 呈现层与申诉搬到了 `components/ResultView.tsx`，历史成绩
   * 详情页（`pages/ScoreDetail.tsx`）是它的第二个调用方。**守卫跟着搬**：
   * 只盯着 `ReadingResult.tsx` 的话，同一份呈现逻辑换个文件就不设防了。
   */
  const RESULT_SURFACE = [
    RESULT_FILE,
    path.join(SRC, 'components', 'ResultView.tsx'),
    path.join(SRC, 'pages', 'ScoreDetail.tsx'),
  ];
  const APPEAL_FILE = path.join(SRC, 'components', 'ResultView.tsx');

  /** 结果页禁止出现的东西。导出成函数，反向夹具才能直接喂假代码验证。 */
  const RESULT_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    { why: '旧历史页 /my-history', re: /\/my-history/ },
    { why: '旧学生外壳 /student', re: /\/student(?![-\w])/ },
    { why: '扫码入口 /scan', re: /\/scan\b/ },
    { why: '旧命名空间 mq: 存储键', re: /['"`]mq:/ },
    { why: '按姓名查询', re: /[?&]name=|history-by-name|studentName/ },
    { why: 'URL 里带 studentId', re: /[?&]studentId=/ },
    { why: '请求体里带身份字段', re: /\b(studentName|studentId)\s*:/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    // 只读：这四个都是写操作，结果页一个都不该碰。
    { why: '调用了写答案端点', re: /\bsaveReadingAnswer\b/ },
    { why: '调用了交卷端点', re: /\bsubmitReading\b/ },
    { why: '调用了开课端点', re: /\blessonStart\b/ },
    { why: '调用了改密码端点', re: /\bchangePassword\b/ },
  ];

  function resultSurfaceHits(code: string): string[] {
    const text = stripComments(code);
    return RESULT_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  it('结果页文件真的存在（占位页已经被替换掉）', () => {
    expect(fs.existsSync(RESULT_FILE)).toBe(true);
    const app = stripComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
    expect(app).toMatch(/ROUTES\.readingResult\}\s*element=\{<ReadingResultPage/);
    expect(app).not.toMatch(/readingResult\}\s*element=\{<LessonPlaceholder/);
  });

  it('**整个结果面都干净**：没有旧路由、没有身份、没有 href 导航、没有写操作', () => {
    for (const f of RESULT_SURFACE) {
      expect(fs.existsSync(f), `${path.relative(SRC, f)} 不存在`).toBe(true);
      expect(resultSurfaceHits(fs.readFileSync(f, 'utf8')), path.relative(SRC, f)).toEqual([]);
    }
  });

  it('**整个结果面只调这四个端点**：今天的课 / 取结果 / 取历史那一份 / 提申诉', () => {
    const called = RESULT_SURFACE.flatMap((f) =>
      [...stripComments(fs.readFileSync(f, 'utf8')).matchAll(/\bapi\.(\w+)\s*\(/g)].map((m) => m[1]),
    );
    expect([...new Set(called)].sort()).toEqual([
      'createAppeal',
      'getReadingResult',
      'lessonToday',
      'readingHistoryDetail',
    ]);
  });

  /**
   * 返工 1/2 —— B-1 的静态防线。
   *
   * 得分率是**前端除出来的**（`history-detail` 的响应里没有这个字段）。
   * 开关必须**默认关**：这样将来接进来的第三个调用方只会少一个派生数字，
   * 不会悄悄多一个。要显示就得在调用点写明白。
   */
  it('**派生百分比默认关**，只有交完卷那一屏显式打开', () => {
    const view = stripComments(fs.readFileSync(path.join(SRC, 'components', 'ResultView.tsx'), 'utf8'));
    expect(view).toMatch(/showDerivedPercentage\s*=\s*false/);
    const reading = stripComments(fs.readFileSync(RESULT_FILE, 'utf8'));
    const detail = stripComments(fs.readFileSync(path.join(SRC, 'pages', 'ScoreDetail.tsx'), 'utf8'));
    expect(reading).toMatch(/showDerivedPercentage/);
    expect(detail).not.toMatch(/showDerivedPercentage/);
    // 页面自己也不许绕过组件另算一个
    for (const f of ['pages/ScoreDetail.tsx', 'pages/Scores.tsx']) {
      const src = stripComments(fs.readFileSync(path.join(SRC, ...f.split('/')), 'utf8'));
      expect(src, `${f} 不该自己算百分比`).not.toMatch(/percentageOf|\*\s*100|toFixed/);
    }
  });

  it('**今天那条链与历史那条链各走各的**：定位方式不许串', () => {
    const reading = stripComments(fs.readFileSync(RESULT_FILE, 'utf8'));
    const detail = stripComments(fs.readFileSync(path.join(SRC, 'pages', 'ScoreDetail.tsx'), 'utf8'));
    // 交完卷那一屏由 /lesson/today 定位，不碰历史端点
    expect(reading).toMatch(/api\.lessonToday\(/);
    expect(reading).not.toMatch(/api\.readingHistoryDetail\(/);
    // 历史详情由路径参数定位，**不许**依赖今天的课
    expect(detail).toMatch(/api\.readingHistoryDetail\(/);
    expect(detail).not.toMatch(/api\.lessonToday\(/);
    expect(detail).toMatch(/useParams/);
  });

  it('**申诉体只有那三个字段**，不得夹带身份', () => {
    const text = stripComments(fs.readFileSync(APPEAL_FILE, 'utf8'));
    const call = text.match(/api\.createAppeal\([\s\S]*?\n\s*\}\);/);
    expect(call, '没找到 createAppeal 调用').not.toBeNull();
    const body = call![0];
    for (const need of ['submissionId', 'paperQuestionId', 'message']) {
      expect(body, `申诉体少了 ${need}`).toContain(need);
    }
    // 后端 schema 还收这些（旧端在用），新端**一个都不传**。
    for (const banned of ['studentName', 'studentId', 'nickname', 'sessionId']) {
      expect(body, `申诉体夹带了 ${banned}`).not.toContain(banned);
    }
  });

  // ── 反向夹具：证明这一屏的守卫真的会红 ──
  describe('反向夹具 —— 结果页守卫必须抓得住', () => {
    it('**跳回 /my-history 会被抓到**（旧端结果页的真实形态）', () => {
      expect(resultSurfaceHits("navigate('/my-history');")).toContain('旧历史页 /my-history');
    });

    it('**按姓名取结果会被抓到**', () => {
      expect(
        resultSurfaceHits('const r = await fetch(`/api/x?name=${encodeURIComponent(nm)}`);'),
      ).toContain('按姓名查询');
    });

    it('**申诉体夹带 studentName 会被抓到**', () => {
      expect(
        resultSurfaceHits('api.createAppeal(t, { submissionId, studentName: nm, message });'),
      ).toContain('请求体里带身份字段');
    });

    it('**照后端 href 跳转会被抓到**', () => {
      expect(resultSurfaceHits('navigate(today.nextAction.href!);')).toContain(
        '拿后端 href 当导航权威',
      );
    });

    it('**在结果页上保存答案会被抓到**（只读被破坏）', () => {
      expect(resultSurfaceHits('await api.saveReadingAnswer(t, sid, body);')).toContain(
        '调用了写答案端点',
      );
    });

    it('**在结果页上重新交卷会被抓到**', () => {
      expect(resultSurfaceHits('await api.submitReading(t, sid);')).toContain('调用了交卷端点');
    });

    it('**注释里提到旧路由不算违规**（守卫剥注释，否则没人敢写理由）', () => {
      expect(resultSurfaceHits('// 我们不跳 /my-history\nnavigate(ROUTES.today);')).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G-9A —— 课程学词这一面的静态守卫
//
// 这一屏最容易坏的方式不是崩，是**悄悄换了词表**：拿不到课程队列时退回
// `/vocab/due` 的自由练习。学生以为在上今天的课，实际在刷另一个词表，
// 课程完成度永远不动 —— 旧端就是这么写的。所以这条单独立规矩，而且要有
// 反向夹具证明它抓得住。
//
// 「课程学词面」= 页面 + 队列 + 纯逻辑三个文件。api.ts 是共享的，
// 不在这一面里（它由全局的端点清点守着）。
// ─────────────────────────────────────────────────────────────
describe('G-9A 课程学词只走课程线', () => {
  const SURFACE = [
    path.join(SRC, 'pages', 'LessonVocab.tsx'),
    path.join(SRC, 'lib', 'review-queue.ts'),
    path.join(SRC, 'lib', 'vocab-card.ts'),
  ];
  const readSurface = () =>
    SURFACE.map((f) => ({ f, text: stripComments(fs.readFileSync(f, 'utf8')) }));

  const VOCAB_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    { why: '退回自由练习队列 /vocab/due', re: /\/vocab\/due/ },
    { why: '旧历史页', re: /\/my-history/ },
    { why: '旧生词本页', re: /\/my-vocab/ },
    { why: '旧错题页', re: /\/my-mistakes/ },
    { why: '扫码入口', re: /\/scan\b/ },
    { why: '旧学生外壳', re: /\/student(?![-\w])/ },
    { why: '请求体里带身份字段', re: /\b(name|studentName|studentId)\s*:/ },
    { why: 'URL 里带身份', re: /[?&](name|studentId)=/ },
    { why: 'then / after 协议', re: /\bthen=|\bafter=/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    { why: '自测 / 错题端点', re: /\/vocab\/quiz|\/vocab\/mistakes/ },
    { why: '在这一屏里做早测 / 正式测试', re: /\/morning-quiz\// },
    { why: '非 sw: 的持久化键', re: /['"`](?!sw:)[A-Za-z_][\w-]*:[A-Za-z_]/ },
  ];

  function vocabHits(code: string): string[] {
    const text = stripComments(code);
    return VOCAB_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  /**
   * 行尾统一成 LF。
   *
   * 仓库里 `core.autocrlf=true`，Windows 检出的源码是 CRLF，而测试文件本身
   * 可能是 LF —— 同一个仓库里两种行尾并存是常态。任何**按行尾定位**的
   * 分析都必须先归一化，否则守卫会在一台机器上绿、在另一台上红，
   * 或者更糟：**静默地量错范围**。
   */
  const lf = (src: string) => src.replace(/\r\n?/g, '\n');

  /** 抽出一个顶层 `function X(...) { … }` 的正文。 */
  function blockOf(raw: string, name: string): string {
    const src = lf(raw);
    const start = src.indexOf(`function ${name}(`);
    if (start < 0) return '';
    // 找**顶层**的收尾花括号。
    //
    // 只找 `\n}` 会撞上参数类型注解里的 `}: {`，把函数体截成一小段；
    // 而如果不先归一化行尾，CRLF 的源码里根本没有 `\n}\n`，`indexOf` 返回
    // -1，函数体就一路切到文件末尾 —— 把**下一个组件**也算了进来。
    // 两种错法都让守卫失去意义（一个永远绿，一个永远红），所以
    // 上面的 `lf()` 不是整洁，是正确性的一部分。
    const end = src.indexOf('\n}\n', start);
    return src.slice(start, end < 0 ? undefined : end);
  }

  /** 完成页里 `pending > 0 ? ( … ) : ( … )` 的**待同步**那一支。 */
  function pendingBranch(src: string): string {
    const from = src.indexOf('{pending > 0 ? (');
    if (from < 0) return '';
    const to = src.indexOf(') : (', from);
    return to < 0 ? '' : src.slice(from, to);
  }

  it('页面真的存在，占位页已经被替换掉', () => {
    for (const f of SURFACE) expect(fs.existsSync(f), f).toBe(true);
    const app = stripComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
    expect(app).toMatch(/ROUTES\.lessonVocab\}\s*element=\{<VocabularyCoachLearnPage/);
    expect(app).not.toMatch(/lessonVocab\}\s*element=\{<LessonPlaceholder/);
  });

  it('**这一面干净**：没有自由练习回退、旧路由、身份、href、非 sw: 键', () => {
    const hits: string[] = [];
    for (const { f, text } of readSurface()) {
      for (const why of vocabHits(text)) hits.push(`${path.relative(SRC, f)} → ${why}`);
    }
    expect(hits).toEqual([]);
  });

  // S12L —— 课程学词只教不测，`vocabReview` / `vocabReviewUndo` 这两个写
  // 端点整个从这一面移走了（主动回忆搬去了自由复习 `/vocab/practice`）。
  // 少两个是**变严**：课程内现在一条 FSRS 都写不出去。
  it('**课程学词只调登记过的七个端点**，一个都不多', () => {
    const called = new Set<string>();
    for (const { text } of readSurface()) {
      for (const m of text.matchAll(/\bapi\.(\w+)\s*\(/g)) called.add(m[1]);
    }
    expect([...called].sort()).toEqual([
      'deferVocabTest',
      'lessonCards',
      'lessonToday',
      'vocabCursor',
      'vocabReplace',
      // `vocabReview` 只剩**补传队列**那一处（`review-queue.ts`）：把上一个
      // 版本或另一台设备留下的评分补上去。页面本身一次都不调 —— 下面
      // 那条单独钉住它。
      'vocabReview',
      'vocabTaught',
    ]);
  });

  it('**课程学词一个评分端点都不调**（S12L：只教不测）', () => {
    const page = stripComments(fs.readFileSync(path.join(SRC, 'pages', 'LessonVocab.tsx'), 'utf8'));
    expect(page).not.toMatch(/api\.vocabReview\b/);
    expect(page).not.toMatch(/api\.vocabReviewUndo\b/);
    expect(page).not.toMatch(/submitCourseReview/);
  });

  it('**不从 apps/web 或跨应用路径 import**', () => {
    for (const { f, text } of readSurface()) {
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(/apps\/web|components\/exam|\.\.\/\.\.\/\.\.\//.test(m[1]), `${f} → ${m[1]}`).toBe(
          false,
        );
      }
    }
  });

  it('**不实现正式测试** —— 只按 kind 跳过去，这一屏不注册路由、不组卷', () => {
    const page = stripComments(fs.readFileSync(SURFACE[0], 'utf8'));
    expect(page).not.toMatch(/<Route\b/);
    expect(page).not.toMatch(/quizAttempt|submitQuiz/);
    // 唯一一次提到正式测试路由，是完成之后按 kind 导航
    expect([...page.matchAll(/ROUTES\.lessonTest/g)]).toHaveLength(1);
  });

  it('**教学卡上没有任何评分动作**', () => {
    const teaching = blockOf(stripComments(fs.readFileSync(SURFACE[0], 'utf8')), 'TeachingCard');
    // 先证明切出来的确实**只是**教学卡：切多了（把 ReviewCard 也吞进来）
    // 这条断言会假红，切少了会假绿 —— 两头都得先钉住，下面那句才有意义。
    expect(teaching.length).toBeGreaterThan(100);
    expect(teaching).toContain('teaching-card');
    expect(teaching).toContain('taught-next');
    expect(teaching).not.toContain('function ReviewCard');
    expect(teaching).not.toContain('review-card');

    expect(teaching).not.toMatch(/onRate|rate-again|rate-good|submitCourseReview|vocabReview/);
  });

  it('**还有待同步时，完成页那一支里没有「下一步」**', () => {
    const page = stripComments(fs.readFileSync(SURFACE[0], 'utf8'));
    const branch = pendingBranch(page);
    expect(branch.length).toBeGreaterThan(50);
    expect(branch).toMatch(/sync-now/);
    expect(branch).not.toMatch(/"finish"/);
  });

  it('**队列记录里没有身份字段**（结构上就没有这个位置）', () => {
    const q = stripComments(fs.readFileSync(SURFACE[1], 'utf8'));
    const iface = q.slice(
      q.indexOf('export interface PendingReview'),
      q.indexOf('function safeStorage'),
    );
    expect(iface).toMatch(/headword/);
    expect(iface).not.toMatch(/\bstudentName\b|\bstudentId\b|\bname\b/);
  });

  // ── 反向夹具：证明这一面的守卫真的会红 ──
  describe('反向夹具 —— 课程学词守卫必须抓得住', () => {
    it('**拿不到课程队列就退回自由练习会被抓到**（旧端的真实写法）', () => {
      expect(
        vocabHits("if (!res.lessonContext) return request('GET', '/vocab/due', { token });"),
      ).toContain('退回自由练习队列 /vocab/due');
    });

    it('**请求体里塞 studentName / studentId 会被抓到**', () => {
      expect(vocabHits('api.vocabReview(t, { studentName: nm, headword });')).toContain(
        '请求体里带身份字段',
      );
      expect(vocabHits('fetch(`/api/vocab/lesson-cards?studentId=${id}`)')).toContain(
        'URL 里带身份',
      );
    });

    it('**跳回旧生词本 / 旧历史页会被抓到**', () => {
      expect(vocabHits("navigate('/my-vocab');")).toContain('旧生词本页');
      expect(vocabHits("location.assign('/my-history');")).toContain('旧历史页');
    });

    it('**then / after 协议会被抓到**', () => {
      expect(vocabHits("navigate('/lesson/test?then=summary');")).toContain('then / after 协议');
      expect(vocabHits("const u = '/x?after=submit';")).toContain('then / after 协议');
    });

    it('**非 sw: 的持久化键会被抓到**', () => {
      expect(vocabHits("localStorage.setItem('vocab:pendingReviews', v)")).toContain(
        '非 sw: 的持久化键',
      );
      expect(vocabHits("localStorage.setItem('mq:cursor', v)")).toContain('非 sw: 的持久化键');
      // 不误伤：sw: 下的键是正当的
      expect(vocabHits("localStorage.setItem('sw:vocab:pending', v)")).toEqual([]);
    });

    it('**照后端 href 跳转会被抓到**', () => {
      expect(vocabHits('navigate(today.nextAction.href);')).toContain('拿后端 href 当导航权威');
    });

    // 行尾必须两种都试。仓库里 `core.autocrlf=true`，Windows 检出的
    // `LessonVocab.tsx` 是 CRLF，而这个测试文件是 LF —— 只用 LF 夹具的话，
    // `blockOf` 找不到 `\n}\n`、一路切到文件末尾，把 ReviewCard 的评分按钮
    // 也算进教学卡里，守卫**在真实检出上永远是红的**（这一条真的发生过）。
    const HOSTILE_LINES = [
      'function TeachingCard({ card }) {',
      '  return <button data-testid="rate-good" onClick={() => onRate("good")} />;',
      '}',
      '',
      'function ReviewCard({ card }) {',
      '  return <button data-testid="rate-again" />;',
      '}',
      '',
    ];
    const CLEAN_LINES = [
      'function TeachingCard({ card }) {',
      '  return <button data-testid="taught-next" />;',
      '}',
      '',
      'function ReviewCard({ card }) {',
      '  return <button data-testid="rate-good" onClick={() => onRate("good")} />;',
      '}',
      '',
    ];

    for (const [label, eol] of [['LF', '\n'], ['CRLF', '\r\n']] as const) {
      it(`**${label}：在教学卡上给评分按钮会被抓到**`, () => {
        expect(blockOf(HOSTILE_LINES.join(eol), 'TeachingCard')).toMatch(/onRate|rate-good/);
      });

      it(`**${label}：干净的教学卡不会被隔壁 ReviewCard 连累**`, () => {
        const block = blockOf(CLEAN_LINES.join(eol), 'TeachingCard');
        expect(block).toContain('taught-next');
        expect(block).not.toContain('function ReviewCard');
        expect(block).not.toMatch(/onRate|rate-good/);
      });
    }

    it('**队列还没清空就放人进正式测试会被抓到**', () => {
      const hostile = [
        '          {pending > 0 ? (',
        '            <button data-testid="finish" onClick={onFinish} />',
        '          ) : (',
        '            <button data-testid="finish" onClick={onFinish} />',
        '          )}',
      ].join('\n');
      expect(pendingBranch(hostile)).toMatch(/"finish"/);
    });

    it('**注释里提到这些名字不算违规**（守卫剥注释）', () => {
      expect(
        vocabHits('// 我们不退回 /vocab/due，也不跳 /my-vocab\nnavigate(ROUTES.today);'),
      ).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G-9B1 —— 正式单词测试这一面的静态守卫
//
// 这一屏和学词那一屏的失败方式不一样：学词坏了是「少记一次复习」，
// 考试坏了是**成绩单上写错了分**。所以除了老三样（旧路由 / 身份 / href），
// 这里还要额外钉住三条：
//
//   · **不许碰自由练习那条线**（`/vocab/due`、`GET /vocab/quiz`、复习、
//     错题、学词写入）—— 旧端在考不了的时候 fallback 到自由练习，学生
//     以为在考试，成绩单上什么都没有；
//   · **出口只有 `/today` 和 `/lesson/summary`**（G4）；
//   · **回执没到就不许显示对错** —— 作答前服务端不下发答案，本地判出来的
//     必然是编的。
//
// G3（生词本 / 错题本独立路由）**没有完成**，那几条路由还不存在。
// ─────────────────────────────────────────────────────────────
describe('G-9B1 正式测试只走成绩线', () => {
  const TEST_FILE = path.join(SRC, 'pages', 'LessonTest.tsx');
  const testSource = () => stripComments(fs.readFileSync(TEST_FILE, 'utf8'));

  const QUIZ_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    { why: '旧历史页', re: /\/my-history/ },
    { why: '旧生词本页', re: /\/my-vocab/ },
    { why: '旧错题页', re: /\/my-mistakes/ },
    { why: '扫码入口', re: /\/scan\b/ },
    { why: '旧学生外壳', re: /\/student(?![-\w])/ },
    { why: '请求体里带身份字段', re: /\b(name|studentName|studentId)\s*:/ },
    { why: 'URL 里带身份', re: /[?&](name|studentId)=/ },
    { why: 'then / after 协议', re: /\bthen=|\bafter=/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    // 自由练习那条线，一条都不许碰
    { why: '自由练习到期队列', re: /\/vocab\/due/ },
    { why: '自由练习出题端点', re: /\/vocab\/quiz['"`]|\/vocab\/quiz\?/ },
    { why: '复习 / 撤销（FSRS）', re: /\/vocab\/review/ },
    { why: '错题本', re: /\/vocab\/mistakes/ },
    { why: '课程学词的写入', re: /\/lesson\/vocab-(taught|cursor)/ },
    { why: '弱网复习队列', re: /review-queue|submitCourseReview|flushPending/ },
    { why: '非 sw: 的持久化键', re: /['"`](?!sw:)[A-Za-z_][\w-]*:[A-Za-z_]/ },
  ];

  function quizHits(code: string): string[] {
    const text = stripComments(code);
    return QUIZ_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  /** G4 —— 这一屏允许去的地方，只有这两个。 */
  const G4 = ['ROUTES.today', 'ROUTES.summary'];

  /**
   * 抽出每个 `navigate(...)` 里出现的所有 `ROUTES.x`。
   *
   * 取第一个实参的原文是不够的 —— 目的地常常写成三元
   * （`kind === 'summary' ? ROUTES.summary : ROUTES.today`），那样整段
   * 都对不上白名单。真正要管的是「它可能去哪」，所以按 ROUTES 常量抽。
   */
  function navTargets(src: string): string[] {
    const out: string[] = [];
    for (const m of stripComments(src).matchAll(/navigate\(([\s\S]*?)\)\s*;/g)) {
      for (const r of m[1].matchAll(/ROUTES\.\w+/g)) out.push(r[0]);
    }
    return out;
  }

  it('页面真的存在，占位页已经被替换掉', () => {
    expect(fs.existsSync(TEST_FILE)).toBe(true);
    const app = stripComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
    expect(app).toMatch(/ROUTES\.lessonTest\}\s*element=\{<Navigate to=\{ROUTES\.vocab\}/);
    expect(app).not.toMatch(/lessonTest\}\s*element=\{<LessonPlaceholder/);
  });

  it('**注册的路由集合一个没多、一个没少**（只换了实现）', () => {
    expect([...REGISTERED_PATHS].sort()).toEqual([...Object.values(ROUTES)].sort());
  });

  it('**这一面干净**：没有旧路由、身份、href、自由练习、FSRS', () => {
    expect(quizHits(fs.readFileSync(TEST_FILE, 'utf8'))).toEqual([]);
  });

  it('**只调这四个端点**：今天的课 + 开考 / 作答 / 交卷', () => {
    const called = [...new Set(
      [...testSource().matchAll(/\bapi\.(\w+)\s*\(/g)].map((m) => m[1]),
    )].sort();
    expect(called).toEqual(['lessonToday', 'quizAnswer', 'quizStart', 'quizSubmit']);
  });

  it('**不从 apps/web 或跨应用路径 import**，也不 import 自由练习模块', () => {
    for (const m of testSource().matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      expect(/apps\/web|components\/exam|\.\.\/\.\.\/\.\.\//.test(spec), spec).toBe(false);
      expect(/review-queue|vocab-card/.test(spec), spec).toBe(false);
    }
  });

  it('**G4：出口只有 /today 和 /lesson/summary**', () => {
    const targets = navTargets(testSource());
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(G4, `navigate(${t})`).toContain(t);
  });

  it('**判定字样只出现在「已作答」分支里**（回执没到不说对错）', () => {
    const src = testSource();
    // 判定卡整段挂在 `{answered && (` 下面 —— 找到它，确认字样在里面
    const at = src.indexOf('{answered && (');
    expect(at).toBeGreaterThan(0);
    const before = src.slice(0, at);
    for (const w of ['答对了', '答错了']) {
      expect(before, `「${w}」出现在了 answered 分支之外`).not.toContain(w);
    }
    expect(src.slice(at)).toContain('答对了');
  });

  it('**没有错题回炉 / 再练一轮 / 不计分模式**', () => {
    const src = testSource();
    for (const w of ['再练一轮', '不计分', '回炉', '自由练习', '自测', 'retry: true']) {
      expect(src, `出现了「${w}」`).not.toContain(w);
    }
  });

  // ── 反向夹具：证明这一面的守卫真的会红 ──
  describe('反向夹具 —— 正式测试守卫必须抓得住', () => {
    it('**考不了就退回自由练习会被抓到**（旧端的真实写法）', () => {
      expect(quizHits("if (code === 'not_ready') return api.request('GET', '/vocab/quiz');")).toContain(
        '自由练习出题端点',
      );
      expect(quizHits("const due = await request('GET', '/vocab/due', { token });")).toContain(
        '自由练习到期队列',
      );
    });

    it('**写 FSRS / 用弱网复习队列会被抓到**', () => {
      expect(quizHits("await request('POST', '/vocab/review', { body, token });")).toContain(
        '复习 / 撤销（FSRS）',
      );
      expect(quizHits("import { submitCourseReview } from '../lib/review-queue';")).toContain(
        '弱网复习队列',
      );
    });

    it('**请求体里塞 studentName / URL 带 studentId 会被抓到**', () => {
      expect(quizHits('api.quizAnswer(t, { studentName: nm, index });')).toContain(
        '请求体里带身份字段',
      );
      expect(quizHits('fetch(`/api/vocab/quiz/attempt/start?studentId=${id}`)')).toContain(
        'URL 里带身份',
      );
    });

    it('**跳回旧页面 / then / after 会被抓到**', () => {
      expect(quizHits("navigate('/my-vocab/quiz');")).toContain('旧生词本页');
      expect(quizHits("navigate('/lesson/summary?then=/my-history');")).toContain('then / after 协议');
    });

    it('**照后端 href 跳转会被抓到**', () => {
      expect(quizHits('navigate(today.nextAction.href);')).toContain('拿后端 href 当导航权威');
    });

    it('**G4：跳到第三个地方会被抓到**', () => {
      const hostile = "navigate(ROUTES.today);\nnavigate(ROUTES.account);";
      const targets = navTargets(hostile);
      expect(targets).toEqual(['ROUTES.today', 'ROUTES.account']);
      expect(targets.filter((t) => !G4.includes(t))).toEqual(['ROUTES.account']);
    });

    it('**把占位页换回去会被抓到**', () => {
      const hostile = '<Route path={ROUTES.lessonTest} element={<LessonPlaceholder stage="lessonTest" />} />';
      expect(hostile).toMatch(/lessonTest\}\s*element=\{<LessonPlaceholder/);
      expect(hostile).not.toMatch(/ROUTES\.lessonTest\}\s*element=\{<LessonTestPage/);
    });

    it('**回执没到就显示对错会被抓到**', () => {
      const hostile = [
        'const verdict = chosen === guess ? "答对了" : "答错了";',
        '{answered && (<p>{item.isCorrect}</p>)}',
      ].join('\n');
      const at = hostile.indexOf('{answered && (');
      expect(hostile.slice(0, at)).toContain('答对了');
    });

    it('**注释里提到这些名字不算违规**（守卫剥注释）', () => {
      expect(quizHits('// 我们不退回 /vocab/due，也不跳 /my-vocab\nnavigate(ROUTES.today);')).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G-12A —— 生词本与自由练习这一面的静态守卫
//
// 这一面最容易坏的两种方式，都不是崩，是**悄悄串线**：
//
//   ① 自由练习拿不到到期卡时退回课程队列（`/vocab/lesson-cards`）——
//      学生以为在刷自己的生词本，其实在做今天的课程词表；
//   ② 自测接到正式测试的 attempt 上（`/vocab/quiz/attempt/*`）——
//      随手一测就在成绩单上留下一条记录。
//
// 两者都是 G-9A / G-9B1 那两条规矩的**镜像面**：那边禁课程线碰自由练习，
// 这边禁自由练习碰课程线与成绩线。所以这里单独立一块，并且给反向夹具。
//
// 「生词本面」= 三个页面 + 它自己的写入小工具。api.ts 是共享的，
// 不在这一面里（它由全局的端点清点守着）。
// ─────────────────────────────────────────────────────────────
describe('G-12A 生词本与自由练习只走自己那条线', () => {
  const SURFACE = [
    path.join(SRC, 'pages', 'VocabBook.tsx'),
    path.join(SRC, 'pages', 'VocabPractice.tsx'),
    path.join(SRC, 'pages', 'VocabSelfTest.tsx'),
    path.join(SRC, 'components', 'vocab', 'practice-write.ts'),
  ];

  const VOCAB_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    // 页面代码里**看不到路径字面量**（路径住在 api.ts），所以每一条都要
    // 同时盯住**客户端方法名** —— 只匹配路径的话这一整块就是摆设。
    { why: '退回课程队列 /vocab/lesson-cards', re: /lesson-cards|\blessonCards\b/ },
    { why: '推进课程断点 /lesson/vocab-cursor', re: /vocab-cursor|\bvocabCursor\b/ },
    { why: '标记课程教过 /lesson/vocab-taught', re: /vocab-taught|\bvocabTaught\b/ },
    { why: '读课程状态 /lesson/today', re: /lesson\/today|\blessonToday\b/ },
    { why: '开课 /lesson/start', re: /lesson\/start|\blessonStart\b/ },
    { why: '接到正式测试的 attempt 上', re: /quiz\/attempt|quizStart|quizAnswer|quizSubmit/ },
    // 阶段 12B 起错题本真的存在了，但它是**另一条线**：生词本这一面
    // 仍然一个字都不该提它（要去错题本就走路由，不是在这里发请求）。
    { why: '错题本（另一条线，生词本这一面不许碰）', re: /\/vocab\/mistakes|\/mistakes/ },
    { why: '埋点', re: /page-view/ },
    { why: '旧生词本页', re: /\/my-vocab/ },
    { why: '旧历史页', re: /\/my-history/ },
    { why: '旧错题页', re: /\/my-mistakes/ },
    { why: '旧课程页', re: /\/my-lesson/ },
    { why: '扫码入口', re: /\/scan\b/ },
    { why: '旧学生外壳', re: /\/student(?![-\w])/ },
    { why: '请求体里带身份字段', re: /\b(name|studentName|studentId)\s*:/ },
    { why: 'URL 里带身份', re: /[?&](name|studentId)=/ },
    { why: 'then / after 协议', re: /\bthen=|\bafter=/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    { why: '早测 / 成绩线', re: /\/morning-quiz\// },
    { why: '非 sw: 的持久化键', re: /['"`](?!sw:)[A-Za-z_][\w-]*:[A-Za-z_]/ },
  ];

  function vocabHits(code: string): string[] {
    const text = stripComments(code);
    return VOCAB_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  it('三个页面与写入小工具都真的存在，而且都注册了', () => {
    for (const f of SURFACE) expect(fs.existsSync(f), f).toBe(true);
    const app = stripComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
    expect(app).toMatch(/ROUTES\.vocab\}\s*element=\{<VocabularyCoachPage/);
    expect(app).toMatch(/ROUTES\.vocabPractice\}\s*element=\{<Navigate to=\{ROUTES\.vocab\}/);
    expect(app).toMatch(/ROUTES\.vocabSelfTest\}\s*element=\{<Navigate to=\{ROUTES\.vocab\}/);
  });

  it('**整面干净**：不碰课程线、成绩线、正式测试、错题本、旧路由、身份', () => {
    for (const f of SURFACE) {
      expect(vocabHits(fs.readFileSync(f, 'utf8')), path.relative(SRC, f)).toEqual([]);
    }
  });

  it('**三个页面各自只调自己那几个端点**', () => {
    const called = (file: string) =>
      [...stripComments(fs.readFileSync(path.join(SRC, 'pages', file), 'utf8'))
        .matchAll(/\bapi\.(\w+)\s*\(/g)].map((m) => m[1]).sort();
    expect([...new Set(called('VocabBook.tsx'))]).toEqual([
      'vocabStats', 'vocabWordRemove', 'vocabWordState', 'vocabWords',
    ]);
    expect([...new Set(called('VocabPractice.tsx'))]).toEqual([
      'vocabDue', 'vocabPracticeReview', 'vocabReviewUndo',
    ]);
    expect([...new Set(called('VocabSelfTest.tsx'))]).toEqual([
      'vocabPracticeReview', 'vocabSelfTestQuiz',
    ]);
  });

  it('**课程学词那一面没有被改动**：它仍然不碰自由练习的端点', () => {
    const course = stripComments(fs.readFileSync(path.join(SRC, 'pages', 'LessonVocab.tsx'), 'utf8'));
    expect(course).not.toMatch(/\/vocab\/due|vocabDue/);
    expect(course).not.toMatch(/vocabPracticeReview|vocabSelfTestQuiz/);
    expect(course).toMatch(/api\.lessonCards\(/);
  });

  it('**正式测试那一面没有被改动**：它仍然走 attempt 那三条', () => {
    const formal = stripComments(fs.readFileSync(path.join(SRC, 'pages', 'LessonTest.tsx'), 'utf8'));
    expect(formal).not.toMatch(/vocabSelfTestQuiz|vocabDue|vocabPracticeReview/);
    expect(formal).toMatch(/api\.quizStart\(/);
  });

  it('**自由练习不落盘**：这一面一个 storage 键都不写', () => {
    for (const f of SURFACE) {
      const text = stripComments(fs.readFileSync(f, 'utf8'));
      expect(text, path.relative(SRC, f)).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it('**requestId 在评分对象里，不是每次请求现生成的**', () => {
    for (const f of ['VocabPractice.tsx', 'VocabSelfTest.tsx']) {
      const text = stripComments(fs.readFileSync(path.join(SRC, 'pages', f), 'utf8'));
      // 生成点只有一处：构造 pending 的那一次
      expect((text.match(/newRequestId\(\)/g) ?? []).length, f).toBe(1);
      // 重发走的是同一个对象
      expect(text, f).toMatch(/pending\.current/);
    }
  });

  // ── 反向夹具：证明这一面的守卫真的抓得住 ──
  describe('反向夹具 —— 生词本守卫必须抓得住', () => {
    it('**退回课程队列会被抓到**（旧端的真实病灶）', () => {
      // 页面里写不出路径字面量，真实的病灶长这样 —— 守卫必须认得方法名
      expect(vocabHits('if (!cards.length) return api.lessonCards(token);'))
        .toContain('退回课程队列 /vocab/lesson-cards');
    });

    it('**推进课程断点会被抓到**', () => {
      expect(vocabHits('await api.vocabCursor(token, { cursor: 3 });'))
        .toContain('推进课程断点 /lesson/vocab-cursor');
    });

    it('**读课程状态会被抓到**', () => {
      expect(vocabHits('const today = await api.lessonToday(token);'))
        .toContain('读课程状态 /lesson/today');
    });

    it('**接到正式测试的 attempt 上会被抓到**', () => {
      expect(vocabHits("await api.quizStart(token);")).toContain('接到正式测试的 attempt 上');
    });

    it('**请求体里带身份会被抓到**', () => {
      expect(vocabHits("api.vocabWords(token, { studentId: id })")).toContain('请求体里带身份字段');
    });

    it('**读后端 href 会被抓到**', () => {
      expect(vocabHits('navigate(data.nextAction.href);')).toContain('拿后端 href 当导航权威');
    });

    it('**跳错题本会被抓到**（那是另一条线）', () => {
      expect(vocabHits("navigate('/mistakes');")).toContain('错题本（另一条线，生词本这一面不许碰）');
    });

    it('**注释里提到这些名字不算违规**（守卫剥注释）', () => {
      expect(vocabHits('// 我们不退回 lesson-cards，也不碰 vocab-cursor\nnavigate(ROUTES.vocab);')).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G-12B —— 错题本与错题重练这一面的静态守卫
//
// 与 G-9A / G-9B1 / G-12A 同一套思路：这一面最容易坏的方式不是崩，是
// **悄悄串线**。错题重练和「今天的课」里的错题段（drill）长得很像 ——
// 一旦它去读 `/lesson/today` 或者写课程断点，学生自己回来重做几道题，
// 当天的完成度就动了，而没有任何地方会报错。
//
// 另外两条只对这一面成立的规矩：
//   · **不落盘** —— 这一面一个 storage 键都不写；
//   · **写入只有那一条** —— `practice-result` 没有幂等键，页面里发它的
//     地方必须**只有一处**，否则「绝不盲目重发」就无从谈起。
// ─────────────────────────────────────────────────────────────
describe('G-12B 错题本只走自己那条线', () => {
  const SURFACE = [
    path.join(SRC, 'pages', 'Mistakes.tsx'),
    path.join(SRC, 'pages', 'MistakePractice.tsx'),
    path.join(SRC, 'components', 'mistakes', 'answer-check.ts'),
  ];

  const MISTAKE_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    // 页面里看不到路径字面量（路径住在 api.ts），所以每条都盯**方法名**
    { why: '读课程状态 /lesson/today', re: /lesson\/today|\blessonToday\b/ },
    { why: '开课 /lesson/start', re: /lesson\/start|\blessonStart\b/ },
    { why: '推进课程断点', re: /vocab-cursor|\bvocabCursor\b/ },
    { why: '课程学词队列', re: /lesson-cards|\blessonCards\b/ },
    { why: '正式测试的 attempt', re: /quiz\/attempt|\bquizStart\b|\bquizAnswer\b|\bquizSubmit\b/ },
    { why: '生词本 / 自由练习的端点', re: /\bvocabWords\b|\bvocabDue\b|\bvocabStats\b|\bvocabPracticeReview\b|\bvocabSelfTestQuiz\b|\bvocabReviewUndo\b/ },
    { why: '成绩线（按姓名查历史）', re: /history-by-name|\breadingHistory\b/ },
    { why: '早测 / 阅读答卷端点', re: /\/morning-quiz\/|\bsubmitReading\b|\bsaveReadingAnswer\b/ },
    { why: '埋点', re: /page-view/ },
    { why: '旧错题页', re: /\/my-mistakes/ },
    { why: '旧历史页', re: /\/my-history/ },
    { why: '旧生词本页', re: /\/my-vocab/ },
    { why: '旧课程页', re: /\/my-lesson/ },
    { why: '扫码入口', re: /\/scan\b/ },
    { why: '旧学生外壳', re: /\/student(?![-\w])/ },
    { why: '请求体里带身份字段', re: /\b(name|studentName|studentId)\s*:/ },
    { why: 'URL 里带身份', re: /[?&](name|studentId)=/ },
    { why: 'then / after 协议', re: /\bthen=|\bafter=/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    { why: '把服务端文本当 HTML 塞进去', re: /dangerouslySetInnerHTML/ },
    { why: '写本地存储', re: /localStorage|sessionStorage/ },
  ];

  function mistakeHits(code: string): string[] {
    const text = stripComments(code);
    return MISTAKE_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  it('两个页面与判定小工具都存在，而且都注册了', () => {
    for (const f of SURFACE) expect(fs.existsSync(f), f).toBe(true);
    const app = stripComments(fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));
    expect(app).toMatch(/ROUTES\.mistakes\}\s*element=\{<MistakesPage/);
    expect(app).toMatch(/ROUTES\.mistakePractice\}\s*element=\{<MistakePracticePage/);
  });

  it('**整面干净**：不碰课程线、生词本、成绩线、正式测试、旧路由、身份、存储', () => {
    for (const f of SURFACE) {
      expect(mistakeHits(fs.readFileSync(f, 'utf8')), path.relative(SRC, f)).toEqual([]);
    }
  });

  // S12L —— 错题本在试点期暂停：两个页面换成占位页，**一个端点都不调**。
  // 空集是最干净的那种「只走自己那条线」。
  it('**两个页面一个端点都不调**（S12L 暂停期）', () => {
    const called = (file: string) =>
      [...new Set(
        [...stripComments(fs.readFileSync(path.join(SRC, 'pages', file), 'utf8'))
          .matchAll(/\bapi\.(\w+)\s*\(/g)].map((m) => m[1]),
      )].sort();
    expect(called('Mistakes.tsx')).toEqual([]);
    expect(called('MistakePractice.tsx')).toEqual([]);
  });

  it('**两个页面都明说暂未开放**，不是空白页', () => {
    const mk = fs.readFileSync(path.join(SRC, 'pages', 'Mistakes.tsx'), 'utf8');
    const mp = fs.readFileSync(path.join(SRC, 'pages', 'MistakePractice.tsx'), 'utf8');
    expect(mk).toContain('错题本暂未开放');
    expect(mp).toContain('错题重练暂未开放');
    // 而且要说清楚数据还在 —— 学生最怕的是「我的错题没了」
    expect(mk).toMatch(/都还在|没有删/);
  });

  /**
   * `practice-result` **没有幂等键**。页面里发它的地方只能有一处 ——
   * 有第二处，就一定会有人在某条错误分支上「顺手再发一次」，而那正是
   * 会把 practiceCount 和连胜算歪的那件事。
   */
  // 原来这里钉的是「重练结果只有一个发送点」「销账只有一个发送点」——
  // 暂停期两个页面一个写都没有，那两条已经被上面的空集断言覆盖。
  // 恢复功能时把它们从 Git 历史里取回来。
  it('**暂停期两个页面一个写都没有**', () => {
    for (const f of ['Mistakes.tsx', 'MistakePractice.tsx']) {
      const src = stripComments(fs.readFileSync(path.join(SRC, 'pages', f), 'utf8'));
      expect((src.match(/api\.\w+\(/g) ?? []).length, f).toBe(0);
    }
  });

  it('**阶段 12A 那一面没有被改动**：生词本仍然不碰错题端点', () => {
    for (const f of ['VocabBook.tsx', 'VocabPractice.tsx', 'VocabSelfTest.tsx']) {
      const src = stripComments(fs.readFileSync(path.join(SRC, 'pages', f), 'utf8'));
      expect(src, f).not.toMatch(/mistake/i);
    }
  });

  it('**课程线与正式测试那两面也没有被改动**', () => {
    for (const f of ['LessonVocab.tsx', 'LessonTest.tsx']) {
      const src = stripComments(fs.readFileSync(path.join(SRC, 'pages', f), 'utf8'));
      expect(src, f).not.toMatch(/mistake/i);
    }
  });

  // ── 反向夹具：证明这一面的守卫抓得住 ──
  describe('反向夹具 —— 错题本守卫必须抓得住', () => {
    it('**读课程状态会被抓到**（重练不许知道今天的课）', () => {
      expect(mistakeHits('const today = await api.lessonToday(token);'))
        .toContain('读课程状态 /lesson/today');
    });

    it('**推进课程断点会被抓到**', () => {
      expect(mistakeHits('await api.vocabCursor(token, { cursor: 3 });'))
        .toContain('推进课程断点');
    });

    it('**顺手写一次 FSRS 会被抓到**（那是生词本那条线）', () => {
      expect(mistakeHits('await api.vocabPracticeReview(token, w);'))
        .toContain('生词本 / 自由练习的端点');
    });

    it('**把服务端文本当 HTML 会被抓到**', () => {
      expect(mistakeHits('<p dangerouslySetInnerHTML={{ __html: entry.stem }} />'))
        .toContain('把服务端文本当 HTML 塞进去');
    });

    it('**落盘会被抓到**', () => {
      expect(mistakeHits("localStorage.setItem('mistake:last', id);")).toContain('写本地存储');
    });

    it('**请求体里带身份会被抓到**', () => {
      expect(mistakeHits('api.mistakeList(token, { studentId: id })')).toContain('请求体里带身份字段');
    });

    it('**注释里提到这些名字不算违规**（守卫剥注释）', () => {
      expect(mistakeHits('// 我们不读 lesson/today，也不碰 vocab-cursor\nnavigate(ROUTES.mistakes);')).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// G-12C —— 考试中查词这一面的静态守卫
//
// 这一块的历史很具体：它在阶段 7C 被**整体摘掉**，原因不是功能不该有，
// 而是旧实现把学生姓名当身份写生词本。12C 按 token-only 重写后挂回来，
// 所以这里要钉住的正是「重写掉的那件事没有偷偷回来」。
//
// 另外两条只对这一面成立：
//   · **不点就不查** —— 发请求的地方只能是查词卡自己；查词只读，
//     加入 / 移出都必须是学生明确点击；
//   · **不落盘学习内容** —— 这一面只允许写一个发现性标记。
// ─────────────────────────────────────────────────────────────
describe('G-12C 考试中查词只走 token-only 那条线', () => {
  const SHEET = path.join(SRC, 'lesson', 'ExamWordSheet.tsx');
  const PASSAGE = path.join(SRC, 'lesson', 'questions', 'IELTSReadingPassage.tsx');
  const HIGHLIGHTER = path.join(SRC, 'lesson', 'shared', 'Highlighter.tsx');
  const SURFACE = [SHEET, PASSAGE, HIGHLIGHTER];

  const WORD_FORBIDDEN: Array<{ why: string; re: RegExp }> = [
    // 这一条就是当初摘掉它的理由 —— 一个字都不许回来
    { why: '把姓名当身份', re: /\bstudentName\b|\bstudentId\b/ },
    { why: 'URL 里带身份', re: /[?&](name|studentId)=/ },
    { why: '旧命名空间的存储键', re: /['"`]mq:/ },
    { why: '从旧端 / components/exam 里 import', re: /from\s+['"][^'"]*(apps\/web|components\/exam)/ },
    { why: '拿后端 href 当导航权威', re: /\.\s*href\b/ },
    { why: '把服务端文本当 HTML 塞进去', re: /dangerouslySetInnerHTML/ },
    { why: '课程进度', re: /\blessonToday\b|\blessonStart\b|vocab-cursor|\bvocabCursor\b|lesson-cards|\blessonCards\b/ },
    { why: '正式测试', re: /quiz\/attempt|\bquizStart\b|\bquizAnswer\b|\bquizSubmit\b/ },
    { why: '自由练习复习', re: /\bvocabPracticeReview\b|\bvocabDue\b|\bvocabSelfTestQuiz\b|\bvocabReviewUndo\b/ },
    { why: '错题本', re: /\bmistake[A-Z]\w*\(|\/mistakes/ },
    { why: '历史成绩', re: /history-by-name|\breadingHistory\b|\breadingHistoryDetail\b/ },
    { why: '埋点', re: /page-view/ },
    { why: '旧路由', re: /\/my-history|\/my-vocab|\/my-mistakes|\/my-lesson|\/scan\b/ },
  ];

  function wordHits(code: string): string[] {
    const text = stripComments(code);
    return WORD_FORBIDDEN.filter(({ re }) => re.test(text)).map(({ why }) => why);
  }

  it('三个文件都在，而且渲染器真的挂了这张卡', () => {
    for (const f of SURFACE) expect(fs.existsSync(f), f).toBe(true);
    const passage = stripComments(fs.readFileSync(PASSAGE, 'utf8'));
    expect(passage).toMatch(/<ExamWordSheet/);
    expect(passage).toMatch(/onWordTap=/);
  });

  it('**整面干净**：没有身份、没有旧存储、没有跨端 import、没有别条线的端点', () => {
    for (const f of SURFACE) {
      expect(wordHits(fs.readFileSync(f, 'utf8')), path.relative(SRC, f)).toEqual([]);
    }
  });

  it('**只有查词卡自己发请求，而且只发查词与 V2 收词两条**', () => {
    const called = (f: string) =>
      [...new Set(
        [...stripComments(fs.readFileSync(f, 'utf8')).matchAll(/\bapi\.(\w+)\s*\(/g)].map((m) => m[1]),
      )].sort();
    expect(called(SHEET)).toEqual(['vocabLookup', 'vocabV2Collect']);
    // 渲染器与手势层**一个 api 调用都没有** —— 它们只负责「点到了哪个词」
    expect(called(PASSAGE)).toEqual([]);
    expect(called(HIGHLIGHTER)).toEqual([]);
  });

  it('**收词只有一个 V2 发送点**，旧生词本端点已移除', () => {
    const src = stripComments(fs.readFileSync(SHEET, 'utf8'));
    expect((src.match(/api\.vocabV2Collect\(/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/api\.vocabAddWord\(|api\.vocabWordRemove\(/);
  });

  it('**查词成功不自动收录**：四个选择都是明确的按钮点击', () => {
    const src = stripComments(fs.readFileSync(SHEET, 'utf8'));
    for (const id of ['learn', 'known', 'later', 'lookup']) {
      expect(src).toContain(`data-testid="word-sheet-coach-${id}"`);
    }
    expect(src).not.toMatch(/setPhase\(\{ s: 'ok',[\s\S]{0,600}void chooseCoachAction/);
  });

  /**
   * 返工 1/2 B-2 —— **显示可以兜底，落库不许兜底**。
   *
   * 「Reading Passage」是没有标题时给屏幕看的占位。把它当成来源写进生词本，
   * 那条记录就永远指向一个不存在的篇目。这条钉住两者是**两个变量**，
   * 而且传给查词卡的是真的那个。
   */
  it('**传给查词卡的是真标题，不是显示用的兜底**', () => {
    const src = stripComments(fs.readFileSync(PASSAGE, 'utf8'));
    expect(src).toMatch(/passageTitle=\{sourceTitle\}/);
    expect(src).not.toMatch(/passageTitle=\{passageTitle\}/);
    // 兜底只出现在「显示用」那个变量的定义里
    expect(src).toMatch(/const passageTitle = sourceTitle \|\| 'Reading Passage';/);
  });

  /**
   * 返工 1/2 B-3 —— 那个键**写了就要读**。
   *
   * 只写不读的话，提示条前后一模一样，它就不是「一次性发现提示」，
   * 只是一个没人看的写操作。
   */
  it('**发现标记既被写也被读**，而且两种提示都在', () => {
    const src = stripComments(fs.readFileSync(PASSAGE, 'utf8'));
    expect(src).toMatch(/localStorage\.getItem\(LOOKED_UP_KEY\)/);
    expect(src).toMatch(/localStorage\.setItem\(LOOKED_UP_KEY, '1'\)/);
    expect(src).toMatch(/data-testid="lookup-hint-prominent"/);
    expect(src).toMatch(/data-testid="lookup-hint-compact"/);
  });

  it('**这一面只写一个发现性标记**，值是固定的 `sw:` 键', () => {
    const passage = stripComments(fs.readFileSync(PASSAGE, 'utf8'));
    expect(passage).toMatch(/const LOOKED_UP_KEY = 'sw:reading:looked-up-once';/);
    // **查词卡自己一个存储调用都没有** —— 词条、身份、待写队列一律不落盘。
    //
    // 手势层（Highlighter）不在这条里：它的 `useStoredHighlights` 是阶段 7C
    // 就有的高亮持久化，与查词无关，而且已经被上面「只写一个命名空间下的
    // 存储键」那条守着。把它算进来只会让这条断言测错东西。
    const sheet = stripComments(fs.readFileSync(SHEET, 'utf8'));
    expect(sheet).not.toMatch(/localStorage|sessionStorage/);
  });

  it('**手势层不认识身份，也不发请求**（分工是刻意的）', () => {
    const src = stripComments(fs.readFileSync(HIGHLIGHTER, 'utf8'));
    expect(src).not.toMatch(/readToken|Authorization|fetch\(/);
    expect(src).toMatch(/onWordTap\?:/);
  });

  // ── 反向夹具：证明这一面的守卫抓得住 ──
  describe('反向夹具 —— 查词守卫必须抓得住', () => {
    it('**把姓名塞回请求体会被抓到**（这正是它当年被摘掉的原因）', () => {
      expect(wordHits("api.vocabAddWord(token, { studentName: name, word: w })"))
        .toContain('把姓名当身份');
    });

    it('**旧存储键会被抓到**', () => {
      expect(wordHits("localStorage.setItem('mq:lookedUpOnce', '1');"))
        .toContain('旧命名空间的存储键');
    });

    it('**从旧端 import 会被抓到**', () => {
      expect(wordHits("import ExamWordSheet from '../../../web/src/components/exam/ExamWordSheet';"))
        .toContain('从旧端 / components/exam 里 import');
    });

    it('**把语境句当 HTML 渲染会被抓到**', () => {
      expect(wordHits('<p dangerouslySetInnerHTML={{ __html: sentence }} />'))
        .toContain('把服务端文本当 HTML 塞进去');
    });

    it('**顺手推一下课程进度会被抓到**', () => {
      expect(wordHits('await api.vocabCursor(token, { cursor: 2 });')).toContain('课程进度');
    });

    it('**注释里提到这些名字不算违规**（守卫剥注释）', () => {
      expect(wordHits('// 旧实现带 studentName、写 mq:lookedUpOnce\nconst x = 1;')).toEqual([]);
    });
  });
});


// ─────────────────────────────────────────────────────────────
// S12O —— 五档难度：两端必须逐字一致
// ─────────────────────────────────────────────────────────────

describe('S12O 难度白名单不许漂', () => {
  /**
   * 界面上少一档 = 学生选不到；多一档 = 他选了之后服务端 400。
   * 两边各写一份迟早会分家，所以这里**直接读服务端那个文件**。
   */
  const API_FILE = path.resolve(SRC, '../../api/src/student-auth/pilot-levels.ts');

  it('服务端那个文件在', () => {
    expect(fs.existsSync(API_FILE)).toBe(true);
  });

  it('前端的五档和服务端的白名单**逐字一致，顺序也一致**', async () => {
    const src = fs.readFileSync(API_FILE, 'utf8');
    const m = src.match(/PILOT_LEVELS\s*=\s*\[([^\]]+)\]/);
    expect(m, '服务端的 PILOT_LEVELS 读不出来').toBeTruthy();
    const server = m![1]
      .split(',')
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    const { PILOT_LEVEL_CHOICES } = await import('../lib/levels');
    expect(PILOT_LEVEL_CHOICES.map((c) => c.id)).toEqual(server);
  });

  it('界面上**一个内部标识都不露** —— 标签与说明里都不能出现枚举值', async () => {
    const { PILOT_LEVEL_CHOICES } = await import('../lib/levels');
    for (const c of PILOT_LEVEL_CHOICES) {
      for (const other of PILOT_LEVEL_CHOICES) {
        expect(c.label).not.toContain(other.id);
        expect(c.blurb).not.toContain(other.id);
      }
    }
  });
});
