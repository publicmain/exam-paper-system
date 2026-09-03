/**
 * 每篇文章希望**优先教到**的词，key 是 `DAYS[].source`。
 *
 * 这不是词表本身 —— 词表由 `build-week2-vocab.js` 从 ECDICT 生成。这里
 * 只影响排序，而**前 12 个才是学生当天的主词**，其余留作同文备用词。
 * 所以这张表回答的是「这一篇最值得教哪些词」。
 *
 * ## 为什么非写不可
 *
 * 不给偏好表时，`choose` 的打分由 ECDICT 的词频排名主导，实测选出来的
 * 主词是这样的：
 *
 *   《The Umbrella》     → parent month near woman hard walk next end old man
 *   《The Leaf That Moved Ships》 → working difficult industry history labour demand
 *
 * 每一个都认识，没有一个值得当「今日新词」。原因是打分里的 rarity 取自
 * 词频排名，而 `barrage`、`mycorrhiza`、`plantation` 这类真正的专题词在
 * ECDICT 里往往**没有词频数据**，rarity 记 0，反被泛词压下去。
 *
 * ## 选词口径（按档位不同）
 *
 *   · O-Level 基础 —— 故事里的具体名词与动作词（umbrella / sweeping /
 *     stall），学生读完这篇就能用上；不选抽象词。
 *   · O-Level 进阶 / 标准 —— 情绪、动作与描写词，兼顾记叙文常用语。
 *   · 雅思两档 —— 学术语域的高频词与本篇的专题词各占一半。
 *
 * 写在这里的词若不在 ECDICT 里会被静默忽略（不会报错也不会顶上来），
 * 所以列表比 20 个略长是有意的。
 */

'use strict';

