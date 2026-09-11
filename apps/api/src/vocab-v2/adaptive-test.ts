import { clozeSentence, questionTypeForStage } from './question-builder';
import { choiceIsCorrect, distinctDistractors, meaningsOverlap, type FrozenCard, type FormalQuestion } from './formal-test';

/**
 * 自助练习题目快照。
 *
 * VOC04（2026-09-11）：拼写 / 听写题都不再把目标词放进 cue。听写题只写
 * `audio: 'item'` —— 客户端凭 sessionId + itemId 找服务端要这道题的音频
 *（`GET /vocab-v2/test/audio`），拿不到能解码出单词的链接或文本。
 * `audioText` 仅为兼容改之前的旧快照而保留在类型里，下发一律走白名单。
 */
export type AdaptiveQuestion =
  | FormalQuestion
  | { type: 'word_choice'; prompt: string; cue: { pos: string; translation: string }; options: string[]; answer: number }
  | { type: 'cloze'; prompt: string; cue: { sentence: string; translation: string }; options: []; answer: string }
  | { type: 'listening_spelling'; prompt: string; cue: { pos: string; audio?: 'item'; audioText?: string }; options: []; answer: string }
  | { type: 'active_use'; prompt: string; cue: { headword: string; translation: string }; options: []; answer: string }
  | { type: 'collocation'; prompt: string; cue: { headword: string }; options: string[]; answer: number }
  | { type: 'word_family'; prompt: string; cue: { headword: string; pos: string }; options: []; answer: string[] };

export interface AdaptiveCard extends FrozenCard {
  masteryStage: number;
  list?: string;
  rank?: number;
  sentenceTranslation?: string | null;
  collocations?: string[];
  wordFamily?: string[];
  /** 服务端有这个词的录音（WordAudio）。没有就不出听写题。 */
  audioAvailable?: boolean;
}

function stable(values: string[], seed: string) {
  return [...values].sort((a, b) => {
    const score = (value: string) => [...`${seed}:${value}`].reduce((sum, char) => (sum * 33 + char.charCodeAt(0)) >>> 0, 5381);
    return score(a) - score(b) || a.localeCompare(b);
  });
}

function spelling(card: AdaptiveCard): AdaptiveQuestion {
  return { type: 'spelling', prompt: '根据中文和词性写出英文单词。', cue: { pos: card.pos, translation: card.translation }, options: [], answer: card.headword };
}

const lowerHeadword = (card: { headword: string }) => String(card.headword ?? '').trim().toLowerCase();

/** Custom practice chooses a task from demonstrated mastery and available, frozen content. */
export function buildAdaptiveQuestion(card: AdaptiveCard, index: number, cards: readonly AdaptiveCard[]): AdaptiveQuestion {
  const samePos = cards.filter((item) => {
    if (lowerHeadword(item) === lowerHeadword(card) || item.pos !== card.pos) return false;
    if (item.list && card.list && item.list !== card.list) return false;
    if (item.rank && card.rank && Math.abs(item.rank - card.rank) > 500) return false;
    return Math.abs(item.masteryStage - card.masteryStage) <= 2;
  });
  // VOC03：干扰项按学生看到的中文去重，并排除与正确释义撞车的（big / large 都是「大的」）。
  const fair = distinctDistractors(card.translation, samePos, (item) => item.translation);
  const type = questionTypeForStage(card.masteryStage, {
    hasContext: Boolean(card.sentence),
    hasAudio: Boolean(card.audioAvailable),
    hasCollocations: Boolean(card.collocations?.length),
    hasWordFamily: Boolean(card.wordFamily?.length),
    reasonableDistractorCount: fair.length,
  }, index + 1);

  if (type === 'meaning_choice' && fair.length >= 3) {
    const correct = card.translation.trim();
    const options = stable([correct, ...fair.slice(0, 3).map((item) => item.translation.trim())], `${card.headword}:meaning`);
    return { type, prompt: card.headword, cue: null, options, answer: options.indexOf(correct) };
  }
  if (type === 'word_choice' && fair.length >= 3) {
    // 选英文单词：意思相同的词不能同时出现，否则两个都对。fair 已排除释义撞车的。
    const words = fair.slice(0, 3).map((item) => item.headword.trim());
    const options = stable([card.headword.trim(), ...words], `${card.headword}:word`);
    return { type, prompt: '选择符合这个词义的英文单词。', cue: { pos: card.pos, translation: card.translation }, options, answer: options.indexOf(card.headword.trim()) };
  }
  if (type === 'cloze' && card.sentence) {
    const sentence = clozeSentence(card.sentence, card.headword, card.headword);
    if (sentence) return { type, prompt: '补全短句。', cue: { sentence, translation: card.sentenceTranslation ?? '' }, options: [], answer: card.headword };
  }
  if (type === 'listening_spelling' && card.audioAvailable) {
    return { type, prompt: '听发音，写出单词。', cue: { pos: card.pos, audio: 'item' }, options: [], answer: card.headword };
  }
  if (type === 'collocation' && card.collocations?.length && samePos.flatMap((item) => item.collocations ?? []).length >= 3) {
    const correct = card.collocations[0];
    const seen = new Set([correct.trim().toLowerCase()]);
    const distractors: string[] = [];
    for (const phrase of samePos.flatMap((item) => item.collocations ?? [])) {
      const key = phrase.trim().toLowerCase();
      if (!key || seen.has(key) || key.split(/\s+/).includes(lowerHeadword(card))) continue;
      seen.add(key);
      distractors.push(phrase);
      if (distractors.length === 3) break;
    }
    if (distractors.length === 3) {
      const options = stable([correct, ...distractors], `${card.headword}:collocation`);
      return { type, prompt: '选择最自然的常见搭配。', cue: { headword: card.headword }, options, answer: options.indexOf(correct) };
    }
  }
  if (type === 'active_use') return { type, prompt: '用目标词写一个完整英文句子。', cue: { headword: card.headword, translation: card.translation }, options: [], answer: card.headword };
  if (type === 'word_family' && card.wordFamily?.length) return { type, prompt: '写出这个词族中的另一个词。', cue: { headword: card.headword, pos: card.pos }, options: [], answer: card.wordFamily };
  return spelling(card);
}

