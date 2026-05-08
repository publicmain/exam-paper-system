import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';

/**
 * One-off IELTS data-quality repair driven by Claude.
 *
 * Three classes of damage are fixed in-place against the question bank
 * (provenanceTag starting with `cambridge_ielts_`):
 *
 *   1. matching_headings: the list-of-headings (i, ii, iii, …) was lost at
 *      ingestion. The paper question's stem only carries the rubric and the
 *      "Paragraph X" item; the bank itself is missing. Without it students
 *      cannot answer because they have no idea what each numeral means. We
 *      ask Claude to reconstruct a plausible, self-consistent heading list
 *      from the passage + the answer key, then store it under
 *      `content.headingsBank`.
 *
 *   2. summary_completion with letter answers (A, B, C, …): the word bank
 *      was lost the same way. Same Claude approach — generate a bank of
 *      ~9 candidate words/phrases keyed A-I (or A-N) such that the answer
 *      key resolves to a sensible word for each blank. Stored under
 *      `content.wordBank`.
 *
 *   3. Passage OCR artifacts: PyMuPDF column extraction left lines broken
 *      mid-sentence and substituted random characters (`property` → `proper~y`,
 *      titles like `AIR TRAFFIC CONTROL` → `AIR TRAF,F1IJQ.<C-ONT:ROL`). We
 *      ask Claude to clean each unique passage once and overwrite
 *      content.passage on every paper question that shares it.
 *
 * Output is idempotent: an already-repaired question is detected and skipped.
 *
 * The endpoint runs in dryRun=true by default and surfaces a per-passage,
 * per-task report so an operator can review before live application.
 */
