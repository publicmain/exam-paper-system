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

const GRADES_0805: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-08-05 早测 · authentic=ielts_authored_2026_v3/Test1/P2 (Gardening the Reef
  // 珊瑚礁修复) / olevel=summary_01_food_waste (概要写作卷, Q4 为 8 分总结题)
  // 全 Claude 在 chat 判, 零 AI。

  // ── 雅思 段落匹配 ──
  cmsfdoo5n024ga7q3rgjh4j2a: { awardedMarks: 0, reason: '段1:a,正解 H(段H讲修复可能掩盖真正病因)。0。' },
  cmsfdoqz4024ia7q3vmp92ue7: { awardedMarks: 0, reason: '段2:b,正解 G(段G讲改造共生藻而非珊瑚本身)。0。' },
  cmsfdpark025ca7q3o8qxp715: { awardedMarks: 0, reason: '段3:e,正解 C(段C讲只做保护已不够)。0。' },
  cmsfdpee6025ea7q3pwjjlwgf: { awardedMarks: 0, reason: '段4:h,正解 D(段D讲苗圃里怎么养珊瑚断枝)。0。' },
  cmsfcuj7t00u8a7q38mxs393s: { awardedMarks: 0, reason: '段1:B,正解 H。0。' },
  cmsfcunbb00uca7q3jqub965u: { awardedMarks: 0, reason: '段2:C,正解 G。0。' },
  cmsfcur2j00ura7q3o48lupvb: { awardedMarks: 0, reason: '段3:A,正解 C。0。' },
  cmsfcv9d000uza7q3y9p2ny8h: { awardedMarks: 0, reason: '段4:H,正解 D。0。' },
  cmsfcymrq012ja7q35tepukgq: { awardedMarks: 0, reason: '段1:E,正解 H。0。' },
  cmsfdm6iy022ua7q33fpjygn4: { awardedMarks: 0, reason: '段1:E,正解 H。0。' },
  cmsfcyzh20135a7q3wodkg6d6: { awardedMarks: 0, reason: '段2:a,正解 G。0。' },
  cmsfdlbfd0226a7q3rqfzzorv: { awardedMarks: 0, reason: '段4:G,正解 D。0。' },

  // 中文输入法打出的全角字母 —— 字母本身选对了，判对
  cmsfd5qd10196a7q3fclr6b7e: { awardedMarks: 1, reason: '段3:你填的「Ｃ」是中文输入法的全角字母，字母选的是 C，正确，给分。1。(下次记得切英文输入法，避免系统识别不到)' },

  // ── 雅思 填空：单复数必须照抄原文形式 ──
  cmsfdcrvt01k1a7q3ly7zywbq: { awardedMarks: 0, reason: "填12:'substance' 少了复数 s。原文是 the algae begin to produce substances，填空要原样照抄原文的词形，雅思判卷单复数算错。0。" },
  cmsfcxk1c00zra7q3c7md14hy: { awardedMarks: 0, reason: "填12:同上,'substance' 应为 substances(照抄原文词形)。0。" },
  cmsfdg3ez01ria7q3zvyf5wqw: { awardedMarks: 0, reason: "填9:'sugar' 应为 sugars(原文 pass sugars to their host)。0。" },
  cmsfdbecf01gva7q329giz1od: { awardedMarks: 0, reason: "填10:'raw materials' 是段A里珊瑚给藻类的东西;本空问苗圃里悬空养殖是为了避开捕食者和会把珊瑚闷死的什么,应填 sediment(沉积物)。0。" },
  cmsfdda0701l7a7q3ej1u9l7h: { awardedMarks: 0, reason: "填13:'transparent' 是形容组织的;本空是「白色的什么透出来」,应填 skeleton(骨骼)。0。" },

  // ── O-Level 概要写作卷《Cutting Food Waste》HEIN HTET NAING ──
  cmsfd7jzv01ara7q3visvcr8u: { awardedMarks: 1, reason: "Q1:'left over, unsold' 命中 surplus=多出来的、剩余的。1。" },
  cmsfd48au018ma7q35az5tsro: { awardedMarks: 0, reason: 'Q2:堆肥做花园肥料/做动物饲料是另一种做法;第6段说 digester(厌氧分解机)把厨余变成水或电能。0。' },
  cmsfd8le401c1a7q3xerul51t: { awardedMarks: 2, reason: 'Q3:点出「样子怪的菜」+「降价促使人买下吃掉、因而不被丢弃」，两层齐。2/2。' },

  // ── O-Level 曾义洋 ──
  cmsfcwgoy00xfa7q3oom5kc5w: { awardedMarks: 0, reason: 'Q1:surplus 指「多出来但仍能吃」的食物,不等于 waste(废弃物) —— 正因为不是废物才拿去捐赠。0。' },
  cmsfcv4n300uva7q3lary1ij3: { awardedMarks: 1, reason: 'Q2:变成水或电能,正确。1。' },
  cmsfcyg5d0123a7q3ehf5ggdu: { awardedMarks: 2, reason: 'Q3:「本来就能吃、只因卖相不好会被丢掉」+「便宜卖出去就有人买来吃」,两层都写到了。2/2。' },
  cmsfczvov014ga7q35vob2vzs: { awardedMarks: 0, reason: 'Q4:只写了一句收尾感想,没有列出任何一条具体做法(计划采购/小份量/临期打折/捐赠/堆肥/厌氧分解/教育宣传),也没有按要求用给定开头。内容点 0。0/8。' },

  // ── O-Level 赵一鸣 ──
  cmsfdlguu022aa7q3o71fch9i: { awardedMarks: 1, reason: "Q1:'excess the quantity which their owner needs' 命中 surplus=超出所需。1。" },
  cmsfdou85024ta7q32akajv5f: { awardedMarks: 1, reason: 'Q2:水或电能,正确。1。' },
  cmsfcxeuw00zfa7q3m9o2lc58: { awardedMarks: 1, reason: 'Q3:答出「降价→被买走→减少浪费」;未点出这些菜本来只因卖相不好就要被丢掉。1/2。' },
  cmsfd6271019ga7q3ksdjqypp: { awardedMarks: 5, reason: 'Q4:写到 5 条做法 —— 家庭计划餐食、餐厅减少份量、设食物银行捐赠、厨余做动物饲料、学校开课教育。内容 5/8。注意三点:①超过 80 词上限 ②没有用规定开头「Singapore is reducing the food it wastes by...」 ③最后一句没写完。5/8。' },

  // ── O-Level 赵伯容 ──
  cmsfcw6rl00wna7q3n13u7bi9: { awardedMarks: 1, reason: "Q1:'the rest food' 意思是剩下的食物,命中 surplus。1。(英文更地道的说法是 leftover / extra food)" },
  cmsfcy0pk010ta7q34r3foy77: { awardedMarks: 0, reason: 'Q2:「Food Scraps」是放进去的厨余,不是产出物;第6段说变成水或电能。0。' },
  cmsfczm4v013ua7q3td5mygh8: { awardedMarks: 1, reason: 'Q3:句子有点乱,但抓到「被买走吃掉而不是被丢弃」;未点出它们本来只因卖相不好就要被丢。1/2。' },
  cmsfd95kq01cva7q3173n0qdq: { awardedMarks: 4, reason: 'Q4:写到 4 条做法 —— 按需采购、餐厅份量减少、超市打折卖次品菜、学校教育。内容 4/8。字数在 80 词内 ✓,但没用规定开头,且末句「As you can see...」是凑字的感想,概要里不需要。4/8。' },
};

