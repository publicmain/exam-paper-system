import { PrismaClient } from '@prisma/client';
import { StudentWordService } from '../src/vocab/student-word.service';
import { VocabService } from '../src/vocab/vocab.service';

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

const GRADES_0730: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-07-30 早测 · authentic=ielts_authored_2026_v2/Test1/P3 (Mending the Sky · 臭氧层)
  // olevel=ai_authored_olevel_38_red_packet (Gu Po 的红包). MCQ 与精确命中的客观短答
  // 已在交卷/锁卷时自动判分,这里只判"未精确命中"留人工的. 全 Claude 在 chat 判,零 AI.

  // ── 雅思 段落匹配(A–H 精确字母)──
  cms6sy6do01b9mnkypchqehjf: { awardedMarks: 0, reason: '段2:c,正解 F(Kigali 修正案针对替代品)。' },
  cms6s6flz00timnkymywkpyr1: { awardedMarks: 0, reason: '段2:A,正解 F。' },
  cms6s6ldi00txmnkyvqm3vfuq: { awardedMarks: 0, reason: '段3:C,正解 G(CFC 滞留数十年故恢复慢)。' },
  cms6s6oqh00ubmnkypajccxxx: { awardedMarks: 0, reason: '段4:F,正解 D(Molina 与 Rowland)。' },
  cms6se0jj0129mnky510cfl2h: { awardedMarks: 0, reason: '段1:C,正解 B(皮肤癌/白内障/浮游生物之害)。' },
  cms6se7e9012bmnkylovknefh: { awardedMarks: 0, reason: '段2:D,正解 F。' },
  cms6sf8a5012xmnkyxobe3juo: { awardedMarks: 0, reason: '段3:E,正解 G。' },
  cms6sgeer013bmnkyufml3zix: { awardedMarks: 0, reason: '段4:H,正解 D。' },
  cms6su9t501a5mnkyc7hluc97: { awardedMarks: 0, reason: '段1:C,正解 B。' },
  cms6suf7801ahmnky20e7d8cz: { awardedMarks: 0, reason: '段2:C,正解 F。' },
  cms6s7aga00wnmnkylx2qxsy3: { awardedMarks: 0, reason: '段1:F,正解 B。' },
  cms6s7fbx00x7mnkym7qwabet: { awardedMarks: 0, reason: '段2:C,正解 F。' },
  cms6s7jjm00xtmnkyufau2s09: { awardedMarks: 0, reason: '段3:B,正解 G。' },
  cms6s7mxd00xxmnkyqqfngwr9: { awardedMarks: 0, reason: '段4:A,正解 D。' },
  cms6sk4fr015pmnky5o2zg0dg: { awardedMarks: 0, reason: '段2:e,正解 F。' },
  cms6s6kgo00tvmnky8bhamwr6: { awardedMarks: 0, reason: '段2:D,正解 F。' },
  cms6s6r3m00uhmnkyn1nd7u6r: { awardedMarks: 0, reason: '段3:C,正解 G。' },
  cms6s6vuz00v3mnky4eog7zf4: { awardedMarks: 0, reason: '段4:E,正解 D。' },

  // ── 雅思 句子填空 ──
  cms6siib8014qmnky73t1stry: { awardedMarks: 0, reason: "填9:'ultraviolet radiation' 多写了 radiation —— 空格后面本来就有 radiation,填进去成 \"the sun's ultraviolet radiation radiation\",句子不通。只需填 ultraviolet。0。" },
  cms6sjaac0158mnkyina3y858: { awardedMarks: 0, reason: "填10:'catalyst'(催化剂,是段 D 讲氯原子的词)错位,此处应 foams(塑料泡沫)。0。" },
  cms6sjwwp015imnkyug3lq98n: { awardedMarks: 0, reason: "填11:'greenhouse gases' 错,问的是恢复到 1980 年水平的时间点,应 middle(本世纪中)。0。" },

  // ── O-Level §B(HEIN HTET NAING)──
  cms6s9s1300zcmnkyeuss5p5a: { awardedMarks: 1, reason: 'Q1:坐两班巴士。1。' },
  cms6scgly010vmnkyqdh9o5fa: { awardedMarks: 1, reason: 'Q2:两块钱。1。' },
  cms6scqb2010zmnkyczz33vjt: { awardedMarks: 1, reason: "Q3:'weak' 命中 frail=虚弱。1。" },
  cms6s6saa00ulmnky6e9mbn5i: { awardedMarks: 0, reason: "Q4:'very old' 只说旧;crumpled 指被揉皱/有折痕(不再挺括),未答出。0。" },
  cms6se7o4012dmnky4k61li0r: { awardedMarks: 0, reason: "Q5:'distant and isolated'(偏远孤立)理解错;sparse 此处指屋里空荡、家当极少。0。" },
  cms6slayx0164mnkysdd1roe8: { awardedMarks: 0, reason: "Q6:'self-reliant'(自立)不是第4段所写的行为;应答待客之道(立刻拆饼干招待)与舍己为人(连喂四块自己一块不吃)。0/2。" },
  cms6sg6wo0131mnkybdiuybt8: { awardedMarks: 1, reason: "Q7:'想被人尊重'≈要体面、不愿被当作受济的穷亲戚(MP1);未及'以牺牲表达疼爱'(年中起攒硬币)。1/2。" },
  cms6sddj6011vmnkyp3wutgb3: { awardedMarks: 1, reason: "Q9:'crumpled and worn' 触及枯叶般单薄陈旧的形象(MP1);未点出'在他眼里一文不值、被随手搁下'的效果。1/2。" },
  cms6smdni0174mnkyrafx0kid: { awardedMarks: 1, reason: 'Q10:答出"值得珍藏而非花掉"=价值反转(MP2);未点出磨得像布=多年随身携带的物证(MP1)。1/2。' },

  // ── O-Level §B(闫乙鑫)──
  cms6skdiq015vmnkyyy4hkcnf: { awardedMarks: 1, reason: 'Q1:两班巴士。1。' },
  cms6sccuz010pmnky46zc54ie: { awardedMarks: 1, reason: 'Q2:两块钱。1。' },
  cms6sc74q010nmnkycrhud522: { awardedMarks: 1, reason: 'Q3:身体虚弱、年迈,命中 frail。1。' },
  cms6sjnka015cmnky5lfyx4gi: { awardedMarks: 1, reason: "Q4:'much used / worn from being handled many times' 点出被反复摩挲揉搓、不再挺括,命中 crumpled。1。" },
  cms6sjxpt015kmnkyv48hrvnb: { awardedMarks: 1, reason: 'Q5:家当极少、陈设简陋,命中 sparse。1。' },
  cms6skr4r0161mnkyporwhcsw: { awardedMarks: 2, reason: 'Q6:待客(坚持把饼干分给来客)+ 舍己(自己不留),两点齐。2/2。' },
  cms6sk7eh015tmnky65ftfzqr: { awardedMarks: 2, reason: 'Q7:延续过年给红包的责任/传统(MP1)+ 要让每个孩子都被顾到、开心(MP2),两点齐。2/2。' },
  cms6shjy0014amnky8yde5b9h: { awardedMarks: 2, reason: 'Q8:只按钞票面额衡量(错的秤)+ 应看给予者付出的代价(对的秤),两点齐。2/2。' },
  cms6sh5u1013pmnkyzp5wbvvf: { awardedMarks: 2, reason: 'Q9:枯叶=薄、脆、旧的形象(MP1)+ 由此联想到姑婆的艰辛与付出(替代 MP2),两点齐。2/2。' },
  cms6scuar0119mnkykhzqffpi: { awardedMarks: 2, reason: 'Q10:磨软=多年珍藏随身(MP1)+ 情感价值远超面额的反转(MP2),两点齐。2/2。' },
};

