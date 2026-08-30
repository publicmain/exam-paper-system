/**
 * S12F —— **给 staging 的词典补 51 个词**（staging 专用，只插不改不删）。
 *
 * ## 为什么单独一个脚本
 *
 * S12F v1.0 的验收账号夹具在写入之前被自己的前置检查拦住了：staging 的
 * `DictEntry` 里**总共只有八个词**（八账号夹具当年只播了
 * `anchor / harbour / lantern / meadow / pebble / ripple / vessel / willow`），
 * 而验收账号要 50 个有真实音标 / 释义的生词，正式测试还要靠词典出四选一的
 * 干扰项。八个撑不起来。
 *
 * ## 为什么它比夹具危险
 *
 * `DictEntry` 是**全局共享的参考数据**，主键就是单词本身 —— 它**带不了
 * `s12f_` 前缀**。「只碰自己拥有的行」这条纪律在这里没法靠 id 表达，
 * 所以换成三条更硬的：
 *
 *   1. **只插不改不删** —— 没有 upsert、没有 update、没有 delete。
 *      主执行路径里一个都没有（有测试盯着源码）。
 *   2. **一份写死在仓库里的 51 词清单** —— 能写进库的只有这 51 个键，
 *      多一个少一个都不行。清单有确定性哈希，改一个字哈希就变。
 *   3. **插入前三态判定** —— 全不在（首次）/ 全在且逐字相同（幂等重跑）
 *      / **其余一律 NO-GO**。部分存在、内容不一致，都不许「补一补」。
 *
 * ## 授权范围
 *
 * 用户在 S12F v1.1 里逐条批准的就是这 51 个键，**不是**「以后可以随便改
 * 词典」。任何别的词都不在授权内。
 *
 * ## 回滚
 *
 * `rollbackPreflight()` **只算不删** —— 它检查条件、给出「会删哪 51 个词」
 * 的计划，然后就停下。真正执行删除需要另一份合同和另一个确认串。
 * 它拒绝的条件：确认串不对、S12F 账号还在、还有 `s12f_` 资源没清、
 * 有非 S12F 的东西引用了这些词、库里的内容与清单不一致。
 * **原有那八个词永远不在计划里。**
 *
 * ## 跑法
 *
 * ```bash
 * RAILWAY_PROJECT_ID=… RAILWAY_PROJECT_NAME=… RAILWAY_ENVIRONMENT_NAME=… \
 * RAILWAY_SERVICE_NAME=Postgres DATABASE_PUBLIC_URL=… \
 * RAILWAY_TCP_PROXY_DOMAIN=… RAILWAY_TCP_PROXY_PORT=… \
 * S12F_DICT_CONFIRM=S12F_SEED_STAGING_DICTIONARY \
 *   node apps/api/scripts/staging/seed-s12f-dictionary.js
 * ```
 */

'use strict';

// ⚠️ 先拍环境快照，再加载任何会碰 dotenv 的东西。
const ENV_AT_STARTUP = {
  RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || '',
  RAILWAY_PROJECT_NAME: process.env.RAILWAY_PROJECT_NAME || '',
  RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME || '',
  RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME || '',
  DATABASE_PUBLIC_URL: process.env.DATABASE_PUBLIC_URL || '',
  RAILWAY_TCP_PROXY_DOMAIN: process.env.RAILWAY_TCP_PROXY_DOMAIN || '',
  RAILWAY_TCP_PROXY_PORT: process.env.RAILWAY_TCP_PROXY_PORT || '',
  S12F_DICT_CONFIRM: process.env.S12F_DICT_CONFIRM || '',
};

const crypto = require('crypto');

const DICT_CONFIRMATION = 'S12F_SEED_STAGING_DICTIONARY';
const ROLLBACK_CONFIRMATION = 'S12F_ROLLBACK_STAGING_DICTIONARY';
const RESERVED_WORD = 'blossom';
const OWNED_PREFIX = 's12f_';
const ACCOUNT_ID = 's12f_acceptance_student';