module.exports = {
  // ══ ielts_light（雅思轻量）════════════════════════════════
  'light-07-tidal-power.json': [
    'tide', 'tidal', 'barrage', 'estuary', 'turbine', 'predictability', 'grid', 'generate',
    'submerge', 'mudflat', 'seabed', 'current', 'dense', 'blade', 'intact', 'machinery',
    'commercial', 'reliable', 'unpredictable', 'supporter',
  ],
  'light-08-libraries.json': [
    'predict', 'prediction', 'borrow', 'lend', 'survey', 'access', 'pension', 'arrival',
    'paperwork', 'unfamiliar', 'adapt', 'instrument', 'employ', 'absorb', 'adequately',
    'critic', 'librarian', 'resident', 'application', 'welcome',
  ],
  'light-09-salt.json': [
    'valuable', 'substance', 'refrigeration', 'rot', 'preserve', 'bacteria', 'multiply',
    'economy', 'fleet', 'monopoly', 'grievance', 'revolution', 'deliberate', 'caravan',
    'slab', 'wealthy', 'mechanical', 'strategic', 'straightforward', 'tax',
  ],
  'original-rail-time': [
    'railway', 'timetable', 'clearance', 'collision', 'telegraph', 'resist', 'longitude',
    'zone', 'official', 'arrangement', 'invention', 'industry', 'convenience', 'organise',
    'adopt', 'traced', 'spanned', 'local', 'agree', 'familiar',
  ],
  'original-smell-of-rain': [
    'fanciful', 'chemically', 'identify', 'substance', 'responsible', 'bacteria', 'soil',
    'extraordinarily', 'sensitive', 'concentration', 'detect', 'oily', 'mixture', 'release',
    'trap', 'burst', 'spray', 'upwind', 'inherited', 'advantage',
  ],

  // ══ ielts_simplified（O-Level 基础）══════════════════════
  'basic-06-the-umbrella.json': [
    'umbrella', 'sweeping', 'cleaning', 'corner', 'covered', 'shared', 'picked', 'waited',
    'toilets', 'afternoon', 'nobody', 'someone', 'twenty', 'spoken', 'worked', 'push',
    'minute', 'month', 'rain', 'held',
  ],
  'basic-08-the-empty-seat.json': [
    'seat', 'empty', 'beside', 'lend', 'pencil', 'joke', 'funny', 'quiet', 'bird', 'miss',
    'term', 'laugh', 'move', 'talk', 'anyone', 'forgot', 'close', 'care', 'family', 'rest',
  ],
  'basic-09-the-durian.json': [
    'durian', 'stall', 'afford', 'promise', 'village', 'argue', 'spread', 'newspaper',
    'hardly', 'price', 'touch', 'smell', 'uncle', 'piece', 'watch', 'cost', 'sixty',
    'money', 'sister', 'shop',
  ],
  'original-library-clock': [
    'clock', 'library', 'screwdriver', 'complain', 'annoy', 'secondary', 'fourteen',
    'politely', 'packing', 'nearly', 'worse', 'expect', 'desk', 'twice', 'simply',
    'finally', 'smile', 'wrong', 'minute',
    // `trust` 排到最后：ECDICT 给它的第一条英文释义是信托法的
    // 「something (as property) held by one party (the trustee)…」，
    // 对中一学生是干扰。排在 12 名之后就只会出现在备用词里。
    'trust',
  ],
  'original-long-way': [
    'awning', 'wobbly', 'stool', 'fence', 'smooth', 'repaired', 'market', 'plastic',
    'coffee', 'counted', 'noticed', 'smell', 'save', 'sign', 'block', 'park', 'grey',
    'fish', 'wave', 'explain',
  ],

  // ══ olevel_intermediate（O-Level 进阶）═══════════════════
  'ai-authored-05-lost-wallet-simplified.json': [
    'wallet', 'identity', 'management', 'photograph', 'medicine', 'grandfather', 'notebook',
    'leather', 'cash', 'owner', 'stall', 'bent', 'chin', 'edge', 'soft', 'alone', 'office',
    'block', 'plate', 'boots',
  ],
  'simplified-new-glasses.json': [
    'perfectly', 'separate', 'classroom', 'corridor', 'recess', 'squint', 'sharp', 'heavy',
    'board', 'circle', 'settled', 'forward', 'primary', 'thousand', 'window', 'writing',
    'field', 'hunt', 'mind', 'tree',
  ],
  'simplified-paper-lantern.json': [
    'festival', 'cupboard', 'playground', 'steadily', 'handle', 'candle', 'carp', 'frame',
    'burning', 'alive', 'bare', 'path', 'corridor', 'plastic', 'stick', 'wire', 'smell',
    'beautiful', 'edge', 'trust',
  ],
  'simplified-swimming-lesson.json': [
    'instructor', 'shoulder', 'ordinary', 'cheerful', 'breathing', 'surface', 'patient',
    'barely', 'beneath', 'burst', 'chest', 'float', 'grab', 'lean', 'rail', 'rush', 'sink',
    'stroke', 'knot', 'pool',
  ],
  'original-wrong-name': [
    'certificate', 'september', 'enormous', 'ordinary', 'register', 'secondary', 'corridor',
    'flustered', 'properly', 'completely', 'avoid', 'correct', 'notice', 'relief', 'scene',
    'stress', 'fuss', 'root', 'drawer', 'gold',
  ],

  // ══ olevel（O-Level 标准）════════════════════════════════
  'ai-authored-15-the-tutor.json': [
    'briefcase', 'handwriting', 'punctual', 'expression', 'invisible', 'subtract',
    'equation', 'position', 'recently', 'slightly', 'careful', 'comment', 'calm', 'neat',
    'pale', 'fresh', 'skin', 'illness', 'band', 'third',
  ],
  'ai-authored-45-void-deck-wake.json': [
    'unbearable', 'stranger', 'entrance', 'corridor', 'occasion', 'upstairs', 'directly',
    'weather', 'refuse', 'handful', 'bicycle', 'guitar', 'clinic', 'argue', 'flight',
    'sentences', 'evening', 'deck', 'lift', 'nod',
  ],
  'ai-authored-46-recipe-card.json': [
    'ingredient', 'quantity', 'grandmother', 'instruction', 'attention', 'argument',
    'movement', 'discover', 'strictly', 'exhausting', 'deliberately', 'attempt', 'suspect',
    'disturb', 'steam', 'sudden', 'learning', 'actual', 'divide', 'jar',
  ],
  'ai-authored-47-letter-from-tekong.json': [
    'conversation', 'discussion', 'envelope', 'handwriting', 'grateful', 'ashamed',
    'quarrel', 'enlist', 'journey', 'section', 'survive', 'mention', 'weekend', 'drawer',
    'sofa', 'fever', 'address', 'dinner', 'trust', 'pack',
  ],
  'original-other-side': [
    'arithmetic', 'household', 'opposing', 'assemble', 'chemistry', 'particular',
    'argument', 'secondary', 'income', 'survey', 'society', 'private', 'quality',
    'describe', 'sentence', 'skill', 'speech', 'shape', 'reply', 'detail',
  ],

  // ══ ielts_authentic（雅思 · 真题型）══════════════════════
  'p06-tea-trade.json': [
    'monopoly', 'plantation', 'commodity', 'consumption', 'agriculture', 'manufacturer',
    'astringent', 'beverage', 'moisture', 'inferior', 'curiosity', 'criminal', 'criticism',
    'underlying', 'arithmetic', 'adaptation', 'anticipate', 'distinction', 'eventual',
    'alternative',
  ],
  'test2-passage1.json': [
    'forecast', 'background', 'earthquake', 'instrument', 'indicator', 'measurement',
    'precision', 'accumulate', 'dissolve', 'continuous', 'discipline', 'remarkable',
    'requirement', 'proportion', 'majority', 'explosive', 'satellite', 'sufficient',
    'underground', 'authority',
  ],
  'original-root-network': [
    'scrutiny', 'offspring', 'organism', 'reconcile', 'metaphor', 'fraction', 'enormous',
    'substantial', 'worldwide', 'underground', 'distribution', 'minority', 'neighbour',
    'arrangement', 'cooperative', 'transfer', 'estimate', 'evidence', 'relationship',
    'commercial',
  ],
  'original-cement-that-heals': [
    'concrete', 'bacteria', 'reservoir', 'precipitate', 'millimetre', 'reinforce',
    'laboratory', 'identical', 'limitation', 'deliberate', 'careless', 'volcanic',
    'chemistry', 'construction', 'industrial', 'engineer', 'opposite', 'maintain',
    'reaction', 'strength',
  ],
  'original-horse-before-wheel': [
    'archaeology', 'genetics', 'tolerance', 'selection', 'sequence', 'distinctive',
    'millennium', 'messenger', 'administration', 'replacement', 'population', 'technology',
    'economical', 'striking', 'distinct', 'appearance', 'transport', 'domestic',
    'physical', 'associate',
  ],
};
