import { PrismaClient } from '@prisma/client';

/**
 * Write back chat-graded marks for today's marker queue.
 *
 * Per [[ai-api-usage-policy]] — short-answer grading is done by Claude
 * in chat. marker-dump.ts surfaces the data, this script applies the
 * decisions. Zero Anthropic API calls.
 *
 * Embeds the grade decisions inline (`GRADES` map below) — re-edit
 * before each run. Idempotent if a script has already been graded
 * (skips it).
 *
 * Behaviour, mirroring marker.service.finalize:
 *   1. Look up an admin user to use as markedById.
 *   2. For each (scriptId, awardedMarks, reason):
 *        - update AnswerScript: awardedMarks, markerComment, markedById, markedAt
 *   3. For each affected submission (deduped):
 *        - recompute autoScore (MCQ + non-marker-graded SA) +
 *          manualScore (marker-graded SA) + totalScore = sum
 *        - if every structured script now has awardedMarks set,
 *          flip status: submitted → marked
 *
 * Skips the markerAssignment claim flow — we're acting as the admin
 * user directly, no concurrent marker.
 */

const GRADES_0728: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-07-28 早测 · authentic=ielts_authored_2026_v2/Test1/P1 (Cephalopods)
  // olevel=ai_authored_olevel_35_provision_shop (Ah Seng 杂货店). MCQ 交卷时已自动判分,
  // 这里只判未自动匹配的短答. 全 Claude 在 chat 判,零 AI.

  // ── 雅思 段落匹配/填空/图标(留到人工的都是错的)──
  cms3xqyv201j06894nto4xhni: { awardedMarks: 0, reason: '段2:C,正解G。' },
  cms3xwjox01oc68945m7xb85h: { awardedMarks: 0, reason: '段3:D,正解H。' },
  cms3x7jxq00w06894eztqinpp: { awardedMarks: 0, reason: '段1:B,正解A。' },
  cms3x7nm500w468941lr8ostv: { awardedMarks: 0, reason: '段2:A,正解G。' },
  cms3x7yia00wx6894bv3v23vp: { awardedMarks: 0, reason: '段3:C,正解H。' },
  cms3x8b9m00x86894o5raod94: { awardedMarks: 0, reason: '段4:H,正解B。' },
  cms3xaqnu010e6894pb90669u: { awardedMarks: 0, reason: '段1:D,正解A。' },
  cms3xg5nm016l6894g0clkxop: { awardedMarks: 0, reason: '段2:F,正解G。' },
  cms3xex96014u68942p5y9t2o: { awardedMarks: 0, reason: '段4:G,正解B。' },
  cms3xo8je01h36894ckckoxdc: { awardedMarks: 0, reason: '图12:"Chromatography"(色谱)错,应 chromatophores。' },
  cms3xi2qi01a668949e1qhlbz: { awardedMarks: 0, reason: '填10:"interferance" 拼写错,应 interference(雅思拼写须正确)。' },
  cms3xiomt01b06894z7t54n3a: { awardedMarks: 0, reason: '图12:"organs" 错,应 chromatophores。' },
  cms3xj8ee01ce6894x4yasla0: { awardedMarks: 0, reason: '图13:"leocuphreoes" 拼写错,应 leucophores。' },
  cms3xruwl01jz68942joxl6v2: { awardedMarks: 0, reason: '段1:C,正解A。' },
  cms3xrzf301k768948rhctprm: { awardedMarks: 0, reason: '段2:B,正解G。' },
  cms3xs1a501kd6894g9r0g62t: { awardedMarks: 0, reason: '段3:D,正解H。' },
  cms3xs2ej01kf68940ummrs3s: { awardedMarks: 0, reason: '段4:E,正解B。' },
  cms3xtoyv01lv689445305x1o: { awardedMarks: 0, reason: '段2:C,正解G。' },
  cms3y391r01uf6894o5anxdy2: { awardedMarks: 0, reason: '填9:"Bright" 错,应 disc。' },
  cms3xl1f001dy6894fvbfhaxr: { awardedMarks: 0, reason: '段2:h,正解G。' },
  cms3xjb1d01cs6894hnhax5c1: { awardedMarks: 0, reason: '段3:f,正解H。' },
  cms3xlt6w01e46894rgdq68sb: { awardedMarks: 0, reason: '段4:c,正解B。' },
  cms3xde29012g68947ytsphbm: { awardedMarks: 0, reason: '图12:"cheomatophore" 拼写错,应 chromatophores。' },

  // ── O-Level §B(HEIN HTET NAING)──
  cms3xal1m010468947tn6w5yw: { awardedMarks: 1, reason: 'Q1:店在 Bedok 组屋底层、咖啡店与电梯厅之间。1。' },
  cms3xc5k7011i6894jukifxyc: { awardedMarks: 1, reason: 'Q2:月底关门。1。' },
  cms3xdvj4013j6894iievahil: { awardedMarks: 1, reason: 'Q4:"squeezed into a very narrow space" 命中 wedged。1。' },
  cms3xa1yc00za6894jfp0oftb: { awardedMarks: 1, reason: 'Q5:"very old" 命中 yellowed=年久。1。' },
  cms3xmcko01eq6894wsy5ljnk: { awardedMarks: 1, reason: 'Q6:只"trusted his neighbours"(MP1信任);未及"按月出粮迟结"(MP2)。1/2。' },
  cms3xgd8u016p6894uusy6sfv: { awardedMarks: 2, reason: 'Q7:超市 + 送货上门,两点齐。2/2。' },
  cms3xsqgv01l16894pwyp50j9: { awardedMarks: 1, reason: 'Q8:"childhood memories"=不止是买东西的地方(MP1);未点出被认识/看着长大(MP2)。1/2。' },
  cms3xiaj801ag6894bys1hv4o: { awardedMarks: 1, reason: 'Q9:讲清"空/残缺如缺牙"(意象);未及失落/衰败之情。1/2。' },

  // ── O-Level §B(胡鑫瑜)──
  cms3y2o0k01tl6894lne2b72h: { awardedMarks: 1, reason: 'Q3:"became smaller/decreased" 命中 dwindled。1。' },
  cms3y347201ub6894zpa1fxg7: { awardedMarks: 0, reason: 'Q7:只复述"人少→变安静",未给原因(超市/送货)。0/2。' },
  cms3y4pcx01w86894m9rfb6ji: { awardedMarks: 2, reason: 'Q8:"far more than a place selling goods"+深厚情感/归属,两点齐。2/2。' },
  cms3y3j0c01up68947mn1g8bf: { awardedMarks: 2, reason: 'Q10:句号=长句终结+永久落幕+悲伤收束,准确。2/2。' },

  // ── O-Level §B(赵伯容)──
  cms3xc4p1011g6894mxjpefhh: { awardedMarks: 1, reason: 'Q1:组屋底层、咖啡店与电梯厅之间。1。' },
  cms3xekn1014a68941gk5qmmf: { awardedMarks: 1, reason: 'Q2:月底关门。1。' },
  cms3xhsym01946894b9kfn8ev: { awardedMarks: 1, reason: 'Q3:"customers are less" 命中 dwindled。1。' },
  cms3xmrye01ew6894jh916ax4: { awardedMarks: 1, reason: 'Q4:"small gap" 命中 wedged=窄缝。1。' },
  cms3xpud701hx6894qghm8l0f: { awardedMarks: 0, reason: 'Q5:只说"页发黄"(字面),未及"年久/旧"这一暗示。0。' },
  cms3xuj5b01mc6894twl4tnak: { awardedMarks: 1, reason: 'Q6:"想帮人"≈善意(MP1);未及按月结账(MP2)。1/2。' },
  cms3y1zgn01sd6894f4kk3m0m: { awardedMarks: 2, reason: 'Q7:超市 + 电话(送货),两点齐。2/2。' },
  cms3y5xc501wm6894f7617g4m: { awardedMarks: 1, reason: 'Q8:"not only a place buying"(MP1);后半句截断未完成 MP2。1/2。' },

  // ── O-Level §B(闫乙鑫)──
  cms3xeqwu014g6894pjlzzdfe: { awardedMarks: 1, reason: 'Q1:组屋底层、咖啡店与电梯厅之间。1。' },
  cms3xh2t7017v6894i6jlca0a: { awardedMarks: 1, reason: 'Q3:"gradually became smaller" 命中 dwindled。1。' },
  cms3xg40i016j6894o8p5sgsj: { awardedMarks: 1, reason: 'Q4:"squeezed into a small, narrow space" 命中 wedged。1。' },
  cms3xgrdq01796894uk17ucfp: { awardedMarks: 1, reason: 'Q5:"very old, kept many years" 命中 yellowed。1。' },
  cms3xgb1q016n6894vngi677j: { awardedMarks: 2, reason: 'Q6:信任 + 按月出粮迟结,两点齐。2/2。' },
  cms3xfbnq015s68942efqy4nm: { awardedMarks: 2, reason: 'Q7:超市 + 送货,两点齐。2/2。' },
  cms3xex3u014s689406pyrgik: { awardedMarks: 2, reason: 'Q8:不止买东西+看着他长大/被记得,两点齐。2/2。' },
  cms3xgiyb016v68948f5t2mhj: { awardedMarks: 2, reason: 'Q9:空/残破意象 + 失落/衰败之感,两点齐。2/2。' },
  cms3xehrw0148689402yaqf81: { awardedMarks: 2, reason: 'Q10:句号=彻底永久终结 + 童年一段的落幕,准确。2/2。' },
};

