import { describe, expect, it } from 'vitest';
import { contextFor, extractQuotedWord, firstSentenceWith, isCompletionTask, isWorthLearning, lemmaCandidates } from './student-word.service';

/**
 * 自动采集的抽词逻辑回归测试。
 *
 * 用例全部取自 2026-07-29 ~ 07-31 真实早测题干 —— 这几周判分时学生
 * 答错的正是这些词义题（coax / crumpled / slick / frail / sparse）。
 */
describe('extractQuotedWord — 从词义题题干里抽目标词', () => {
  it('抓 O-Level §B 词义题的单引号目标词', () => {
    expect(
      extractQuotedWord(
        "Q3. What does the word 'coax' in 'coax a station out of the static' (Paragraph 1) suggest about how the grandfather tuned the radio? [1]",
      ),
    ).toBe('coax');
  });

  it('弯引号同样识别（学生端与 PDF 常见）', () => {
    expect(extractQuotedWord('What does ‘crumpled’ suggest about the note?')).toBe('crumpled');
  });

  it('取第一个单词而不是被引用的整句', () => {
    // 'slick' 是目标词；后面那段是引用原句，不能被当成目标词
    const stem =
      "Q4. What does the word 'slick' in 'His skin was slick with rain' (Paragraph 5) suggest?";
    expect(extractQuotedWord(stem)).toBe('slick');
  });

  it('没有引号目标词时返回 null（不瞎猜）', () => {
    expect(extractQuotedWord('Q1. From Paragraph 2, how did Gu Po travel to the flat? [1]')).toBeNull();
    expect(extractQuotedWord('')).toBeNull();
  });

  it('不把多词短语当成目标词', () => {
    // 引号里是短语，正则要求 [A-Za-z'’-]+ 单词，空格不匹配 → 跳过
    expect(extractQuotedWord("the phrase 'picked their way' means")).toBeNull();
  });
});

describe('contextFor — 卡片上下文必须来自原文，不能是题干', () => {
  const stem =
    "Q3. What does the word 'frail' in 'frail now, her back curved like a question mark' (Paragraph 2) suggest about Gu Po? [1]";
  const passage =
    'Paragraph 2\nGu Po came late, as she always did. She was my grandmother’s younger sister, frail now, her back curved like a question mark, and she held the doorframe for a moment.';

  it('优先返回文章原文里含该词的句子', () => {
    const out = contextFor(passage, stem, 'frail');
    expect(out).toContain('frail now, her back curved');
    // 关键：绝不能把题干当上下文，否则挖空挖的是题目里的引用词
    expect(out).not.toContain('What does the word');
  });

  it('没有原文时退回题干里的引文摘录，而不是整句题干', () => {
    const out = contextFor('', stem, 'frail');
    expect(out).toBe('frail now, her back curved like a question mark');
    expect(out).not.toContain('Q3.');
  });

  it('原文里没有该词时不硬套原文开头', () => {
    const out = contextFor('A totally unrelated passage about drains.', stem, 'frail');
    expect(out.toLowerCase()).toContain('frail');
  });

  it('原文与题干都没有时也返回非空', () => {
    expect(contextFor('', 'no quotes here', 'zzz').length).toBeGreaterThan(0);
  });

  // 以下三条来自真实数据实测发现的切分缺陷
  it('不把「Paragraph N」段落标记带进上下文', () => {
    const p = 'Paragraph 4\nThen the water surged. A wall of churning brown water came sweeping down.';
    expect(contextFor(p, '', 'surged')).toBe('Then the water surged.');
  });

  it('句末是「句号+引号」时也能正确断句，不跨句粘连', () => {
    const p =
      "'This one your grandmother liked.'\n\nParagraph 3\nAs I grew older the radio became background, then nuisance.";
    const out = contextFor(p, '', 'nuisance');
    expect(out).toBe('As I grew older the radio became background, then nuisance.');
    expect(out).not.toContain('grandmother');
    expect(out).not.toContain('Paragraph');
  });

  it('段首句也能干净取出（不带段落标记前缀）', () => {
    const p = "Paragraph 1\nAh Seng's provision shop sat wedged between the coffee shop and the lift.";
    expect(contextFor(p, '', 'wedged')).toBe(
      "Ah Seng's provision shop sat wedged between the coffee shop and the lift.",
    );
  });
});

