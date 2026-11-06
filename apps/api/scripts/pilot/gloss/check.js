// 文章点词释义门禁：node apps/api/scripts/pilot/gloss/check.js <week> <level>
// 读 content/<week>/<level>.js 的每篇正文 + content/<week>/glosses/<level>.json，全部通过才打印「全部通过」。
'use strict';
const path = require('path');
const fs = require('fs');
const { articleTokens } = require('./tokens');

const [week, level] = process.argv.slice(2);
if (!week || !level) { console.error('用法：check.js <week> <level>'); process.exit(2); }
const contentDir = path.join(__dirname, '..', 'content', week);
const pack = require(path.join(contentDir, `${level}.js`));
const file = path.join(contentDir, 'glosses', `${level}.json`);
if (!fs.existsSync(file)) { console.error(`缺文件 ${file}`); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// 校园安全：释义里一律不许出现（中英文）
const UNSAFE = /(性交|性行为|性关系|性器|性欲|性爱|性感|口交|交媾|交配|做爱|淫|妓|嫖|娼|阴茎|阴道|阴部|睾丸|精液|射精|勃起|乳房|屁股|裸|色情|春药|手淫|自慰|强奸|奸|情妇|姘|通奸|私通|下流|猥亵|粗俗|他妈|操你|屎|尿|屁|毒品|大麻|吸毒|海洛因|可卡因|鸦片|自杀|凶杀|谋杀|杀|枪|炸|恐怖|白痴|蠢|傻|疯|婊|贱|死|尸|血|赌|酒|烟|kiss|sex|drug)/i;
const CJK = /[一-鿿]/;
const POS_OK = /^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|aux\.|det\.|phr\.|名)$/;

const problems = [];
const warn = [];
let total = 0;
const days = pack.DAYS || [];
const sources = new Set(days.map((d) => d.source));
for (const k of Object.keys(data)) if (!sources.has(k)) problems.push(`多出来的文章键 ${k}（内容包里没有）`);
for (const d of days) {
  const entry = data[d.source];
  if (!entry || typeof entry !== 'object' || !entry.glosses) { problems.push(`${d.date} ${d.source}：没有 glosses`); continue; }
  const g = entry.glosses;
  const tokens = articleTokens(d.passage);
  for (const t of tokens) {
    total++;
    const e = g[t];
    if (!e) { problems.push(`${d.date} ${d.source}：缺「${t}」`); continue; }
    if (typeof e.zh !== 'string' || !e.zh.trim() || !CJK.test(e.zh)) problems.push(`${d.date}「${t}」zh 不是中文`);
    else if (e.zh.length > 24) problems.push(`${d.date}「${t}」zh 太长（${e.zh.length} 字，上限 24）`);
    if (typeof e.pos !== 'string' || !POS_OK.test(e.pos)) problems.push(`${d.date}「${t}」pos 不合规：${JSON.stringify(e.pos)}`);
    const text = `${e.zh} ${e.lemma || ''}`;
    if (UNSAFE.test(e.zh)) warn.push(`${d.date}「${t}」zh 命中敏感字「${e.zh.match(UNSAFE)[0]}」：${e.zh}（确认不是不当含义；确实需要就改说法）`);
    if (e.lemma != null && (typeof e.lemma !== 'string' || !/^[a-z][a-z' -]*$/.test(e.lemma))) problems.push(`${d.date}「${t}」lemma 不合规：${JSON.stringify(e.lemma)}`);
    void text;
  }
  const tokSet = new Set(tokens);
  const extra = Object.keys(g).filter((k) => !tokSet.has(k));
  if (extra.length) problems.push(`${d.date} ${d.source}：多出 ${extra.length} 个正文里没有的键，如 ${extra.slice(0, 5).join(', ')}`);
}
console.log(`档位 ${level}：${days.length} 篇，应覆盖 ${total} 个词`);
if (warn.length) { console.log(`敏感字提示 ${warn.length} 条：`); for (const w of warn) console.log('  ' + w); }
if (problems.length) { console.log(`不通过 ${problems.length} 条：`); for (const p of problems.slice(0, 80)) console.log('  ' + p); process.exit(1); }
console.log(warn.length ? '全部通过（有敏感字提示，逐条确认过才算交差）' : '全部通过');
