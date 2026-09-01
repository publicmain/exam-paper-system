/**
 * The two restored levels for the first real-student week.
 *
 * The passages and source questions come from the repository's original fixture
 * bank.  This adapter turns them into the same publishable shape as the three
 * hand-authored level modules.  No network or runtime dictionary dependency is
 * involved: the teaching-word metadata is generated and committed alongside it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vocab = require('./fixture-vocab.generated.json');

const API_ROOT = path.resolve(__dirname, '..', '..', '..');
const LIGHT_DIR = path.join(API_ROOT, 'test-fixtures', 'ielts-light-2026');
const INTERMEDIATE_DIR = path.join(API_ROOT, 'test-fixtures', 'singapore-olevel-1128');
const DATES = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

const LIGHT_FILES = [
  'light-01-city-bees.json',
  'light-02-night-shift-sleep.json',
  'light-03-plastic-roads.json',
  'light-04-lost-languages.json',
  'light-05-vertical-farms.json',
];
const INTERMEDIATE_FILES = [
  'ai-authored-25-hawker-auntie-simplified.json',
  'ai-authored-22-macritchie-frog-simplified.json',
  'ai-authored-21-drawing-simplified.json',
  'ai-authored-18-library-card-simplified.json',
  'ai-authored-17-relay-simplified.json',
];

function read(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}

function cleanPassage(text) {
  return text.replace(/\n\n\(AI-authored original[\s\S]*$/, '').trim();
}

function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^Paragraph \d+\s*/, '').trim())
    .filter((p) => p && !p.startsWith('(AI-authored'));
}

function evidenceFor(stem, passage) {
  const requested = stem.match(/Paragraph\s+(\d+)/i)?.[1];
  const ps = paragraphs(passage);
  if (requested) return ps[Number(requested) - 1] ?? ps[0];
  return ps[0];
}

function options(values, answer) {
  const unique = [...new Set([answer, ...values].map(String))].slice(0, 4);
  while (unique.length < 4) unique.push(`None of choices ${unique.length + 1}`);
  const rotated = [...unique.slice(1), unique[0]];
  return {
    answer: String.fromCharCode(65 + rotated.indexOf(String(answer))),
    options: rotated.map((text, i) => ({ key: String.fromCharCode(65 + i), text })),
  };
}

function wordsFor(level, file) {
  return vocab[level][file].map((w) => ({
    headword: w.headword,
    surfaceForm: w.surfaceForm,
    phonetic: w.phonetic,
    pos: w.pos,
    translation: w.translation,
    definition: w.definition,
    context: w.context,
  }));
}