describe('firstSentenceWith — 取含该词的原句作为卡片上下文', () => {
  it('返回包含目标词的那一句', () => {
    const stem =
      "Read the narrative. Section B. Q3. What does the word 'coax' suggest? It is worth 1 mark.";
    expect(firstSentenceWith(stem, 'coax')).toContain('coax');
  });

  it('大小写不敏感', () => {
    expect(firstSentenceWith('The Radio sat there. Coax was used.', 'coax')).toBe('Coax was used.');
  });

  it('找不到时退回题干开头，不返回空', () => {
    const out = firstSentenceWith('No target here at all.', 'zzz');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('isCompletionTask — 哪些题型的参考答案本身就是个词', () => {
  it('识别各类填空题', () => {
    for (const t of ['sentence_completion','flow_chart_completion','summary_completion','note_completion','table_completion','diagram_label_completion']) {
      expect(isCompletionTask(t)).toBe(true);
    }
  });
  it('不把非填空题当填空', () => {
    for (const t of ['matching_information','true_false_not_given','multi_match','short_answer','matching_headings']) {
      expect(isCompletionTask(t)).toBe(false);
    }
    expect(isCompletionTask(undefined)).toBe(false);
  });
});

describe('isWorthLearning — 填空答案要不要进生词本', () => {
  // 以下取值全部来自生产词典里这些词的真实字段（2026-07-31 实测）
  it('收进阶词：sediment / skeleton / axis / slot / interference', () => {
    expect(isWorthLearning({ tag: ['toefl','ielts','gre'], oxford: false, bnc: 5512 })).toBe(true);   // sediment
    expect(isWorthLearning({ tag: ['cet6','ky','toefl','ielts','gre'], oxford: false, bnc: 5954 })).toBe(true); // skeleton
    expect(isWorthLearning({ tag: ['cet4','cet6','ky','toefl','ielts','gre'], oxford: false, bnc: 5787 })).toBe(true); // axis
    expect(isWorthLearning({ tag: ['cet6','ky','ielts','gre'], oxford: false, bnc: 5604 })).toBe(true); // slot
  });
  it('不收学生本就认识的核心高频词：hole / mirror / twice', () => {
    // hole 带 cet6 标签，但它是牛津核心词且 bnc=1329 —— 答错是读错段落，不是不认识
    expect(isWorthLearning({ tag: ['zk','gk','cet4','cet6','ky'], oxford: true, bnc: 1329 })).toBe(false);
    expect(isWorthLearning({ tag: ['zk','gk','cet4','cet6','ky'], oxford: true, bnc: 2086 })).toBe(false);
    expect(isWorthLearning({ tag: ['zk','gk'], oxford: true, bnc: 1501 })).toBe(false);
  });
  it('无进阶考纲标签的一律不收', () => {
    expect(isWorthLearning({ tag: [], oxford: false, bnc: 8367 })).toBe(false);      // carbonate
    expect(isWorthLearning({ tag: ['zk','gk'], oxford: false, bnc: 9999 })).toBe(false);
  });
  it('缺字段时不报错且从严', () => {
    expect(isWorthLearning({})).toBe(false);
    expect(isWorthLearning({ tag: ['ielts'], oxford: null, bnc: null })).toBe(true);
  });
});

/**
 * 2026-08-11 线上数据复盘补的回归用例。
 *
 * 上线两周后查生词本，发现全班覆盖最广的词之一是 "lakes"（8 名学生），
 * 而 "minutes" 的词卡释义是「会议记录」—— 原文里是「几分钟」。
 * 根因：ECDICT 只在原形上带 oxford / bnc，屈折形式两个字段都是空的，
 * isWorthLearning 三条规则一条也拦不住，于是基础词的复数畅通无阻。
 */
describe('lemmaCandidates — 屈折形式回退原形', () => {
  it('复数', () => {
    expect(lemmaCandidates('lakes')).toContain('lake');
    expect(lemmaCandidates('minutes')).toContain('minute');
    expect(lemmaCandidates('cables')).toContain('cable');
  });

  it('过去式，含重复辅音与 -e 结尾', () => {
    expect(lemmaCandidates('surged')).toContain('surge');
    expect(lemmaCandidates('dwindled')).toContain('dwindle');
    expect(lemmaCandidates('stopped')).toContain('stop');
  });

  it('-ing 形式', () => {
    expect(lemmaCandidates('wobbling')).toContain('wobble');
    expect(lemmaCandidates('running')).toContain('run');
  });

  it('-ies → -y', () => {
    expect(lemmaCandidates('bodies')).toContain('body');
  });

  it('不给出与自身相同的形式', () => {
    expect(lemmaCandidates('axis')).not.toContain('axis');
  });
});

describe('isWorthLearning — 屈折形式要看原形', () => {
  it('lakes 自身无词频信号，但原形 lake 是牛津核心词 → 拒', () => {
    const lakes = { tag: ['ielts', 'gre'], oxford: false, bnc: null };
    expect(isWorthLearning(lakes)).toBe(true);                                  // 修复前的行为
    expect(isWorthLearning(lakes, { oxford: true, bnc: 1200 })).toBe(false);    // 修复后
  });

  it('minutes 同理：原形 minute 高频 → 拒', () => {
    const minutes = { tag: ['ielts', 'gre'], oxford: false, bnc: null };
    expect(isWorthLearning(minutes, { oxford: false, bnc: 800 })).toBe(false);
  });

  it('原形本身也是进阶词时照收（wobbling → wobble）', () => {
    const wobbling = { tag: ['toefl'], oxford: false, bnc: null };
    expect(isWorthLearning(wobbling, { oxford: false, bnc: 38793 })).toBe(true);
  });

  it('本身就带词频信号的词不走回退，行为不变', () => {
    // interference: bnc 4513，原形回退不该把它拒掉
    expect(isWorthLearning({ tag: ['ielts'], oxford: false, bnc: 4513 }, { oxford: true, bnc: 1 })).toBe(true);
  });

  it('查不到原形时退回原来的判断', () => {
    expect(isWorthLearning({ tag: ['ielts'], oxford: false, bnc: null }, null)).toBe(true);
  });
});

describe('extractQuotedWord — 叙事引语不是词汇考点', () => {
  it('《The Uniform》Q6 的 \u0027good\u0027 不该被当成生词', () => {
    const stem =
      "Q6. Using your own words, explain why the narrator 'said nothing' when his mother called the cloth 'good' (Paragraph 2). [2]";
    expect(extractQuotedWord(stem)).toBeNull();
  });

  it('“效果题”里的引语同样不收', () => {
    const stem =
      "Q9. What is the effect of the narrator's realisation that there 'had been nothing' to cover? [2]";
    expect(extractQuotedWord(stem)).toBeNull();
  });

  it('真正的词义题仍然照抽', () => {
    expect(
      extractQuotedWord("Q4. What does the word 'shadow' in 'There was a shadow on the left pocket' suggest?"),
    ).toBe('shadow');
    expect(extractQuotedWord('What does ‘crumpled’ suggest about the note?')).toBe('crumpled');
  });
});
