import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeTranslationService } from './realtime-translation.service';
import { glossKey, normalizedPassage, WordGlosses } from './article-gloss';

/**
 * 生词本 —— 词典查询服务。
 *
 * 阅读原句命中带 wordGlosses 的卷子时只用本文释义，缺词直接未收录。
 * 其他查词保留本地 DictEntry（ECDICT）优先、缺词才实时翻译的旧链路。
 * 文章原句的句意也由同一翻译服务按需返回。密钥只在 API 服务端，浏览器
 * 永远接触不到供应商凭据。
 *
 * 解析链（P0 实测定型，见 docs/PRD/vocabulary-notebook-p0-report.md）：
 *   1. 直查                    —— ECDICT 已把 went/coaxed/shattered 等变形收作
 *                                 独立词条，实测 95.7% 的词形一次命中
 *   2. 剥离所有格 's / s'      —— Singapore's → singapore
 *   3. 常见动词屈折回退        —— bumped → bump / stopped → stop
 *   4. 按连字符拆分逐段查      —— public-housing → public / housing
 *
 * 第 3 步只处理形态明确的 -ed，不做宽泛的「去 s / 去 ing」；这样能覆盖
 * bumped 这类真实漏词，同时不会把 mother→moth、class→clas、this→thi。
 */

export interface LookupHit {
  /** 实际命中的词典词条 */
  word: string;
  /** 学生点击的原词形 */
  query: string;
  phonetic: string | null;
  translation: string;
  definition: string | null;
  pos: string | null;
  collins: number | null;
  oxford: boolean;
  tag: string[];
  /** 命中方式，便于前端与排查（本地四种 + remote 实时兜底） */
  via: 'direct' | 'possessive' | 'lemma' | 'hyphen' | 'remote' | 'gloss';
  contextTranslation?: string | null;
  /**
   * 整句翻译没取到时，为什么没取到、能不能再试（VOC15 同一口径）。有译文时不给。
   * 前端据此决定给不给「再取一次」、要不要写「N 秒后再试」，不把报错当译文。
   */
  contextTranslationStatus?: { status: string; retryable: boolean; retryAfterSec?: number };
}

