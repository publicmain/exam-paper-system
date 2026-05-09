import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';

export interface SuggestLabelInput {
  subjectId: string;
  componentId?: string;
  questionStem: string;
  marks?: number;
}

export interface SuggestLabelOutput {
  topicCandidates: Array<{ topicId: string; topicCode: string; topicName: string; confidence: number; reason: string }>;
  suggestedDifficulty: number;
  suggestedQuestionType: 'mcq' | 'short_answer' | 'structured' | 'essay';
  notes: string;
}

export interface TagBatchResult {
  attempted: number;
  tagged: number;
  skipped: number;
  errors: { itemId: string; error: string }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn('ANTHROPIC_API_KEY not configured — AI calls will return stub responses.');
      this.client = null;
    } else {
      // Round-7 H35 (agent-8 §6.5): explicit retry budget. SDK default
      // already retries 2x but it's worth pinning so a bump in SDK
      // version doesn't silently change it. 529 (overloaded) jitters
      // most often during peak Sonnet usage windows; the extra retry
      // hides ~95% of those before they reach the user.
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  async suggestLabels(input: SuggestLabelInput): Promise<SuggestLabelOutput> {
    const topics = await this.prisma.topic.findMany({
      where: input.componentId ? { componentId: input.componentId } : { component: { subjectId: input.subjectId } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take: 200,
    });

    if (!this.client) {
      // Stub response: pick first 3 topics, mid difficulty
      return {
        topicCandidates: topics.slice(0, 3).map(t => ({
          topicId: t.id, topicCode: t.code, topicName: t.name,
          confidence: 0.4, reason: 'AI not configured — stub response',
        })),
        suggestedDifficulty: 3,
        suggestedQuestionType: 'short_answer',
        notes: 'Stub response. Configure ANTHROPIC_API_KEY in .env to enable real AI labeling.',
      };
    }

    const topicList = topics.map(t => `- [${t.code}] ${t.name}`).join('\n');
    const systemHeader = `You are a syllabus tagger for an exam paper system.
Given a question, identify which syllabus topics it tests.
Respond ONLY with valid JSON matching this schema:
{
  "topicCandidates": [{"topicCode": "...", "confidence": 0.0-1.0, "reason": "..."}],
  "suggestedDifficulty": 1-5,
  "suggestedQuestionType": "mcq" | "short_answer" | "structured" | "essay",
  "notes": "..."
}
Return at most 3 topic candidates ordered by confidence.`;

    const userMsg = `Question stem (LaTeX may be present in $...$):
${input.questionStem}

${input.marks != null ? `Marks: ${input.marks}` : ''}`;

    try {
      // Cache the syllabus topic tree on the system block so a batch over
      // many questions in the same subject pays for it once.
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 800,
        system: [
          { type: 'text', text: systemHeader },
          {
            type: 'text',
            text: `Available topics for this subject:\n${topicList}`,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [{ role: 'user', content: userMsg }],
      });
      const text = resp.content
        .map(c => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');
      const parsed = JSON.parse(jsonMatch[0]);

      const codeToTopic = new Map(topics.map(t => [t.code, t]));
      const candidates = (parsed.topicCandidates || [])
        .map((c: any) => {
          const t = codeToTopic.get(c.topicCode);
          if (!t) return null;
          return {
            topicId: t.id,
            topicCode: t.code,
            topicName: t.name,
            confidence: Number(c.confidence) || 0,
            reason: String(c.reason || ''),
          };
        })
        .filter(Boolean);

      return {
        topicCandidates: candidates,
        suggestedDifficulty: Math.min(5, Math.max(1, Number(parsed.suggestedDifficulty) || 3)),
        suggestedQuestionType: parsed.suggestedQuestionType || 'short_answer',
        notes: String(parsed.notes || ''),
      };
    } catch (err: any) {
      this.logger.error(`AI labeling failed: ${err.message}`);
      return {
        topicCandidates: [],
        suggestedDifficulty: 3,
        suggestedQuestionType: 'short_answer',
        notes: `AI call failed: ${err.message}`,
      };
    }
  }

  /**
   * Batch-tag pending QuestionItems for a repo. We resolve subject and
   * component from each item's SourceFile (syllabusCode + paperVariant)
   * and call suggestLabels for each. Items are sorted by subject so the
   * cached syllabus tree on the system block hits across the batch.
   *
   * Suggestions never auto-apply — they only fill suggested* fields. A
   * teacher must still approve via the review queue. This is the
   * "AI-assist, human-confirm" guarantee from the design doc.
   */
  /**
   * Backfill `primaryTopicId` (and optionally `componentId`) on already-
   * approved Question rows that came out null because the AI tagger never
   * ran on the underlying QuestionItem (typical for the bulk-approve
   * path, where items go straight into the bank without a /tag pass).
   *
   * Walks active Questions matching the filter, calls suggestLabels on
   * the stem, picks the highest-confidence topic above minConfidence,
   * sets `primaryTopicId` (and `componentId` from the topic if missing).
   * Each call hits Anthropic, so this costs real money — a 200-question
   * batch is ~$2-5 at current Sonnet pricing.
   */
  async backfillApprovedTopics(
    args: {
      syllabusCode?: string;
      componentId?: string;
      limit?: number;
      minConfidence?: number;
      dryRun?: boolean;
    },
  ): Promise<{
    dryRun: boolean;
    scanned: number;
    updated: Array<{ questionId: string; topicCode: string; confidence: number }>;
    skipped: Array<{ questionId: string; reason: string }>;
    errors: Array<{ questionId: string; error: string }>;
    costUsdEstimate: number;
  }> {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    const minConfidence = args.minConfidence ?? 0.4;
    const candidates = await this.prisma.question.findMany({
      where: {
        primaryTopicId: null,
        status: 'active',
        ...(args.syllabusCode ? { subject: { code: args.syllabusCode } } : {}),
        ...(args.componentId ? { componentId: args.componentId } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, content: true, subjectId: true, componentId: true, marks: true,
      },
    });

    const updated: Array<{ questionId: string; topicCode: string; confidence: number }> = [];
    const skipped: Array<{ questionId: string; reason: string }> = [];
    const errors: Array<{ questionId: string; error: string }> = [];

    for (const q of candidates) {
      const stem = (q.content as any)?.stem ?? '';
      if (!stem || typeof stem !== 'string' || stem.length < 30) {
        skipped.push({ questionId: q.id, reason: 'stem too short' });
        continue;
      }
      try {
        // Don't constrain by componentId here. The variant→component
        // mapping is coarse (CIE 9709 P5 / Paper 5 Math papers actually
        // contain a mix of M1 and M2 topics, not pure M2), so passing
        // componentId narrows the topic candidates so much that AI
        // returns empty when the true topic lives in a sibling
        // component. Searching the full subject's topic tree is
        // more accurate. componentId still gets corrected post-tag
        // by reading topic.componentId.
        const out = await this.suggestLabels({
          subjectId: q.subjectId,
          questionStem: stem.slice(0, 4000),
          marks: q.marks,
        });
        const top = out.topicCandidates[0];
        if (!top || top.confidence < minConfidence) {
          skipped.push({ questionId: q.id, reason: `low confidence ${top?.confidence ?? 0}` });
          continue;
        }
        updated.push({ questionId: q.id, topicCode: top.topicCode, confidence: top.confidence });
        if (!args.dryRun) {
          // If componentId is null, derive from the topic's component.
          const topic = await this.prisma.topic.findUnique({
            where: { id: top.topicId },
            select: { id: true, componentId: true },
          });
          await this.prisma.question.update({
            where: { id: q.id },
            data: {
              primaryTopicId: topic?.id ?? top.topicId,
              ...(q.componentId == null && topic?.componentId ? { componentId: topic.componentId } : {}),
            },
          });
        }
      } catch (e: any) {
        errors.push({ questionId: q.id, error: String(e?.message ?? e).slice(0, 200) });
      }
    }

    // Rough cost estimate: ~3000 input tokens per call (system prompt +
    // topics) × 95% cache hit + ~200 output. With Sonnet pricing this is
    // ~$0.005 per cached call, ~$0.025 per uncached call.
    const costUsdEstimate = candidates.length * 0.012;

    this.logger.log(
      `topic-backfill ${args.dryRun ? '[dry] ' : ''}` +
        `scanned=${candidates.length} updated=${updated.length} ` +
        `skipped=${skipped.length} errors=${errors.length} ~$${costUsdEstimate.toFixed(2)}`,
    );

    return {
      dryRun: !!args.dryRun,
      scanned: candidates.length,
      updated, skipped, errors,
      costUsdEstimate,
    };
  }

  async tagPendingForRepo(repoId: string, opts: { limit?: number; syllabusCode?: string } = {}): Promise<TagBatchResult> {
    const limit = Math.max(1, Math.min(opts.limit ?? 200, 500));
    const items = await this.prisma.questionItem.findMany({
      where: {
        reviewStatus: 'pending_review',
        // Optional syllabus narrowing so the operator can tag just one
        // syllabus from a multi-syllabus repo (vascodegraaff hosts
        // 9702/9709/9608). Without this, a stale 9702 backlog can
        // monopolise the per-call timeout before the new syllabus's
        // items get a turn.
        sourceFile: {
          repoId,
          ...(opts.syllabusCode ? { syllabusCode: opts.syllabusCode } : {}),
        },
      },
      include: { sourceFile: true },
      take: limit,
    });
    // Sort by syllabusCode so the cached system message is reused.
    items.sort((a, b) => {
      const sa = a.sourceFile?.syllabusCode ?? '';
      const sb = b.sourceFile?.syllabusCode ?? '';
      if (sa !== sb) return sa.localeCompare(sb);
      return (a.sourceFile?.paperVariant ?? '').localeCompare(b.sourceFile?.paperVariant ?? '');
    });

    const result: TagBatchResult = { attempted: 0, tagged: 0, skipped: 0, errors: [] };
    for (const item of items) {
      const sf = item.sourceFile;
      if (!sf?.syllabusCode || !item.rawExtractedText) {
        result.skipped++;
        continue;
      }
      const subject = await this.prisma.subject.findFirst({ where: { code: sf.syllabusCode } });
      if (!subject) {
        result.skipped++;
        continue;
      }
      const component = sf.paperVariant
        ? await this.prisma.syllabusComponent.findFirst({
            where: { subjectId: subject.id, code: `P${sf.paperVariant.charAt(0)}` },
          })
        : null;

      result.attempted++;
      try {
        const out = await this.suggestLabels({
          subjectId: subject.id,
          componentId: component?.id,
          questionStem: item.rawExtractedText.slice(0, 4000),
          marks: item.suggestedMarks ?? undefined,
        });
        const top = out.topicCandidates[0];
        await this.prisma.questionItem.update({
          where: { id: item.id },
          data: {
            suggestedSubjectCode: sf.syllabusCode,
            suggestedTopicCode: top?.topicCode ?? null,
            suggestedDifficulty: out.suggestedDifficulty,
            suggestedType: out.suggestedQuestionType as any,
            suggestedMetadata: out as any,
            confidenceTopic: top?.confidence ?? null,
          },
        });
        result.tagged++;
      } catch (e: any) {
        result.errors.push({ itemId: item.id, error: String(e?.message ?? e).slice(0, 500) });
      }
    }
    return result;
  }
}
