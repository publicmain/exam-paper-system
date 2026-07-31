import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/**
 * 生词本 —— 词典查询服务。
 *
 * 铁律：**零 Anthropic API 调用**。查词只走本地 DictEntry 表（ECDICT 导入），
 * 不调用任何 LLM 或联网翻译接口。
 *
 * 解析链（P0 实测定型，见 docs/PRD/vocabulary-notebook-p0-report.md）：
 *   1. 直查                    —— ECDICT 已把 went/coaxed/shattered 等变形收作
 *                                 独立词条，实测 95.7% 的词形一次命中
 *   2. 剥离所有格 's / s'      —— Singapore's → singapore
 *   3. 按连字符拆分逐段查      —— public-housing → public / housing
 * 三步合计覆盖真实语料 99.4% 的词次。
 *
 * 刻意**不实现**词形还原引擎：P0 实测 exchange / lemma 两条路径各只多命中
 * 1 个词形，收益为零，而自造后缀规则会把 mother→moth、class→clas 判错。
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
  /** 命中方式，便于前端与排查（direct | possessive | hyphen） */
  via: 'direct' | 'possessive' | 'hyphen';
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

@Injectable()
export class VocabService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查一个词。查不到返回 null（前端显示「本词典未收录」，不猜、不编）。
   *
   * 连字符词单独处理：整体查不到时逐段查，返回第一个查得到的段
   * （public-housing → public）。
   */
  async lookup(raw: string): Promise<LookupHit | null> {
    const cands = candidateForms(raw);
    if (!cands.length) return null;

    const forms = cands.map((c) => c.form);
    const rows = await this.prisma.dictEntry.findMany({
      where: { word: { in: forms } },
    });
    for (const c of cands) {
      const hit = rows.find((r) => r.word === c.form);
      if (hit) return this.toHit(hit, raw, c.via);
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