const GRADES_0806: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-08-06 早测 · authentic=ielts_authored_2026_v3/Test1/P3 (The Slow Journey
  // of Paper 造纸术西传) / olevel=ai_authored_olevel_40_send_off_v1 (The Send-off
  // 送哥哥入伍)。全 Claude 在 chat 判, 零 AI。

  // ── 雅思 美式拼写：IELTS 官方接受英美两种拼写，判对 ──
  cmsgsehiq00ymtte6d57z8emd: { awardedMarks: 1, reason: "填12:'Fibers' 是 fibres 的美式拼写。雅思官方明确英式美式拼写都接受,判对。1。" },
  cmsgsywxq01wvtte6die32exg: { awardedMarks: 1, reason: "填12:'Fibers' 美式拼写,雅思接受,判对。1。" },

  // ── 雅思 单复数仍从严(与 8/05 substance/substances 同一条线) ──
  cmsgsx35j01t9tte6t6tlmg23: { awardedMarks: 0, reason: "填12:'fibre' 少了复数 s。原文 until the fibres separate,填空须照抄原文词形。0。" },
  cmsgss24u01hmtte6715ug67u: { awardedMarks: 0, reason: "填9:'rage'(愤怒)是另一个词,不是拼写变体。原文是 linen rags(亚麻破布)。0。" },

  // ── 雅思 字母间多打了空格，词本身是对的 ──
  cmsgssl6f01j4tte69d9r2r52: { awardedMarks: 1, reason: "填11:'r a g' 字母间多了空格,词本身就是 rag,判对。1。(下次连着打成一个词,系统按字符精确匹配)" },

  // ── 雅思 段落匹配 ──
  cmsgt5ct6028itte6j9tczm09: { awardedMarks: 0, reason: '段1:A,正解 G(段G讲原料短缺与木浆的代价)。0。' },
  cmsgt5f6e028otte6xtbkkxc3: { awardedMarks: 0, reason: '段2:B,正解 F(段F讲印刷与纸互相拉动需求)。0。' },
  cmsgt5hee028qtte6m2kicbde: { awardedMarks: 0, reason: '段3:C,正解 D(段D讲欧洲抵制纸的非技术原因)。0。' },
  cmsgt5kez028utte68jdpdydy: { awardedMarks: 0, reason: '段4:D,正解 A(段A讲纸出现前书写材料的缺点)。0。' },
  cmsgsi70m012rtte638e8xi95: { awardedMarks: 0, reason: '段1:B,正解 G。0。' },
  cmsgsibc90131tte6a7j34vs1: { awardedMarks: 0, reason: '段2:A,正解 F。0。' },
  cmsgsidmh0139tte6hyb7ny1a: { awardedMarks: 0, reason: '段3:C,正解 D。0。' },
  cmsgsiezc013dtte6w8gv8986: { awardedMarks: 0, reason: '段4:D,正解 A。0。' },
  cmsgsp8vx01dbtte6uaoqfwzx: { awardedMarks: 0, reason: '段1:B,正解 G。0。' },
  cmsgsgc5000yotte6sgkfgh9c: { awardedMarks: 0, reason: '段1:B,正解 G。0。' },
  cmsgs69kz00tktte6w7cqxnud: { awardedMarks: 0, reason: '段2:B,正解 F。0。' },
  cmsgs6cu300tutte6vbr1rzhm: { awardedMarks: 0, reason: '段3:C,正解 D。0。' },
  cmsgsj99q015btte6hydn1khe: { awardedMarks: 0, reason: '段1:A,正解 G。0。' },
  cmsgsywea01wttte6rf9zb74f: { awardedMarks: 0, reason: '段2:D,正解 F。0。' },
  cmsgszsmw01xdtte6dgqufyif: { awardedMarks: 0, reason: '段3:G,正解 D。0。' },
  cmsgsz83g01x5tte62l9zpybc: { awardedMarks: 0, reason: '段4:B,正解 A。0。' },
  cmsgsra6401g2tte65oyh0rh3: { awardedMarks: 0, reason: '段3:B,正解 D。0。' },
  cmsgsrcu901g8tte63kyuocb9: { awardedMarks: 0, reason: '段4:C,正解 A。0。' },

  // ── 雅思 其他填空 ──
  cmsgt2e1c023htte6wbkfxwzo: { awardedMarks: 0, reason: "填11:'paper' 错。原文说木浆纸比 rag(破布)纸更易朽坏,应填 rag。0。" },
  cmsgswocl01sltte62n5qs6h1: { awardedMarks: 0, reason: "图13:'squeeze' 是原文 pressed to squeeze out moisture 里的动作对象,本空要填 pressed(被压)。0。" },

  // ── O-Level《The Send-off》HEIN HTET NAING ──
  cmsgstp9a01m7tte6z4mqqxq0: { awardedMarks: 1, reason: 'Q1:压在冰箱的磁贴下。1。' },
  cmsgsghhh00ywtte61owv7o7r: { awardedMarks: 1, reason: 'Q2:那枚(足球)奖牌。1。' },
  cmsgsvb0501pjtte6eqqt42xz: { awardedMarks: 1, reason: "Q3:'unstable' 命中 wobbling=桌子不稳、会晃。1。" },
  cmsgshtnu0121tte6ado3v46d: { awardedMarks: 1, reason: "Q4:'surprisingly unremarkable and normal' 抓到「和平常一模一样却让人觉得不对劲」。1。" },
  cmsgslg9f017jtte6ao8ka58l: { awardedMarks: 1, reason: 'Q9:答出拥抱「又急又短」;未点出那是因为一犹豫就抱不下去了、以及他不会慢慢表达感情。1/2。' },

  // ── O-Level 曾义洋 ──
  cmsgsjz6f016dtte6igtas4et: { awardedMarks: 1, reason: 'Q2:一枚奖牌。1。' },
  cmsgsrqns01gytte6ebu3bu7o: { awardedMarks: 0, reason: 'Q4:只写「Surprised」一个词,没有说明;本题要答「重要的日子却和平常一样,反而让人觉得不对劲」。0。' },
  cmsgsh3g300zttte6c8tj7jdd: { awardedMarks: 0, reason: "Q5:'rough' 说的是围站得松散不齐,不是「一起解决问题」。0。" },
  cmsgsxkqm01tztte6jcsa5hdy: { awardedMarks: 1, reason: 'Q7:抓到「妈妈很难过却哭不出来」= 她在硬憋着(MP1);未及「憋住比哭出来更费力」。1/2。' },
  cmsgt6qkr02a6tte60vc79v01: { awardedMarks: 0, reason: 'Q8:只写了「To」,未作答。0/2。' },
  cmsgt0koa01y7tte6msqsv9ww: { awardedMarks: 0, reason: 'Q9:句子不通,也没解释「像大风里关门那样」这个比喻(又快又用力、不敢犹豫)。0/2。' },
  cmsgsun5m01nrtte61nv0obhz: { awardedMarks: 0, reason: 'Q10:只说「想哥哥」,未触及 took up(占地方)与 filled(填满)这组反义对照。0/2。' },

  // ── O-Level 赵一鸣 ──
  cmsgsqix401estte6xqurl3j1: { awardedMarks: 1, reason: 'Q2:足球奖牌。1。' },
  cmsgsmb6c0199tte652g0ls0i: { awardedMarks: 0, reason: 'Q4:答成「紧张但天亮着、对未来有期待」,与原意相反。horribly ordinary 是说这天平常得让人难受。0。' },
  cmsgt121l01zptte62irsgr2m: { awardedMarks: 0, reason: "Q5:'rough' 形容围站的形状松散不齐,不是形容心情茫然。0。" },
  cmsgshrcu011rtte60zj0ge7s: { awardedMarks: 1, reason: 'Q7:答出「不想在这个时刻让 Wei 看见自己难过」= 刻意压住情绪(MP1);未及「憋住比哭出来更费力」。1/2。' },
  cmsgssext01igtte663vc51uy: { awardedMarks: 1, reason: 'Q8:答出「不敢相信儿子真的走了」(MP1);未点出袋子已空却仍抱着、那份「轻」正是失去本身。1/2。' },
  cmsgszicu01x9tte6ixbfofnr: { awardedMarks: 0, reason: 'Q9:没有解释比喻本身,只说「他开始改变对哥哥的看法」。0/2。' },

  // ── O-Level 赵伯容 ──
  cmsgs67ja00titte62y3mpqv5: { awardedMarks: 1, reason: 'Q1:压在冰箱磁贴下。1。' },
  cmsgs972o00vhtte6yfa84kw7: { awardedMarks: 1, reason: 'Q2:足球奖牌。1。' },
  cmsgsalbt00wbtte6lyay04gm: { awardedMarks: 0, reason: "Q3:'broken'(坏了)不是 wobbling 的意思;wobbling 指桌腿松、桌子会晃。0。" },
  cmsgsigim013htte658e6hv60: { awardedMarks: 0, reason: 'Q4:答成「那天早晨不寻常」,与原意相反 —— horribly ordinary 正是说它平常得和任何一天一样,而这恰恰让人难受。0。' },
  cmsgsl9zy017htte67wxx5rus: { awardedMarks: 0, reason: "Q5:'optionally' 不通;rough circle 指围站得松散、不成形。0。" },
  cmsgsoiha01bntte6egbyzmgr: { awardedMarks: 1, reason: 'Q6:列出了行为(提早回家、修桌子、问我学校的事)并读出「他舍不得走」;但未点出他是在临走前把事情一件件安顿好、以及那是想趁还来得及跟弟弟亲近。1/2。' },
  cmsgt0p2a01yptte6ym9dl10u: { awardedMarks: 1, reason: 'Q7:「mom overcome that」抓到她是硬压住了(MP1);「想看清楚记住他」是自己加的,原文没有;未及「憋住比哭出来更费力」。1/2。' },
  cmsgt6co6029ntte6l6nd608t: { awardedMarks: 1, reason: 'Q8:「不敢相信」点到了(MP1),但只有四个字、没有展开,也没写到那只空袋子。1/2。' },
};