const EXPECTED_RAILWAY = {
  RAILWAY_PROJECT_ID: 'ed8c31c0-6499-4611-830a-64043189f7d0',
  RAILWAY_PROJECT_NAME: 'exam-staging-manual',
  RAILWAY_ENVIRONMENT_NAME: 'production',
  RAILWAY_SERVICE_NAME: 'Postgres',
};

// ─────────────────────────────────────────────────────────────
// 清单：50 个生词本用词（= 夹具 CANDIDATE_WORDS 的前 50 个，顺序一致）
//        + 1 个留给课上查词的 `blossom`（**不进生词本**）。
//
// 释义一律以词性开头 —— `vocab-quiz.service.posOf()` 就是这么解析的，
// 干扰项按词性配对要靠它。中英释义各自互不相同，不靠复制粘贴凑数。
// ─────────────────────────────────────────────────────────────

const MANIFEST = [
  { word: 'abandon', phonetic: '/əˈbændən/', pos: 'vt.', translation: 'vt. 抛弃，遗弃；放弃', definition: 'to leave someone or something behind for good' },
  { word: 'ability', phonetic: '/əˈbɪləti/', pos: 'n.', translation: 'n. 能力，才干', definition: 'the power or skill that is needed to do something' },
  { word: 'absorb', phonetic: '/əbˈzɔːb/', pos: 'vt.', translation: 'vt. 吸收；吸纳；理解', definition: 'to take in a liquid, gas or piece of knowledge' },
  { word: 'abstract', phonetic: '/ˈæbstrækt/', pos: 'adj.', translation: 'adj. 抽象的；n. 摘要', definition: 'existing as an idea rather than as a physical thing' },
  { word: 'accurate', phonetic: '/ˈækjərət/', pos: 'adj.', translation: 'adj. 准确的，精确的', definition: 'correct and true in every detail' },
  { word: 'achieve', phonetic: '/əˈtʃiːv/', pos: 'vt.', translation: 'vt. 实现，完成；取得', definition: 'to succeed in reaching a goal after effort' },
  { word: 'acquire', phonetic: '/əˈkwaɪə(r)/', pos: 'vt.', translation: 'vt. 获得，取得；习得', definition: 'to gain or come to own something over time' },
  { word: 'adapt', phonetic: '/əˈdæpt/', pos: 'v.', translation: 'v. 适应；改编', definition: 'to change so as to suit new conditions or a new use' },
  { word: 'adequate', phonetic: '/ˈædɪkwət/', pos: 'adj.', translation: 'adj. 足够的；差强人意的', definition: 'enough in amount, or just good enough in quality' },
  { word: 'adjust', phonetic: '/əˈdʒʌst/', pos: 'v.', translation: 'v. 调整，校准；使适应', definition: 'to move or change something slightly to improve it' },
  { word: 'admire', phonetic: '/ədˈmaɪə(r)/', pos: 'vt.', translation: 'vt. 钦佩，赞赏；欣赏', definition: 'to regard someone or something with respect and pleasure' },
  { word: 'advance', phonetic: '/ədˈvɑːns/', pos: 'v.', translation: 'v. 前进；推动；n. 进展', definition: 'to move forward, or to help something make progress' },
  { word: 'advocate', phonetic: '/ˈædvəkeɪt/', pos: 'vt.', translation: 'vt. 提倡，主张；n. 拥护者', definition: 'to publicly recommend or support a course of action' },
  { word: 'afford', phonetic: '/əˈfɔːd/', pos: 'vt.', translation: 'vt. 买得起；负担得起', definition: 'to have enough money or time for something' },
  { word: 'agenda', phonetic: '/əˈdʒendə/', pos: 'n.', translation: 'n. 议程；待办事项', definition: 'a list of matters to be discussed or dealt with' },
  { word: 'alter', phonetic: '/ˈɔːltə(r)/', pos: 'v.', translation: 'v. 改变，更改；修改', definition: 'to make something different without changing it completely' },
  { word: 'ancient', phonetic: '/ˈeɪnʃənt/', pos: 'adj.', translation: 'adj. 古代的；年代久远的', definition: 'belonging to the very distant past' },
  { word: 'annual', phonetic: '/ˈænjuəl/', pos: 'adj.', translation: 'adj. 每年的，一年一度的', definition: 'happening once every year' },
  { word: 'anxiety', phonetic: '/æŋˈzaɪəti/', pos: 'n.', translation: 'n. 焦虑，忧虑；渴望', definition: 'a feeling of worry or unease about what may happen' },
  { word: 'apparent', phonetic: '/əˈpærənt/', pos: 'adj.', translation: 'adj. 明显的；表面上的', definition: 'easy to see, or seeming true without being certain' },
  { word: 'appeal', phonetic: '/əˈpiːl/', pos: 'n.', translation: 'n. 呼吁；吸引力；v. 恳求', definition: 'an earnest request, or the quality of being attractive' },
  { word: 'approach', phonetic: '/əˈprəʊtʃ/', pos: 'n.', translation: 'n. 方法，途径；v. 接近', definition: 'a way of dealing with something, or to come nearer' },
  { word: 'arrange', phonetic: '/əˈreɪndʒ/', pos: 'v.', translation: 'v. 安排，筹备；排列', definition: 'to plan an event, or to put things in a neat order' },
  { word: 'aspect', phonetic: '/ˈæspekt/', pos: 'n.', translation: 'n. 方面；外观，样子', definition: 'a particular part or feature of a thing or situation' },
  { word: 'assemble', phonetic: '/əˈsembl/', pos: 'v.', translation: 'v. 集合，聚集；装配', definition: 'to gather in one place, or to fit parts together' },
  { word: 'assess', phonetic: '/əˈses/', pos: 'vt.', translation: 'vt. 评估，评定；估价', definition: 'to judge the quality, value or size of something' },
  { word: 'assume', phonetic: '/əˈsjuːm/', pos: 'vt.', translation: 'vt. 假定，臆断；承担', definition: 'to accept something as true without proof' },
  { word: 'attach', phonetic: '/əˈtætʃ/', pos: 'vt.', translation: 'vt. 附上，系上；使依恋', definition: 'to fasten or join one thing to another' },
  { word: 'attempt', phonetic: '/əˈtempt/', pos: 'n.', translation: 'n. 尝试，试图；vt. 试图', definition: 'an act of trying to do something difficult' },
  { word: 'attitude', phonetic: '/ˈætɪtjuːd/', pos: 'n.', translation: 'n. 态度，看法；姿态', definition: 'a settled way of thinking or feeling about something' },
  { word: 'balance', phonetic: '/ˈbæləns/', pos: 'n.', translation: 'n. 平衡；余额；v. 使平衡', definition: 'an even distribution of weight, or an amount left over' },
  { word: 'barrier', phonetic: '/ˈbæriə(r)/', pos: 'n.', translation: 'n. 障碍，阻碍；屏障', definition: 'something that blocks movement or prevents progress' },
  { word: 'benefit', phonetic: '/ˈbenɪfɪt/', pos: 'n.', translation: 'n. 好处，益处；v. 得益', definition: 'an advantage gained from something' },
  { word: 'brief', phonetic: '/briːf/', pos: 'adj.', translation: 'adj. 简短的；短暂的', definition: 'lasting only a short time, or using few words' },
  { word: 'burden', phonetic: '/ˈbɜːdn/', pos: 'n.', translation: 'n. 负担，重担；vt. 使负重', definition: 'a heavy load, or a duty that is hard to bear' },
  { word: 'capable', phonetic: '/ˈkeɪpəbl/', pos: 'adj.', translation: 'adj. 有能力的；能干的', definition: 'having the skill or power needed to do something' },
  { word: 'capture', phonetic: '/ˈkæptʃə(r)/', pos: 'vt.', translation: 'vt. 俘获，夺得；记录下', definition: 'to catch a person or thing, or to record a moment' },
  { word: 'career', phonetic: '/kəˈrɪə(r)/', pos: 'n.', translation: 'n. 职业，生涯；事业', definition: 'the work a person does over a long period of life' },
  { word: 'caution', phonetic: '/ˈkɔːʃn/', pos: 'n.', translation: 'n. 谨慎，小心；警告', definition: 'care taken in order to avoid danger or mistakes' },
  { word: 'certain', phonetic: '/ˈsɜːtn/', pos: 'adj.', translation: 'adj. 确信的；某些的', definition: 'sure beyond doubt, or referring to a particular one' },
  { word: 'challenge', phonetic: '/ˈtʃælɪndʒ/', pos: 'n.', translation: 'n. 挑战，难题；vt. 质疑', definition: 'a task that tests ability, or to question something' },
  { word: 'channel', phonetic: '/ˈtʃænl/', pos: 'n.', translation: 'n. 频道；渠道；海峡', definition: 'a route or passage along which something travels' },
  { word: 'charity', phonetic: '/ˈtʃærəti/', pos: 'n.', translation: 'n. 慈善；慈善团体', definition: 'help given to those in need, or a body that gives it' },
  { word: 'circuit', phonetic: '/ˈsɜːkɪt/', pos: 'n.', translation: 'n. 电路；环形路线', definition: 'a closed path, especially one carrying electricity' },
  { word: 'client', phonetic: '/ˈklaɪənt/', pos: 'n.', translation: 'n. 客户，委托人', definition: 'a person who pays for a professional service' },
  { word: 'climate', phonetic: '/ˈklaɪmət/', pos: 'n.', translation: 'n. 气候；风气，氛围', definition: 'the usual weather of a place, or a general mood' },
  { word: 'combine', phonetic: '/kəmˈbaɪn/', pos: 'v.', translation: 'v. 结合，联合；兼有', definition: 'to join two or more things so they work as one' },
  { word: 'comment', phonetic: '/ˈkɒment/', pos: 'n.', translation: 'n. 评论，意见；v. 发表看法', definition: 'a spoken or written remark expressing an opinion' },
  { word: 'commit', phonetic: '/kəˈmɪt/', pos: 'v.', translation: 'v. 承诺；投入；犯下', definition: 'to promise yourself to something, or to do a wrong act' },
  { word: 'compare', phonetic: '/kəmˈpeə(r)/', pos: 'vt.', translation: 'vt. 比较，对照；比作', definition: 'to look at things to see how they are alike or different' },
  // 第 51 个：留给课上查词，**不进生词本**
  { word: 'blossom', phonetic: '/ˈblɒsəm/', pos: 'n.', translation: 'n. 花，花朵；v. 开花，繁盛', definition: 'the flower of a tree, or to start to grow well' },
];