const GRADES_0731: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-07-31 早测 · authentic=cambridge_ielts_8/Test1/P2 (Air Traffic Control in the USA)
  // olevel=ai_authored_olevel_27_radio_v2 (The Old Radio). MCQ 与精确命中的客观短答已自动
  // 判分, 这里只判"未精确命中"留人工的. 全 Claude 在 chat 判, 零 AI.
  //
  // 本次标题匹配(matching headings)判分口径 —— 说明一下为什么这样判:
  //   题目要求填罗马数字 i–x, 但有 3 位同学填了阿拉伯数字(1/2/3…), 另有同学
  //   填大写(II)或带口音符(Iì). 这些都属于"写法"问题, 不是"读懂没读懂"的问题:
  //   "3" 唯一对应 iii, 没有歧义, 学生已经证明他选对了那个小标题.
  //   因此按等价换算给分, 但在评语里明确提醒"考试必须按题目要求写罗马数字".
  //   拼写错误(如昨天的 pozolanic)性质不同 —— 那会把答案变成另一个词, 仍判 0.

  // ── 雅思 标题匹配(刘亦佳)──
  cms87p25s00ytx9dbpizjeek8: { awardedMarks: 1, reason: "标题1:'Iì' 是 ii 打成带口音符的写法, 选的就是 ii, 正确。1。(考试请写规范的 ii)" },
  cms87phau00z7x9dbd9lxvpp1: { awardedMarks: 0, reason: "标题4(段E):'VII'=vii, 正解 iv(Setting altitude zones, 段E讲 365m/215m 高度分层)。0。" },
  cms87pmf200zhx9dbqjbfrput: { awardedMarks: 0, reason: "标题5(段F):'Vii'=vii, 正解 viii(Setting rules to weather conditions, 段F讲 VFR/IFR)。0。" },
  cms87poni00zjx9dbb61bicgy: { awardedMarks: 0, reason: "标题6(段G):'Viji' 写法不清(应为 viii), 且正解是 vii(Defining airspace categories)。0。" },

  // ── 雅思 标题匹配(刘钇村 · 全部大写罗马数字, 已按等价换算)──
  cms886y3101cxx9dbseufx2ch: { awardedMarks: 0, reason: "标题1(段A):'I'=i, 正解 ii(Aviation disaster prompts action)。0。" },
  cms88706801d1x9dblf5qti6q: { awardedMarks: 0, reason: "标题2(段C):'II'=ii, 正解 iii(Two coincidental developments)。0。" },
  cms8872ny01d3x9db7cxwzpe8: { awardedMarks: 0, reason: "标题3(段D):'III'=iii, 正解 v(An oversimplified view)。0。" },
  cms8878cr01ddx9dbsrlmk8vh: { awardedMarks: 0, reason: "标题5(段F):'VI'=vi, 正解 viii。0。" },

  // ── 雅思 标题匹配(叶书瑞 · 阿拉伯数字, 按等价换算)──
  cms87n8dp00wqx9dbai47f3q3: { awardedMarks: 0, reason: "标题1(段A):'1'=i, 正解 ii。0。(考试请写罗马数字 i–x)" },
  cms87nb9q00wsx9dbqpdngux7: { awardedMarks: 1, reason: "标题2(段C):'3'=iii, 与正解一致, 给分。1。(考试请写罗马数字 iii, 不要写 3)" },
  cms87ndla00wux9db7wet7rp9: { awardedMarks: 0, reason: "标题3(段D):'2'=ii, 正解 v。0。" },
  cms87nft100wwx9dbfgcohsdy: { awardedMarks: 1, reason: "标题4(段E):'4'=iv, 与正解一致, 给分。1。(考试请写 iv)" },
  cms87nict00wyx9db132m5sff: { awardedMarks: 0, reason: "标题5(段F):'7'=vii, 正解 viii。0。" },
  cms87nk6v00x0x9dbkhg741eo: { awardedMarks: 0, reason: "标题6(段G):'6'=vi, 正解 vii。0。" },

  // ── 雅思 标题匹配(叶雅滋)──
  cms882y5w01a3x9dbr4wzrujr: { awardedMarks: 0, reason: '标题4(段E):vii, 正解 iv(段E讲高度分层)。0。' },
  cms884hct01arx9db4pnuzfrp: { awardedMarks: 0, reason: '标题6(段G):vi, 正解 vii(段G讲空域分类 A/B/C/D/E/F)。0。' },

  // ── 雅思 标题匹配(毛思琳 · 阿拉伯数字, 按等价换算; 且有重复使用)──
  cms87jlnn00uxx9db86jr4hgk: { awardedMarks: 1, reason: "标题1(段A):'2'=ii, 与正解一致, 给分。1。(考试请写罗马数字 ii)" },
  cms87jnny00v4x9dbcfmhvmvb: { awardedMarks: 0, reason: "标题2(段C):'1'=i, 正解 iii。0。" },
  cms87jp8400v6x9dbsybyq9d3: { awardedMarks: 0, reason: "标题3(段D):'3'=iii, 正解 v。0。" },
  cms87jsz300v8x9dbo0the1gl: { awardedMarks: 0, reason: "标题4(段E):'2'=ii(与第1题重复), 正解 iv。注意每个小标题只能用一次。0。" },
  cms87judo00vax9dbb882h7iu: { awardedMarks: 0, reason: "标题5(段F):'1'=i(重复), 正解 viii。0。" },
  cms87jvm400vcx9dbh8x3aoyv: { awardedMarks: 0, reason: "标题6(段G):'3'=iii(重复), 正解 vii。0。" },

  // ── 雅思 标题匹配(郑稀瑜)──
  cms87vadd013ox9dbhc8llay0: { awardedMarks: 0, reason: '标题1(段A):ix, 正解 ii。0。' },
  cms87vcv3013qx9dbdzsho3i0: { awardedMarks: 0, reason: "标题2(段C):'i i'=ii, 正解 iii。0。" },
  cms87veeq013ux9dbexwlc3c5: { awardedMarks: 0, reason: '标题3(段D):iii, 正解 v。0。' },
  cms87vots014ox9dbibznxpbz: { awardedMarks: 0, reason: '标题4(段E):x, 正解 iv。0。' },
  cms87vkas014cx9dbye6x24tr: { awardedMarks: 0, reason: '标题5(段F):vi, 正解 viii。0。' },
  cms87vqml014yx9dbkoqdmir1: { awardedMarks: 0, reason: '标题6(段G):ix(与第1题重复), 正解 vii。0。' },

  // ── 雅思 标题匹配(闫雯涵 · 阿拉伯数字, 按等价换算)──
  cms87hhrg00sux9dbcbibi9yk: { awardedMarks: 0, reason: "标题1(段A):'1'=i, 正解 ii。0。(考试请写罗马数字 i–x)" },
  cms87hjw600swx9dbngdp3d1b: { awardedMarks: 1, reason: "标题2(段C):'3'=iii, 与正解一致, 给分。1。(考试请写 iii)" },
  cms87hmnf00syx9dbxvrfc18q: { awardedMarks: 0, reason: "标题3(段D):'3'=iii(重复), 正解 v。每个标题只能用一次。0。" },
  cms87hor400t0x9db8l65enbl: { awardedMarks: 0, reason: "标题4(段E):'2'=ii, 正解 iv。0。" },
  cms87hswa00t6x9db772txx61: { awardedMarks: 0, reason: "标题5(段F):'1'=i(重复), 正解 viii。0。" },
  cms87huq200t8x9dbwsyxk2rh: { awardedMarks: 0, reason: "标题6(段G):'3'=iii(重复), 正解 vii。0。" },

  // ── O-Level §B(HEIN HTET NAING)──
  cms87u0c9012lx9dbrs19h2ba: { awardedMarks: 1, reason: 'Q1:厨房料理台的同一个角落。1。' },
  cms87pi0o00z9x9dbktpv2z8m: { awardedMarks: 1, reason: 'Q2:两个星期。1。' },
  cms87xo550169x9dblflt53fl: { awardedMarks: 0, reason: "Q4:'very slow' 说的是快慢; 'a hair's breadth at a time' 说的是每次只转极小的幅度(量), 未答出。0。" },
  cms87smi00129x9dbqwnf4wn9: { awardedMarks: 1, reason: "Q5:'annoyed' 命中 nuisance=嫌它烦。1。" },
  cms87yw3p016fx9dbqee6f3ve: { awardedMarks: 1, reason: 'Q7:收音机等同于爷爷本人、动它像惊扰他(MP1);未及"开机就等于承认他真的走了"(MP2)。1/2。' },
  cms8809ar017mx9db9aogawj5: { awardedMarks: 2, reason: "Q9:'gentle' 对应 swam(声音缓缓浮起)+ '把多年前的回忆带回来' 对应 out of the years(往昔涌入当下),两层齐。2/2。" },

  // ── O-Level §B(赵伯容)──
  cms87oo7v00yox9dbw11g21s1: { awardedMarks: 1, reason: 'Q1:厨房料理台的同一个角落。1。' },
  cms87r3v9010nx9dbe8lwsmtw: { awardedMarks: 1, reason: 'Q2:两个星期。1。' },
  cms87vihl0144x9db7mtc8xb6: { awardedMarks: 0, reason: "Q3:'skillful'(技术好)不是 coax 的意思; coax 指轻柔、耐心地把电台「哄」出来。0。" },
  cms8807zm017kx9dby65ajk9n: { awardedMarks: 0, reason: "Q4:'careful' 泛指小心; 'a hair's breadth at a time' 要答出每次只转极微小的幅度。0。" },
  cms884hbt01apx9dbgn7nnntx: { awardedMarks: 0, reason: "Q5:答成「收音机太旧、不属于新世界」(那是上下文), nuisance 要答出「他嫌它碍事/烦人」。0。" },
  cms887kl801e3x9dbrondw4r5: { awardedMarks: 1, reason: 'Q7:"家人把收音机看作爷爷"命中 MP1;未及"开机=承认他真的不在了"(MP2)。1/2。' },
  cms88fepk01kwx9db4qxnrf8v: { awardedMarks: 0, reason: 'Q8:答成"明白爷爷为何喜欢收音机", 与点播启示无关; 应答"别人也来这里找逝去的人, 原来我不是唯一的"。0/2。' },
};

