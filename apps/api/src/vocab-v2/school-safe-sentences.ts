/**
 * 校园内容闸门·句子级 —— 例句、例句中文、搭配词的把关处。
 *
 * ## 为什么要有这一层
 *
 * 2026-09-21 加的 `school-safe-words.ts` 只拦**单词**（黑名单 10 个）。
 * 2026-10-20 出事：`oral`（口头的，NAWL 第 173 名）是个再正经不过的词，
 * 闸门照常放行，可它从 Tatoeba 取回来的例句是 "What is oral sex?"，中文
 * 翻译还老老实实写着「什麼是口交？」—— 9/28 起推给了 19 个学生 24 次，
 * 叶老师是看到学生端截图才知道的。
 *
 * 同一批语料还喂出了搭配词（`collocationsFromExamples` 就是从这些例句里
 * 抽的词组），所以 `oral` 的搭配里列着 "oral sex"、`yourself` 的搭配里是
 * **"kill yourself"**、`adolescents` 的是 "adolescents masturbate"。
 * 全库一共 78 条例句 + 38 个义项的搭配中招，涉及 43 个学生。
 *
 * 教训很简单：**词干净不代表句子干净**。词表是通用语料排名，Tatoeba 是
 * 成年人写给成年人的开放语料，两者都没有中学课堂这个前提。
 *
 * ## 这一层拦什么
 *
 * 只拦「放到中学生屏幕上就是事故」的那几类：性、粗口、自伤、凶杀、
 * 恐怖主义、成瘾。中英文都查 —— 英文句子干净但中文翻译露骨的情况真实
 * 存在（Tatoeba 的中译是另一批人贡献的）。
 *
 * **不拦**学科里正当的用法：`asexual reproduction`（无性生殖）不含
 * `\bsexual\b` 的词边界所以天然放行，`primary alcohols into aldehydes`
 * （化学）、`blood pressure`（医学）、`jumped the gun`（习语）同理。
 * 宁可多拦一句 —— 代价只是那个词暂时没有例句，而漏一句的代价你已经
 * 见过了。
 *
 * ## 接在哪
 *
 * 1. `tatoebaExamples()` 取回语料就过一遍 —— 源头拦住，例句和搭配词
 *    一起干净（搭配词是从例句抽的）。
 * 2. 写库时再过一遍 —— AI 生成的例句不走 Tatoeba 那条路。
 * 3. `contextForEncounter()` 推送前**硬过滤** —— 历史脏数据不会因为
 *    「这个词一条干净例句都不剩」的兜底逻辑被捞回来。
 * 4. `cardSnapshot()` 的搭配词过一遍 —— 老义项里残留的词组不外泄。
 *
 * 要加要减就改下面的表，不用动逻辑。
 */

/** 分类只为了出错时说得清是哪一类，拦截行为没有区别。 */
interface UnsafeRule {
  readonly label: string;
  readonly pattern: RegExp;
}

