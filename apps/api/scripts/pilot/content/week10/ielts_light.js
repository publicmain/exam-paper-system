/**
 * 第十周 —— ielts_light（雅思轻量）档，四篇全原创说明文。
 *
 * 沿用第九周结构：五段、不编号；3 道判断、3 道填空转四选一、1 道两分概括填空、
 * 3 道主观题（2 / 1 / 2 分），每天 10 题、满分 13 分；每篇都有 Using your own words。
 * 本档不属于简报指定的 GP 议论文档位，四篇均为说明文。
 *
 * 选题、梗概与结局（SPECS 按 11-03 至 11-06 排列）：
 *   周二 culture：A Pattern Built Into Cloth（织进布里的图案）。从印花与织纹的区别进入，
 *     解释经纬交错、组织顺序和张力控制；结尾从保存成品转到让实际技艺继续被练习。
 *   周三 learning：The World on a Flat Page（平面上的世界）。用展开曲面的困难解释投影，
 *     区分保面积与保局部角度，再说明单看比例尺不能消除误读；结尾把平面图与球体对照。
 *   周四 health：How the Eye Changes Its Focus（眼睛怎样调焦）。解释不同距离的光线，
 *     跟踪肌肉、连接纤维与晶状体形状的变化；结尾用清楚的近字与模糊的远景解释焦点取舍。
 *   周五 community：Thirty Visits, How Many People?（三十次到访是多少人）。用明确假设的
 *     两个活动作算术比较，拆开覆盖人数与持续参加；结尾保留两个数字，让两种贡献分别可见。
 * 四篇分别为工艺结构、空间模型、身体机制、统计单位比较，不使用人物姓名或叙事老套路。
 *
 * 事实核对（依简报离线进行，未联网核验）：
 *   · 织造：经线沿织物长度排列，纬线横向穿过；平纹逐根交替上下、相邻行反转；
 *     组织方式与色线可共同形成图案，刺绣是在已有底布上加针脚；张力影响织物均匀程度。
 *     均为基础纺织常识，把握高。不写特定族群起源、图案归属、年代或产量，避免泛化文化。
 *   · 地图：球面无法在平面上同时保留所有几何关系；等积投影保相对面积，保角投影保
 *     局部角度而非任意两点间的真实方位；比例尺可随位置变化。基础制图原理，把握高。
 *     不点具体投影名，不把局部保角说成所有航线方向准确；球体仅作地球整体形状的模型。
 *   · 调焦：角膜先使光线折射，晶状体继续聚焦到视网膜；看近处时睫状肌收缩、悬韧带
 *     张力减小，弹性晶状体更圆；看远处逆转。基础光学与生理知识，把握高，限通常的
 *     年轻健康眼睛，不涉及疾病诊断、治疗、训练建议、年龄阈值或效果保证。
 *   · 社区：两项活动及人数均明确标为假设，10 人各来 3 次与 30 人各来 1 次均为 30
 *     次到访；计数单位不同不能互相替代，是算术与统计定义，把握高。没有虚构实证调查。
 *
 * 查重：完整对照 pack-titles-1030.txt 与 read-titles-1030.txt，并在历史内容包和
 * test-fixtures 检索 weaving / warp / weft / embroidery / loom / map projection /
 * equal-area / cartograph / retina / accommodation / unique visitors / repeat visits /
 * attendance / headcount；未发现相同核心题材。
 *   · 旧文 The forgotten craft of Japanese kintsugi 讲陶器修复，本篇讲经纬结构与技艺传递；
 *     The Fourth Button 讲学会缝扣子后帮助家人，本篇无学手艺成功的故事，刺绣只作工艺对照。
 *   · A Map Made from Sound 讲城镇声音采集及注意力，A World Without Left and Right 讲语言
 *     的空间参照，本篇讲球面投影的几何限制，不写导航实验或居民采集声音。
 *   · Is That Really My Voice? / Why Ears Pop on a Plane 讲听觉与气压，星体观察旧文仅提
 *     光学透镜；本篇核心是眼睛调节晶状体形状，机制、例子与结尾均不同。
 *   · The Gap in the Graph 讲传感器缺测与旧值替代，The Blank Column 讲具体请求开启互助，
 *     本篇没有数据缺口或求助转折，讲同为真实的到访量与不同参与人数为何不可混用。
 *
 * 判断题全周：周二 T / F / T，周三 NG / F / F，周四 T / NG / T，周五 NG / F / NG。
 *   → TRUE 4 · FALSE 4 · NOT GIVEN 4；每天只有两种答案，既不各一种，也不全同。
 * NOT GIVEN 均明确缺少所问比较或资料；FALSE 都有直接相反的原文，不靠常识判定。
 * 主观题逐点给分、接受合理同义改写；照抄却没解释题目要求的关系，不给对应层次的分。
 * 校园安全：正文、题干、选项、答案、rubric 按简报逐句检查，不涉及敏感题材或停推词。
 * 徽章主题：2026-11-03 culture · 11-04 learning · 11-05 health · 11-06 community。
 */

