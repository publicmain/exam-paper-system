/**
 * S12F 词典补种脚本的行为测试。
 *
 * 这是**全局共享数据**上的一次插入 —— 词典的主键就是单词本身，带不了
 * `s12f_` 前缀，所以「只碰自己的行」这条纪律在这里必须换一种表达：
 * **一份写死在仓库里的 51 词清单，插入前逐个比对，只插不改不删。**
 *
 * 测试跑的是脚本真的导出的那些函数，事务客户端是记录读写顺序的假对象，
 * **不连任何数据库**。
 *
 * 模块缺失时整套仍然要能收集并执行 —— 每条用例各自红。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireCjs = createRequire(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '..', 'seed-s12f-dictionary.js');
const FIXTURE_PATH = path.resolve(__dirname, '..', 'prepare-s12f-acceptance-account.js');

type Row = {
  word: string;
  phonetic: string;
  translation: string;
  definition: string;
  pos: string;
};

type Seeder = {
  DICT_CONFIRMATION: string;
  ROLLBACK_CONFIRMATION: string;
  RESERVED_WORD: string;
  MANIFEST: Row[];
  EXPECTED_RAILWAY: Record<string, string>;
  manifestHash(rows?: Row[]): string;
  assertManifest(rows?: Row[]): true;
  assertEnvGates(env: Record<string, string>): void;
  classifyExisting(rows: Array<Partial<Row>>): {
    kind: 'all-absent' | 'already-seeded' | 'mismatch';
    missing: string[];
    conflicting: string[];
  };
  readManifestRows(tx: any): Promise<any[]>;
  seedInTransaction(tx: any): Promise<any>;
  verifyAfterSeed(tx: any, before: { total: number; originalHash: string }): Promise<any>;
  rollbackPreflight(tx: any, opts: { confirm: string }): Promise<any>;
};

let loadError: unknown = null;
let loaded: Seeder | null = null;
try {
  loaded = requireCjs(SCRIPT_PATH) as Seeder;
} catch (e) {
  loadError = e;
}

function mod(): Seeder {
  if (!loaded) {
    throw new Error(
      `S12F 词典补种脚本尚未实现：${path.relative(process.cwd(), SCRIPT_PATH)} 无法加载` +
        (loadError instanceof Error ? `（${loadError.message.split('\n')[0]}）` : ''),
    );
  }
  return loaded;
}

function sourceText(): string {
  if (!fs.existsSync(SCRIPT_PATH)) throw new Error('S12F 词典补种脚本文件不存在');
  return fs.readFileSync(SCRIPT_PATH, 'utf8');
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** 已经在库里的那八个词 —— 本脚本一行都不许碰。 */
const ORIGINAL_EIGHT = [
  'anchor', 'harbour', 'lantern', 'meadow', 'pebble', 'ripple', 'vessel', 'willow',
];

type Ev = { kind: 'read' | 'write'; what: string; args?: any };

function fakeTx(overrides: Record<string, any[]> = {}) {
  const events: Ev[] = [];
  const manifest = loaded?.MANIFEST ?? [];
  const reads: Record<string, any[]> = {
    'manifest-rows': [],
    'dict-total': [{ n: 8 }],
    'original-rows': ORIGINAL_EIGHT.map((w) => ({ word: w, phonetic: `/${w}/`, translation: `n. ${w}`, definition: w, pos: 'n.' })),
    'account-present': [{ n: 0 }],
    'owned-rows': [{ n: 0 }],
    'referencing-rows': [{ n: 0 }],
    ...overrides,
  };
  const tagOf = (sql: string): string => {
    const m = /\/\* s12fdict:([a-z-]+) \*\//.exec(sql);
    return m ? m[1] : 'untagged';
  };
  const modelProxy = (model: string) =>
    new Proxy({}, {
      get: (_t, op: string) => (args: any) => {
        events.push({ kind: 'write', what: `${model}.${op}`, args });
        return Promise.resolve({ count: Array.isArray(args?.data) ? args.data.length : 1 });
      },
    });
  const tx: any = new Proxy(
    {
      $queryRawUnsafe: (sql: string) => {
        const tag = tagOf(sql);
        events.push({ kind: 'read', what: tag, args: sql });
        return Promise.resolve(reads[tag] ?? []);
      },
      $executeRawUnsafe: (sql: string) => {
        events.push({ kind: 'write', what: `sql:${tagOf(sql)}`, args: sql });
        return Promise.resolve(0);
      },
    },
    {
      get: (t: any, prop: string) => {
        if (prop in t) return t[prop];
        if (typeof prop !== 'string' || prop.startsWith('$')) return undefined;
        return modelProxy(prop);
      },
    },
  );
  return { tx, events, manifest };
}