const GRADES_0807: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-08-07 早测（本周收官）· authentic=ielts_authored_2026_v3/Test2/P1
  // (The Ground That Remembers 永久冻土) / olevel=summary_02_cycling (概要写作卷)
  // 全 Claude 在 chat 判, 零 AI。

  // ── 雅思 段落匹配 ──
  cmsi7y1q101bp14kfzz6a5ggf: { awardedMarks: 0, reason: '段3:A,正解 D(段D澄清 feedback 一词常被误解)。0。' },
  cmsi8hm9k024q14kfi8v2hj3h: { awardedMarks: 0, reason: '段1:a,正解 F(段F讲为何释放量难以准确估算)。0。' },
  cmsi82qy601lu14kf8ysz07kp: { awardedMarks: 0, reason: '段3:A,正解 D。0。' },
  cmsi80hi601ib14kf5n9v56ry: { awardedMarks: 0, reason: '段4:H,正解 B(段B讲低温阻断了腐烂过程)。0。' },
  cmsi7nmfm00u714kf406kcqno: { awardedMarks: 0, reason: '段3:a,正解 D。0。' },
  cmsi7ote400vg14kfrbxl81yy: { awardedMarks: 0, reason: '段1:D,正解 F。0。' },
  cmsi7p7fk00wg14kfgrkwmwsm: { awardedMarks: 0, reason: '段2:F,正解 G(段G讲对建筑与聚落的影响)。0。' },
  cmsi7pb7c00wo14kfalsmesri: { awardedMarks: 0, reason: '段3:A,正解 D。0。' },
  cmsi80bbh01hx14kfghrf94qf: { awardedMarks: 0, reason: '段1:A,正解 F。0。' },
  cmsi8082001hp14kfxk2kq1pk: { awardedMarks: 0, reason: '段2:c,正解 G。0。' },
  cmsi805jb01hh14kfp2ltsc2e: { awardedMarks: 0, reason: '段3:B,正解 D。0。' },
  cmsi803v301hd14kfa1ypbjrv: { awardedMarks: 0, reason: '段4:H,正解 B。0。' },

  // ── 雅思 填空 ──
  cmsi7ps7300xm14kf2a4r36h1: { awardedMarks: 0, reason: "图13:'lake' 少了复数 s。原文 forming pits, slumps and small lakes,填空须照抄原文词形(与本周 fibre/substance 同一条线)。0。" },
  cmsi8en0u023814kfkrfmykyt: { awardedMarks: 0, reason: "填10:'locked' 错。本空问北方永久冻土封存的碳大约是整个大气层的多少倍,原文 roughly twice,应填 twice。0。" },

  // ── O-Level 概要写作卷《Cycling in Singapore》HEIN HTET NAING ──
  cmsi7p5ow00w814kfmzcg6oa4: { awardedMarks: 1, reason: "Q1:'done intentionally' 命中 deliberate=有意为之。1。" },
  cmsi7prjy00xk14kfm8kxtzf5: { awardedMarks: 1, reason: 'Q2:自行车停放位(bicycle bays),正确。1。' },
  cmsi7rfvk00zu14kf51eviyup: { awardedMarks: 2, reason: 'Q3:「岛上到处都能借还」+「不必自己买车、也不用找地方存放」,两点齐。2/2。' },

  // ── O-Level 曾义洋 ──
  cmsi85kss01ox14kfcs2sxxq9: { awardedMarks: 0, reason: 'Q1:只写了「A wa」,未作答。0。' },
  cmsi83wii01n914kfi81xb738: { awardedMarks: 0, reason: 'Q2:抄的是「换乘后可继续骑同一辆车」那句,答的不是车站提供了什么;应答自行车停放位或储物柜。0。' },
  cmsi7udic017f14kfl26jobug: { awardedMarks: 2, reason: 'Q3:两点都写到了(到处可借还 + 不必自己买或存放)。2/2。但基本是照抄原文,题目要求 in your own words,下次请换成自己的说法。' },
  cmsi826to01ko14kft2j3aq96: { awardedMarks: 0, reason: 'Q4:又是把原文最后一句收尾感想抄下来(上周食物浪费那篇也是),没有列出任何一条具体做法(修车道/共享单车/车站停放/限速宣导/学校教学/环岛路线),也没用规定开头。内容点 0。0/8。' },

  // ── O-Level 蒋安祁 ──
  cmsi8lhm3026w14kf4pgvamov: { awardedMarks: 1, reason: "Q1:'not happened by accident'(不是偶然发生的)确实表达了 deliberate=有意为之。1。(这是原文里的同义句,能找到并用上是好的阅读策略)" },

  // ── O-Level 赵一鸣 ──
  cmsi8h6bv024214kf3t95q8sj: { awardedMarks: 0, reason: "Q1:'thinking twice'(三思而行)是 deliberate 的另一个义项;此处 a deliberate policy 指「刻意推行的、有意为之的」。0。" },
  cmsi7ryak010a14kfvpms8poi: { awardedMarks: 0, reason: 'Q2:折叠车可上地铁是列车的规定,不是「车站提供了什么」;应答自行车停放位或储物柜。0。' },
  cmsi8hx9n024u14kfu0rxvmuj: { awardedMarks: 0, reason: 'Q3:「更便宜、更方便」太笼统,没有写出到底怎么方便(随处借还、不必自己买车存车)。0/2。' },
  cmsi7vgf2018u14kfrtikovhn: { awardedMarks: 5, reason: 'Q4:写到 5 条做法 —— 手机 App 租车、地铁允许带折叠车、公众宣导交通规则、学校教孩子骑行、环岛路线。用了规定开头 ✓。内容 5/8。注意:①超过 80 词上限 ②中文标点(，)要换成英文逗号。5/8。' },

  // ── O-Level 赵伯容 ──
  cmsi7o6pf00un14kfwbh2m2ap: { awardedMarks: 0, reason: 'Q1:答的是这项政策的内容,不是 deliberate 这个词的意思(有意为之、刻意安排的)。0。' },
  cmsi7tlug016914kfrkh9dwnc: { awardedMarks: 1, reason: 'Q2:自行车停放位和储物柜,正确。1。' },
  cmsi7ykg801dk14kflupy7ibe: { awardedMarks: 1, reason: 'Q3:「租一辆车骑遍全岛」触及「不必自己买车」这层;未写出随处可借可还、也不用找地方存放。1/2。' },
  cmsi823l101k814kfhzwczom0: { awardedMarks: 0, reason: 'Q4:「政策、支持、意愿、观念转变」全是抽象名词,没有一条具体做法,也没用规定开头。概要要写「做了什么」,不是「靠什么」。内容点 0。0/8。' },
};