@Injectable()
export class IeltsRepairService {
  private readonly logger = new Logger('IeltsRepairService');
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async repair(opts: {
    dryRun?: boolean;
    provenancePrefix?: string;
    sourceRefPrefix?: string;
  }) {
    const dryRun = opts.dryRun !== false;
    const provenancePrefix = opts.provenancePrefix;
    // Default to anything ingested under the IELTS hierarchy. Prod data
    // currently has provenanceTag=NULL so we have to filter on sourceRef.
    const sourceRefPrefix = opts.sourceRefPrefix ?? 'IELTS/';

    if (!this.client) {
      return {
        ok: false,
        error: 'ANTHROPIC_API_KEY not configured',
      };
    }

    // Pull every IELTS bank question. We need them grouped by passage so we
    // can do one Claude call per passage and one per task-group, not per
    // question (would be 160 calls vs ~30).
    const where: any = {
      sourceRef: { startsWith: sourceRefPrefix },
      sourceType: 'past_paper_reference',
    };
    if (provenancePrefix) where.provenanceTag = { startsWith: provenancePrefix };
    const questions = await this.prisma.question.findMany({
      where,
      orderBy: { sourceRef: 'asc' },
    });

    type BankQ = (typeof questions)[number];
    const byPassage = new Map<string, BankQ[]>();
    for (const q of questions) {
      const ref = q.sourceRef ?? '';
      const m = ref.match(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
      if (!m) continue;
      const key = m[1];
      if (!byPassage.has(key)) byPassage.set(key, []);
      byPassage.get(key)!.push(q);
    }

    type PassageReport = {
      passageRef: string;
      passageTitle: string;
      passageRepaired: boolean;
      headingsBanksAdded: number;
      wordBanksAdded: number;
      questionsTouched: number;
      skipped: number;
      errors: string[];
    };

    const report: PassageReport[] = [];

    for (const [passageRef, qs] of byPassage) {
      // Sort numerically so we feed Claude in the original Q order.
      qs.sort((a, b) => {
        const an = parseInt(a.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
        const bn = parseInt(b.sourceRef?.match(/\/Q(\d+)$/)?.[1] ?? '0', 10);
        return an - bn;
      });
      const r: PassageReport = {
        passageRef,
        passageTitle: ((qs[0].content as any)?.passageTitle as string) ?? '',
        passageRepaired: false,
        headingsBanksAdded: 0,
        wordBanksAdded: 0,
        questionsTouched: 0,
        skipped: 0,
        errors: [],
      };

      try {
        // 1. Clean passage (once per passage). Skip if already cleaned.
        const firstContent = qs[0].content as any;
        const passage: string = firstContent?.passage ?? '';
        const alreadyCleaned: boolean = firstContent?.passageCleaned === true;
        let cleanedPassage = passage;
        let cleanedTitle = firstContent?.passageTitle ?? '';
        if (passage && !alreadyCleaned) {
          const cleaned = await this.cleanPassage(passage, cleanedTitle);
          cleanedPassage = cleaned.passage;
          cleanedTitle = cleaned.title;
          r.passageRepaired = true;
        } else {
          r.skipped++;
        }

        // 2. Detect tasks needing bank reconstruction. Group by taskType
        //    + matching instruction (same logic as the frontend).
        type TaskGroup = { taskType: string; instr: string; qs: BankQ[] };
        const groups: TaskGroup[] = [];
        let cur: TaskGroup | null = null;
        for (const q of qs) {
          const c = q.content as any;
          const tt: string = c?.taskType ?? '_other';
          const stem: string = c?.stem ?? '';
          const instr = stem.split(/\n\s*\n/)[0].trim();
          if (!cur || cur.taskType !== tt || cur.instr !== instr) {
            cur = { taskType: tt, instr, qs: [] };
            groups.push(cur);
          }
          cur.qs.push(q);
        }

        // For each task group of interest, generate the missing bank.
        const banksByQuestionId = new Map<string, any>();
        for (const g of groups) {
          if (g.taskType === 'matching_headings') {
            // Skip if already has a bank.
            if ((g.qs[0].content as any)?.headingsBank) {
              r.skipped++;
              continue;
            }
            const bank = await this.generateHeadingsBank(
              cleanedPassage,
              g.qs.map((q) => ({
                paragraph: this.extractItem((q.content as any).stem ?? ''),
                answer: ((q.answerContent as any)?.text ?? '').trim(),
                sourceRef: q.sourceRef ?? '',
              })),
              g.instr,
            );
            for (const q of g.qs) banksByQuestionId.set(q.id, { headingsBank: bank });
            r.headingsBanksAdded++;
          } else if (g.taskType === 'summary_completion') {
            // Trigger only when answers are letter codes (A, B, C, …) —
            // those are the with-bank flavour. Plain word answers
            // (e.g. "physical chemistry") are handled by the existing
            // BlankAwareInput and need no bank.
            const answers = g.qs.map((q) =>
              ((q.answerContent as any)?.text ?? '').trim(),
            );
            const isLetterBank = answers.every((a) => /^[A-Z]$/.test(a));
            if (!isLetterBank) {
              r.skipped++;
              continue;
            }
            if ((g.qs[0].content as any)?.wordBank) {
              r.skipped++;
              continue;
            }
            const bank = await this.generateWordBank(
              cleanedPassage,
              g.qs.map((q) => ({
                item: this.extractItem((q.content as any).stem ?? ''),
                answer: ((q.answerContent as any)?.text ?? '').trim(),
                sourceRef: q.sourceRef ?? '',
              })),
              g.instr,
            );
            for (const q of g.qs) banksByQuestionId.set(q.id, { wordBank: bank });
            r.wordBanksAdded++;
          }
        }

        // 3. Apply: write cleaned passage + bank into Question.content for
        //    every question in this passage, AND mirror into PaperQuestion
        //    .snapshotContent for any already-generated papers using these
        //    questions (so we don't have to regenerate to see the fix).
        if (!dryRun) {
          for (const q of qs) {
            const content = q.content as any;
            const updated: any = { ...content };
            if (r.passageRepaired) {
              updated.passage = cleanedPassage;
              updated.passageTitle = cleanedTitle;
              updated.passageCleaned = true;
            }
            const extra = banksByQuestionId.get(q.id);
            if (extra) Object.assign(updated, extra);
            await this.prisma.question.update({
              where: { id: q.id },
              data: { content: updated },
            });
            // Mirror onto any PaperQuestion snapshot so already-generated
            // papers pick up the fix without a regen step.
            await this.prisma.paperQuestion.updateMany({
              where: { questionId: q.id },
              data: { snapshotContent: updated },
            });
            r.questionsTouched++;
          }
        }
      } catch (e: any) {
        r.errors.push(e?.message ?? String(e));
        this.logger.error(`repair failed for ${passageRef}: ${e?.message}`);
      }

      report.push(r);
    }

    return { ok: true, dryRun, count: byPassage.size, report };
  }

  /* ------------------------------------------------------------------
   * Claude prompts
   * ------------------------------------------------------------------ */

  private async cleanPassage(
    passage: string,
    title: string,
  ): Promise<{ passage: string; title: string }> {
    const prompt = `You are repairing a Cambridge IELTS Reading passage that was extracted from a PDF with column-based OCR.

The text has THREE typical kinds of damage:
1. Lines broken mid-sentence (PDF column wrap) — every ~10 words there is a newline, even inside paragraphs.
2. Random character substitutions ("property" → "proper~y", "1940s" → "l 940s", etc.).
3. Garbled section/title headers (e.g. "AIR TRAF,F1IJQ.<C-ONT:ROL" should be "AIR TRAFFIC CONTROL").

Your job: return a CLEANED version that:
- Joins lines into proper paragraphs.
- Preserves the IELTS paragraph markers (single capital letter at the start of each paragraph: "A …", "B …", "C …" — these MUST stay; do not delete them or merge paragraphs together).
- Fixes obvious character substitutions in context (use the surrounding word to recover the original).
- Repairs the title.
- Does NOT paraphrase, summarise, translate, or rephrase. Word choice and meaning must match the original.
- Does NOT add or remove sentences.

Return strict JSON:
{
  "title": "<corrected title>",
  "passage": "<full cleaned passage with paragraph markers preserved, paragraphs separated by blank lines>"
}

Title (raw): ${JSON.stringify(title)}

Passage (raw):
<<<
${passage}
>>>`;

    const j = await this.callJson(prompt, 8000);
    return {
      passage: j.passage ?? passage,
      title: j.title ?? title,
    };
  }

  private async generateHeadingsBank(
    passage: string,
    items: Array<{ paragraph: string; answer: string; sourceRef: string }>,
    instruction: string,
  ): Promise<Array<{ key: string; text: string }>> {
    // Determine bank size: max(answers, default 8). IELTS heading lists
    // are typically 8-10 with 2-3 distractors over the number of paragraphs.
    const usedNumerals = new Set(items.map((i) => i.answer.toLowerCase()));
    const m = instruction.toLowerCase().match(/i\s*[–-]\s*(x{0,2}i{0,3}v?i*)/);
    const explicitMax = m?.[1] ?? '';
    const bankSize = Math.max(8, usedNumerals.size + 3, this.romanToInt(explicitMax) || 0);

    const items_text = items
      .map((i) => ` - ${i.paragraph} → ${i.answer}`)
      .join('\n');

    const prompt = `You are reconstructing the lost "List of Headings" for an IELTS Reading matching-headings task. The original headings list (i, ii, iii…) was missing from the data ingestion; only the answer key for each paragraph survived.

Cambridge IELTS heading lists are typically ${bankSize} short noun phrases (4-10 words each), some of which are correct answers for paragraphs and some of which are distractors. Each heading captures the MAIN POINT of one paragraph.

Given:
- The full passage with paragraph markers (A, B, C, …).
- The answer key: which roman-numeral heading corresponds to each paragraph.

Produce a list of ${bankSize} headings keyed i, ii, iii, …, ${this.intToRoman(bankSize)} such that:
- For each (paragraph X → numeral Y) pair, heading Y is a faithful summary of paragraph X.
- The remaining headings (not in the answer key) are plausible IELTS-style distractors that loosely relate to the topic but do NOT correctly summarise any paragraph.
- All headings are concise noun phrases, parallel in style.

Return strict JSON:
{ "headings": [{ "key": "i", "text": "…" }, { "key": "ii", "text": "…" }, …] }

Instruction line (for context): ${JSON.stringify(instruction)}
Answer key:
${items_text}

Passage:
<<<
${passage}
>>>`;
    const j = await this.callJson(prompt, 4000);
    if (!Array.isArray(j.headings)) throw new Error('headings missing');
    return j.headings;
  }

  private async generateWordBank(
    passage: string,
    items: Array<{ item: string; answer: string; sourceRef: string }>,
    instruction: string,
  ): Promise<Array<{ key: string; text: string }>> {
    const used = new Set(items.map((i) => i.answer.toUpperCase()));
    const bankSize = Math.max(9, used.size + 3);
    const items_text = items
      .map((i) => ` - "${i.item}" → ${i.answer}`)
      .join('\n');

    const prompt = `You are reconstructing the lost word/phrase bank for an IELTS Reading summary-completion task. The original bank (A, B, C, …) was missing from the data ingestion; only the answer-letter for each summary item survived.

Cambridge IELTS summary banks are typically ${bankSize} short words or phrases (1-3 words each), several of which fit different blanks and a few of which are distractors. The chosen words come from the passage's vocabulary and are inflected to fit the gap.

Given:
- The full passage.
- Each summary item with a blank ("___") and the correct letter.

Produce a bank of ${bankSize} keyed entries A, B, C, …, such that:
- For each (item → letter) pair, the bank entry under that letter completes the gap correctly given the passage.
- Distractors are plausible candidates from the same semantic field but do NOT fit any of the gaps.

Return strict JSON:
{ "wordBank": [{ "key": "A", "text": "…" }, { "key": "B", "text": "…" }, …] }

Instruction line: ${JSON.stringify(instruction)}
Items:
${items_text}

Passage:
<<<
${passage}
>>>`;
    const j = await this.callJson(prompt, 4000);
    if (!Array.isArray(j.wordBank)) throw new Error('wordBank missing');
    return j.wordBank;
  }

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */

  private extractItem(stem: string): string {
    const trimmed = stem.trim();
    const matches = [...trimmed.matchAll(/\n\s*\n/g)];
    if (matches.length === 0) return trimmed;
    const last = matches[matches.length - 1];
    return trimmed.slice((last.index ?? 0) + last[0].length).trim();
  }

  private async callJson(prompt: string, maxTokens = 4000): Promise<any> {
    if (!this.client) throw new Error('Anthropic client not configured');
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text block');
    const txt = block.text.trim();
    // Tolerate code fences.
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON in response');
    return JSON.parse(jsonMatch[0]);
  }

  private romanToInt(roman: string): number {
    const map: Record<string, number> = { i: 1, v: 5, x: 10 };
    let total = 0;
    for (let i = 0; i < roman.length; i++) {
      const cur = map[roman[i]] ?? 0;
      const next = map[roman[i + 1]] ?? 0;
      total += cur < next ? -cur : cur;
    }
    return total;
  }

  private intToRoman(n: number): string {
    const out: string[] = [];
    const nums: Array<[number, string]> = [
      [10, 'x'],
      [9, 'ix'],
      [5, 'v'],
      [4, 'iv'],
      [1, 'i'],
    ];
    for (const [v, s] of nums) {
      while (n >= v) {
        out.push(s);
        n -= v;
      }
    }
    return out.join('');
  }
}