'use strict';

const { buildAuthoredDay, plain } = require('../authored');
const { DATES } = require('./dates');

const LEVEL = 'ielts_light';

// 周二 —— 织物结构与技艺传递（culture）
const WOVEN_PATTERN = {
  key: 'original-w10-woven-pattern',
  title: 'A Pattern Built Into Cloth',
  passage: plain([
    'A patterned cloth may look like a plain surface to which decoration has been added. Sometimes that description is accurate: a design can be printed onto finished material. In weaving, however, a pattern can emerge as the cloth itself is constructed. Its appearance then depends on the structural arrangement of threads, rather than solely on marks applied afterwards.',
    'On a loom, one set of threads is held under tension along the length of the future cloth. These are the warp. Another thread, the weft, travels across them. In a plain weave, it passes alternately over and under individual warp threads, with the sequence reversed in the next row. This interlacing produces a continuous fabric from separate strands.',
    'More elaborate configurations allow some threads to remain visible across several crossings. Together with changes of colour, these variations can produce repeated shapes without printing them onto a surface. Embroidery works differently: additional stitches are placed in cloth that already exists. The distinction concerns how a design is made, not whether one method is more valuable or more culturally meaningful.',
    'A diagram can record the sequence of crossings, but it cannot fully communicate the practical judgement involved. If the weft is pulled too tightly, the edges may be drawn inwards; uneven tension can also disturb the regularity of a pattern. Watching experienced practitioners adjust the threads therefore reveals knowledge that a finished object does not display directly. A neat result can conceal continual small corrections. Such coordination includes tacit knowledge, acquired through practice.',
    'This helps explain why preserving a textile tradition involves more than storing attractive examples. An object records what was produced, while teaching keeps the ability to produce it in use. Photographs and diagrams remain useful, particularly when a pattern is complicated. Yet they complement practice rather than replace it. A collection can retain the visible result of a craft even when the practical knowledge needed to continue that craft is no longer being passed on.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'In some woven cloth, the pattern is formed during the construction of the material.',
      answer: 'TRUE',
      evidence: 'In weaving, however, a pattern can emerge as the cloth itself is constructed.',
    },
    {
      kind: 'tfng',
      item: 'The passage presents embroidery as a less valuable method than weaving.',
      answer: 'FALSE',
      evidence: 'The distinction concerns how a design is made, not whether one method is more valuable or more culturally meaningful.',
    },
    {
      kind: 'tfng',
      item: 'A finished textile can hide the repeated adjustments made during its production.',
      answer: 'TRUE',
      evidence: 'A neat result can conceal continual small corrections.',
    },
    {
      kind: 'gapChoice',
      stem: 'The threads running along the length of cloth are held under ______ on the loom.',
      answer: 'tension',
      distractors: ['decoration', 'colour', 'judgement'],
      evidence: 'On a loom, one set of threads is held under tension along the length of the future cloth.',
    },
    {
      kind: 'gapChoice',
      stem: 'In plain weave, the sequence is ______ in the following row.',
      answer: 'reversed',
      distractors: ['printed', 'pulled', 'placed'],
      evidence: 'In a plain weave, it passes alternately over and under individual warp threads, with the sequence reversed in the next row.',
    },
    {
      kind: 'gapChoice',
      stem: 'In embroidery, additional ______ are put into an existing piece of cloth.',
      answer: 'stitches',
      distractors: ['diagrams', 'crossings', 'corrections'],
      evidence: 'Embroidery works differently: additional stitches are placed in cloth that already exists.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'Keeping objects and teaching a textile craft serve different purposes because ______.',
      answer: 'objects preserve examples of what has been made, while teaching allows people to keep making it',
      evidence: 'An object records what was produced, while teaching keeps the ability to produce it in use.',
      rubric: '两分：①保存实物留下已经做出的作品／成果，给 1 分；②教学让制作能力继续被使用／传下去，给 1 分。两点独立，合理同义改写均可。只写「一个静态、一个动态」而没说明各自保留什么，不给分；写「照片没有用」「保存实物就一定保住了技艺」不给分。照抄别处句子但没有回答这两个作用，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why a diagram and watching a maker provide different kinds of knowledge.',
      answer: 'A diagram shows the order in which threads cross. Watching a maker shows how the threads must be adjusted while the work is being done.',
      evidence: 'A diagram can record the sequence of crossings, but it cannot fully communicate the practical judgement involved. If the weft is pulled too tightly, the edges may be drawn inwards; uneven tension can also disturb the regularity of a pattern. Watching experienced practitioners adjust the threads therefore reveals knowledge that a finished object does not display directly.',
      rubric: '两分：①图示提供线怎样交错的顺序／结构信息，给 1 分；②观察制作者能了解工作中怎样调节线／张力，给 1 分。合理同义改写均可；第二点用避免把边缘拉紧等具体调节例子也可。只说「看人做比较好」不给分；照抄图示与观察的句子却没解释两种知识的区别，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "What does 'they' refer to in the final paragraph?",
      answer: 'Photographs and diagrams.',
      evidence: 'Photographs and diagrams remain useful, particularly when a pattern is complicated. Yet they complement practice rather than replace it.',
      rubric: '一分：答出「照片和图示」给 1 分，合理同义改写也可。只写其中一种不给分，因为 they 指前面并列的两类记录；写「制作者」「作品收藏」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why can judging a craft only by its finished appearance miss both its production process and its future?',
      answer: 'A tidy pattern does not show the corrections needed to make it. Keeping the finished piece does not ensure that anyone can continue making such pieces.',
      evidence: 'A neat result can conceal continual small corrections. Such coordination includes tacit knowledge, acquired through practice.\n\nThis helps explain why preserving a textile tradition involves more than storing attractive examples. An object records what was produced, while teaching keeps the ability to produce it in use. Photographs and diagrams remain useful, particularly when a pattern is complicated. Yet they complement practice rather than replace it. A collection can retain the visible result of a craft even when the practical knowledge needed to continue that craft is no longer being passed on.',
      rubric: '两分：①成品的整齐外观不显示制作时不断调节的过程，给 1 分；②保存成品不能保证制作知识继续传承／有人继续会做，给 1 分。合理同义改写均可，两点独立。只描述图案漂亮不给分；只列「成品、教学」而没解释忽略了什么，不给分。照抄原文但未回答过程或未来这一层，不给对应分。',
    },
  ],
};

