import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 身份组合点的**结构性清单** —— fail-closed。
 *
 * ## 它是什么，不是什么
 *
 * | 证据种类 | 在哪 | 证明什么 |
 * |---|---|---|
 * | 控制器 → 服务 | `token-only-runtime.spec.ts` | 真控制器 + 假服务：边界上的身份与响应 |
 * | 服务内部行为 | `service-identity-chain.spec.ts` | 真服务 + 假 Prisma：链**确实**跑得通 |
 * | **结构性清单（本文件）** | 这里 | 组合点**一个不漏地被清点并分类**，新增未分类的会红 |
 * | 实机部署 | —— | **仍未验证**（阶段 5B，未授权） |
 *
 * 本文件**不替代**行为证据。它回答的是另一个问题：「以后有人加了第三个
 * 组合点，会不会没人发现？」
 *
 * ## 上一版为什么是假守卫
 *
 * 上一版叫「服务调服务的身份点恰好两处」，实现却是：硬编码两个字符串，
 * 检查它们存在且附近出现过 `authStudentId`。它**从不枚举**真实的调用点，
 * 因此第三个组合点加进来照样全绿 —— 标题在说一件测试根本没做的事。
 * 反向夹具（本文件末尾）把这一点钉住了。
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

// ─────────────────────────────────────────────────────────────
// 扫描器 —— 纯函数，吃源码文本，便于用合成源码做反向夹具
// ─────────────────────────────────────────────────────────────

/** 已知的身份解析入口。 */
const RESOLVERS = new Set([
  'resolveStudent',
  'resolveStudentByName',
  'resolveByIdOrName',
  'resolveAuthenticatedStudent',
]);

/** 一个方法/调用是否与身份有关。 */
const IDENTITY_RE = /studentName|authStudentId|resolveStudent\b|resolveStudentByName|resolveByIdOrName|resolveAuthenticatedStudent/;

export type Callsite = {
  /** `文件 :: 方法 -> 被调者` —— 清单的主键 */
  key: string;
  file: string;
  method: string;
  callee: string;
  args: string;
  /** 调用点显式写出了 authStudentId */
  hasAuthArg: boolean;
  /** 展开了一个**声明了 authStudentId** 的入参对象（`...input`） */
  spreadsAuthInput: boolean;
  /**
   * **承载身份的那几个实参**根植于请求入参（input./body./p.data./raw*）。
   *
   * 只看身份位，不看整段实参 —— `audit.log` 的 metadata 里本来就该有请求
   * 内容（submissionId、留言原文），拿整段去判会把正确的调用判红。
   */
  rootedInRequest: boolean;
};

const REQUEST_ROOT = /\b(input|body|params|raw[A-Z]\w*|p\.data)\b/;

/**
 * 实参里**承载身份的位置**是否来自请求。
 *
 * 有 `studentName:` / `studentId:` / `actorId:` 这类键时只查这些键的值；
 * 一个身份键都没有时（`streakDays(student.id)` 这种位置参数），查整段。
 */
export function identityArgsRootedInRequest(args: string): boolean {
  const pairs = [...args.matchAll(/\b(studentName|studentId|actorId)\s*:\s*([^,}]+)/g)];
  if (pairs.length === 0) return REQUEST_ROOT.test(args);
  return pairs.some((m) => REQUEST_ROOT.test(m[2]));
}

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

