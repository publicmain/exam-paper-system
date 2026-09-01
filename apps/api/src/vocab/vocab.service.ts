import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RealtimeTranslationService } from './realtime-translation.service';

/**
 * 生词本 —— 词典查询服务。
 *
 * 本地 DictEntry（ECDICT）永远优先；只有本地确实查不到时才走实时翻译。
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
  via: 'direct' | 'possessive' | 'lemma' | 'hyphen' | 'remote';
  contextTranslation?: string | null;
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

  /** 本地词典优先；缺词才联网。点词带原句时，同时返回中文句意。 */
  async lookup(raw: string, contextSentence?: string): Promise<LookupHit | null> {
    let hit = await this.lookupLocal(raw);
    if (!hit && this.realtime) {
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
    const contextTranslation = contextSentence?.trim() && this.realtime
      ? await this.realtime.translate(contextSentence)
      : null;
    return { ...hit, contextTranslation };
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

    const forms = cands.map((c) => c.form);
    const rows = await this.prisma.dictEntry.findMany({
      where: { word: { in: forms } },
    });
    const lemmaForms = verbLemmaForms(raw);
    const directCandidate = cands
      .map((c) => ({ candidate: c, row: rows.find((r) => r.word === c.form) }))
      .find((item) => item.row);

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