// 周三 —— 阅读世界地图时理解投影（learning）
const MAP_PROJECTION = {
  key: 'original-w10-map-projection',
  title: 'The World on a Flat Page',
  passage: plain([
    'Two world maps can show the same countries yet make their relative sizes look remarkably different. Neither difference in printing nor a change of borders is needed to explain this. The difficulty begins with representing a spherical surface on a flat sheet. A globe can model the overall shape of Earth; a page cannot reproduce all its geometrical and spatial relationships without alteration.',
    'Imagine peeling an orange and trying to press the complete skin flat. It must split, stretch or overlap. The analogy is imperfect, since a map is calculated rather than physically flattened, but it illustrates the underlying constraint. A map projection is a systematic way of transferring positions from a curved surface onto a plane. Every projection involves some distortion. The obstacle is geometry, not a lack of detail.',
    'Different projections preserve different properties. An equal-area map maintains the correct proportions between areas, although the outlines of regions may appear stretched. A conformal map preserves local angles, making shapes in sufficiently small areas look familiar, but its scale varies across the map. Preserving local angles does not mean that every long journey has its true direction shown by a straight line.',
    'These distinctions matter when maps become evidence in a lesson. If students compare the extent of forests in different regions, a projection that greatly enlarges one region could encourage a misleading visual comparison. Equal areas should occupy equal amounts of paper: this equivalence is essential here. However, accurately comparing areas does not require every coastline to retain its familiar outline. Proportional relationships matter more than familiar shapes for this comparison.',
    'Reading a map therefore involves more than finding a place name. Students should ask which relationships have been preserved and which have changed. A scale printed beneath a world map does not by itself establish that distances are equally accurate everywhere. Comparing a two-dimensional map with a globe makes the problem visible: the familiar rectangle is one representation of the world, rather than the standard against which the world must be judged.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'Students usually prefer conformal maps to equal-area maps.',
      answer: 'NOT GIVEN',
      explanation: '原文说明两类投影各保留什么，没有调查或比较学生对它们的喜好；熟悉的外形不等于学生偏好的证据。',
    },
    {
      kind: 'tfng',
      item: 'A projection can preserve every geometrical relationship of the curved surface on a flat page.',
      answer: 'FALSE',
      evidence: 'A globe can model the overall shape of Earth; a page cannot reproduce all its geometrical and spatial relationships without alteration.',
    },
    {
      kind: 'tfng',
      item: 'An equal-area map must also preserve the familiar outlines of all regions.',
      answer: 'FALSE',
      evidence: 'An equal-area map maintains the correct proportions between areas, although the outlines of regions may appear stretched.',
    },
    {
      kind: 'gapChoice',
      stem: 'The orange-skin comparison illustrates the underlying ______ of representing a curved surface on a plane.',
      answer: 'constraint',
      distractors: ['scale', 'direction', 'extent'],
      evidence: 'The analogy is imperfect, since a map is calculated rather than physically flattened, but it illustrates the underlying constraint.',
    },
    {
      kind: 'gapChoice',
      stem: 'A conformal map preserves local ______.',
      answer: 'angles',
      distractors: ['borders', 'distances', 'proportions'],
      evidence: 'A conformal map preserves local angles, making shapes in sufficiently small areas look familiar, but its scale varies across the map.',
    },
    {
      kind: 'gapChoice',
      stem: 'The writer recommends comparing a flat map with a ______ to make its limitations visible.',
      answer: 'globe',
      distractors: ['rectangle', 'coastline', 'region'],
      evidence: 'Comparing a two-dimensional map with a globe makes the problem visible: the familiar rectangle is one representation of the world, rather than the standard against which the world must be judged.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The orange-skin example is helpful but limited because ______.',
      answer: 'it shows why flattening a curved surface requires changes, but a map is produced through calculation rather than by pressing an actual surface flat',
      evidence: 'Imagine peeling an orange and trying to press the complete skin flat. It must split, stretch or overlap. The analogy is imperfect, since a map is calculated rather than physically flattened, but it illustrates the underlying constraint.',
      rubric: '两分：①橙皮例子显示曲面压平时必须发生改变／不能原样铺平，给 1 分；②真正地图靠计算产生，并非把实际表面压平，给 1 分。合理同义改写均可。只说「橙皮会裂」却没有联系曲面变平面的困难，不给第一分；只说「橙子不是地球」不给第二分。照抄但未解释比喻的作用或限制，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why an unfamiliar-looking equal-area map can still be useful for the forest lesson.',
      answer: 'It gives equal amounts of land equal space on the page, so visual comparisons of extent are fairer. A changed outline does not prevent the area comparison that the lesson requires.',
      evidence: 'These distinctions matter when maps become evidence in a lesson. If students compare the extent of forests in different regions, a projection that greatly enlarges one region could encourage a misleading visual comparison. Equal areas should occupy equal amounts of paper: this equivalence is essential here. However, accurately comparing areas does not require every coastline to retain its familiar outline. Proportional relationships matter more than familiar shapes for this comparison.',
      rubric: '两分：①同样大的实际面积在纸上占同样空间，适合比较森林范围，给 1 分；②轮廓变形不妨碍本课要做的面积比较，给 1 分。合理同义改写均可，两点独立。第一点答「不会因投影放大某个地区而误判面积」也可。只写地图陌生或列出两种投影名称不给分；照抄面积与轮廓的对比却没说明它们与本课任务的关系，不给对应分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why is a scale beneath a world map insufficient evidence that all distances shown are equally accurate?',
      answer: 'The scale can vary with position on the map.',
      evidence: 'A conformal map preserves local angles, making shapes in sufficiently small areas look familiar, but its scale varies across the map.',
      rubric: '一分：答出「地图不同位置的比例尺可能不同」给 1 分，合理同义改写也可。只说「比例尺有数字」「地图很大」不给分；写「所有地图都没有准确距离」不给分。照抄结尾的 insufficient 含义而不说明比例尺随位置变化，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What TWO assumptions does the writer reject about long routes and the accuracy of distances across a map?',
      answer: 'Preserving local angles does not make every long route a straight line showing its true direction. A printed scale does not show that distances are equally accurate throughout the map.',
      evidence: 'Preserving local angles does not mean that every long journey has its true direction shown by a straight line.\n\nThese distinctions matter when maps become evidence in a lesson. If students compare the extent of forests in different regions, a projection that greatly enlarges one region could encourage a misleading visual comparison. Equal areas should occupy equal amounts of paper: this equivalence is essential here. However, accurately comparing areas does not require every coastline to retain its familiar outline. Proportional relationships matter more than familiar shapes for this comparison.\n\nReading a map therefore involves more than finding a place name. Students should ask which relationships have been preserved and which have changed. A scale printed beneath a world map does not by itself establish that distances are equally accurate everywhere.',
      rubric: '两分：①不能从局部保角推出所有长途线路画成直线就反映真实方向，给 1 分；②不能从印有比例尺推出各处距离同样准确，给 1 分。合理同义改写均可，两点独立。写面积或轮廓的其他问题不给分，因为题目限定长途路线与距离；重复同一误区不给两次分。只抄原句却没指出哪个推断不成立，不给对应分。',
    },
  ],
};