// ─────────────────────────────────────────────────────────────
// 安全错误
// ─────────────────────────────────────────────────────────────

const SAFE_ERRORS = new WeakSet();

class S12fDictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'S12fDictError';
    SAFE_ERRORS.add(this);
  }
}

const GENERIC_FAILURE = [
  'S12F 词典补种未执行：运行期失败。',
  '细节被刻意隐去 —— 底层错误的文本里可能含有数据库连接串、账号或主机名。',
].join('\n');

function reportFailure(e, log = console.error) {
  if (SAFE_ERRORS.has(e) && typeof e.message === 'string') {
    log(['', 'S12F 词典补种未执行：', e.message, ''].join('\n'));
    return;
  }
  log(['', GENERIC_FAILURE, ''].join('\n'));
}

// ─────────────────────────────────────────────────────────────
// 清单校验与哈希
// ─────────────────────────────────────────────────────────────

const FIELDS = ['word', 'phonetic', 'pos', 'translation', 'definition'];

/** 规范化成一行 —— 哈希与逐字比对都用它，两边口径必须完全一致。 */
function canonical(row) {
  return FIELDS.map((f) => String(row[f] ?? '')).join('␟');
}

function manifestHash(rows = MANIFEST) {
  const body = rows.map(canonical).join('␞');
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex');
}

