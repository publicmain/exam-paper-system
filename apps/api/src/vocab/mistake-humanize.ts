/**
 * 把「给老师判分用的东西」翻译成「学生看得懂的东西」。
 *
 * 2026-08-13 老师看真机后的判断：错题本上那一大串正确答案学生根本
 * 不会细看。查了实际数据，他说得对 —— 存进去的是 mark scheme 原文：
 *
 *   MP1 (goodwill/trust): he trusted his neighbours…; MP2 (practical
 *   timing): …。Award one mark per distinct point.
 *
 *   CONTENT POINTS (award ~1 each; 7 distinct ideas spread over
 *   paragraphs 2-7): ① raising retirement… STYLE / OWN-WORDS (the 8th
 *   mark; mirrors the SEAB 7-mark summary band): reward sustained own
 *   words…; penalise lifting / note form…
 *
 * 这是**判分指令**，不是答案。"Award one mark per distinct point"、
 * "the 8th mark"、"mirrors the SEAB band" 对学生零价值，而且正是这些
 * 噪音把真正的答案要点埋掉了。
 *
 * 题干同理：IELTS 每道题都拖着一整段答题须知（"In boxes 5–8 on your
 * answer sheet, write TRUE if the statement agrees…"），真正问的那句
 * 在最后。学生扫一眼看到的全是须知。
 *
 * 清洗只在**读取时**做，数据库里保留原文 —— 老师复核判分依据时仍要
 * 看完整 mark scheme，而且清洗规则以后还会调，不能把原始数据洗没了。
 */

/** IELTS/O-Level 题干里的答题须知前缀。命中则丢弃，只留真正的问题。 */
const RUBRIC_PATTERNS: RegExp[] = [
  /^Do the following statements agree[\s\S]*?on this\.?\s*/i,
  /^Reading Passage \d+ has \w+ paragraphs[\s\S]*?answer sheet\.?\s*/i,
  /^Complete the (sentences|summary|notes|flow-chart|table)[\s\S]*?answer sheet\.?\s*/i,
  /^Choose (the correct letter|NO MORE THAN)[\s\S]*?answer sheet\.?\s*/i,
  /^Read the (narrative|non-narrative) text below[\s\S]*?(?=Q\d+\.)/i,
  /^Refer to the same[\s\S]*?(?=Q\d+)/i,
];

/**
 * 从题干里取出真正在问的那句话。
 * 先剥答题须知，再取最后一个「Qn.」之后的内容。
 */