// 周四 —— 通常年轻健康眼睛的调焦机制（health）
const EYE_FOCUS = {
  key: 'original-w10-eye-focus',
  title: 'How the Eye Changes Its Focus',
  passage: plain([
    'Look at a nearby word and then at a distant window. The scene may become clear so quickly that the adjustment passes unnoticed. Yet light from objects at different distances cannot be brought to a sharp image by exactly the same optical arrangement. In a typical healthy young eye, focusing involves changing the shape of a transparent structure inside it.',
    'Light first passes through the curved front surface, the cornea, which provides much of the refraction needed. The lens behind it makes further adjustments so that light forms a focused image on the retina, the sensitive layer at the back. When an object is brought closer, the rays reaching the eye spread out more widely and require additional bending.',
    'The lens is elastic and is suspended by fine fibres, called ligaments, connected to a ring of muscle. For distant viewing, the relaxed muscle leaves these fibres relatively tight, holding the lens flatter. When attention shifts to something nearby, the muscle contracts. This reduces the pull of the fibres, allowing the lens to become rounder through its own elasticity. The rounder lens bends light more strongly.',
    'This process, called accommodation, contains a relationship that can seem surprising: muscle contraction reduces tension in the supporting fibres. The muscle does not directly squeeze the lens into a rounded shape. Instead, it alters the pull around it. The distinction matters because describing focusing simply as a muscle making the lens thicker leaves out the indirect mechanism by which the change occurs.',
    'Nor should accommodation be confused with changing the amount of light entering the eye. The pupil, the opening in front of the lens, can become smaller in bright conditions, but adjusting an opening and altering lens curvature are different operations. While reading, a person may find that the distant background looks indistinct. That contrast reflects the distance currently selected for clear vision; the eye is not necessarily failing to work. Clarity at one distance does not require equal clarity at every other distance simultaneously.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The cornea bends light before it reaches the lens.',
      answer: 'TRUE',
      evidence: 'Light first passes through the curved front surface, the cornea, which provides much of the refraction needed. The lens behind it makes further adjustments so that light forms a focused image on the retina, the sensitive layer at the back.',
    },
    {
      kind: 'tfng',
      item: 'Changing focus from a window to a word takes longer than changing focus in the opposite direction.',
      answer: 'NOT GIVEN',
      explanation: '开头说调焦可能快得不被察觉，但全文没有比较由远到近与由近到远所需的时间，因此不能判断。',
    },
    {
      kind: 'tfng',
      item: 'Contraction of the ring of muscle reduces the pull on the lens.',
      answer: 'TRUE',
      evidence: 'When attention shifts to something nearby, the muscle contracts. This reduces the pull of the fibres, allowing the lens to become rounder through its own elasticity.',
    },
    {
      kind: 'gapChoice',
      stem: 'The sensitive layer on which the focused image forms is the ______.',
      answer: 'retina',
      distractors: ['cornea', 'lens', 'pupil'],
      evidence: 'The lens behind it makes further adjustments so that light forms a focused image on the retina, the sensitive layer at the back.',
    },
    {
      kind: 'gapChoice',
      stem: 'For distant viewing, tension in the fibres holds the lens ______.',
      answer: 'flatter',
      distractors: ['rounder', 'thicker', 'smaller'],
      evidence: 'For distant viewing, the relaxed muscle leaves these fibres relatively tight, holding the lens flatter.',
    },
    {
      kind: 'gapChoice',
      stem: 'The term for changing focus through changes in lens shape is ______.',
      answer: 'accommodation',
      distractors: ['contraction', 'curvature', 'elasticity'],
      evidence: 'This process, called accommodation, contains a relationship that can seem surprising: muscle contraction reduces tension in the supporting fibres.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'When focusing on something nearby, the eye changes the lens and the path of light so that ______.',
      answer: 'the lens becomes rounder and bends the incoming light more strongly',
      evidence: 'This reduces the pull of the fibres, allowing the lens to become rounder through its own elasticity. The rounder lens bends light more strongly.',
      rubric: '两分：①晶状体变得更圆／曲率增加，给 1 分；②光线被弯折得更强，给 1 分。合理同义改写均可，两点可单独给分。只写「看得清了」不给分；写「晶状体变平」「让更多光进入」不给对应分。照抄别处肌肉句而未回答晶状体或光线的变化，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why saying that the muscle directly squeezes the lens gives the wrong account of near focusing.',
      answer: 'The muscle changes how strongly the supporting fibres pull on the lens. Once that pull is reduced, the elastic lens becomes rounder by itself.',
      evidence: 'When attention shifts to something nearby, the muscle contracts. This reduces the pull of the fibres, allowing the lens to become rounder through its own elasticity. The rounder lens bends light more strongly.\n\nThis process, called accommodation, contains a relationship that can seem surprising: muscle contraction reduces tension in the supporting fibres. The muscle does not directly squeeze the lens into a rounded shape. Instead, it alters the pull around it.',
      rubric: '两分：①肌肉通过减少连接纤维的牵拉来起作用，给 1 分；②晶状体凭自身弹性变圆，给 1 分。合理同义改写均可，第一点答「肌肉收缩使纤维放松」也可。两点独立，不把晶状体弹性与纤维作用塞成一个得分点。写「肌肉用力把晶状体直接压圆」不给分；照抄「不是直接挤压」却未解释间接过程，不给对应分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: "In the third paragraph, what does 'This' in 'This reduces the pull' refer to?",
      answer: 'The contraction of the ring of muscle when focusing on something nearby.',
      evidence: 'When attention shifts to something nearby, the muscle contracts. This reduces the pull of the fibres, allowing the lens to become rounder through its own elasticity.',
      rubric: '一分：答出「那圈肌肉收缩」给 1 分；合理同义改写也可，不必重复看近处。只说「注意力变化」不给分，因为减少牵拉的直接动作是肌肉收缩；写「瞳孔缩小」「晶状体主动收缩」不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Why must pupil adjustment be distinguished from accommodation, and why can a distant background remain unclear during reading?',
      answer: 'The pupil controls light entry, a different operation from changing lens shape. An unclear distant background can occur because the eye is focused on nearby words.',
      evidence: 'Nor should accommodation be confused with changing the amount of light entering the eye. The pupil, the opening in front of the lens, can become smaller in bright conditions, but adjusting an opening and altering lens curvature are different operations. While reading, a person may find that the distant background looks indistinct. That contrast reflects the distance currently selected for clear vision; the eye is not necessarily failing to work.',
      rubric: '两分：①瞳孔大小调节进光量，调焦改变晶状体形状，是两种操作，给 1 分；②远景模糊可能是眼睛正在对近处文字调焦，给 1 分。合理同义改写均可，两点独立。只写「瞳孔小、背景模糊」不给分；写「模糊一定表示异常」「瞳孔本身就是晶状体」不给分。照抄现象但没有回答两种操作的区别或远景模糊的原因，不给对应分。',
    },
  ],
};