const GRADES_0729: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-07-29 早测 · authentic=ielts_authored_2026_v2/Test1/P2 (Roman Concrete)
  // olevel=ai_authored_olevel_37_monsoon_drain (季候排水渠营救). MCQ 交卷时已自动判分,
  // 客观短答(段落匹配/填空)交卷时按精确匹配自动判分,这里只判"未精确命中"留人工的.
  // 全 Claude 在 chat 判,零 AI.

  // ── 雅思 段落匹配/填空(留人工的多为错答;个别是拼写/连字符变体)──
  cms5cva14011idox8txngwiyf: { awardedMarks: 0, reason: "填10:'Pozzuolianic' 拼写错(把地名 Pozzuoli 混进来),应 pozzolanic;雅思须拼写正确。0。" },
  cms5cq1m700ujdox8ia0j409a: { awardedMarks: 0, reason: '段1匹配:C,正解 G。' },
  cms5cq7p100utdox8j5ylyuau: { awardedMarks: 0, reason: '段2:B,正解 C。' },
  cms5cqa0200uzdox8ab3ui7sw: { awardedMarks: 0, reason: '段3:G,正解 H。' },
  cms5cqd2g00v5dox8mvmnkrdp: { awardedMarks: 0, reason: '段4:I(无效,仅 A–H),正解 B。' },
  cms5dcbvx01azdox874dirn3b: { awardedMarks: 0, reason: '段1:B,正解 G。' },
  cms5d553v0183dox817etynor: { awardedMarks: 0, reason: '段3:D,正解 H。' },
  cms5dg5kv01c2dox852bfzh4s: { awardedMarks: 0, reason: '段4:E,正解 B。' },
  cms5d27ru0162dox8l1jpuk5u: { awardedMarks: 1, reason: "填11:'Al‑tobermorite' 仅连字符字符不同(Unicode ‑),拼写完全正确。1。" },
  cms5cuge1010mdox8oyn00loe: { awardedMarks: 0, reason: "填10:'pozolanic' 少一个 z,拼写错。0。" },
  cms5cux7d011adox84tqk0tdd: { awardedMarks: 0, reason: "填11:'toberonic' 拼写乱,应 Al-tobermorite。0。" },
  cms5dexiy01bndox8xk0t2pov: { awardedMarks: 0, reason: '段1:e,正解 G。' },
  cms5dehh001bjdox89lewn0kq: { awardedMarks: 0, reason: '段3:f,正解 H。' },
  cms5di24501cedox8ocvft4o9: { awardedMarks: 1, reason: "填11:'Altobermorite' 词拼对,仅缺连字符;接受。1。" },
  cms5cpt9200ttdox8zpuw1r11: { awardedMarks: 0, reason: '段1:C,正解 G。' },
  cms5cpyhg00u6dox8g91dt6ka: { awardedMarks: 0, reason: '段2:B,正解 C。' },
  cms5cq3g100updox808i4zp8o: { awardedMarks: 0, reason: '段3:A,正解 H。' },
  cms5cq9ug00uxdox8enl7dydj: { awardedMarks: 0, reason: '段4:E,正解 B。' },

  // ── O-Level §B(HEIN HTET NAING)──
  cms5czzes0140dox8z69ljege: { awardedMarks: 1, reason: "Q1:命中'deep, fast-flowing water'(危险深急水流)。1。" },
  cms5d2cg90168dox8f9rb5bki: { awardedMarks: 1, reason: 'Q2:去捡回他的红球。1。' },
  cms5cu3vg0100dox8xkh6spe4: { awardedMarks: 1, reason: "Q3:'suddenly and violently' 命中 surge=突然而猛。1。" },
  cms5d19eq014sdox8d6a49iok: { awardedMarks: 0, reason: "Q4:'very wet' 只重复'湿'(原文已说 slick with rain),未点出 slick=滑。0。" },
  cms5d3pfv017mdox8x3qyh0we: { awardedMarks: 1, reason: "Q5:'slowly and carefully' 命中 picked their way=小心慢行。1。" },
  cms5cz0i8012ydox852ymcw6v: { awardedMarks: 1, reason: "Q7:抓到'事后才真正懂得严重性'(MP2);未及'此前只当熟视的字句'(MP1)。1/2。" },
  cms5cx0f8011zdox8u8qmqb4u: { awardedMarks: 1, reason: "Q9:点出'水势凶、Jun 无助、危险感增强'(效果);未指出拟人手法(把水写成蓄意活物)。1/2。" },

  // ── O-Level §B(赵伯容 · 未答 MCQ,仅短答 Q1–7)──
  cms5croez00w3dox8nn71uf51: { awardedMarks: 0, reason: "Q1:'warning...when climbing' 未说出警示内容(深、急水流)。0。" },
  cms5dm7o801eadox8d988cx0f: { awardedMarks: 1, reason: 'Q2:因丢了红球而下去捡。1。' },
  cms5cybgf012bdox8838zyz3o: { awardedMarks: 0, reason: "Q3:'moved quickly' 只表快,未及 surge 的突然/猛。0。" },
  cms5d22vg015udox8p9ystdjj: { awardedMarks: 0, reason: "Q4:'smooth' 未点出 slick=湿滑。0。" },
  cms5dbbn8019sdox8juwcy6mh: { awardedMarks: 0, reason: "Q5:'sharply' 与 picked their way(小心慢行)相反。0。" },
  cms5dkcy001d2dox83twcdr2a: { awardedMarks: 0, reason: "Q6:'flat is more safer' 太笼统,未给'借力/杠杆'(MP1)或'下去会被冲走'(MP2)。0/2。" },
  cms5dn66d01emdox84hxbvrvv: { awardedMarks: 1, reason: "Q7:'不只是一个字'→此前当作寻常字句(MP1);答案被截断,MP2 未完成。1/2。" },
};