/** 与前端分词器一致的归一化。 */
export function normalizeWord(w: string): string {
  return (w || '').toLowerCase().replace(/[’']/g, "'").trim();
}

/** 生成候选查询形式，按优先级排列。 */
export function candidateForms(raw: string): Array<{ form: string; via: LookupHit['via'] }> {
  const w = normalizeWord(raw).replace(/^[^a-z']+|[^a-z']+$/g, '');
  const out: Array<{ form: string; via: LookupHit['via'] }> = [];
  if (!w) return out;
  out.push({ form: w, via: 'direct' });
  if (w.endsWith("'s") && w.length > 3) out.push({ form: w.slice(0, -2), via: 'possessive' });
  else if (w.endsWith("s'") && w.length > 3) out.push({ form: w.slice(0, -1), via: 'possessive' });
  return out;
}

/**
 * 直查失败后才使用的保守动词过去式候选。刻意不处理普通 -s / -ing，避免
 * this→thi、morning→morn 这类“查到了但翻错了”比未收录更糟的结果。
 */
export function verbLemmaForms(raw: string): string[] {
  const w = normalizeWord(raw).replace(/^[^a-z']+|[^a-z']+$/g, '');
  if (!w || w.length <= 4) return [];
  const out = new Set<string>();
  const add = (form: string) => {
    if (form.length >= 3 && form !== w) out.add(form);
  };
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  else if (w.endsWith('ed')) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    if (/(.)\1ed$/.test(w)) add(w.slice(0, -3));
  }
  return [...out];
}

/**
 * 新加坡本地词表：文章里常见、ECDICT 没有或释义离谱的词。键是小写。
 */
const LOCAL_GLOSSARY: Readonly<Record<string, { translation: string; definition?: string; pos?: string; phonetic?: string }>> = {
  hdb: { translation: 'n. 建屋发展局（Housing & Development Board）；口语里指政府组屋', definition: "Singapore's public housing authority; informally, the flats it builds", pos: 'n.' },
  mrt: { translation: 'n. 新加坡地铁（Mass Rapid Transit）', definition: "Singapore's rapid transit railway", pos: 'n.' },
  tekong: { translation: 'n. 德光岛（新加坡新兵训练营所在地）', definition: 'Pulau Tekong, the island where Singapore’s basic military training takes place', pos: 'n.' },
  kopitiam: { translation: 'n. 咖啡店（新马传统饮食店）', definition: 'a traditional coffee shop in Singapore and Malaysia', pos: 'n.', phonetic: 'ˈkɒpɪtiːæm' },
  ns: { translation: 'n. 国民服役（National Service）', definition: 'compulsory national service in Singapore', pos: 'n.' },
  psle: { translation: 'n. 小六会考（Primary School Leaving Examination）', definition: 'the national examination taken at the end of primary school in Singapore', pos: 'n.' },
  cca: { translation: 'n. 课外活动（Co-Curricular Activity）', definition: 'a school co-curricular activity', pos: 'n.' },
  cpf: { translation: 'n. 公积金（Central Provident Fund）', definition: "Singapore's compulsory savings scheme", pos: 'n.' },
  nric: { translation: 'n. 身份证（National Registration Identity Card）', definition: "Singapore's national identity card", pos: 'n.' },
  bto: { translation: 'n. 预购组屋（Build-To-Order）', definition: 'a new public flat bought before it is built', pos: 'n.' },
};

/** ECDICT 中有词频/考纲/核心词信号的条目，优先视为可靠的独立词条。 */
function hasLexicalSignal(row: any): boolean {
  return !!(
    row?.oxford ||
    row?.collins ||
    row?.bnc ||
    row?.frq ||
    (Array.isArray(row?.tag) && row.tag.length > 0)
  );
}

/**
 * ECDICT 少数变形行的英中词性互相打架：英文 definition 全是动词，中文却
 * 只有形容词（bumped / cupped）。在阅读里的过去式语境中，这种直查会给出
 * 看似存在、实际误导的答案。若中文已经明确写了过去式/过去分词则不拦。
 */
function hasInflectionTranslationMismatch(row: any): boolean {
  const definition = String(row?.definition ?? '');
  const translation = String(row?.translation ?? '');
  const englishHasVerb = /(?:^|\n)\s*v\b/i.test(definition);
  const chineseHasVerb = /(?:^|\n)\s*(?:v|vi|vt)\./i.test(translation);
  const explainsInflection = /过去式|过去分词/.test(translation);
  const chineseStartsAdjective = /^\s*(?:a|adj)\./i.test(translation);
  return englishHasVerb && chineseStartsAdjective && !chineseHasVerb && !explainsInflection;
}

@Injectable()
export class VocabService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtime?: RealtimeTranslationService,
  ) {}

  /** 本文释义优先且禁止回退；其他场景保留原查词行为。 */
  async lookup(raw: string, contextSentence?: string): Promise<LookupHit | null> {
    const sentence = contextSentence?.trim() ?? '';
    const glosses = sentence ? await this.articleGlosses(sentence) : null;
    let hit: LookupHit | null;
    if (glosses !== null) {
      const key = glossKey(raw);
      const gloss = Object.prototype.hasOwnProperty.call(glosses, key) ? glosses[key] : null;
      // 有表即封闭：空表、漏词、坏数据都不能重新读词典释义或翻译词语。
      if (!gloss || typeof gloss.zh !== 'string' || !gloss.zh.trim() || typeof gloss.pos !== 'string' || !gloss.pos.trim()) return null;
      const word = typeof gloss.lemma === 'string' && gloss.lemma ? gloss.lemma : key;
      const phonetics = await this.prisma.dictEntry.findMany({
        where: { word: { in: [...new Set([key, word])] } },
        select: { word: true, phonetic: true },
      });
      hit = {
        word, query: raw, translation: gloss.zh, pos: gloss.pos, definition: null,
        phonetic: phonetics.find((r) => r.word === key)?.phonetic ?? phonetics.find((r) => r.word === word)?.phonetic ?? null,
        collins: null, oxford: false, tag: [], via: 'gloss',
      };
    } else {
      hit = await this.lookupLocal(raw);
    }
    if (!hit && glosses === null && this.realtime) {
      const translation = await this.realtime.translate(raw);
      const word = normalizeWord(raw).replace(/^[^a-z']+|[^a-z']+$/g, '');
      if (translation && word) {
        hit = {
          word,
          query: raw,
          phonetic: null,
          translation,
          definition: null,
          pos: null,
          collins: null,
          oxford: false,
          tag: [],
          via: 'remote',
        };
      }
    }
    if (!hit) return null;
    // 内容包里人工过过的整句翻译优先；机翻只兜底
    //（2026-09-06 复测：机翻把 "the remaining stock" 译成「剩余的菌株」）。
    const curated = sentence ? await this.curatedSentenceTranslation(sentence) : null;
    if (curated || !sentence || !this.realtime) return { ...hit, contextTranslation: curated };
    // VOC15：用带状态的翻译 —— 没取到时如实告诉前端原因与能否重试
    const r = await this.realtime.translateDetailed(sentence);
    if (r.text) return { ...hit, contextTranslation: r.text };
    return {
      ...hit,
      contextTranslation: null,
      contextTranslationStatus: { status: r.status, retryable: r.retryable, ...(r.retryAfterSec ? { retryAfterSec: r.retryAfterSec } : {}) },
    };
  }

  private glossCache: { at: number; articles: Array<{ passages: string[]; glosses: WordGlosses }> } | null = null;

  /** Paper 没有 publishedAt；用 createdAt 限最近 60 天，且必须仍是已发布、未软归档。 */
  private async articleGlosses(sentence: string): Promise<WordGlosses | null> {
    if (!this.glossCache || Date.now() - this.glossCache.at > 10 * 60_000) {
      const papers = await this.prisma.paper.findMany({
        where: { status: 'published', archivedAt: null, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: { config: true, questions: { select: { snapshotContent: true, overrideContent: true } } },
      });
      const articles: Array<{ passages: string[]; glosses: WordGlosses }> = [];
      for (const paper of papers) {
        const cfg = paper.config as Record<string, unknown> | null;
        if (!cfg || !Object.prototype.hasOwnProperty.call(cfg, 'wordGlosses')) continue;
        const glosses = cfg.wordGlosses;
        const passages = paper.questions.flatMap((q) => {
          const snapshot = q.snapshotContent as { passage?: unknown } | null;
          const override = q.overrideContent as { passage?: unknown } | null;
          const passage = override?.passage ?? snapshot?.passage;
          return typeof passage === 'string' && passage.trim() ? [normalizedPassage(passage)] : [];
        });
        // 字段存在但格式坏了也必须封闭，不能把它当成旧文章。
        articles.push({ passages, glosses: glosses && typeof glosses === 'object' && !Array.isArray(glosses) ? glosses as WordGlosses : {} });
      }
      // 查询失败向上传播；不会缓存“查不到”并降级到词典。
      this.glossCache = { at: Date.now(), articles };
    }
    // 学生端 sentenceContaining 把超过 260 字的原句截成前 257 字 + 「…」再发来（IELTSReadingPassage.tsx），
    // 去掉这个省略号后仍是正文的连续片段，照样能对上文章；否则长句里的词会退回词典。
    const needle = normalizedPassage(sentence).replace(/\s*(?:…|\.\.\.)$/, '');
    if (!needle) return null;
    return this.glossCache.articles.find((article) => article.passages.some((passage) => passage.includes(needle)))?.glosses ?? null;
  }

  private curatedCache: { at: number; map: Map<string, string> } | null = null;

  /**
   * 试点内容包每篇文章带 12 个主词 + 备用词的例句与人工翻译
   * （`Paper.config.lessonWords[].context / contextTranslation`）。学生点到
   * 这些句子时用人工翻译，不用机翻。十分钟缓存一次，卷子不多。
   */
  private async curatedSentenceTranslation(sentence: string): Promise<string | null> {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!this.curatedCache || Date.now() - this.curatedCache.at > 10 * 60_000) {
      const map = new Map<string, string>();
      try {
        const papers = await this.prisma.paper.findMany({
          where: { id: { startsWith: 'p1_' } },
          select: { config: true },
        });
        for (const paper of papers) {
          const cfg = (paper.config ?? {}) as { lessonWords?: unknown; lessonWordReserves?: unknown };
          for (const list of [cfg.lessonWords, cfg.lessonWordReserves]) {
            if (!Array.isArray(list)) continue;
            for (const w of list as Array<{ context?: unknown; contextTranslation?: unknown }>) {
              if (typeof w?.context === 'string' && typeof w?.contextTranslation === 'string' && w.contextTranslation.trim()) {
                map.set(norm(w.context), w.contextTranslation.trim());
              }
            }
          }
        }
      } catch {
        /* 读不到就只用机翻 */
      }
      this.curatedCache = { at: Date.now(), map };
    }
    return this.curatedCache.map.get(norm(sentence)) ?? null;
  }

  /**
   * 查一个词。查不到返回 null（前端显示「本词典未收录」，不猜、不编）。
   *
   * 连字符词单独处理：整体查不到时逐段查，返回第一个查得到的段
   * （public-housing → public）。
   */
  private async lookupLocal(raw: string): Promise<LookupHit | null> {
    const cands = candidateForms(raw);
    if (!cands.length) return null;
    // 新加坡本地词：词典没有、机翻会瞎译（HDB →「组屋银行」，2026-09-06 第五轮复测 B-2）
    const local = LOCAL_GLOSSARY[cands[0].form];
    if (local) {
      return {
        word: cands[0].form,
        query: raw,
        phonetic: local.phonetic ?? null,
        translation: local.translation,
        definition: local.definition ?? null,
        pos: local.pos ?? null,
        collins: null,
        oxford: false,
        tag: [],
        via: 'direct',
      };
    }

    const forms = cands.map((c) => c.form);
    const rows = await this.prisma.dictEntry.findMany({
      where: { word: { in: forms } },
    });
    const lemmaForms = verbLemmaForms(raw);
    const directCandidate = cands
      .map((c) => ({ candidate: c, row: rows.find((r) => r.word === c.form) }))
      .find((item) => item.row);

    // ECDICT 的变形词条有一类中文只写「be的过去式」这种指针，英文 definition
    // 还混进了别的条目（was 的第一行是华盛顿州；2026-09-06 第五轮盲测 4）。
    // 指针指向谁就用谁的释义，中文前面标一句「was 是 be 的过去式」。
    const direct = directCandidate?.candidate.via === 'direct' ? directCandidate.row : undefined;
    if (direct) {
      const pointer = String(direct.translation ?? '').trim()
        .match(/^([a-z]+)\s*的\s*(过去式|过去分词|现在分词|复数|第三人称单数|比较级|最高级)$/i);
      if (pointer) {
        const base = await this.prisma.dictEntry.findUnique({ where: { word: pointer[1].toLowerCase() } });
        if (base) {
          const hit = this.toHit(base, raw, 'lemma');
          return {
            ...hit,
            word: direct.word,
            phonetic: direct.phonetic ?? hit.phonetic,
            translation: `${direct.word} 是 ${base.word} 的${pointer[2]}\n${hit.translation ?? ''}`.trim(),
          };
        }
      }
    }

    if (
      directCandidate &&
      (directCandidate.candidate.via !== 'direct' ||
        (hasLexicalSignal(directCandidate.row) &&
          !hasInflectionTranslationMismatch(directCandidate.row)))
    ) {
      return this.toHit(
        directCandidate.row,
        raw,
        directCandidate.candidate.via,
      );
    }

    // ECDICT 有少数低质量变形词条：例如 bumped 的中文是「凸起的」，但英文
    // definition 与 exchange 都明确指向 bump。若变形本身没有任何词频/考纲
    // 信号，而原形有，就优先采用可靠原形。learned 这类有独立词频和标签的
    // 词条仍保留自己的释义。
    if (lemmaForms.length) {
      const lemmaRows = await this.prisma.dictEntry.findMany({
        where: { word: { in: lemmaForms } },
      });
      const strongLemma = lemmaForms
        .map((form) => lemmaRows.find((r) => r.word === form))
        .find((row) => row && hasLexicalSignal(row));
      if (
        strongLemma &&
        (!directCandidate ||
          (directCandidate.candidate.via === 'direct' &&
            (!hasLexicalSignal(directCandidate.row) ||
              hasInflectionTranslationMismatch(directCandidate.row))))
      ) {
        return this.toHit(strongLemma, raw, 'lemma');
      }
      if (!directCandidate) {
        const anyLemma = lemmaForms
          .map((form) => lemmaRows.find((r) => r.word === form))
          .find(Boolean);
        if (anyLemma) return this.toHit(anyLemma, raw, 'lemma');
      }
    }
    if (directCandidate) {
      return this.toHit(
        directCandidate.row,
        raw,
        directCandidate.candidate.via,
      );
    }

    // 连字符：拆段再查
    const base = normalizeWord(raw).replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
    if (base.includes('-')) {
      const parts = base.split('-').filter((p) => p.length > 1);
      if (parts.length) {
        const partRows = await this.prisma.dictEntry.findMany({
          where: { word: { in: parts } },
        });
        for (const p of parts) {
          const hit = partRows.find((r) => r.word === p);
          if (hit) return this.toHit(hit, raw, 'hyphen');
        }
      }
    }
    return null;
  }

  /**
   * 批量查询 —— 用于按篇预生成 glossary（离线下发）。
   * 单篇约 300 个词形、22 KB，见 P0 报告 §5。
   */
  async lookupMany(words: string[]): Promise<LookupHit[]> {
    const uniq = [...new Set(words.map(normalizeWord).filter(Boolean))];
    const out: LookupHit[] = [];
    // 分批，避免 IN 列表过长
    const CHUNK = 500;
    for (let i = 0; i < uniq.length; i += CHUNK) {
      const slice = uniq.slice(i, i + CHUNK);
      const rows = await this.prisma.dictEntry.findMany({
        where: { word: { in: slice } },
      });
      const map = new Map(rows.map((r) => [r.word, r]));
      for (const w of slice) {
        const hit = map.get(w);
        if (hit) out.push(this.toHit(hit, w, 'direct'));
      }
    }
    return out;
  }

  private toHit(r: any, query: string, via: LookupHit['via']): LookupHit {
    return {
      word: r.word,
      query,
      phonetic: r.phonetic ?? null,
      translation: r.translation,
      definition: r.definition ?? null,
      pos: r.pos ?? null,
      collins: r.collins ?? null,
      oxford: !!r.oxford,
      tag: r.tag ?? [],
      via,
    };
  }
}