const LIGHT_HUMAN = {
  'light-01-city-bees.json': [
    ['summary_completion', 'Why can a city provide bees with a steadier food supply than a modern single-crop farm?', 'because different city plants flower at different times', 'A city, by contrast, is a patchwork of small gardens, parks, balconies and roadside trees, and these are planted with many different species.', '说明城市植物种类多、开花时间不同，意思完整给 2 分。'],
    ['short_answer', 'How does the higher temperature in cities extend the bees’ working season?', 'they emerge earlier in spring and stay active later into autumn', 'Bees emerge earlier in spring and remain active later into the autumn, which lengthens the season in which they can collect nectar.', '同时写到春天更早活动、秋天更晚停止给 2 分；只写一点给 1 分。'],
    ['short_answer', 'Give ONE way farm chemicals can affect bees.', 'they can weaken or kill bees', 'Farmers spray chemicals to protect their crops, and these treatments can weaken or kill bees.', 'weaken 或 kill 任一点表达清楚即给 1 分。'],
    ['short_answer', 'Why are some city beekeepers worried about the rapid increase in hives?', 'there may not be enough flowers to support all the hives', 'Some cities have seen so many new hives appear that beekeepers worry the available flowers cannot support them all.', '指出花源可能不足以供养所有蜂箱给 2 分。'],
  ],
  'light-02-night-shift-sleep.json': [
    ['summary_completion', 'What is the main signal that resets the body’s internal clock?', 'morning light reaching the eye', 'When morning light reaches the eye, the clock resets; when darkness falls, the body begins producing a hormone called melatonin, which prepares it for sleep.', '写出 morning light / light reaching the eye 给 1 分。'],
    ['short_answer', 'Give TWO health problems linked with long-term night work.', 'digestive complaints and heart problems', 'Studies have linked long-term night work with digestive complaints, heart problems and a higher risk of certain illnesses.', '三项中任写两项给 2 分；只写一项给 1 分。'],
    ['short_answer', 'Why is forward rotation of shifts preferable to backward rotation?', 'it suits the body clock better', 'Rotating shifts forward — morning, then afternoon, then night — suits the body better than rotating them backwards.', '指出更符合身体节律给 1 分。'],
    ['short_answer', 'Why can no workplace measure completely remove the problem of night work?', 'the internal clock cannot be switched off', 'The internal clock cannot be switched off, only nudged.', '明确写出人体生物钟不能关闭给 2 分。'],
  ],
  'light-03-plastic-roads.json': [
    ['summary_completion', 'What two shortages or waste problems led engineers to consider plastic roads?', 'short supplies of sand and gravel, and waste plastic disposal', 'Producing it requires a great deal of energy, and the world is running short of the sand and gravel that go into it. At the same time, governments everywhere are struggling to dispose of waste plastic.', '同时写到砂石短缺和废塑料处理给 2 分。'],
    ['short_answer', 'At what stage is shredded plastic added when making the road?', 'before the asphalt binder is mixed in', 'Waste plastic is shredded into small flakes and added to the hot stone before the asphalt binder is mixed in.', '写明在 binder 加入之前给 1 分。'],
    ['short_answer', 'Give ONE reported advantage of roads that contain plastic.', 'they resist water better or soften less in hot weather', 'Roads containing plastic have shown better resistance to water, which is the main cause of potholes. They also appear to soften less in very hot weather.', '抗水或高温下不易软化，任一点给 1 分。'],
    ['short_answer', 'What environmental risk raised by critics is still being measured?', 'tiny plastic fragments may wash into rivers and the sea', 'As tyres wear the surface away, the plastic does not disappear; it breaks into tiny fragments that wash into rivers and eventually the sea.', '指出微塑料碎片进入河流和海洋给 2 分。'],
  ],
  'light-04-lost-languages.json': [
    ['summary_completion', 'Why does skipping one generation put a language in serious danger?', 'the chain of learning is almost impossible to repair', 'A language is considered to be in danger when children stop learning it, because once a generation is skipped the chain is almost impossible to repair.', '写出语言传承链很难恢复给 2 分。'],
    ['short_answer', 'Why may parents voluntarily stop using a small language with their children?', 'the national language offers better jobs and easier schooling', 'Parents notice that the national language brings better jobs and easier schooling, so they raise their children in it.', '工作与教育两点写全给 2 分；一点给 1 分。'],
    ['short_answer', 'Give ONE kind of local knowledge that can disappear with a language.', 'plant names, weather signs, or fish routes', 'Many small languages carry detailed knowledge of the local environment — the names of hundreds of plants, the signs that predict weather, the routes that fish take through a river system.', '三类知识任写一类给 1 分。'],
    ['short_answer', 'What does the writer say works better than recordings alone?', 'giving people reasons to use the language every day', 'What works better is giving people reasons to use it every day: schools that teach in it, radio programmes, apps, road signs.', '指出让人每天实际使用语言给 2 分。'],
  ],
  'light-05-vertical-farms.json': [
    ['summary_completion', 'How do plants in the warehouse receive water and nutrients without soil?', 'their roots sit in a film of nutrient-rich water', 'The roots sit in a thin film of water carrying dissolved nutrients, and above each tray a panel of red and blue lamps provides exactly the wavelengths the plants use.', '写明根浸在含营养的薄层水中给 2 分。'],
    ['short_answer', 'Why is vertical farming especially relevant to Singapore?', 'it produces more food from little land in a country that imports most food', 'A vertical farm can produce the same weight of leaves as a field many times its footprint, which matters in a country that imports over ninety per cent of its food.', '少用地和高度依赖进口两点写全给 2 分。'],
    ['short_answer', 'How does a closed system reduce water use?', 'unused water is collected and used again', 'Because the system is closed, water that the plants do not absorb is collected and used again; such farms typically consume a small fraction of what an ordinary field needs.', '指出回收未吸收的水再利用给 1 分。'],
    ['short_answer', 'Why are wheat and rice unsuitable for current vertical farms?', 'they do not repay the high cost of lighting', 'Leafy greens and herbs are light, quick to grow and valuable, so they repay the cost of lighting. Wheat and rice do not.', '写出价值/生长特点不足以覆盖照明成本给 2 分。'],
  ],
};