// ─────────────────────────────────────────────────────────────
// VOC11：造句题只能确定「用到了目标词」，判不了句子好坏
// ─────────────────────────────────────────────────────────────

/** 常见不规则动词（原形 → 过去式 / 过去分词 / 其他变形）。只用来识别词形，不做语法判断。 */
const IRREGULAR_FORMS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
  begin: ['began', 'begun'], bring: ['brought'], build: ['built'], buy: ['bought'], catch: ['caught'],
  choose: ['chose', 'chosen'], come: ['came'], draw: ['drew', 'drawn'], drink: ['drank', 'drunk'],
  drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feel: ['felt'], fight: ['fought'],
  find: ['found'], fly: ['flew', 'flown', 'flies'], forget: ['forgot', 'forgotten'], get: ['got', 'gotten'],
  give: ['gave', 'given'], grow: ['grew', 'grown'], hear: ['heard'], hide: ['hid', 'hidden'], hold: ['held'],
  keep: ['kept'], know: ['knew', 'known'], lead: ['led'], leave: ['left'], lend: ['lent'], lie: ['lay', 'lain', 'lying'],
  lose: ['lost'], make: ['made'], mean: ['meant'], meet: ['met'], pay: ['paid'], ride: ['rode', 'ridden'],
  ring: ['rang', 'rung'], rise: ['rose', 'risen'], run: ['ran'], say: ['said'], see: ['saw', 'seen'], sell: ['sold'],
  send: ['sent'], shake: ['shook', 'shaken'], shine: ['shone'], shoot: ['shot'], sing: ['sang', 'sung'], sit: ['sat'],
  sleep: ['slept'], speak: ['spoke', 'spoken'], spend: ['spent'], stand: ['stood'], steal: ['stole', 'stolen'],
  strike: ['struck'], swim: ['swam', 'swum'], take: ['took', 'taken'], teach: ['taught'], tear: ['tore', 'torn'],
  tell: ['told'], think: ['thought'], throw: ['threw', 'thrown'], understand: ['understood'], wake: ['woke', 'woken'],
  wear: ['wore', 'worn'], win: ['won'], write: ['wrote', 'written'], seek: ['sought'], bear: ['bore', 'borne'],
  bind: ['bound'], bite: ['bit', 'bitten'], blow: ['blew', 'blown'], break: ['broke', 'broken'], deal: ['dealt'],
  dig: ['dug'], feed: ['fed'], flee: ['fled'], forbid: ['forbade', 'forbidden'], freeze: ['froze', 'frozen'],
  hang: ['hung'], light: ['lit'], slide: ['slid'], spin: ['spun'], stick: ['stuck'], sting: ['stung'], swing: ['swung'],
  weave: ['wove', 'woven'], weep: ['wept'], wind: ['wound'], child: ['children'], person: ['people'], man: ['men'],
  woman: ['women'], foot: ['feet'], tooth: ['teeth'], mouse: ['mice'], good: ['better', 'best'], bad: ['worse', 'worst'],
};

/** 目标词的可接受词形（规则变化 + 常见不规则）。 */
export function targetWordForms(headword: string): Set<string> {
  const base = String(headword ?? '').trim().toLowerCase();
  const forms = new Set<string>(base ? [base, `${base}s`, `${base}es`, `${base}ed`, `${base}ing`] : []);
  if (!base) return forms;
  if (base.endsWith('e')) {
    forms.add(`${base}d`);
    forms.add(`${base.slice(0, -1)}ing`);
  }
  if (/[^aeiou]y$/.test(base)) {
    forms.add(`${base.slice(0, -1)}ies`);
    forms.add(`${base.slice(0, -1)}ied`);
  }
  // 重读闭音节双写：stop → stopped / stopping
  if (/^[a-z]*[^aeiou][aeiou][bdgklmnprt]$/.test(base) && base.length <= 6) {
    forms.add(`${base}${base.slice(-1)}ed`);
    forms.add(`${base}${base.slice(-1)}ing`);
  }
  if (/(s|x|z|ch|sh)$/.test(base)) forms.add(`${base}es`);
  for (const extra of IRREGULAR_FORMS[base] ?? []) forms.add(extra);
  return forms;
}

