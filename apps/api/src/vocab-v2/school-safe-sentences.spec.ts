import { describe, expect, it } from 'vitest';
import {
  isSchoolUnsafeContext,
  isSchoolUnsafeText,
  keepSchoolSafeTexts,
  schoolUnsafeReason,
  SCHOOL_BLOCKED_QUALITY_STATUS,
} from './school-safe-sentences';
import { contextForEncounter, type ContextCandidate } from './context-progression';

/**
 * 2026-10-20 事故的回归测试。
 *
 * 下面「真实脏数据」里的每一条都是从生产库里原样抄来的 —— 不是编的例子。
 * 「学科正当用法」那一组同样重要：闸门拦过头会让化学、生物、医学的词
 * 没有例句可用，那是另一种坏。
 */

/** 生产库原样抄来的脏例句（2026-10-20 下架的 78 条里挑的代表）。 */
const REAL_UNSAFE_SENTENCES: ReadonlyArray<readonly [string, string]> = [
  ['oral', 'What is oral sex?'],
  ['secrete', 'If a woman masturbates, she will secrete female hormones and become more feminine.'],
  ['respondents', "Some respondents reported they'd experienced orgasm while exercising."],
  ['involve', "Sex doesn't have to involve penetration."],
  ['portrayal', 'Pornography is a sinful and immoral portrayal of human sexuality.'],
  ['boundary', "Where's the boundary between sexuality and pornography?"],
  ['many', 'There are many sexual perversions.'],
  ['sex', "I'm a sex worker."],
  ['trophy', 'Sex is not a trophy.'],
  ['drag', 'Drag is not inherently sexual.'],
  ['inclusion', 'The inclusion of sex education in schools is, in my opinion, a good thing.'],
  ['as', 'Mary works as a prostitute.'],
  ['legal', 'Prostitution is legal in France.'],
  ['exposure', 'Amelia was arrested for her naked exposure.'],
  ['naked', 'Tom ran outside stark naked.'],
  ['breast', 'Rima wants a breast reduction.'],
  ['abortion', 'Layla had an abortion.'],
  ['actual', 'What the actual fuck?'],
  ['toxic', 'Tom is toxic as fuck.'],
  ['must', 'Warmongers must fuck off.'],
  ['discrimination', 'What is this shitty discrimination!'],
  // 第一版闸门用 `\bshit` 漏掉了这条，清完库它又被重新生成写回来 ——
  // 词边界卡在 bull 和 shit 中间。
  ['tradition', 'This tradition is bullshit.'],
  ['sex', 'Tom is a sex offender.'],
  ['sexual', 'Tom is a sexual predator.'],
  ['crack', 'Yanni was addicted to crack.'],
  ['marijuana', 'Yanni smokes a lot of marijuana.'],
  // 以下是 10-20 派 agent 逐词审出来、第一版正则一条都没拦住的
  ['widespread', 'Wife swapping is widespread there.'],
  ['oxygen', 'That oxygen tank is sexy.'],
  ['corpus', 'I piss on the corpus.'],
  ['go', 'I need to go poop.'],
  ['hedge', 'I pooped behind the hedge.'],
  ['that', 'I could hit that.'],
  ['damn', 'Damn you, you ruined everything!'],
  ['hell', 'What the hell happened here?'],
  ['system', 'To hell with the system!'],
  ['commit', 'Hitler decided to commit suicide.'],
  ['attempt', 'Tom may attempt suicide.'],
  ['unfortunately', 'Unfortunately, Tom committed suicide.'],
  ['suicide', 'We found his suicide note.'],
  ['human', 'I killed the human being.'],
  ['kill', "I wanted to kill 'em."],
  ['kill', 'I can kill him.'],
  ['murder', 'The murder was premeditated.'],
  ['subsequently', 'Sami was subsequently murdered.'],
  ['terrorist', 'Ziri is a terrorist.'],
  ['terrorist', 'Russia is a terrorist state.'],
  ['emerge', 'Terrorists can emerge anywhere.'],
  ['drug', 'I am a drug addict.'],
  ['dependent', 'He is dependent on drugs.'],
  ['super', 'Tom, you are super drunk!'],
  ['slight', 'Drunkenness is a slight madness.'],
  ['cigarette', 'Do you want a cigarette?'],
];