const RULES: readonly UnsafeRule[] = [
  // ── 性 ──────────────────────────────────────────────────────────
  // `\bsexual\b` 不会命中 asexual：a 和 s 之间没有词边界，无性生殖照常能教。
  { label: '性', pattern: /\bsex\b|\bsexes\b|\bsexual(ly|ity)?\b|\bhypersexual/i },
  { label: '性', pattern: /\bporn|\berotic|\bobscene\b|\blewd\b/i },
  { label: '性', pattern: /\bmasturbat|\borgasm|\bpenetration\b|\bforeplay\b/i },
  { label: '性', pattern: /\bpenis\b|\bvagina|\bgenital|\bbreasts?\b|\bnipple/i },
  { label: '性', pattern: /\bprostitut|\bbrothel\b|\bpimp\b/i },
  { label: '性', pattern: /\bnaked\b|\bnude\b|\bnudity\b|\bstriptease\b/i },
  { label: '性', pattern: /\bcondom|\bcontraceptive\b|\babortion\b/i },
  { label: '性', pattern: /口交|性交|做爱|性行为|性欲|手淫|自慰|阴茎|阴道|乳房|妓女|卖淫|嫖|色情|淫秽|猥亵|裸体|堕胎/ },

  // ── 粗口 ────────────────────────────────────────────────────────
  // 教育价值不抵在课堂上被念出来的代价。
  // fuck / shit 故意**不加**前导 `\b`：「bullshit」里 l 和 s 之间没有词边界，
  // `\bshit` 漏掉它 ——「This tradition is bullshit.」就是这么溜过第一版闸门
  // 重新进库的。motherfucker 同理。没有哪个干净的英文词里含这两个串。
  { label: '粗口', pattern: /fuck|shit|\bbitch\b|\bbastard\b|\bcunt\b|\basshole\b|\bslut\b/i },
  { label: '粗口', pattern: /\bdamn\b|\bgoddamn|\bbloody hell\b/i },
  { label: '粗口', pattern: /\bthe hell\b|\bto hell with\b|\bhell is\b/i },
  { label: '粗口', pattern: /他妈的|操你|去死|混蛋|王八蛋|婊子/ },

  // ── 自伤 ────────────────────────────────────────────────────────
  { label: '自伤', pattern: /\bsuicid|\bself-harm\b|\bcut (her|him|my|them)self\b/i },
  { label: '自伤', pattern: /\bkill (your|her|him|my|them|it)self\b/i },
  { label: '自伤', pattern: /自杀|自残|轻生/ },

  // ── 凶杀与暴力 ──────────────────────────────────────────────────
  { label: '凶杀', pattern: /\bmurder|\bhomicide\b|\bmanslaughter\b|\bassassinat/i },
  { label: '凶杀', pattern: /\brape\b|\braped\b|\brapist\b|\bmolest/i },
  // 过去式也要拦：「I killed the human being.」真的在库里躺着。
  { label: '凶杀', pattern: /\bkill(s|ed)? (him|her|them|me|you|'em|the (man|woman|boy|girl|kid|child|human))\b/i },
  { label: '凶杀', pattern: /\bshot (the|a|his|her|my) (pilot|man|woman|boy|girl|kid|child|teacher|dog|cat)\b/i },
  { label: '凶杀', pattern: /谋杀|凶杀|杀死他|杀了他|强奸|虐待儿童/ },

  // ── 恐怖主义 ────────────────────────────────────────────────────
  // 课堂词汇素材里不需要它，而语料里这类句子常常还带着族群指向。
  { label: '恐怖主义', pattern: /\bterroris|\bjihad|\bsuicide bomb/i },
  { label: '恐怖主义', pattern: /恐怖分子|恐怖主义|圣战/ },

  // ── 成瘾 ────────────────────────────────────────────────────────
  // 单独的 alcohol / drug / cigarette 不拦 —— 化学、药学、健康课都要用。
  // 单独的 drug 不拦（药学、医学要用），带上用药语境的才拦：
  // 「He is dependent on drugs.」靠 `on drugs` 命中。
  { label: '成瘾', pattern: /\bdrug (addict|dealer|abuse)\b|\baddicted to\b|\bjunkie\b/i },
  { label: '成瘾', pattern: /\b(on|take|taking|took|sell|selling|sold|do|doing) drugs\b/i },
  { label: '成瘾', pattern: /\bcocaine\b|\bheroin\b|\bmarijuana\b|\bcannabis\b|\bmeth\b|\bopium\b/i },
  // 不能用光秃秃的 `\bdrunk\b`：被动语态的「喝」也长这样 —— 库里真有
  // 「Tea is drunk more widely than any manufactured beverage on earth.」
  // 这条正经阅读材料。只拦醉酒义。
  { label: '成瘾', pattern: /\bdrunkenness\b|\bdrunken\b|\bbooze\b|\bgot wasted\b/i },
  { label: '成瘾', pattern: /\b(get|got|getting|dead|so|very|too|super|totally|completely)\s+drunk\b|\bdrunk driving\b/i },
  { label: '成瘾', pattern: /\b(want|have|smoke|smoking|lit) a cigarette\b|\bchain-smok/i },
  { label: '成瘾', pattern: /吸毒|毒品|瘾君子|大麻|海洛因|可卡因|酗酒|醉醺醺/ },
];

/** 命中了就返回分类名（给日志和测试用），没命中返回 null。 */
export function schoolUnsafeReason(text: unknown): string | null {
  const value = String(text ?? '');
  if (!value.trim()) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(value)) return rule.label;
  }
  return null;
}

/** 这段文字能不能出现在学生屏幕上。 */
export function isSchoolUnsafeText(text: unknown): boolean {
  return schoolUnsafeReason(text) !== null;
}

/**
 * 一条例句的任何一面脏了，整条就不要 —— 英文干净但中文露骨的情况
 * 是真实存在的（Tatoeba 的中译是另一批人贡献的）。
 */
export function isSchoolUnsafeContext(row: { sentence?: unknown; translation?: unknown; text?: unknown }): boolean {
  return isSchoolUnsafeText(row.sentence) || isSchoolUnsafeText(row.text) || isSchoolUnsafeText(row.translation);
}

/** 过掉脏词组；顺序原样保留。搭配词是从例句抽的，所以同一张表够用。 */
export function keepSchoolSafeTexts(texts: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(texts)) return [];
  return texts.filter((text) => typeof text === 'string' && !isSchoolUnsafeText(text)) as string[];
}

/** 过掉脏例句；顺序原样保留。 */
export function keepSchoolSafeContexts<T extends { sentence?: unknown; translation?: unknown; text?: unknown }>(
  rows: readonly T[] | null | undefined,
): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => !isSchoolUnsafeContext(row));
}

/** 这次事故后给历史数据打的状态值；库里已有 78 条。 */
export const SCHOOL_BLOCKED_QUALITY_STATUS = 'blocked_school';