/** 构造函数注入的成员：名字 → 类型。 */
function injectedMembers(src: string): Record<string, string> {
  const i = src.indexOf('constructor(');
  if (i < 0) return {};
  const args = balanced(src, src.indexOf('(', i));
  const out: Record<string, string> = {};
  for (const m of args.matchAll(/(?:private|public|protected)\s+readonly\s+(\w+)\??:\s*(\w+)/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * 枚举一个服务文件里**控制器边界之外**的身份组合调用点。
 *
 * 收的三类（与阶段 5 的定义一致）：
 *   ① 注入服务之间的调用（`this.<注入服务>.<方法>(…)`）；
 *   ② 同一服务内**重新进入身份解析方法**的调用；
 *   ③ 传递身份形状对象的调用。
 *
 * 排除项只走**显式分类**：Prisma 操作与日志在这里被排除（它们不是
 * 「服务组合」），其余一律进清单，由 MANIFEST 分类 —— 包括纯工具调用。
 */
export function scanCompositions(src: string, fileLabel: string): Callsite[] {
  const L = src.split('\n');
  const inj = injectedMembers(src);

  // 类内方法（两空格缩进）
  const marks: { i: number; name: string; sig: string }[] = [];
  L.forEach((line, i) => {
    const m = line.match(/^  (?:private |public |protected )?(?:async )?(\w+)\s*\(/);
    if (!m || m[1] === 'constructor') return;
    const rest = L.slice(i).join('\n');
    marks.push({ i, name: m[1], sig: balanced(rest, rest.indexOf('(')) });
  });

  // **推导**出「身份相关的方法」，而不是写死一张名单 ——
  // 新增一个吃身份的方法，它的内部调用会自动进清单。
  const identityMethods = new Set(
    marks.filter((mk) => IDENTITY_RE.test(mk.sig)).map((mk) => mk.name),
  );

  const out: Callsite[] = [];
  marks.forEach((mk, k) => {
    const end = k + 1 < marks.length ? marks[k + 1].i : L.length;
    const body = L.slice(mk.i, end).join('\n');
    if (!IDENTITY_RE.test(body)) return; // 与身份无关的方法整段跳过

    const pattern = /this\.(\w+)\.(\w+)\(|this\.(\w+)\(|(?<![\w.])(resolveAuthenticatedStudent)\(/g;
    for (const c of body.matchAll(pattern)) {
      const member = c[1] ?? null;
      const bare = c[3] ?? c[4] ?? null;
      let callee: string;
      if (member) {
        // 显式排除：Prisma 与日志不是「服务组合」
        if (inj[member] === 'PrismaService' || member === 'prisma' || member === 'logger') continue;
        callee = `${member}.${c[2]}`;
      } else {
        if (!bare) continue;
        // 同服务调用只有在重新进入身份方法时才算组合点
        if (!identityMethods.has(bare) && !RESOLVERS.has(bare)) continue;
        callee = bare;
      }
      const parenAt = c.index! + c[0].length - 1;
      const args = balanced(body, parenAt).replace(/\s+/g, ' ');
      const spread = args.match(/\.\.\.(\w+)/);
      out.push({
        key: `${fileLabel} :: ${mk.name} -> ${callee}`,
        file: fileLabel,
        method: mk.name,
        callee,
        args: args.length > 160 ? args.slice(0, 160) + '…' : args,
        hasAuthArg: /authStudentId/.test(args),
        spreadsAuthInput: Boolean(spread && /authStudentId/.test(mk.sig)),
        rootedInRequest: identityArgsRootedInRequest(args),
      });
    }
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
// 已审阅的分类清单
//
// 每一条都是人看过的结论。新增调用点必须在这里登记，否则测试红。
// ─────────────────────────────────────────────────────────────

type Klass =
  | 'identity_resolution'   // 在这里把身份解析成学生
  | 'identity_forwarding'   // 把身份继续传给下一跳
  | 'resolved_id_only'      // 只传已解析出来的库内 id
  | 'non_identity'          // 与身份无关
  | 'out_of_scope';         // 阶段 5 范围之外，只钉住不许悄悄改

type Entry = {
  key: string;
  klass: Klass;
  /** identity_resolution 专用：这一处**应当**带上认证身份吗 */
  expectAuth?: boolean;
  note: string;
};

const F_LESSON = 'lesson/lesson.service.ts';
const F_WORD = 'vocab/student-word.service.ts';
const F_REVIEW = 'vocab/vocab-review.service.ts';
const F_QUIZ = 'vocab/vocab-quiz.service.ts';
const F_ATTEMPT = 'vocab/vocab-quiz-attempt.service.ts';
const F_MQ = 'morning-quiz/morning-quiz.service.ts';

const MANIFEST: Entry[] = [
  // ── lesson ──
  { key: `${F_LESSON} :: getToday -> today`, klass: 'identity_forwarding', note: '`...input` 展开，签名声明了 authStudentId' },
  { key: `${F_LESSON} :: startOrResumeToday -> today`, klass: 'identity_forwarding', note: '同上' },
  { key: `${F_LESSON} :: today -> resolveAuthenticatedStudent`, klass: 'identity_resolution', expectAuth: true, note: '令牌路径：按精确 id 查人' },
  { key: `${F_LESSON} :: today -> resolveByIdOrName`, klass: 'identity_resolution', expectAuth: false, note: '**只在没有令牌时**才走到；带 authStudentId 会走上面那条' },
  { key: `${F_LESSON} :: resolveByIdOrName -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: false, note: '旧路径专用，两参数是有意的；这里出现 authStudentId 说明分支写错了' },
  { key: `${F_LESSON} :: markTaughtAndAdvance -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '第一次解析' },
  { key: `${F_LESSON} :: markTaughtAndAdvance -> startOrResumeToday`, klass: 'identity_forwarding', note: '**曾经在这里丢身份**：事务已提交、请求却 name_required' },
  { key: `${F_LESSON} :: saveVocabCursor -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '叶子，无二次解析' },
  { key: `${F_LESSON} :: classBoard -> getToday`, klass: 'resolved_id_only', note: '教师看板：姓名与 id 都取自库里那行，不在学生令牌链上' },

  // ── student-word ──
  { key: `${F_WORD} :: resolveStudent -> resolveAuthenticatedStudent`, klass: 'identity_resolution', expectAuth: true, note: '共享解析器的令牌分支' },
  { key: `${F_WORD} :: addWord -> resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '' },
  { key: `${F_WORD} :: addWord -> vocab.lookup`, klass: 'non_identity', note: '查词典，传的是单词不是人' },
  { key: `${F_WORD} :: removeWord -> resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '' },
  { key: `${F_WORD} :: listWords -> resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '' },

  // ── vocab-review ──
  ...['due', 'lessonCards', 'review', 'undo', 'stats'].map(
    (m): Entry => ({ key: `${F_REVIEW} :: ${m} -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '叶子' }),
  ),

  // ── vocab-quiz ──
  { key: `${F_QUIZ} :: buildQuiz -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '被 attempt.start 二次调用，必须自己也能吃令牌' },
  { key: `${F_QUIZ} :: buildQuiz -> review.streakDays`, klass: 'resolved_id_only', note: '传 student.id' },

  // ── vocab-quiz-attempt ──
  ...['start', 'current', 'answer', 'submit', 'history'].map(
    (m): Entry => ({ key: `${F_ATTEMPT} :: ${m} -> words.resolveStudent`, klass: 'identity_resolution', expectAuth: true, note: '第一次解析' }),
  ),
  { key: `${F_ATTEMPT} :: start -> quiz.buildQuiz`, klass: 'identity_forwarding', note: '**曾经在这里丢身份**：出题前失败，无脏数据但端点不可用' },

  // ── morning-quiz：只有 createAppeal 在阶段 5 范围内 ──
  { key: `${F_MQ} :: createAppeal -> resolveStudentByName`, klass: 'identity_resolution', expectAuth: true, note: '范围内的三个 mq 端点里唯一走服务解析的' },
  { key: `${F_MQ} :: createAppeal -> audit.log`, klass: 'resolved_id_only', note: 'actorId 取的是解析结果' },
  ...[
    ['skillProfileByName', 'resolveStudentByName'],
    ['skillProfileByName', 'skills.forStudent'],
    ['upcomingForName', 'resolveStudentByName'],
    ['startPractice', 'resolveStudentByName'],
    ['startPractice', 'audit.log'],
    ['getPractice', 'resolveStudentByName'],
    ['submitPractice', 'resolveStudentByName'],
    ['submitPractice', 'audit.log'],
    ['historyTrendByName', 'resolveStudentByName'],
  ].map(([m, c]): Entry => ({ key: `${F_MQ} :: ${m} -> ${c}`, klass: 'out_of_scope', note: '阶段 5 明确排除，钉住不许被顺手改动' })),
];

const IN_SCOPE_FILES = [
  F_LESSON, F_WORD, F_REVIEW, F_QUIZ, F_ATTEMPT, F_MQ,
  'vocab/mistake.service.ts',   // 目前完全不吃身份（控制器传已解析的 id）
  'vocab/page-view.service.ts', // 同上 —— 一旦开始吃身份，扫描器会发现
];

/** 对一个调用点应用 fail-closed 判据，返回违规说明（空 = 通过）。 */
export function violationsOf(site: Callsite, entry: Entry | undefined): string[] {
  const bad: string[] = [];
  if (!entry) return [`未分类的组合点：${site.key}　${site.args}`];
  switch (entry.klass) {
    case 'identity_forwarding':
      if (!site.hasAuthArg && !site.spreadsAuthInput) {
        bad.push(`${site.key} 是转发点，却没把认证身份传下去：${site.args}`);
      }
      break;
    case 'identity_resolution':
      if (entry.expectAuth === true && !site.hasAuthArg) {
        bad.push(`${site.key} 应当带认证身份，实参里没有：${site.args}`);
      }
      if (entry.expectAuth === false && site.hasAuthArg) {
        bad.push(`${site.key} 被登记为「旧路径专用」，却出现了 authStudentId —— 请重新分类：${site.args}`);
      }
      break;
    case 'resolved_id_only':
      if (site.rootedInRequest) {
        bad.push(`${site.key} 应当只传已解析的库内 id，实参却根植于请求入参：${site.args}`);
      }
      break;
    default:
      break;
  }
  return bad;
}

function scanAll(): Callsite[] {
  return IN_SCOPE_FILES.flatMap((f) => scanCompositions(read(f), f));
}

// ─────────────────────────────────────────────────────────────
// 对真实源码的 fail-closed 判据
// ─────────────────────────────────────────────────────────────

describe('身份组合点：结构性清单（fail-closed）', () => {
  const sites = scanAll();
  const byKey = new Map(MANIFEST.map((e) => [e.key, e]));

  it('扫描器**真的枚举出了调用点**（不是硬编码两处）', () => {
    expect(sites.length).toBeGreaterThan(20);
    // 两个已知的转发点必须在结果里 —— 它们正是曾经出缺陷的地方
    expect(sites.map((s) => s.key)).toContain(`${F_LESSON} :: markTaughtAndAdvance -> startOrResumeToday`);
    expect(sites.map((s) => s.key)).toContain(`${F_ATTEMPT} :: start -> quiz.buildQuiz`);
  });

  it('**没有未分类的组合点**（加一个新的就会红）', () => {
    const unknown = sites.filter((s) => !byKey.has(s.key)).map((s) => `${s.key}　${s.args}`);
    expect(unknown).toEqual([]);
  });

  it('**清单里的每一条都还在**（删掉或挪走就会红）', () => {
    const found = new Set(sites.map((s) => s.key));
    const missing = MANIFEST.filter((e) => !found.has(e.key)).map((e) => e.key);
    expect(missing).toEqual([]);
  });

  it('**每一条都满足它那一类的判据**', () => {
    const bad = sites.flatMap((s) => violationsOf(s, byKey.get(s.key)));
    expect(bad).toEqual([]);
  });

  it('清单本身没有重复键，且分类取值合法', () => {
    expect(new Set(MANIFEST.map((e) => e.key)).size).toBe(MANIFEST.length);
    const legal = new Set(['identity_resolution', 'identity_forwarding', 'resolved_id_only', 'non_identity', 'out_of_scope']);
    for (const e of MANIFEST) expect(legal.has(e.klass), `${e.key} 分类非法`).toBe(true);
  });

  it('分类分布与阶段 5 的范围一致', () => {
    const count = (k: Klass) => MANIFEST.filter((e) => e.klass === k).length;
    // 四个转发点：getToday→today、startOrResumeToday→today，外加曾经
    // 出过缺陷的那两处（markTaughtAndAdvance→startOrResumeToday、
    // attempt.start→buildQuiz）。范围外的九条只钉不改。
    expect(count('identity_forwarding')).toBe(4);
    expect(count('out_of_scope')).toBe(9);
    expect(count('identity_resolution')).toBeGreaterThanOrEqual(18);
  });
});

// ─────────────────────────────────────────────────────────────
// 反向夹具 —— 全部作用于**内存里的合成源码**，不动仓库文件
// ─────────────────────────────────────────────────────────────

describe('反向夹具：旧守卫放过去的，新清单必须抓住', () => {
  /** 一个合成的服务：多了一个第三方组合点，而且把身份丢了。 */
  const SYNTHETIC = `
@Injectable()
export class FakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly words: StudentWordService,
    private readonly other: OtherService,
  ) {}

  async doThing(input: { studentName: string; studentId?: string; authStudentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId);
    await this.prisma.studentWord.updateMany({ where: { studentId: student.id } });
    this.logger.log('noise');
    return this.other.sideQuest({ studentName: input.studentName, studentId: input.studentId });
  }
}
`;

  /** 旧守卫的逻辑，原样复刻：硬编码标记 + 附近出现 authStudentId。 */
  const oldGuard = (src: string) => {
    const markers = ['this.startOrResumeToday({', 'this.quiz.buildQuiz({'];
    return markers.every((mk) => {
      const at = src.indexOf(mk);
      return at < 0 ? true : /authStudentId/.test(src.slice(at, at + 400));
    });
  };

  it('**旧守卫对这个第三组合点毫无反应**（它压根不枚举）', () => {
    // 合成源码里两个硬编码标记都不存在 → 旧守卫「通过」
    expect(oldGuard(SYNTHETIC)).toBe(true);
  });

  it('**新清单把它当作未分类点抓出来**', () => {
    const sites = scanCompositions(SYNTHETIC, 'fake/fake.service.ts');
    const keys = sites.map((s) => s.key);
    expect(keys).toContain('fake/fake.service.ts :: doThing -> other.sideQuest');
    // 清单里没有它 → 未分类
    const byKey = new Map(MANIFEST.map((e) => [e.key, e]));
    const unknown = sites.filter((s) => !byKey.has(s.key));
    expect(unknown.length).toBeGreaterThan(0);
    expect(violationsOf(unknown[0], undefined)[0]).toMatch(/未分类的组合点/);
  });

  it('**转发点丢了认证身份 → 红**', () => {
    const sites = scanCompositions(SYNTHETIC, 'fake/fake.service.ts');
    const s = sites.find((x) => x.callee === 'other.sideQuest')!;
    const bad = violationsOf(s, { key: s.key, klass: 'identity_forwarding', note: '' });
    expect(bad[0]).toMatch(/没把认证身份传下去/);
  });

  it('转发点带上 authStudentId → 绿', () => {
    const fixed = SYNTHETIC.replace(
      'studentId: input.studentId }',
      'studentId: input.studentId, authStudentId: input.authStudentId }',
    );
    const s = scanCompositions(fixed, 'fake/fake.service.ts').find((x) => x.callee === 'other.sideQuest')!;
    expect(violationsOf(s, { key: s.key, klass: 'identity_forwarding', note: '' })).toEqual([]);
  });

  it('`...input` 展开也算转发到位 —— 前提是签名声明了 authStudentId', () => {
    const spreadOk = `
export class S {
  async a(input: { studentName: string; authStudentId?: string }) { return this.b({ ...input, freeze: true }); }
  async b(input: { studentName: string; authStudentId?: string }) { return this.words.resolveStudent(input.studentName, input.studentId, input.authStudentId); }
}`;
    const s = scanCompositions(spreadOk, 'fake/spread.service.ts').find((x) => x.callee === 'b')!;
    expect(s.spreadsAuthInput).toBe(true);
    expect(violationsOf(s, { key: s.key, klass: 'identity_forwarding', note: '' })).toEqual([]);

    // 签名没有 authStudentId 时，`...input` 不算数
    const spreadBad = spreadOk.replace('async a(input: { studentName: string; authStudentId?: string })', 'async a(input: { studentName: string })');
    const s2 = scanCompositions(spreadBad, 'fake/spread.service.ts').find((x) => x.callee === 'b')!;
    expect(s2.spreadsAuthInput).toBe(false);
    expect(violationsOf(s2, { key: s2.key, klass: 'identity_forwarding', note: '' })).not.toEqual([]);
  });

  it('**resolved_id_only 却传了请求里的姓名 → 红**', () => {
    const src = `
export class S {
  async a(input: { studentName: string; authStudentId?: string }) {
    const student = await this.words.resolveStudent(input.studentName, undefined, input.authStudentId);
    return this.other.board({ studentName: input.studentName, studentId: student.id });
  }
}`;
    const s = scanCompositions(src, 'fake/board.service.ts').find((x) => x.callee === 'other.board')!;
    const bad = violationsOf(s, { key: s.key, klass: 'resolved_id_only', note: '' });
    expect(bad[0]).toMatch(/根植于请求入参/);
  });

  it('**登记为「旧路径专用」的解析点冒出 authStudentId → 红**', () => {
    const s: Callsite = {
      key: 'x :: y -> z', file: 'x', method: 'y', callee: 'z',
      args: '(studentName, studentId, authStudentId)',
      hasAuthArg: true, spreadsAuthInput: false, rootedInRequest: false,
    };
    const bad = violationsOf(s, { key: s.key, klass: 'identity_resolution', expectAuth: false, note: '' });
    expect(bad[0]).toMatch(/旧路径专用/);
  });

  it('**清单里的条目消失 → 红**', () => {
    const found = new Set(['a :: b -> c']);
    const missing = [{ key: 'a :: b -> c' }, { key: 'gone :: x -> y' }].filter((e) => !found.has(e.key));
    expect(missing.map((m) => m.key)).toEqual(['gone :: x -> y']);
  });

  it('**把第三个组合点注入到真实源码里（只在内存中），清单当场变红**', () => {
    // 读真文件 → 在字符串上做变异 → 喂给扫描器。**不写盘**，仓库文件全程未改。
    const real = read(F_LESSON);
    const mutated = real.replace(
      '  async saveVocabCursor(input: { studentName: string; studentId?: string; authStudentId?: string; cursor: number }) {',
      '  async saveVocabCursor(input: { studentName: string; studentId?: string; authStudentId?: string; cursor: number }) {\n' +
        '    await this.review.sideQuest({ studentName: input.studentName, studentId: input.studentId });',
    );
    expect(mutated, '变异锚点失效了 —— 这条测试就白跑了').not.toBe(real);

    const byKey = new Map(MANIFEST.map((e) => [e.key, e]));
    const before = scanCompositions(real, F_LESSON).filter((s) => !byKey.has(s.key));
    const after = scanCompositions(mutated, F_LESSON).filter((s) => !byKey.has(s.key));

    expect(before, '未变异时不该有未分类点').toEqual([]);
    expect(after.map((s) => s.key)).toEqual([`${F_LESSON} :: saveVocabCursor -> review.sideQuest`]);
    expect(violationsOf(after[0], undefined)[0]).toMatch(/未分类的组合点/);
  });

  it('Prisma 与日志被**显式**排除，不进清单', () => {
    const sites = scanCompositions(SYNTHETIC, 'fake/fake.service.ts');
    expect(sites.map((s) => s.callee)).not.toContain('prisma.studentWord.updateMany');
    expect(sites.map((s) => s.callee)).not.toContain('logger.log');
  });
});