/**
 * 这些必须放行。闸门宁严勿宽，但不能把学科内容一起拦了 ——
 * `asexual` 不含 `\bsexual\b` 的词边界、`skill` 不含 `\bkill`、
 * `analysis` 里的 anal 根本不在表里、`jumped the gun` 是习语。
 */
const MUST_PASS: ReadonlyArray<readonly [string, string]> = [
  ['生物', 'Reproduction is asexual when there is no fusion of gametes.'],
  ['化学', 'The Collins reagent is used to oxidize primary alcohols into aldehydes.'],
  ['医学', 'Screening programmes catch conditions such as diabetes and high blood pressure.'],
  ['医学', 'The word "capillary" refers to very small blood vessels.'],
  ['药学', "Don't doubt the effectiveness of this drug."],
  ['药学', 'He noticed that this drug seemed to inhibit bacterial growth.'],
  ['健康教育', 'Smoking will ruin your health.'],
  ['习语', 'The competitor twice jumped the gun.'],
  ['习语', 'My hip is killing me.'],
  ['习语', 'My mood is shot.'],
  ['骰子', 'You roll the die twice.'],
  ['林业', 'Dead branches, needles and leaf litter accumulate each year that no fire comes.'],
  ['生态', 'Grey wolves had been eliminated from Yellowstone National Park by the 1920s.'],
  ['日常', 'The cigarette was still burning.'],
  // 被动语态的「喝」，不是醉酒 —— 光秃秃的 `\bdrunk\b` 会把这条正经
  // 阅读材料一起拦掉，所以闸门只拦 get/got/super drunk 那一类。
  ['被动语态', 'Tea is drunk more widely than any manufactured beverage on earth.'],
  // 「hit that / tap that」只在句尾才是俚语
  ['体育', 'Can you hit that ball over the fence?'],
  ['日常', 'Peel the apple before you eat it.'],
  ['日常', 'She asked her peers for advice.'],
];

describe('校园内容闸门·句子级', () => {
  it.each(REAL_UNSAFE_SENTENCES)('%s：生产库里的真实脏例句要被拦下 —— %s', (_headword, sentence) => {
    expect(schoolUnsafeReason(sentence)).not.toBeNull();
  });

  it.each(MUST_PASS)('%s：学科正当用法要放行 —— %s', (_label, sentence) => {
    expect(schoolUnsafeReason(sentence)).toBeNull();
  });

  it('英文干净、中文露骨的也要拦（Tatoeba 的中译是另一批人贡献的）', () => {
    // 这就是 oral 那条的真实样子：两边都脏，但只要有一边脏就该整条不要。
    expect(isSchoolUnsafeContext({ sentence: 'What is oral sex?', translation: '什麼是口交？' })).toBe(true);
    expect(isSchoolUnsafeContext({ sentence: 'He made a decision.', translation: '他决定自杀。' })).toBe(true);
    expect(isSchoolUnsafeContext({ sentence: 'He made a decision.', translation: '他做了个决定。' })).toBe(false);
  });

  it('搭配词：脏词组剔掉，顺序和干净的原样保留', () => {
    // oral 的真实搭配：["is oral", "oral sex", "has oral", "oral thrush"]
    expect(keepSchoolSafeTexts(['is oral', 'oral sex', 'has oral', 'oral thrush']))
      .toEqual(['is oral', 'has oral', 'oral thrush']);
    // yourself 的真实搭配里躺着 kill yourself —— 这是最该拦的一条
    expect(keepSchoolSafeTexts(['cut yourself', 'kill yourself', 'help yourself']))
      .toEqual(['cut yourself', 'help yourself']);
    expect(keepSchoolSafeTexts(['figure adolescents', 'adolescents masturbate']))
      .toEqual(['figure adolescents']);
    // agent 审出来的搭配
    expect(keepSchoolSafeTexts(['tap that', 'that is', 'well endowed', 'go poop', 'will go']))
      .toEqual(['that is', 'will go']);
  });

  it('搭配词里的误伤守住了：skill / analysis / hello / shell casing 都不是脏话', () => {
    expect(keepSchoolSafeTexts([
      'your skill', 'skill impresses', 'numerical analysis', 'qualitative analysis',
      'an analyst', 'that analogy', 'say hello', 'hello you', 'shell casing',
      'irrigation canal', 'leadership skills', 'prescribed painkillers', 'two shots',
    ])).toHaveLength(13);
  });

  it('空值不炸', () => {
    expect(isSchoolUnsafeText(null)).toBe(false);
    expect(isSchoolUnsafeText(undefined)).toBe(false);
    expect(isSchoolUnsafeText('')).toBe(false);
    expect(keepSchoolSafeTexts(null)).toEqual([]);
    expect(keepSchoolSafeTexts(undefined)).toEqual([]);
  });
});