const GRADES_0804: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-08-04 早测 · authentic=ielts_authored_2026_v3/Test1/P1 (The Machine from
  // the Sea 安提基特拉机械) / olevel=ai_authored_olevel_39_blackout_v1 (The Blackout)
  // MCQ 与精确命中的客观短答已自动判分, 这里只判挂起项. 全 Claude 在 chat 判, 零 AI.

  // ── 雅思 段落匹配(A–H 精确字母) ──
  cmsdy2n6c01rdn31mpkslpadj: { awardedMarks: 0, reason: '段1:A,正解 D(段D讲工业X光扫描仪解决了难题)。0。' },
  cmsdy5u7801xin31mbh6a9aee: { awardedMarks: 0, reason: '段3:C,正解 G(段G讲奥运周期表明面向公众)。0。' },
  cmsdy60w001y5n31m0rbbkv4h: { awardedMarks: 0, reason: '段4:D,正解 A(段A讲沉船被发现的经过)。0。' },
  cmsdxavmv00utn31mlwjplkhw: { awardedMarks: 0, reason: '段1:B,正解 D。0。' },
  cmsdxb0ay00v1n31mf73poc6j: { awardedMarks: 0, reason: '段2:C,正解 B(段B讲学者最初怀疑年代)。0。' },
  cmsdxb3lj00vin31m3vwdt8ni: { awardedMarks: 0, reason: '段3:A,正解 G。0。' },
  cmsdxb7y600vkn31mxcxdh8pw: { awardedMarks: 0, reason: '段4:F,正解 A。0。' },
  cmsdxh7ne0133n31m21yxu70a: { awardedMarks: 0, reason: '段1:B,正解 D。0。' },
  cmsdxhcoi013en31mjt4cruud: { awardedMarks: 0, reason: '段2:C,正解 B。0。' },
  cmsdxhklp013pn31ms68obixb: { awardedMarks: 0, reason: '段3:F,正解 G。0。' },
  cmsdxfuo4010gn31m0xoyjpec: { awardedMarks: 0, reason: '段4:C,正解 A。0。' },
  cmsdxqwt101d8n31mc9h6jtyi: { awardedMarks: 0, reason: '段3:H,正解 G。0。' },
  cmsdxqemz01cmn31m0xfpku4v: { awardedMarks: 0, reason: '段4:E,正解 A。0。' },
  cmsdy83ka020wn31mu5z82qyd: { awardedMarks: 0, reason: '段4:H,正解 A。0。' },

  // ── 雅思 毛思琳：段落匹配题用中文作答, 未按要求填 A–H 字母 ──
  cmsdxaesw00tun31m6chu4tj7: { awardedMarks: 0, reason: '段1:写成中文「带回去研究」。本题要求在框里填段落字母 A–H(如 D),不是写句子。0。' },
  cmsdxam5k00udn31m8pukgmbd: { awardedMarks: 0, reason: '段2:同上,应填字母 B。0。' },
  cmsdxay2700uxn31mb55te0e6: { awardedMarks: 0, reason: '段3:同上,应填字母 G。0。' },
  cmsdxf2ww00z5n31mas1g018w: { awardedMarks: 0, reason: '填11:写成中文「太阳或者」。填空题要从原文抄英文词(≤2 词),此处应填 phase。0。' },

  // ── 雅思 填空 ──
  cmsdy0kkm01mrn31mm57a2ovo: { awardedMarks: 0, reason: "填11:'Positions' 是段E里太阳月亮的「位置」,而本空问的是半银半黑小球显示月亮的什么,应填 phase(月相)。0。" },
  cmsdy3e3i01srn31mb5pv2kl1: { awardedMarks: 0, reason: "填9:'scholars' 错,发现沉船的是 sponge divers(采海绵的潜水员)。0。" },
  cmsdy782k01zyn31m7f1kfbvv: { awardedMarks: 0, reason: "图12:'case' 错,流程图此处是「一个齿轮叠在另一个上、其 axis(轴)略微偏心」。0。" },

  // ── O-Level《The Blackout》HEIN HTET NAING ──
  cmsdxo7gw018sn31muefz8nii: { awardedMarks: 1, reason: 'Q1:每天扫两次自家门外的走廊。1。' },
  cmsdy5e7c01wmn31m1xvmyrdu: { awardedMarks: 1, reason: 'Q2:被困电梯约二十分钟。1。' },
  cmsdy3ksr01t5n31mo8hci035: { awardedMarks: 1, reason: "Q3:'still boiling' 命中 hissing=锅还在火上煮着。1。" },
  cmsdxzaj701m9n31mc2eca59g: { awardedMarks: 1, reason: 'Q7:答出「安抚受惊的 Mrs Kaur」这一意图;但没答出为什么偏要聊菜价球赛这些无关小事(转移注意 / 把气氛拉回日常)。1/2。' },
  cmsdxxja001lbn31mjlo8y213: { awardedMarks: 1, reason: 'Q9:抓到「危机一过就迅速恢复常态」;未点出那份邻里温情因此显得反常而脆弱。1/2。' },
  cmsdy4bb601u6n31m5z84zwio: { awardedMarks: 0, reason: 'Q10:「To show that the memorable and final impression」句子未写完,也没谈到 counting 一词由挑剔变成守护的反转。0/2。' },

  // ── O-Level 曾义洋 ──
  cmsdy5y5s01xtn31mdfw73420: { awardedMarks: 1, reason: "Q2:'stopped at the lift' 抓到「被困在电梯里」这一核心。1。" },
  cmsdy4vp501v0n31mnhosbwy0: { awardedMarks: 0, reason: 'Q4:答成「讲商店的背景」,与题目无关。本题问 cut off mid-breath 说明停电是怎样发生的(戛然而止)。0。' },
  cmsdy122701n9n31mq4joz92p: { awardedMarks: 0, reason: 'Q7:「让她不难过」既太笼统、情绪也不对(她是受惊不是难过),未答出聊闲事的作用。0/2。' },
  cmsdyazh7023rn31mr881w0y6: { awardedMarks: 0, reason: 'Q8:「It reveals a surprise」未涉及他在逐户核对独居老人、并上楼敲没露面那几家的门。0/2。' },
  cmsdya4ox022xn31mbff5m32k: { awardedMarks: 1, reason: 'Q9:抓到「大家很快回到日常」;未点出温情的反常与脆弱。1/2。' },

  // ── O-Level 蒋安祁(只作答 4 题) ──
  cmsdy58ii01wcn31m41peddax: { awardedMarks: 0, reason: 'Q2:「Because awould not come out」句子残缺,未说出她被困电梯。0。' },
  cmsdy3nv701tbn31mih2hx7ng: { awardedMarks: 0, reason: "Q5:「Her was slowly」残缺;loosened 指她的手渐渐松开=没那么怕了。0。" },

  // ── O-Level 赵一鸣 ──
  cmsdxvxg301kfn31m1chso71d: { awardedMarks: 0, reason: 'Q2:「She is scared」说的是她的状态,题目问的是原因(被困在电梯里约二十分钟)。0。' },
  cmsdy0maj01mtn31mk091ux8l: { awardedMarks: 0, reason: 'Q4:「电被切断了」是复述事实;题目问的是 cut off mid-breath 说明它怎样停的(一瞬间戛然而止)。0。' },
  cmsdy1phl01o7n31ma2fmhwxd: { awardedMarks: 1, reason: 'Q6:答出「她害怕、不想被人碰」= 不去加重她的恐惧(MP1);未及「给她时间自己缓过来」(MP2)。1/2。' },
  cmsdy4v5m01uyn31motgd1p69: { awardedMarks: 0, reason: 'Q7:读反了 —— 一直在说话的是 Mr Tan,不是 Mrs Kaur。0/2。' },
  cmsdxo7vd018un31mlwdmwtvn: { awardedMarks: 1, reason: 'Q9:抓到「人都散了,像没发生过一样」;未点出温情的反常与脆弱。1/2。' },

  // ── O-Level 赵伯容 ──
  cmsdxdvzs00xnn31mbd9s73pu: { awardedMarks: 1, reason: 'Q1:每天扫两次自家门外走廊。1。' },
  cmsdxg2t5010yn31m7cuhyh7y: { awardedMarks: 1, reason: 'Q2:停电时她正在电梯里。1。' },
  cmsdxivlr014un31m60u5c9ah: { awardedMarks: 1, reason: "Q3:'still cooking' 命中 hissing。1。" },
  cmsdxv81k01jvn31ma0jj6i1i: { awardedMarks: 1, reason: "Q4:'failed quickly' 可接受(停电是一下子断的);更完整的答法是「毫无预兆、一瞬间全部停掉」。1。" },
  cmsdxqvzn01d6n31miu4rday8: { awardedMarks: 0, reason: 'Q5:方向反了 —— 手「松开」是没那么害怕了,不是更紧张。0。' },
  cmsdy1krl01nzn31mh6f0xzq6: { awardedMarks: 0, reason: 'Q6:「觉得她的动作危险」文中没有;应答不去加重她的恐惧、以及给她时间自己缓过来。0/2。' },
  cmsdy3b6901sln31m68m3iffu: { awardedMarks: 1, reason: 'Q7:答出「想让她冷静下来」这一意图;未答出为什么用闲聊达成(转移注意 / 恢复日常感)。1/2。' },
  cmsdy5c4p01win31mom40rd4p: { awardedMarks: 2, reason: 'Q8:逐户核对有老人的住户(MP1)+ 上楼敲没露面那几家的门(MP2),两点齐。(文中是十四层,不是 40 层,不扣分。)2/2。' },
  cmsdyaqpq023jn31mrn8ta6ve: { awardedMarks: 0, reason: 'Q9:只写了「To」,未作答。0/2。' },
};