// Finalize-sweep — every non-practice submission in these assignments gets
// its status flipped submitted→marked (recomputing scores), even the fully
// auto-graded ones (0 parked items) and blank submissions (no scripts). The
// GRADES map alone only reaches submissions that had a parked item.
const SWEEP_ASSIGNMENTS: string[] = [
  'b58fa2e5-8fc9-40da-aa3a-052b8aaa93bc', // 2026-07-29 IELTS authentic (Roman Concrete P2)
  'e496cfd7-25a5-4d2e-ad6c-32175e3bbf51', // 2026-07-29 O-Level (monsoon drain)
];

const GRADES: Record<string, { awardedMarks: number; reason: string }> = GRADES_0729;
const _OLD_GRADES: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-07-24 早测 · ielts_authentic = cambridge_ielts_8/Test1/P1
  // "A Chronicle of Timekeeping"(Q1-4 段落匹配 A-H;Q9-13 图标注 ≤2词).
  // olevel §B = 二手化学课本叙事文(短答 Q1-5). 全部 Claude 在 chat 判,零 AI.
  // 判图标注标准:≤2词 且 含关键词(官方 mark scheme 括号内词可选,如
  // "(escape) wheel" / "(ship's) anchor").段落匹配为精确字母.

  // 刘亦佳 (ielts_authentic)
  cmry7o3rb00z69rg1gyi0iwtz: { awardedMarks: 1, reason: '图10:"escape wheel" 含关键词 wheel,≤2词。1。' },

  // 刘钇村 (ielts_authentic · 段落匹配全错)
  cmry7wahf012i9rg16bfubtxg: { awardedMarks: 0, reason: '段1:A,正确 D。' },
  cmry7wffy012o9rg1vs4vgwik: { awardedMarks: 0, reason: '段3:C,正确 F。' },
  cmry7whfa012s9rg1m8ucoou3: { awardedMarks: 0, reason: '段4:D,正确 E。' },

  // 叶雅滋 (ielts_authentic · 图标注)
  cmry82wwh00tuqmedpp9f54gj: { awardedMarks: 0, reason: '图10:"S" 无效,正确 wheel。' },
  cmry82mgn00tfqmed4egu73z9: { awardedMarks: 0, reason: '图11:"Pendulum"≠tooth。' },
  cmry81how00smqmedcecujmdl: { awardedMarks: 0, reason: '图12:"Small arc" 错,正确 pendulum。' },

  // 孔凡今 (ielts_authentic)
  cmry7vorh01209rg1kcokmxyt: { awardedMarks: 0, reason: '段3:G,正确 F。' },
  cmry7vorh01229rg1rtanka2k: { awardedMarks: 0, reason: '段4:H,正确 E。' },

  // 李淳 (ielts_authentic)
  cmry7koi400wr9rg18bn7v2pe: { awardedMarks: 1, reason: '图9:"ship\'s anchor"=文中擒纵器形似船锚,≤2词。1。' },
  cmry7l07a00wt9rg1q6lzlfqq: { awardedMarks: 1, reason: '图10:"escape wheel" 含 wheel。1。' },
  cmry7l7lb00wv9rg1m1viqld1: { awardedMarks: 0, reason: '图11:"long pendulum"≠tooth。' },
  cmry7le5q00x19rg1l80id7ia: { awardedMarks: 0, reason: '图12:"floor-standing case"≠pendulum。' },

  // 杨钧皓 (ielts_authentic · 段落填小写乱字母 + 图标注)
  cmry8ba4d00tbo2n92fvc1yso: { awardedMarks: 0, reason: '段1:f,正确 D。' },
  cmry8bhw800tvo2n9cy99h7l4: { awardedMarks: 0, reason: '段2:a,正确 B。' },
  cmry8bnj100u7o2n9xa0h0f3f: { awardedMarks: 0, reason: '段3:d,正确 F。' },
  cmry8bsms00ubo2n9m5i5dys7: { awardedMarks: 0, reason: '段4:h,正确 E。' },
  cmry8fvwg00x7o2n9ep4mqnud: { awardedMarks: 0, reason: '图10:"address" 错,正确 wheel。' },
  cmry8gd6z00xzo2n96p61q0pz: { awardedMarks: 0, reason: '图12:"long" 缺 pendulum。' },

  // 林寅嘉 (ielts_authentic)
  cmry7lr8o00xp9rg173s31j36: { awardedMarks: 0, reason: '段3:G,正确 F。' },
  cmry7mdvr00yf9rg1pgkuelqe: { awardedMarks: 0, reason: '图10:"pendulum"≠wheel。' },

  // 胡齐家 (ielts_authentic · 第10题写"我看不到题" → 手机看不到原文/题 bug)
  cmry7z3a801489rg12mniyn0p: { awardedMarks: 0, reason: '段4:C,正确 E。' },
  cmry86jpf00xpqmed4txsf8rw: { awardedMarks: 1, reason: '图9:"Ship\'s anchor" 命中 anchor。1。' },
  cmry8194l00sgqmedgct6nytb: { awardedMarks: 0, reason: '图10:空答("我看不到题")。0。※手机端看不到原文 bug,已修。' },
  cmry8gj4i00y3o2n9e55yucch: { awardedMarks: 0, reason: '图13:"Electronic devices" 错,正确 second。' },

  // 赵伯容 (olevel · §B 短答 二手化学课本)
  cmry7wpcs01309rg14kaok0og: { awardedMarks: 1, reason: 'Q1:"He paid 8$"=eight dollars。1。' },
  cmry810kp00s4qmed5r5w3tb2: { awardedMarks: 1, reason: 'Q2:"It was 2009"=2009。1。' },
  cmry83de000txqmed0s4bv6ep: { awardedMarks: 1, reason: 'Q3:"so old that had become soft" 抓到"旧/用旧"=worn/well-used。1。' },
  cmry8atry00t5o2n9jlp8y4v2: { awardedMarks: 0, reason: 'Q4:"very like the notes" 泛化,未点出"给予陪伴/慰藉"。0。' },
  cmry8flh700wto2n9d3x9twrq: { awardedMarks: 0, reason: 'Q5:"narrator hate capital" 文意错乱,应"几乎都已褪去"。0。' },

  // 陈乐玮 (ielts_authentic)
  cmry7jkk400v89rg1doyluv10: { awardedMarks: 0, reason: '段2:A,正确 B。' },
  cmry7s9kz01189rg1f6knpj46: { awardedMarks: 0, reason: '段3:G,正确 F。' },
  cmry83p4x00u7qmedewx29m7t: { awardedMarks: 0, reason: '图9:"anchor escapement" 指机构本身,应填其形似之物 anchor。0。' },
  cmry8dw3900w7o2n9qvljqxrh: { awardedMarks: 0, reason: '图10:"invention allowed" 片段,应 wheel。' },
  cmry85zok00x5qmedb4mzt9fv: { awardedMarks: 0, reason: '图11:"use of" 片段,应 tooth。' },
  cmry8582s00w7qmed1myg036l: { awardedMarks: 1, reason: '图12:"long pendulum" 含 pendulum,≤2词,文中"long pendulum"。1。' },
};