/**
 * 真正的事故成因不是「没有名单」，是**兜底逻辑会把拦下的句子捞回来**：
 * `contextForEncounter` 原来写的是「干净的挑不出来就退回用全部」，而
 * 一个词只有一条例句、那条正好是脏的时候，干净的就是挑不出来。
 */
describe('推送前硬过滤：兜底逻辑不得把脏句子捞回来', () => {
  const row = (over: Partial<ContextCandidate>): ContextCandidate => ({
    id: 'c1', kind: 'short_same_meaning', position: 1,
    sentence: 'He gave an oral report.', translation: '他做了口头汇报。',
    difficulty: 2, qualityStatus: 'ready', ...over,
  });

  it('唯一一条例句被标成 blocked_school：返回 null，不退回用它', () => {
    const only = [row({ sentence: 'What is oral sex?', translation: '什麼是口交？', qualityStatus: SCHOOL_BLOCKED_QUALITY_STATUS })];
    expect(contextForEncounter(only, 1, 5, 'oral')).toBeNull();
  });

  it('漏标的历史脏数据（状态还是 ready）照样拦下', () => {
    const stale = [row({ sentence: 'What is oral sex?', translation: '什麼是口交？', qualityStatus: 'ready' })];
    expect(contextForEncounter(stale, 1, 5, 'oral')).toBeNull();
  });

  it('脏的旁边有干净的：给干净那条', () => {
    const mixed = [
      row({ id: 'dirty', sentence: 'What is oral sex?', qualityStatus: SCHOOL_BLOCKED_QUALITY_STATUS }),
      row({ id: 'clean', sentence: 'She passed her oral exam.', translation: '她通过了口试。', position: 2 }),
    ];
    expect(contextForEncounter(mixed, 1, 5, 'oral')?.id).toBe('clean');
  });

  it('难度兜底也不能把脏的捞回来（脏的难度更低时尤其危险）', () => {
    const mixed = [
      row({ id: 'dirty', sentence: 'Tom may attempt suicide.', difficulty: 1, qualityStatus: 'ready' }),
      row({ id: 'clean', sentence: 'They will attempt the climb tomorrow.', translation: '他们明天尝试攀登。', difficulty: 5, position: 2 }),
    ];
    // 上限 1 时只有脏的「够得着」，但它必须先被剔掉
    expect(contextForEncounter(mixed, 1, 1, 'attempt')?.id).toBe('clean');
  });

  it('老师写的阅读文章原句不走文字闸门（鸦片战争那篇不能被关键词误杀）', () => {
    const article = [row({
      id: 'article', kind: 'article_original',
      sentence: 'The eventual response was to sell opium grown in India into China, a trade that led to two wars.',
      translation: '最终的对策是把印度种植的鸦片卖到中国，这笔贸易引发了两场战争。',
    })];
    expect(contextForEncounter(article, 1, 5, 'opium')?.id).toBe('article');
  });

  it('但 Tatoeba 生成的同名副本照拦，而且人工标死的连文章也不给', () => {
    const corpus = [row({ id: 'corpus', kind: 'short_same_meaning', sentence: 'Yanni was addicted to crack.' })];
    expect(contextForEncounter(corpus, 1, 5, 'crack')).toBeNull();
    const pulled = [row({ id: 'a', kind: 'article_original', qualityStatus: SCHOOL_BLOCKED_QUALITY_STATUS })];
    expect(contextForEncounter(pulled, 1, 5, 'opium')).toBeNull();
  });

  it('全部干净时行为不变（别把原来的挑句规则改坏了）', () => {
    const clean = [
      row({ id: 'a', kind: 'short_same_meaning', position: 1 }),
      row({ id: 'b', kind: 'alternate_topic', position: 2 }),
    ];
    expect(contextForEncounter(clean, 1, 5, 'oral')?.id).toBe('a');
    expect(contextForEncounter(clean, 3, 5, 'oral')).not.toBeNull();
  });
});