export type ActiveUseCheck = {
  /** 服务端能确定的只有这一件事：目标词（某个词形）作为一个完整单词出现了 */
  targetDetected: boolean;
  /** 句子质量（语法、语义）一律没评估 —— 如实告诉学生 */
  sentenceQuality: 'not_evaluated';
  reason: 'ok' | 'too_short' | 'target_missing' | 'only_target_repeated' | 'not_words';
};

/**
 * 造句题的确定性检查。只回答「是不是像样地用到了目标词」，**不**声称句子正确：
 *   · 只算完整单词（`apple` 不能靠 `pineapple` 过关）；
 *   · 不规则变化也认（go → went）；
 *   · 至少 3 个单词，且除了目标词以外至少还有 2 个不同的词
 *     （`apple apple apple` 不过关）。
 */
export function checkActiveUse(headword: string, response: unknown): ActiveUseCheck {
  const text = String(response ?? '').toLowerCase().replace(/[’‘`]/g, "'");
  const tokens = text.match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  if (!tokens.length) return { targetDetected: false, sentenceQuality: 'not_evaluated', reason: 'not_words' };
  const forms = targetWordForms(headword);
  const hits = tokens.filter((token) => forms.has(token));
  if (!hits.length) return { targetDetected: false, sentenceQuality: 'not_evaluated', reason: 'target_missing' };
  if (tokens.length < 3) return { targetDetected: false, sentenceQuality: 'not_evaluated', reason: 'too_short' };
  const others = new Set(tokens.filter((token) => !forms.has(token)));
  if (others.size < 2) return { targetDetected: false, sentenceQuality: 'not_evaluated', reason: 'only_target_repeated' };
  return { targetDetected: true, sentenceQuality: 'not_evaluated', reason: 'ok' };
}

export function answerAdaptiveQuestion(question: AdaptiveQuestion, response: unknown): boolean {
  if (question.type === 'meaning_choice' || question.type === 'word_choice' || question.type === 'collocation') {
    return choiceIsCorrect(question.options, question.answer, response);
  }
  const text = String(response ?? '').trim().toLowerCase();
  if (question.type === 'word_family') return question.answer.some((answer) => answer.toLowerCase() === text);
  if (question.type === 'active_use') return checkActiveUse(question.answer, response).targetDetected;
  return text.replace(/[’‘`]/g, "'").replace(/\s+/g, ' ') === String((question as { answer: string }).answer).trim().toLowerCase();
}

/**
 * 进行中下发的题面白名单（VOC04）。按题型逐字段挑，不是「删 answer 其余照发」：
 * 拼写只给词性 + 中文；听写只给词性 + `audio: 'item'`（旧快照里的 audioText 丢掉）。
 */
export function publicAdaptiveQuestion(question: AdaptiveQuestion) {
  switch (question.type) {
    case 'meaning_choice':
      return { type: question.type, prompt: question.prompt, cue: null, options: [...question.options] };
    case 'spelling':
      return { type: question.type, prompt: question.prompt, cue: { pos: question.cue?.pos ?? '', translation: question.cue?.translation ?? '' }, options: [] as [] };
    case 'word_choice':
      return { type: question.type, prompt: question.prompt, cue: { pos: question.cue.pos, translation: question.cue.translation }, options: [...question.options] };
    case 'cloze':
      return { type: question.type, prompt: question.prompt, cue: { sentence: question.cue.sentence, translation: question.cue.translation }, options: [] as [] };
    case 'listening_spelling':
      return { type: question.type, prompt: question.prompt, cue: { pos: question.cue?.pos ?? '', audio: 'item' as const }, options: [] as [] };
    case 'active_use':
      return {
        type: question.type,
        prompt: question.prompt,
        cue: { headword: question.cue.headword, translation: question.cue.translation },
        options: [] as [],
        // VOC11：先告诉学生这题怎么判，别让他以为会检查语法
        grading: 'target_word_only' as const,
      };
    case 'collocation':
      return { type: question.type, prompt: question.prompt, cue: { headword: question.cue.headword }, options: [...question.options] };
    case 'word_family':
      return { type: question.type, prompt: question.prompt, cue: { headword: question.cue.headword, pos: question.cue.pos }, options: [] as [] };
    default:
      return { type: (question as { type: string }).type, prompt: (question as { prompt: string }).prompt, cue: null, options: [] as [] };
  }
}

/** 兼容旧名：等同于 `publicAdaptiveQuestion`。 */
export function hideAdaptiveAnswer(question: AdaptiveQuestion) {
  return publicAdaptiveQuestion(question);
}

export { meaningsOverlap };