const prisma = new PrismaClient();

(async () => {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });
  if (!admin) {
    console.error('No admin user found — cannot record markedById.');
    process.exit(1);
  }
  console.log(`Acting as admin: ${admin.name} (${admin.id})`);

  const submissionIds = new Set<string>();
  let scriptsWritten = 0;
  let scriptsSkipped = 0;

  for (const [scriptId, { awardedMarks, reason }] of Object.entries(GRADES)) {
    const script = await prisma.answerScript.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        awardedMarks: true,
        markedById: true,
        submissionId: true,
        paperQuestion: { select: { marks: true } },
      },
    });
    if (!script) {
      console.warn(`  skip ${scriptId} — not found`);
      scriptsSkipped++;
      continue;
    }
    if (awardedMarks > script.paperQuestion.marks) {
      console.warn(
        `  skip ${scriptId} — awardedMarks ${awardedMarks} > maxMarks ${script.paperQuestion.marks}`,
      );
      scriptsSkipped++;
      continue;
    }
    if (script.markedById && script.awardedMarks != null) {
      console.log(`  skip ${scriptId} — already graded (markedById set)`);
      scriptsSkipped++;
      submissionIds.add(script.submissionId);
      continue;
    }
    await prisma.answerScript.update({
      where: { id: scriptId },
      data: {
        awardedMarks,
        markerComment: reason,
        markedById: admin.id,
        markedAt: new Date(),
      },
    });
    scriptsWritten++;
    submissionIds.add(script.submissionId);
  }

  console.log(`\nWrote ${scriptsWritten} script(s), skipped ${scriptsSkipped}.\n`);

  // Finalize-sweep — pull EVERY non-practice submission in the target
  // assignments into the finalize set, so fully-auto-graded submissions
  // (no parked item in GRADES) and blank submissions (no scripts at all)
  // also get flipped submitted→marked. The finalize loop below keeps any
  // submission with a still-ungraded structured script at 'submitted'.
  if (SWEEP_ASSIGNMENTS.length > 0) {
    const swept = await prisma.studentSubmission.findMany({
      where: { assignmentId: { in: SWEEP_ASSIGNMENTS }, status: { not: 'practice' } },
      select: { id: true },
    });
    for (const s of swept) submissionIds.add(s.id);
    console.log(
      `Sweep: added ${swept.length} submission(s) from ${SWEEP_ASSIGNMENTS.length} assignment(s) to the finalize set.\n`,
    );
  }

  // Per-submission recompute + finalize. Mirrors marker.service.finalize:
  // mcq + non-marker-graded structured → autoScore, marker-graded → manualScore.
  let finalized = 0;
  let partial = 0;
  for (const submissionId of submissionIds) {
    const sub = await prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        student: { select: { name: true } },
        scripts: {
          include: {
            paperQuestion: { include: { question: { select: { questionType: true } } } },
          },
        },
      },
    });
    if (!sub) continue;

    let mcqScore = 0;
    let autoScore = 0;
    let manualScore = 0;
    let structuredTotal = 0;
    let structuredUngraded = 0;
    for (const s of sub.scripts) {
      const t = s.paperQuestion.question.questionType;
      if (t === 'mcq') {
        mcqScore += s.awardedMarks ?? 0;
        continue;
      }
      structuredTotal++;
      if (s.awardedMarks == null) {
        structuredUngraded++;
        continue;
      }
      if (s.markedById != null) manualScore += s.awardedMarks;
      else autoScore += s.awardedMarks;
    }
    autoScore += mcqScore;
    const totalScore = autoScore + manualScore;

    if (structuredUngraded > 0) {
      // Still has ungraded scripts — write recomputed totals but keep
      // status='submitted'. The dashboard will reflect the partial.
      await prisma.studentSubmission.update({
        where: { id: submissionId },
        data: { autoScore, manualScore, totalScore },
      });
      console.log(
        `  ${sub.student.name}: partial — autoScore=${autoScore} manualScore=${manualScore} total=${totalScore}/${sub.maxScore} (still ${structuredUngraded} ungraded)`,
      );
      partial++;
      continue;
    }

    const updated = await prisma.studentSubmission.updateMany({
      where: { id: submissionId, status: 'submitted' },
      data: { status: 'marked', autoScore, manualScore, totalScore },
    });
    if (updated.count === 0) {
      // Already marked, or wrong starting status. Still write the totals.
      await prisma.studentSubmission.update({
        where: { id: submissionId },
        data: { autoScore, manualScore, totalScore },
      });
      console.log(
        `  ${sub.student.name}: scores updated (no status flip — was already marked) total=${totalScore}/${sub.maxScore}`,
      );
    } else {
      finalized++;
      console.log(
        `  ${sub.student.name}: FINALIZED  total=${totalScore}/${sub.maxScore} (auto=${autoScore} manual=${manualScore})`,
      );
    }
  }

  console.log(`\n=== Done ===\n  scripts written: ${scriptsWritten}\n  submissions finalized: ${finalized}\n  partial: ${partial}\n`);
  await prisma.$disconnect();
})();