/** 库里已有的那八个词 —— 只用来断言「清单没碰它们」。 */
const ORIGINAL_EIGHT = ['anchor', 'harbour', 'lantern', 'meadow', 'pebble', 'ripple', 'vessel', 'willow'];

const PLACEHOLDERS = ['todo', 'fixme', 'placeholder', 'dummy', 'xxx', 'n/a'];

function assertManifest(rows = MANIFEST) {
  if (!Array.isArray(rows) || rows.length !== 51) {
    throw new S12fDictError(`拒绝执行：清单必须正好 51 行，实际 ${Array.isArray(rows) ? rows.length : 0} 行。`);
  }
  const words = rows.map((r) => r.word);
  if (new Set(words).size !== 51) throw new S12fDictError('拒绝执行：清单里有重复的词。');
  const reserved = words.filter((w) => w === RESERVED_WORD);
  if (reserved.length !== 1) throw new S12fDictError(`拒绝执行：留给查词的 ${RESERVED_WORD} 必须正好出现一次。`);

  const translations = new Set();
  const definitions = new Set();
  for (const r of rows) {
    if (!/^[a-z]{4,12}$/.test(String(r.word || ''))) {
      throw new S12fDictError(`拒绝执行：${r.word} 不是 4–12 个纯小写字母。`);
    }
    if (ORIGINAL_EIGHT.includes(r.word)) {
      throw new S12fDictError(`拒绝执行：${r.word} 是库里原有的词，本脚本一行都不许碰它们。`);
    }
    if (!/^\/.+\/$/.test(String(r.phonetic || ''))) {
      throw new S12fDictError(`拒绝执行：${r.word} 的音标不合格。`);
    }
    if (String(r.translation || '').trim().length < 4 || !/[一-龥]/.test(String(r.translation))) {
      throw new S12fDictError(`拒绝执行：${r.word} 缺少像样的中文释义。`);
    }
    const m = String(r.translation).trim().match(/^(vt|vi|n|v|adj|adv|a|ad|prep|conj|pron)\./i);
    if (!m) throw new S12fDictError(`拒绝执行：${r.word} 的释义没有以词性开头（干扰项按词性配对要用）。`);
    if (!String(r.pos || '').toLowerCase().startsWith(m[1].toLowerCase())) {
      throw new S12fDictError(`拒绝执行：${r.word} 的 pos 与释义前缀不一致。`);
    }
    if (String(r.definition || '').trim().length < 11) {
      throw new S12fDictError(`拒绝执行：${r.word} 缺少像样的英文释义。`);
    }
    const blob = JSON.stringify(r).toLowerCase();
    for (const bad of PLACEHOLDERS) {
      if (blob.includes(bad)) throw new S12fDictError(`拒绝执行：${r.word} 里有占位内容（${bad}）。`);
    }
    translations.add(String(r.translation).trim());
    definitions.add(String(r.definition).trim());
  }
  if (translations.size !== 51) throw new S12fDictError('拒绝执行：有重复的中文释义 —— 不许靠复制粘贴凑数。');
  if (definitions.size !== 51) throw new S12fDictError('拒绝执行：有重复的英文释义。');
  return true;
}