// Finalize-sweep — every non-practice submission in these assignments gets
// its status flipped submitted→marked (recomputing scores), even the fully
const GRADES_0811: Record<string, { awardedMarks: number; reason: string }> = {
  // 2026-08-11 早测 · authentic=ielts_adapted_2026_v5/Test1/P1
  // (Weather Beyond the Atmosphere 空间天气, NOAA 公有领域底本改编)
  // olevel=ai_authored_olevel_40_uniform_v1 (The Uniform 叙事卷)
  // 全部由 Claude 在 chat 逐条判,零 AI 调用。

  // ── O-Level ──
  cmsnxrlbi017xk35hgdne2f9p: { awardedMarks: 1, reason: "Q1:表哥 Wei Ming,对。1。(叙述者是男生,用 his)" }, // HEIN HTET NAING Q1
  cmsnxlq5i00yfk35hcgzi23zd: { awardedMarks: 1, reason: "Q1:表哥 Wei Ming,对。1。" }, // 赵伯容 Q1
  cmsnxpgg9015gk35h53kownk8: { awardedMarks: 1, reason: "Q2:four evenings,对。1。" }, // HEIN HTET NAING Q2
  cmsnxnsg5012zk35hogavaffn: { awardedMarks: 1, reason: "Q2:four,对。1。" }, // 赵一鸣 Q2
  cmsnxnxek013jk35h3wbty7mt: { awardedMarks: 1, reason: "Q2:four evenings,对。1。(It took her... 时态用 took)" }, // 赵伯容 Q2
  cmsnxqjv40170k35hxc6ccevr: { awardedMarks: 0, reason: "Q3:只说 old。这题考的是\"weak tea 这个颜色比喻说明了什么\",要答出领口已经泛黄变色、不再是白的。只说\"旧\"没有触及颜色,不给分。0。" }, // HEIN HTET NAING Q3
  cmsnxq65z016ek35hhc019nle: { awardedMarks: 1, reason: "Q3:答到 dirty(不再干净洁白),抓住了颜色这一层,判对。1。(更准确是\"泛黄/褪成淡褐色\")" }, // 赵一鸣 Q3
  cmsnxr73h0174k35hn2sa1lnq: { awardedMarks: 0, reason: "Q3:只说 old,同上,没有触及颜色。0。" }, // 赵伯容 Q3
  cmsny6lyj01rpk35hmot8bp7d: { awardedMarks: 0, reason: "Q4:抄的是下一句关于 tear 的内容,答非所问。0。shadow 指徽章拆掉后布料留下一块颜色较深的印子。" }, // 曾义洋 Q4
  cmsnxtx5401bpk35h3ufci38o: { awardedMarks: 0, reason: "Q4:只说徽章没了、那里空着 —— 但题干已经写明 badge had been unpicked,等于没有补充信息。shadow 的关键是\"留下了看得见的痕迹\"。0。" }, // 赵一鸣 Q4
  cmsnxtqxd01bfk35hpdpyfw6b: { awardedMarks: 0, reason: "Q4:说前任主人喜欢戴徽章,文中无据。0。" }, // 赵伯容 Q4
  cmsnxsnls019jk35hn9omycea: { awardedMarks: 0, reason: "Q5:只说 examined carefully,不看那个比喻也能写出来。要答出她像挑菜一样内行、务实地估量这块布还能不能用。0。" }, // HEIN HTET NAING Q5
  cmsnxy9t401gdk35hjhu2rai8: { awardedMarks: 1, reason: "Q5:答到\"像为家里买菜一样认真对待\",抓住了务实估量这一层,判对。1。" }, // 赵一鸣 Q5
  cmsnxy4zs01g7k35h2vvl7m76: { awardedMarks: 0, reason: "Q5:说母亲喜欢穿彩色衣服,文中无据。0。" }, // 赵伯容 Q5
  cmsny0vgy01l3k35hy32a7vjk: { awardedMarks: 1, reason: "Q6:答到 MP1(他不认同),得 1。缺 MP2 —— 为什么明明不认同还是不说:抱怨没用,而且会显得不领情,家里本来也买不起新的。1/2。" }, // 赵一鸣 Q6
  cmsny0cdb01kdk35hym6seapg: { awardedMarks: 1, reason: "Q6:答到 MP1(他不喜欢这块布),得 1。\"所以我什么都没说\"只是把题干重复一遍,没解释原因,缺 MP2。1/2。" }, // 赵伯容 Q6
  cmsnyahb401w2k35h88w2gjzd: { awardedMarks: 0, reason: "Q7:只写了一个\"9\",无法判分。0。这题问的是:十八块说明家里买不起新衬衫(MP1),而且母子都心知肚明却都不说破(MP2)。" }, // 曾义洋 Q7
  cmsny3cz501ntk35hzt5bh1ti: { awardedMarks: 0, reason: "Q7:与原文不符 —— 他并没有买新衬衫,他穿的就是母亲改好的那件。0。" }, // 赵一鸣 Q7
  cmsny5z8n01r3k35h0atdtu0n: { awardedMarks: 0, reason: "Q7:说母亲明白儿子不喜欢她的审美,偏了。这句的关键是钱:买不起新的,而且两人都避而不谈。0。" }, // 赵伯容 Q7
  cmsnycdd401x4k35hepkwuphh: { awardedMarks: 0, reason: "Q8:只写了 \"Because \" 就没有了。0。答案:一是对自己的手艺满意(MP1),二是她不善言辞,这个多余的小动作就是她表达疼爱的方式(MP2)。" }, // 赵伯容 Q8
  cmsny7hu501srk35h5cetbmfp: { awardedMarks: 0, reason: "Q9:整段抄原文,没有回答\"效果\"。0。要点:他是事后才发觉自己语气里根本没有需要掩饰的东西,说明羞耻感是真的消失了、而非他刻意装出来的,这种不经意的发现比直接宣告更可信。" }, // 曾义洋 Q9

  // ── 雅思 ──
  cmsnxyjtm01gvk35hqahumdah: { awardedMarks: 0, reason: "段1:B,正解 H。0。" }, // 刘钇村 Q1
  cmsnxrdu4017ek35hf94a98hl: { awardedMarks: 0, reason: "段1:A,正解 H。0。" }, // 叶雅滋 Q1
  cmsnxnhqt011xk35hdoc3qtxi: { awardedMarks: 0, reason: "段1:B,正解 H。0。" }, // 林寅嘉 Q1
  cmsnxcexb00sgk35hfl0y966a: { awardedMarks: 0, reason: "段1:C,正解 H。0。" }, // 毛思琳 Q1
  cmsnxzmrt01jhk35h0vnzkc3u: { awardedMarks: 0, reason: "段2:C,正解 F。0。" }, // 刘钇村 Q2
  cmsnxq8d4016ik35hn7e1n3lt: { awardedMarks: 1, reason: "段2:答案就是 F,只是打成了全角「Ｆ」,系统按字符精确匹配才没自动判对。内容正确,判对。1。(下次把输入法切成半角英文)" }, // 叶雅滋 Q2
  cmsnxnkrs0127k35hkv1qqf1g: { awardedMarks: 0, reason: "段2:A,正解 F。0。" }, // 林寅嘉 Q2
  cmsnxcgz600sik35ha9pjhqfg: { awardedMarks: 0, reason: "段2:E,正解 F。0。" }, // 毛思琳 Q2
  cmsnxouqj014qk35hl74dv488: { awardedMarks: 0, reason: "段2:C,正解 F。0。" }, // 闫雯涵 Q2
  cmsny69up01rjk35h1y39vx0l: { awardedMarks: 0, reason: "段3:D,正解 B。0。" }, // 刘钇村 Q3
  cmsnxnnfa012hk35hnf0owg2x: { awardedMarks: 0, reason: "段3:H,正解 B。0。" }, // 林寅嘉 Q3
  cmsnxcmez00skk35hez222win: { awardedMarks: 0, reason: "段3:D,正解 B。0。" }, // 毛思琳 Q3
  cmsny8otm01uqk35hnmmx0nqb: { awardedMarks: 0, reason: "段3:E,正解 B。0。" }, // 郑稀瑜 Q3
  cmsny3hfd01o1k35hasnx6uw5: { awardedMarks: 0, reason: "段4:E,正解 G。0。" }, // 刘钇村 Q4
  cmsnxnsc1012vk35hxcps2la5: { awardedMarks: 0, reason: "段4:D,正解 G。0。" }, // 林寅嘉 Q4
  cmsnxcsty00smk35h0jpue0bw: { awardedMarks: 0, reason: "段4:A,正解 G。0。" }, // 毛思琳 Q4
  cmsny7qr901t0k35h9pfiw47n: { awardedMarks: 1, reason: "填11:gas。原文\"encounter more gas than expected\"就在这句上,题干措辞和它重合,gas 说得通,判对。1。(标准答案 drag,即原文点名的 satellite drag)" }, // 叶雅滋 Q11
  cmsnxnrrb012tk35h9l7fo6yh: { awardedMarks: 1, reason: "填11:gas。同上,题干与原文\"more gas\"重合,判对。1。(标准答案 drag)" }, // 李淳 Q11
  cmsny69pk01rhk35hp8egxynn: { awardedMarks: 1, reason: "填11:Gas。同上,判对。1。(标准答案 drag)" }, // 胡齐家 Q11
  cmsny3xnn01olk35hg9mrodq3: { awardedMarks: 1, reason: "填11:gas。同上,判对。1。(标准答案 drag)" }, // 郑稀瑜 Q11
  cmsnxpn4b015zk35hx9szb9j5: { awardedMarks: 1, reason: "填11:satellite drag,正是原文点名的那个效应,判对。1。" }, // 闫雯涵 Q11
  cmsnxfehs00uqk35h5qpcgffz: { awardedMarks: 0, reason: "填13:geomagrtices。前半 geomag 对了,后半拼错得认不出来,雅思阅读拼写必须完全正确。0。正解 geomagnetic。" }, // 杨钧皓 Q13
  cmsnxtetg01axk35hckh93c49: { awardedMarks: 1, reason: "填13:geomagenetic,只多打了一个 e,词本身认得出是 geomagnetic,判对。1。(雅思正式考试拼写从严,考场上要检查一遍)" }, // 王耀星 Q13
};

// auto-graded ones (0 parked items) and blank submissions (no scripts). The
// GRADES map alone only reaches submissions that had a parked item.
const SWEEP_ASSIGNMENTS: string[] = [
  47f92310-c27f-4f65-ab31-134aee25bb2a, // 2026-08-11 IELTS authentic (Weather Beyond the Atmosphere)
  addb3d7a-b801-453a-a756-dccb6edf1f47, // 2026-08-11 O-Level (The Uniform, 叙事卷)
];

const GRADES: Record<string, { awardedMarks: number; reason: string }> = GRADES_0811;
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