export function cleanStem(stem: string): string {
  let s = (stem ?? '').trim();
  for (const re of RUBRIC_PATTERNS) s = s.replace(re, '').trim();
  // 「Q4. …」形式：取最后一个题号之后（题干里可能带 section 说明再带题）
  const qs = s.split(/(?:^|\s)Q\d+(?:\([ivx]+\))?\.\s+/);
  if (qs.length > 1) {
    // 命中题号 = 已经精确切到这一道，整块保留，不再往下切。
    // summary 题的最后一段是开头提示 "Begin your summary: 'Singapore
    // is responding…'"，真正的任务("用自己的话概括第2-7段")在它前面 ——
    // 再取一次"最后一段"就只剩提示语，学生看不懂在考什么。
    s = qs[qs.length - 1].trim();
  } else if (s.includes('\n\n')) {
    // 没有题号时才用位置兜底：须知在前、问题在后是这批卷子的固定结构
    const parts = s.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) s = parts[parts.length - 1];
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 判断题的答案在题库里存的是选项字母（考试界面硬编码 A/B/C 三个键，
 * 见 IELTSReadingPassage.tsx），而学生的作答存的是键上的**文字**
 * （TRUE / FALSE / NOT GIVEN）。错题本上线首日实测：学生看到
 * 「我写了 FALSE，正确答案 C」—— 160 条（全库 31%）全是这样。
 * 读取时必须把字母翻译回学生看得懂的词。
 */
const LETTER_LABELS: Record<string, Record<string, string>> = {
  true_false_not_given: { A: 'TRUE', B: 'FALSE', C: 'NOT GIVEN' },
  yes_no_not_given: { A: 'YES', B: 'NO', C: 'NOT GIVEN' },
};

/** 把客观题答案从选项字母翻译成学生作答时看到的词。非判断题原样返回。 */
export function translateAnswerLetter(taskType: string, answer: string): string {
  const map = LETTER_LABELS[taskType];
  const key = (answer ?? '').trim().toUpperCase();
  return map?.[key] ?? answer;
}

/**
 * 客观题判分时留下的流水评语（"段3:B,正解 F。0。同上。"）是判分记录
 * 不是教学内容 —— 「同上」在错题本的孤立卡片里是指向虚空的引用，
 * "正解 F"和卡片上的参考答案重复。整条都是噪音时不展示。
 * 判断标准：去掉 题号/学生答案/正解X/得分/同上 这些记账 token 后，
 * 剩余的实质内容不足 6 个字 → 认定为纯流水，隐藏。
 * 长答题（≥2 分）的评语永远保留 —— 那是逐份手写的教学资产。
 */
export function cleanMarkerComment(comment: string, maxMarks: number): string {
  const c = (comment ?? '').trim();
  if (!c) return '';
  if (maxMarks >= 2) return c; // 长答题评语永远保留
  const residue = c
    .replace(/[QĐ段]\s*\d+\s*[:：]?/gi, '')
    .replace(/正解\s*[^\s。,，;；]+/g, '')
    .replace(/同上/g, '')
    .replace(/\b\d+(\.\d+)?\s*\/\s*\d+\b/g, '')
    .replace(/(^|[\s。,，;；])[0-2](?=$|[\s。,，;；])/g, '$1')
    .replace(/\b(TRUE|FALSE|NOT GIVEN|YES|NO)\b/gi, '')
    .replace(/[A-H](?=[\s。,，;；]|$)/g, '')
    .replace(/[\s。,，;；:：、]+/g, '');
  return residue.length >= 6 ? c : '';
}

/** 判分指令 —— 对学生零价值，整段删掉。 */
const GRADING_NOISE: RegExp[] = [
  /Award one mark per distinct point\.?/gi,
  /\(award\s*~?\d*\s*each[^)]*\)/gi,
  /STYLE\s*\/\s*OWN-WORDS[\s\S]*?(?=MODEL|$)/gi,
  /\(the \d+(?:st|nd|rd|th) mark[^)]*\)/gi,
  /mirrors the SEAB[^.;]*[.;]?/gi,
  /reward sustained[^.;]*[.;]?/gi,
  /penalise [^.;]*[.;]?/gi,
  /\b\d+ distinct ideas spread over paragraphs [\d-]+\b/gi,
];

/**
 * 把 mark scheme 变成学生能读的要点列表。
 *
 * 返回 { points, model }：
 *   points —— 拆开的答案要点（去掉 MP1/①/CONTENT POINTS 这类标记）
 *   model  —— 范文（长答题的 mark scheme 里常带 MODEL(~79 words): '…'）
 *             这是学生最该看的东西，单独拎出来。
 */
export function humanizeAnswer(raw: string): { points: string[]; model: string } {
  let s = (raw ?? '').trim();
  if (!s) return { points: [], model: '' };

  // 先抽范文，再从正文里删掉它 —— 否则它会被当成一个超长要点
  let model = '';
  const modelMatch = s.match(/MODEL\s*\([^)]*\)\s*:\s*['‘“]?([\s\S]*?)['’”]?\s*$/i);
  if (modelMatch) {
    model = modelMatch[1].trim().replace(/\s+/g, ' ');
    s = s.slice(0, modelMatch.index).trim();
  }

  for (const re of GRADING_NOISE) s = s.replace(re, ' ');
  s = s.replace(/CONTENT POINTS\s*:?/gi, ' ').replace(/\s{2,}/g, ' ').trim();

  // 按要点标记切：MP1: / MP2 (xxx): / ① / ② / ; 分号
  const marked = s.split(/\s*(?:MP\d+\s*(?:\([^)]*\))?\s*:|[①②③④⑤⑥⑦⑧⑨⑩])\s*/).map((x) => x.trim());
  let points = marked.filter(Boolean);
  // 没有要点标记时按分号切（多数 1 分题就是一句话，切完还是一条）
  if (points.length === 1) {
    points = points[0].split(/\s*;\s*/).map((x) => x.trim()).filter(Boolean);
  }
  points = points
    .map((p) => p.replace(/^[,;:.\s]+|[,;\s]+$/g, '').trim())
    // 只丢纯标点残渣，绝不按长度过滤 —— 段落匹配/判断题的答案就是
    // 单个字母（"C"、"H"），length>1 会把它们整条吃掉，学生看到「参考
    // 答案：—」。2026-08-13 上线首查就撞到了。
    .filter((p) => /[A-Za-z0-9一-鿿]/.test(p));

  return { points, model };
}