function lightDays() {
  return LIGHT_FILES.map((file, dayIndex) => {
    const raw = read(LIGHT_DIR, file);
    const passage = cleanPassage(raw.passage);
    const completionAnswers = raw.questions.slice(3).map((q) => q.answer);
    const auto = raw.questions.map((q) => {
      if (q.taskType === 'true_false_not_given') {
        return {
          taskType: q.taskType,
          questionType: 'mcq',
          marks: q.marks,
          options: TFNG,
          answer: { TRUE: 'A', FALSE: 'B', 'NOT GIVEN': 'C' }[q.answer],
          stem: `${q.instruction}\n${q.item}`,
          evidence: q.answer === 'NOT GIVEN' ? '' : evidenceFor(q.item, passage),
          explanation: q.answer === 'NOT GIVEN' ? '原文没有提供这项信息。' : `原文信息与题干判断对应，答案是 ${q.answer}。`,
        };
      }
      const choice = options([...completionAnswers, raw.wordlist[0].word], q.answer);
      return {
        taskType: q.taskType,
        questionType: 'mcq',
        marks: q.marks,
        options: choice.options,
        answer: choice.answer,
        stem: `${q.instruction}\n${q.item}`,
        evidence: passage.split(/(?<=[.!?])\s+/).find((s) => s.toLowerCase().includes(String(q.answer).toLowerCase())) ?? '',
        explanation: `原文空格位置使用的词是 “${q.answer}”。`,
      };
    });
    const human = LIGHT_HUMAN[file].map(([taskType, stem, answer, evidence, rubric], i) => ({
      taskType,
      questionType: 'short_answer',
      marks: i === 2 ? 1 : 2,
      options: null,
      answer,
      accept: null,
      stem,
      evidence,
      rubric,
      explanation: `答案依据原文：${evidence}`,
    }));
    return {
      date: DATES[dayIndex],
      title: raw.passageTitle,
      passage,
      questions: [...auto, ...human],
      words: wordsFor('ielts_light', file),
    };
  });
}

const INTERMEDIATE_DISTRACTORS = {
  'ai-authored-25-hawker-auntie-simplified.json': [
    ['plain porridge and tea', 'fried rice with chilli', 'noodles and two fishballs'],
    ['she wrote it down each day', 'she guessed it differently', 'she had only heard it once'],
  ],
  'ai-authored-22-macritchie-frog-simplified.json': [
    ['owners', 'hunters', 'guides'],
    ['it separated the friends', 'it made them walk faster', 'it frightened the teacher'],
  ],
  'ai-authored-21-drawing-simplified.json': [
    ['the bus stop and two bicycles', 'the school hall and a teacher', 'his flat and the corridor'],
    ['he was bored and tired', 'he was angry and loud', 'he was calm and sleepy'],
  ],
  'ai-authored-18-library-card-simplified.json': [
    ['every Friday, on bus 28', 'once a month, by MRT', 'every morning, on foot'],
    ['someone stole it deliberately', 'she left it at the library desk', 'it was hidden inside a book'],
  ],
  'ai-authored-17-relay-simplified.json': [
    ['the team had no coach', 'the race was moved overseas', 'three boys refused to run'],
    ['angrily and impatiently', 'coldly and without waiting', 'loudly in front of the class'],
  ],
};

function intermediateDays() {
  return INTERMEDIATE_FILES.map((file, dayIndex) => {
    const raw = read(INTERMEDIATE_DIR, file);
    const section = raw.sections[0];
    const passage = cleanPassage(section.passage);
    const converted = section.questions.slice(0, 2).map((q, i) => {
      const choice = options(INTERMEDIATE_DISTRACTORS[file][i], q.answer);
      return {
        taskType: i === 0 ? 'sentence_completion' : 'multiple_choice',
        questionType: 'mcq',
        marks: q.marks,
        options: choice.options,
        answer: choice.answer,
        stem: q.stem,
        evidence: evidenceFor(q.stem, passage),
        explanation: `根据题目所指的原文段落，正确选项是 “${q.answer}”。`,
      };
    });
    const flow = raw.sections[1].questions.map((q) => ({
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: q.marks,
      options: q.options.map((o) => ({ key: o.key, text: o.text })),
      answer: q.answer,
      stem: q.stem,
      evidence: evidenceFor(q.stem, passage),
      explanation: `题目所指阶段的主导感受与选项 ${q.answer} 最吻合。`,
    }));
    const human = section.questions.slice(2, 6).map((q, i) => ({
      taskType: i === 1 ? 'summary_completion' : 'short_answer',
      questionType: 'short_answer',
      marks: q.marks,
      options: null,
      answer: q.answer,
      accept: null,
      stem: q.stem,
      evidence: evidenceFor(q.stem, passage),
      rubric: `按参考答案的要点给分；本题共 ${q.marks} 分，每个清楚、由原文支持的要点给 1 分，不得因措辞不同扣分。`,
      explanation: `答案依据题目所指的原文段落。`,
    }));
    return {
      date: DATES[dayIndex],
      title: section.passageTitle,
      passage,
      questions: [...converted, ...flow, ...human],
      words: wordsFor('olevel_intermediate', file),
    };
  });
}

module.exports = {
  IELTS_LIGHT_DAYS: lightDays(),
  OLEVEL_INTERMEDIATE_DAYS: intermediateDays(),
};