// 周五 —— 区分到访量与不同参与人数（community）
const COMMUNITY_COUNTS = {
  key: 'original-w10-community-counts',
  title: 'Thirty Visits, How Many People?',
  passage: plain([
    'A community centre may report aggregate attendance as evidence of participation. The arithmetic can be correct while the statistical interpretation remains uncertain. A visit is an event, whereas a participant is a person. Without distinguishing repeated attendance from attendance by distinct individuals, the same total can describe different relationships with a community.',
    'Consider two hypothetical programmes, each offering three sessions. In the first, the same ten residents attend every session, producing thirty visits. In the second, thirty different residents each attend once, again producing thirty visits. The totals are identical, but the first programme has reached ten individuals and the second thirty. This numerical equivalence conceals different patterns of engagement.',
    'The first programme provides continuity for sustained collaboration. Returning participants can develop a shared project, although retention alone supplies no qualitative evidence that they enjoyed every session. The second achieves broader outreach, but its larger number of individuals does not demonstrate that lasting connections were formed. One measure describes repeated involvement; another describes the breadth of contact. These are distinct criteria, not interchangeable achievements.',
    'This distinction determines which criterion is relevant. A centre hoping to introduce an activity to unfamiliar residents needs to know how many different people attended. A group organising a project across several meetings also needs to know whether people returned. Counting visits remains useful for planning materials and understanding how frequently a space is used. It becomes misleading only when it is presented as an answer to a different question.',
    'A transparent report could therefore show both cumulative visits and distinct participants, explaining the timeframe. Keeping that period consistent matters: someone returning next month may count differently in a monthly report and an annual one. Such consistency enables comparability. Rather than declaring one programme the winner, this approach makes both contributions visible. Thirty visits can represent a wide introduction or a continuing group; the total alone cannot tell the reader which.',
  ]),
  questions: [
    {
      kind: 'tfng',
      item: 'The second imaginary programme costs more to provide than the first.',
      answer: 'NOT GIVEN',
      explanation: '原文给出次数和人数，并说明次数可帮助规划材料，但没有提供两项活动的费用，不能从覆盖人数推断哪项更贵。',
    },
    {
      kind: 'tfng',
      item: 'The two imaginary programmes reach the same number of different residents.',
      answer: 'FALSE',
      evidence: 'The totals are identical, but the first programme has reached ten individuals and the second thirty.',
    },
    {
      kind: 'tfng',
      item: 'Most participants in the first imaginary programme live within walking distance of the centre.',
      answer: 'NOT GIVEN',
      explanation: '文中把参与者称为居民，但没有说明住址、离中心的距离或能否步行到达；不能把 residents 当成距离资料。',
    },
    {
      kind: 'gapChoice',
      stem: 'The first programme offers ______ through repeated attendance.',
      answer: 'continuity',
      distractors: ['arithmetic', 'interpretation', 'breadth'],
      evidence: 'The first programme provides continuity for sustained collaboration. Returning participants can develop a shared project, although retention alone supplies no qualitative evidence that they enjoyed every session.',
    },
    {
      kind: 'gapChoice',
      stem: 'Counting visits can help a centre plan the ______ needed for activities.',
      answer: 'materials',
      distractors: ['relationships', 'achievements', 'connections'],
      evidence: 'Counting visits remains useful for planning materials and understanding how frequently a space is used.',
    },
    {
      kind: 'gapChoice',
      stem: 'To compare attendance reports properly, the reporting period should remain ______.',
      answer: 'consistent',
      distractors: ['uncertain', 'interchangeable', 'hypothetical'],
      evidence: 'Keeping that period consistent matters: someone returning next month may count differently in a monthly report and an annual one.',
    },
    {
      kind: 'gapTyped',
      summary: true,
      marks: 2,
      stem: 'The two imaginary programmes both record thirty visits, but differ because ______.',
      answer: 'the first involves ten different residents while the second involves thirty different residents',
      evidence: 'The totals are identical, but the first programme has reached ten individuals and the second thirty.',
      rubric: '两分：①第一项只有 10 位不同居民，给 1 分；②第二项有 30 位不同居民，给 1 分。两点独立，合理同义表达均可，用人数明确表示而不逐字说 different 也可。写第一项有 30 人或第二项有 90 人不给对应分；只重复两项都是 30 次不给分。照抄其他次数句而没有回答不同参与人数，不给对应分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'Using your own words, explain why the examples do not establish that either programme is more successful overall.',
      answer: 'The first supports repeated involvement over time. The second brings the activity to more different people, so each serves a different aim.',
      evidence: 'The first programme provides continuity for sustained collaboration. Returning participants can develop a shared project, although retention alone supplies no qualitative evidence that they enjoyed every session. The second achieves broader outreach, but its larger number of individuals does not demonstrate that lasting connections were formed. One measure describes repeated involvement; another describes the breadth of contact. These are distinct criteria, not interchangeable achievements.',
      rubric: '两分：①第一项体现持续／重复参与的价值，给 1 分；②第二项体现覆盖更多不同居民的价值，给 1 分。说明不同目标下各有贡献即可，不额外要求第三个结论点；合理同义改写均可。只抄「10 人与 30 人」却不说明支持哪种成效不给分；写「第一项一定人人喜欢」「第二项必定形成更长久的关系」不给对应分。照抄原文的对比但没解释为何不能整体排出高下，不给对应层次的分。',
    },
    {
      kind: 'short',
      marks: 1,
      stem: 'Why can one returning person be counted differently in monthly and annual reports?',
      answer: 'The person may appear in two separate monthly counts but count as one different participant across the year.',
      evidence: 'Keeping that period consistent matters: someone returning next month may count differently in a monthly report and an annual one.',
      rubric: '一分：解释「跨两个月回来的人可在各月分别算一次，但全年不同人数中仍是同一个人」给 1 分，合理同义改写均可。只写「一个按月、一个按年」不给分，因为没有解释同一个人如何计数；写「全年必须每次都当新人」不给分。照抄 period 句却没有解释重复计数的范围，不给分。',
    },
    {
      kind: 'short',
      marks: 2,
      stem: 'What should the centre measure for each of these aims: introducing an activity to unfamiliar residents, and supporting a project over several meetings?',
      answer: 'For the introduction, it should count different people who attended. For the continuing project, it should check whether participants returned.',
      evidence: 'A centre hoping to introduce an activity to unfamiliar residents needs to know how many different people attended. A group organising a project across several meetings also needs to know whether people returned.',
      rubric: '两分：①推广给不熟悉活动的居民时看不同参与人数，给 1 分；②跨多次会议的项目看人有没有回来／重复参与情况，给 1 分。合理同义改写均可，两点独立。写「两种目标都只看到访总次数」不给分；只抄目标而没说对应指标，不给分。照抄其他段落的材料规划句而没有回答两个目标，不给对应分。',
    },
  ],
};

const SPECS = [WOVEN_PATTERN, MAP_PROJECTION, EYE_FOCUS, COMMUNITY_COUNTS];

module.exports = {
  LEVEL,
  SPECS,
  DAYS: DATES.slice(0, SPECS.length).map((date, i) => buildAuthoredDay(SPECS[i], date)),
};