const GOOD_ENV = () => ({
  ...mod().EXPECTED_RAILWAY,
  DATABASE_PUBLIC_URL: 'postgresql://sentinel-user:sentinel-secret@proxy.sentinel.example:47111/railway',
  RAILWAY_TCP_PROXY_DOMAIN: 'proxy.sentinel.example',
  RAILWAY_TCP_PROXY_PORT: '47111',
  S12F_DICT_CONFIRM: mod().DICT_CONFIRMATION,
});

// ─────────────────────────────────────────────────────────────
// 1. 模块与清单
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 模块', () => {
  it('存在，且导出闸门 / 清单 / 分类 / 插入 / 回读 / 回滚预检', () => {
    const s = mod();
    for (const fn of [
      'manifestHash', 'assertManifest', 'assertEnvGates', 'classifyExisting',
      'readManifestRows', 'seedInTransaction', 'verifyAfterSeed', 'rollbackPreflight',
    ]) {
      expect(typeof (s as any)[fn], `缺少导出 ${fn}`).toBe('function');
    }
  });

  it('闸门通过之前不加载 Prisma', () => {
    const src = stripComments(sourceText());
    const idx = src.indexOf("require('@prisma/client')");
    expect(idx).toBeGreaterThan(0);
    expect(src.slice(0, idx)).toContain('assertEnvGates()');
    expect(/^const .*require\('@prisma\/client'\)/m.test(src)).toBe(false);
  });
});