// ─────────────────────────────────────────────────────────────
// 闸门
// ─────────────────────────────────────────────────────────────

function assertEnvGates(env = ENV_AT_STARTUP) {
  for (const key of Object.keys(EXPECTED_RAILWAY)) {
    if (env[key] !== EXPECTED_RAILWAY[key]) {
      throw new S12fDictError(
        `拒绝执行：${key} 与 staging 的固定取值不符。\n` +
          '这道闸门保证脚本只可能打到 exam-staging-manual / production / Postgres 上。',
      );
    }
  }

  let url = null;
  try {
    const raw = env.DATABASE_PUBLIC_URL;
    if (typeof raw !== 'string' || raw.length === 0) throw new Error('empty');
    const parsed = new URL(raw);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error('scheme');
    if (!parsed.hostname) throw new Error('host');
    if (!parsed.port) throw new Error('port');
    if (!parsed.pathname || parsed.pathname === '/') throw new Error('database');
    url = parsed;
  } catch (e) {
    throw new S12fDictError('拒绝执行：DATABASE_PUBLIC_URL 不是一个合法的 PostgreSQL 连接 URL。');
  }
  if (!env.RAILWAY_TCP_PROXY_DOMAIN || url.hostname !== env.RAILWAY_TCP_PROXY_DOMAIN) {
    throw new S12fDictError('拒绝执行：DATABASE_PUBLIC_URL 的主机名不等于 RAILWAY_TCP_PROXY_DOMAIN。');
  }
  if (!env.RAILWAY_TCP_PROXY_PORT || String(url.port) !== String(env.RAILWAY_TCP_PROXY_PORT)) {
    throw new S12fDictError('拒绝执行：DATABASE_PUBLIC_URL 的端口不等于 RAILWAY_TCP_PROXY_PORT。');
  }

  // **词典插入有自己的确认串** —— 夹具那一个在这里不作数。
  // 共享参考数据的写入必须是一个单独的、有意识的动作。
  if (env.S12F_DICT_CONFIRM !== DICT_CONFIRMATION) {
    throw new S12fDictError(
      `拒绝执行：需要逐字确认 S12F_DICT_CONFIRM=${DICT_CONFIRMATION}\n` +
        '这会往**全局共享的**词典里插入 51 行。',
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 三态判定
// ─────────────────────────────────────────────────────────────

/**
 * 库里已有的行 vs 清单，只可能是三种状态：
 *
 *   · `all-absent`     —— 一个都不在。首次执行的正常状态。
 *   · `already-seeded` —— 51 个全在，且**逐字段相同**。幂等重跑，什么都不做。
 *   · `mismatch`       —— 其余一切。部分在、内容不一样、多出别的 —— 一律 NO-GO。
 *
 * 「补上缺的那几个」听起来很合理，但它意味着库里那几个已存在的行是别人写的、
 * 内容未知，而我要在它们旁边插入自己的版本 —— 那是在共享数据上制造混合状态。
 */
function classifyExisting(existing) {
  const byWord = new Map((existing || []).map((r) => [String(r.word), r]));
  const missing = [];
  const conflicting = [];
  for (const row of MANIFEST) {
    const found = byWord.get(row.word);
    if (!found) {
      missing.push(row.word);
      continue;
    }
    if (canonical(found) !== canonical(row)) conflicting.push(row.word);
  }
  if (conflicting.length > 0) return { kind: 'mismatch', missing, conflicting };
  if (missing.length === 51) return { kind: 'all-absent', missing, conflicting };
  if (missing.length === 0) return { kind: 'already-seeded', missing, conflicting };
  return { kind: 'mismatch', missing, conflicting };
}

const L = (s) => `'${String(s).replace(/'/g, "''")}'`;
const MANIFEST_LIST = MANIFEST.map((r) => L(r.word)).join(',');
const ORIGINAL_LIST = ORIGINAL_EIGHT.map(L).join(',');

async function readManifestRows(tx) {
  return tx.$queryRawUnsafe(
    `/* s12fdict:manifest-rows */
     SELECT word, coalesce(phonetic,'') AS phonetic, coalesce(pos,'') AS pos,
            translation, coalesce(definition,'') AS definition
     FROM "DictEntry" WHERE word IN (${MANIFEST_LIST}) ORDER BY word`,
  );
}

async function dictTotal(tx) {
  const r = await tx.$queryRawUnsafe(`/* s12fdict:dict-total */ SELECT count(*)::int AS n FROM "DictEntry"`);
  return Number(r[0].n);
}

async function originalHash(tx) {
  const r = await tx.$queryRawUnsafe(
    `/* s12fdict:original-rows */
     SELECT md5(string_agg(
       word || '|' || coalesce(phonetic,'') || '|' || coalesce(pos,'') || '|' ||
       translation || '|' || coalesce(definition,''), ',' ORDER BY word)) AS hash
     FROM "DictEntry" WHERE word IN (${ORIGINAL_LIST})`,
  );
  return r[0] ? r[0].hash : null;
}

// ─────────────────────────────────────────────────────────────
// 插入（只插不改不删）
// ─────────────────────────────────────────────────────────────

async function seedInTransaction(tx) {
  assertManifest();
  const existing = await readManifestRows(tx);
  const cls = classifyExisting(existing);

  if (cls.kind === 'mismatch') {
    throw new S12fDictError(
      '拒绝执行：词典处于既不是「全空」也不是「已补种」的状态。\n' +
        `  已在库里但内容不一致：${cls.conflicting.length} 个${cls.conflicting.length ? `（例如 ${cls.conflicting.slice(0, 5).join(', ')}）` : ''}\n` +
        `  还缺：${cls.missing.length} 个\n` +
        '共享数据上不做「补一补」—— 混合状态一律 NO-GO，请人工确认后再说。',
    );
  }
  if (cls.kind === 'already-seeded') {
    return { kind: cls.kind, inserted: 0, manifestHash: manifestHash() };
  }

  // 全空 → 一次性插入 51 行。**createMany 且 skipDuplicates: false** ——
  // 撞了就报错，绝不悄悄跳过（跳过等于默认「库里那行是对的」）。
  const res = await tx.dictEntry.createMany({
    data: MANIFEST.map((r) => ({
      word: r.word,
      phonetic: r.phonetic,
      pos: r.pos,
      translation: r.translation,
      definition: r.definition,
    })),
    skipDuplicates: false,
  });
  return { kind: cls.kind, inserted: Number(res && res.count != null ? res.count : 51), manifestHash: manifestHash() };
}

/** 写完之后在同一个事务里回读 —— 对不上就整体回滚。 */
async function verifyAfterSeed(tx, before) {
  const total = await dictTotal(tx);
  const origin = await originalHash(tx);
  const rows = await readManifestRows(tx);

  const problems = [];
  if (total !== before.total + 51) {
    problems.push(`词典总数应为 ${before.total + 51}，实际 ${total}`);
  }
  if (origin !== before.originalHash) {
    problems.push('库里原有的八个词发生了变化');
  }
  const cls = classifyExisting(rows);
  if (cls.kind !== 'already-seeded') {
    problems.push(`51 行没有全部逐字落库（缺 ${cls.missing.length} · 不一致 ${cls.conflicting.length}）`);
  }
  if (problems.length > 0) {
    throw new S12fDictError(`回读校验不通过（事务将回滚）：\n  · ${problems.join('\n  · ')}`);
  }
  return { total, inserted: 51, manifestHash: manifestHash() };
}

// ─────────────────────────────────────────────────────────────
// 回滚预检 —— **只算不删**
// ─────────────────────────────────────────────────────────────

/**
 * 算出「如果要回滚，会删哪些词」，并把所有拦阻条件查一遍。
 *
 * **它永远不执行删除**（返回值里 `executed` 恒为 false，也没有任何写语句）。
 * 真正执行需要另一份合同 —— 这里只保证「到时候有一条安全的路可走」。
 */
async function rollbackPreflight(tx, opts) {
  const confirm = (opts && opts.confirm) || '';
  if (confirm !== ROLLBACK_CONFIRMATION) {
    throw new S12fDictError(
      `拒绝：回滚需要它自己的确认串 S12F_ROLLBACK_STAGING_DICTIONARY。\n` +
        '补种的那个确认串在这里不作数 —— 删除必须是另一个有意识的动作。',
    );
  }
  assertManifest();

  const rows = await readManifestRows(tx);
  const cls = classifyExisting(rows);
  if (cls.kind !== 'already-seeded') {
    throw new S12fDictError(
      '拒绝回滚：库里这 51 行与清单对不上（缺失或被改过）。\n' +
        '内容不是我写的那一份，就不该由我删。',
    );
  }

  const acct = await tx.$queryRawUnsafe(
    `/* s12fdict:account-present */ SELECT count(*)::int AS n FROM "User" WHERE id = ${L(ACCOUNT_ID)}`,
  );
  if (Number(acct[0].n) !== 0) {
    throw new S12fDictError('拒绝回滚：S12F 验收账号还在。要先撤掉账号，才谈得上撤词典。');
  }

  const owned = await tx.$queryRawUnsafe(
    `/* s12fdict:owned-rows */
     SELECT ((SELECT count(*) FROM "StudentWord" WHERE id LIKE '${OWNED_PREFIX}%')
           + (SELECT count(*) FROM "MistakeEntry" WHERE id LIKE '${OWNED_PREFIX}%')
           + (SELECT count(*) FROM "VocabQuizAttempt" WHERE id LIKE '${OWNED_PREFIX}%')
           + (SELECT count(*) FROM "Question" WHERE id LIKE '${OWNED_PREFIX}%'))::int AS n`,
  );
  if (Number(owned[0].n) !== 0) {
    throw new S12fDictError(`拒绝回滚：还有 ${owned[0].n} 行 ${OWNED_PREFIX} 资源没清干净。`);
  }

  // 有**别人**引用这些词吗 —— 引用还在就不能删词典行。
  const refs = await tx.$queryRawUnsafe(
    `/* s12fdict:referencing-rows */
     SELECT ((SELECT count(*) FROM "StudentWord" WHERE lower(headword) IN (${MANIFEST_LIST}))
           + (SELECT count(*) FROM "MistakeEntry" WHERE lower("vocabWord") IN (${MANIFEST_LIST}))
           + (SELECT count(*) FROM "VocabQuizAttempt" a
                WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(a.items::jsonb) it
                              WHERE lower(it->>'headword') IN (${MANIFEST_LIST}))))::int AS n`,
  );
  if (Number(refs[0].n) !== 0) {
    throw new S12fDictError(
      `拒绝回滚：还有 ${refs[0].n} 行非 S12F 的数据引用了这些词（生词 / 错题 / 测试快照）。`,
    );
  }

  return {
    executed: false,
    confirmationRequired: ROLLBACK_CONFIRMATION,
    wouldDelete: MANIFEST.map((r) => r.word),
    wouldPreserve: [...ORIGINAL_EIGHT],
    statement: `DELETE FROM "DictEntry" WHERE word IN (${MANIFEST_LIST})`,
    manifestHash: manifestHash(),
  };
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

async function main() {
  assertEnvGates();
  assertManifest();

  process.env.DATABASE_URL = ENV_AT_STARTUP.DATABASE_PUBLIC_URL;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });

  let out;
  try {
    out = await prisma.$transaction(
      async (tx) => {
        const before = { total: await dictTotal(tx), originalHash: await originalHash(tx) };
        const seeded = await seedInTransaction(tx);
        if (seeded.kind === 'already-seeded') {
          return { ...seeded, total: before.total, before };
        }
        const after = await verifyAfterSeed(tx, before);
        return { ...seeded, ...after, before };
      },
      { maxWait: 30_000, timeout: 120_000 },
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    [
      '',
      'S12F 词典补种完成。',
      `  状态          : ${out.kind}`,
      `  插入行数      : ${out.inserted}`,
      `  词典总数      : ${out.before.total} → ${out.total}`,
      `  清单哈希      : ${out.manifestHash}`,
      `  原有八词      : 未改动（回读比对通过）`,
      '',
    ].join('\n'),
  );
}

module.exports = {
  DICT_CONFIRMATION,
  ROLLBACK_CONFIRMATION,
  RESERVED_WORD,
  EXPECTED_RAILWAY,
  MANIFEST,
  ORIGINAL_EIGHT,
  S12fDictError,
  reportFailure,
  canonical,
  manifestHash,
  assertManifest,
  assertEnvGates,
  classifyExisting,
  readManifestRows,
  dictTotal,
  originalHash,
  seedInTransaction,
  verifyAfterSeed,
  rollbackPreflight,
  main,
};

if (require.main === module) {
  main().catch((e) => {
    reportFailure(e);
    process.exit(1);
  });
}