// Finalize-sweep — every non-practice submission in these assignments gets
// its status flipped submitted→marked (recomputing scores), even the fully
// auto-graded ones (0 parked items) and blank submissions (no scripts). The
// GRADES map alone only reaches submissions that had a parked item.
const SWEEP_ASSIGNMENTS: string[] = [
  'd2d16e00-7ae1-42ca-ba0f-2a39d822277d', // 2026-08-04 IELTS authentic (The Machine from the Sea)
  '5308a741-f733-4ac3-9b24-8c453ab1e6bc', // 2026-08-04 O-Level (The Blackout)
];

const GRADES: Record<string, { awardedMarks: number; reason: string }> = GRADES_0804;
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

  // ── 生词本「批改即采集」──────────────────────────────────────────
  //
  // 采集本来只挂在 MarkerService.finalize（即 /api/marker/finalize 端点）上，
  // 但实际判分走的是**本脚本**，从不经过那个端点 —— 于是自动采集在真实流程
  // 里一次都没触发过（2026-08-04 判完分发现新增 0 条才查出来）。
  //
  // 这里直接复用同一个生产服务类，保证抽词与筛选逻辑和线上完全一致，
  // 不重写。best-effort：采集失败绝不能影响已经写好的分数。
  const vocabSvc = new VocabService(prisma as any);
  const wordsSvc = new StudentWordService(prisma as any, vocabSvc);
  let harvested = 0;
  let harvestFailed = 0;
  for (const submissionId of submissionIds) {
    try {
      const r = await wordsSvc.harvestFromSubmission(submissionId);
      harvested += r.added;
    } catch (e: any) {
      harvestFailed++;
      console.warn(`  vocab harvest failed for ${submissionId}: ${e?.message ?? e}`);
    }
  }
  console.log(`\n生词本自动采集: 新增 ${harvested} 条${harvestFailed ? `（${harvestFailed} 份失败）` : ''}`);

  console.log(`\n=== Done ===\n  scripts written: ${scriptsWritten}\n  submissions finalized: ${finalized}\n  partial: ${partial}\n`);
  await prisma.$disconnect();
})();