describe('S12F 词典 —— 清单', () => {
  it('正好 51 个词，全小写，互不重复', () => {
    const m = mod().MANIFEST;
    expect(m.length).toBe(51);
    const words = m.map((r) => r.word);
    expect(new Set(words).size).toBe(51);
    for (const w of words) expect(w).toBe(w.toLowerCase());
  });

  it('50 个来自夹具的候选词表（前 50 个，顺序一致），第 51 个是 blossom', () => {
    const s = mod();
    const fixture = requireCjs(FIXTURE_PATH) as { CANDIDATE_WORDS: string[]; RESERVED_LOOKUP_WORD: string };
    const notebook = s.MANIFEST.map((r) => r.word).filter((w) => w !== s.RESERVED_WORD);
    expect(notebook.length).toBe(50);
    expect(notebook).toEqual(fixture.CANDIDATE_WORDS.slice(0, 50));
    expect(s.RESERVED_WORD).toBe(fixture.RESERVED_LOOKUP_WORD);
    expect(s.RESERVED_WORD).toBe('blossom');
    // 留给查词的那个词**绝不能**同时是生词本里的词
    expect(notebook).not.toContain(s.RESERVED_WORD);
  });

  it('一个都不碰库里原有的八个词', () => {
    const words = mod().MANIFEST.map((r) => r.word);
    for (const w of ORIGINAL_EIGHT) expect(words, `清单里混进了原有的 ${w}`).not.toContain(w);
  });

  it('每一行都有真实的音标 / 中文释义 / 英文释义 / 词性，没有占位符', () => {
    for (const r of mod().MANIFEST) {
      expect(r.phonetic, `${r.word} 缺音标`).toMatch(/^\/.+\/$/);
      expect(r.translation.trim().length, `${r.word} 缺中文释义`).toBeGreaterThan(3);
      expect(r.definition.trim().length, `${r.word} 缺英文释义`).toBeGreaterThan(10);
      expect(r.pos.trim().length, `${r.word} 缺词性`).toBeGreaterThan(0);
      for (const bad of ['TODO', 'FIXME', 'placeholder', 'dummy', 'xxx', 'N/A']) {
        expect(JSON.stringify(r).toLowerCase(), `${r.word} 里有占位符 ${bad}`).not.toContain(bad.toLowerCase());
      }
      // 中文释义必须真的有中文
      expect(/[一-龥]/.test(r.translation), `${r.word} 的释义里没有中文`).toBe(true);
    }
  });

  it('中文释义互不相同 —— 不靠复制粘贴凑数', () => {
    const t = mod().MANIFEST.map((r) => r.translation.trim());
    expect(new Set(t).size).toBe(51);
    const en = mod().MANIFEST.map((r) => r.definition.trim());
    expect(new Set(en).size).toBe(51);
  });

  it('释义以词性开头，和 posOf 的解析口径一致（干扰项按词性配对要用）', () => {
    for (const r of mod().MANIFEST) {
      const m = r.translation.trim().match(/^(vt|vi|n|v|adj|adv|a|ad|prep|conj|pron)\./i);
      expect(m, `${r.word} 的释义没有以词性开头：${r.translation}`).toBeTruthy();
      expect(r.pos.toLowerCase().startsWith(m![1].toLowerCase()), `${r.word} 的 pos 与释义前缀不一致`).toBe(true);
    }
  });

  it('每个词都撑得起拼写题：4–12 个纯字母', () => {
    for (const r of mod().MANIFEST) {
      expect(/^[a-z]{4,12}$/.test(r.word), `${r.word} 不符合拼写题的词形要求`).toBe(true);
    }
  });

  it('清单哈希是确定性的，且随内容变化', () => {
    const s = mod();
    const h = s.manifestHash();
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(s.manifestHash()).toBe(h);
    const tweaked = s.MANIFEST.map((r, i) => (i === 0 ? { ...r, translation: r.translation + '。' } : r));
    expect(s.manifestHash(tweaked)).not.toBe(h);
  });

  it('清单里没有连接串 / 凭据 / 环境值', () => {
    const blob = JSON.stringify(mod().MANIFEST).toLowerCase();
    for (const bad of ['postgres', 'railway', 'password', 'secret', 'token', 'http', '@']) {
      expect(blob, `清单里出现了 ${bad}`).not.toContain(bad);
    }
  });

  it('assertManifest 对合法清单放行，对被改坏的清单拒绝', () => {
    const s = mod();
    expect(s.assertManifest()).toBe(true);
    expect(() => s.assertManifest(s.MANIFEST.slice(0, 50))).toThrow();
    expect(() => s.assertManifest([...s.MANIFEST.slice(0, 50), { ...s.MANIFEST[0] }])).toThrow();
    expect(() =>
      s.assertManifest(s.MANIFEST.map((r, i) => (i === 3 ? { ...r, translation: '' } : r))),
    ).toThrow();
    expect(() =>
      s.assertManifest(s.MANIFEST.map((r, i) => (i === 3 ? { ...r, word: 'anchor' } : r))),
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 闸门
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 闸门', () => {
  it('全部满足时放行', () => {
    expect(() => mod().assertEnvGates(GOOD_ENV())).not.toThrow();
  });

  const cases: Array<[string, Record<string, string>]> = [
    ['项目 id 不对', { RAILWAY_PROJECT_ID: '00000000-0000-0000-0000-000000000000' }],
    ['项目名不对', { RAILWAY_PROJECT_NAME: 'exam-paper-system' }],
    ['环境不对', { RAILWAY_ENVIRONMENT_NAME: 'staging' }],
    ['服务不对', { RAILWAY_SERVICE_NAME: 'stg-api' }],
    ['代理主机名不对', { RAILWAY_TCP_PROXY_DOMAIN: 'somewhere.else.example' }],
    ['代理端口不对', { RAILWAY_TCP_PROXY_PORT: '1' }],
    ['连接串畸形', { DATABASE_PUBLIC_URL: 'not-a-postgres-url' }],
    ['缺词典确认串', { S12F_DICT_CONFIRM: '' }],
    ['词典确认串写错', { S12F_DICT_CONFIRM: 'yes' }],
    ['拿夹具的确认串来冒充', { S12F_DICT_CONFIRM: 'S12F_CREATE_PRODUCTION_LIKE_ACCEPTANCE_ACCOUNT' }],
  ];
  for (const [label, patch] of cases) {
    it(`拒绝：${label}`, () => {
      expect(() => mod().assertEnvGates({ ...GOOD_ENV(), ...patch })).toThrow();
    });
  }

  it('词典确认串与夹具确认串是两个不同的值', () => {
    const s = mod();
    const fixture = requireCjs(FIXTURE_PATH) as { CONFIRMATION: string };
    expect(s.DICT_CONFIRMATION).not.toBe(fixture.CONFIRMATION);
    expect(s.ROLLBACK_CONFIRMATION).not.toBe(s.DICT_CONFIRMATION);
  });

  it('拒绝时不回显任何取值', () => {
    const env = { ...GOOD_ENV(), RAILWAY_TCP_PROXY_PORT: '1' };
    let msg = '';
    try {
      mod().assertEnvGates(env);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg.length).toBeGreaterThan(0);
    for (const secret of ['sentinel-user', 'sentinel-secret', 'proxy.sentinel.example', '47111', env.DATABASE_PUBLIC_URL]) {
      expect(msg, `泄漏了 ${secret}`).not.toContain(secret);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 插入前的三态判定
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 插入前的三态判定', () => {
  it('全都不在 → all-absent（首次执行的正常状态）', () => {
    const r = mod().classifyExisting([]);
    expect(r.kind).toBe('all-absent');
    expect(r.missing.length).toBe(51);
    expect(r.conflicting).toEqual([]);
  });

  it('全都在且逐字相同 → already-seeded（幂等重跑）', () => {
    const s = mod();
    const r = s.classifyExisting(s.MANIFEST.map((x) => ({ ...x })));
    expect(r.kind).toBe('already-seeded');
    expect(r.missing).toEqual([]);
    expect(r.conflicting).toEqual([]);
  });

  it('只在了一半 → mismatch（部分状态一律 NO-GO）', () => {
    const s = mod();
    const r = s.classifyExisting(s.MANIFEST.slice(0, 20).map((x) => ({ ...x })));
    expect(r.kind).toBe('mismatch');
  });

  it('在，但内容不一样 → mismatch，且点名是哪几个词', () => {
    const s = mod();
    const rows = s.MANIFEST.map((x, i) => (i === 7 ? { ...x, translation: 'n. 别人写的' } : { ...x }));
    const r = s.classifyExisting(rows);
    expect(r.kind).toBe('mismatch');
    expect(r.conflicting).toContain(s.MANIFEST[7].word);
  });

  it('任何一个字段不同都算冲突（音标 / 英文释义 / 词性）', () => {
    const s = mod();
    for (const field of ['phonetic', 'definition', 'pos'] as const) {
      const rows = s.MANIFEST.map((x, i) => (i === 2 ? { ...x, [field]: 'different' } : { ...x }));
      expect(s.classifyExisting(rows).kind, `${field} 不同却没判成冲突`).toBe('mismatch');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 只插不改不删
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 写入', () => {
  it('首次执行：一次性插入 51 行，且用的是 create 不是 upsert', async () => {
    const s = mod();
    const { tx, events } = fakeTx();
    const r = await s.seedInTransaction(tx);
    expect(r.inserted).toBe(51);
    const writes = events.filter((e) => e.kind === 'write');
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.what, `出现了非 create 的写：${w.what}`).toMatch(/^dictEntry\.createMany$/);
    }
    const data = writes[0].args.data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(51);
    expect(writes[0].args.skipDuplicates).toBe(false);
  });

  it('幂等重跑：全都在且相同 → 一个字都不写', async () => {
    const s = mod();
    const { tx, events } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })) });
    const r = await s.seedInTransaction(tx);
    expect(r.inserted).toBe(0);
    expect(r.kind).toBe('already-seeded');
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });

  it('内容冲突 → 抛错，一个字都不写', async () => {
    const s = mod();
    const rows = s.MANIFEST.map((x, i) => (i === 0 ? { ...x, translation: 'n. 冲突' } : { ...x }));
    const { tx, events } = fakeTx({ 'manifest-rows': rows });
    await expect(s.seedInTransaction(tx)).rejects.toThrow();
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });

  it('部分存在 → 抛错，一个字都不写', async () => {
    const s = mod();
    const { tx, events } = fakeTx({ 'manifest-rows': s.MANIFEST.slice(0, 10).map((x) => ({ ...x })) });
    await expect(s.seedInTransaction(tx)).rejects.toThrow();
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });

  it('源码里没有 upsert / update / delete 任何词典行的语句', () => {
    const src = stripComments(sourceText());
    expect(/dictEntry\s*\.\s*upsert/.test(src), '用了 upsert').toBe(false);
    expect(/dictEntry\s*\.\s*update/.test(src), '用了 update').toBe(false);
    expect(/dictEntry\s*\.\s*delete/.test(src), '主执行路径里用了 delete').toBe(false);
    expect(/UPDATE\s+"DictEntry"/i.test(src), '有裸 UPDATE').toBe(false);
  });

  it('原有的八个词一个都不出现在任何写语句里', async () => {
    const s = mod();
    const { tx, events } = fakeTx();
    await s.seedInTransaction(tx);
    const blob = JSON.stringify(events.filter((e) => e.kind === 'write').map((e) => e.args));
    for (const w of ORIGINAL_EIGHT) expect(blob, `写语句里出现了 ${w}`).not.toContain(`"${w}"`);
  });

  it('所有读都排在第一次写之前', async () => {
    const s = mod();
    const { tx, events } = fakeTx();
    await s.seedInTransaction(tx);
    const firstWrite = events.findIndex((e) => e.kind === 'write');
    const lastRead = events.reduce((acc, e, i) => (e.kind === 'read' ? i : acc), -1);
    expect(firstWrite).toBeGreaterThan(-1);
    expect(lastRead).toBeGreaterThan(-1);
    expect(firstWrite).toBeGreaterThan(lastRead);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. 写后回读
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 写后回读', () => {
  const before = () => ({ total: 8, originalHash: 'ORIGINAL-HASH' });

  it('总数正好 +51、原有八行未变、51 行逐字相同 → 通过', async () => {
    const s = mod();
    const { tx } = fakeTx({
      'dict-total': [{ n: 59 }],
      'original-rows': [{ hash: 'ORIGINAL-HASH' }],
      'manifest-rows': s.MANIFEST.map((x) => ({ ...x })),
    });
    await expect(s.verifyAfterSeed(tx, before())).resolves.toBeTruthy();
  });

  it('总数不是 +51 → 抛（事务回滚）', async () => {
    const s = mod();
    const { tx } = fakeTx({
      'dict-total': [{ n: 60 }],
      'original-rows': [{ hash: 'ORIGINAL-HASH' }],
      'manifest-rows': s.MANIFEST.map((x) => ({ ...x })),
    });
    await expect(s.verifyAfterSeed(tx, before())).rejects.toThrow();
  });

  it('原有八行变了 → 抛', async () => {
    const s = mod();
    const { tx } = fakeTx({
      'dict-total': [{ n: 59 }],
      'original-rows': [{ hash: 'SOMETHING-ELSE' }],
      'manifest-rows': s.MANIFEST.map((x) => ({ ...x })),
    });
    await expect(s.verifyAfterSeed(tx, before())).rejects.toThrow();
  });

  it('51 行里有一行内容不对 → 抛', async () => {
    const s = mod();
    const { tx } = fakeTx({
      'dict-total': [{ n: 59 }],
      'original-rows': [{ hash: 'ORIGINAL-HASH' }],
      'manifest-rows': s.MANIFEST.map((x, i) => (i === 5 ? { ...x, phonetic: '/wrong/' } : { ...x })),
    });
    await expect(s.verifyAfterSeed(tx, before())).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 6. 回滚预检（只算不删）
// ─────────────────────────────────────────────────────────────

describe('S12F 词典 —— 回滚预检', () => {
  const OK = () => ({ confirm: mod().ROLLBACK_CONFIRMATION });

  it('条件齐备时给出计划，且**一个删除都不执行**', async () => {
    const s = mod();
    const { tx, events } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })) });
    const plan = await s.rollbackPreflight(tx, OK());
    expect(plan.wouldDelete.length).toBe(51);
    expect(plan.wouldDelete).not.toContain('anchor');
    expect(plan.executed).toBe(false);
    expect(events.some((e) => e.kind === 'write')).toBe(false);
  });

  it('没有专用确认串 → 拒绝（与补种的确认串不通用）', async () => {
    const s = mod();
    const { tx } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })) });
    await expect(s.rollbackPreflight(tx, { confirm: '' })).rejects.toThrow();
    await expect(s.rollbackPreflight(tx, { confirm: s.DICT_CONFIRMATION })).rejects.toThrow();
  });

  it('S12F 账号还在 → 拒绝', async () => {
    const s = mod();
    const { tx } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })), 'account-present': [{ n: 1 }] });
    await expect(s.rollbackPreflight(tx, OK())).rejects.toThrow();
  });

  it('还有 s12f_ 的资源没清干净 → 拒绝', async () => {
    const s = mod();
    const { tx } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })), 'owned-rows': [{ n: 3 }] });
    await expect(s.rollbackPreflight(tx, OK())).rejects.toThrow();
  });

  it('有非 S12F 的资源引用了这些词 → 拒绝', async () => {
    const s = mod();
    const { tx } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })), 'referencing-rows': [{ n: 1 }] });
    await expect(s.rollbackPreflight(tx, OK())).rejects.toThrow();
  });

  it('库里的内容与清单不一致 → 拒绝（别人改过，不该由我删）', async () => {
    const s = mod();
    const { tx } = fakeTx({
      'manifest-rows': s.MANIFEST.map((x, i) => (i === 9 ? { ...x, translation: 'n. 被别人改过' } : { ...x })),
    });
    await expect(s.rollbackPreflight(tx, OK())).rejects.toThrow();
  });

  it('计划里只有那 51 个词，绝不含原有的八个', async () => {
    const s = mod();
    const { tx } = fakeTx({ 'manifest-rows': s.MANIFEST.map((x) => ({ ...x })) });
    const plan = await s.rollbackPreflight(tx, OK());
    for (const w of ORIGINAL_EIGHT) expect(plan.wouldDelete).not.toContain(w);
    expect([...plan.wouldDelete].sort()).toEqual(s.MANIFEST.map((r) => r.word).sort());
  });
});
