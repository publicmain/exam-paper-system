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
      this.client = new Anthropic({ apiKey });
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
    const prompt = `You are a syllabus tagger for an exam paper system.
Given a question, identify which syllabus topics it tests.
Respond ONLY with valid JSON matching this schema:
{
  "topicCandidates": [{"topicCode": "...", "confidence": 0.0-1.0, "reason": "..."}],
  "suggestedDifficulty": 1-5,
  "suggestedQuestionType": "mcq" | "short_answer" | "structured" | "essay",
  "notes": "..."
}

Available topics:
${topicList}

Question stem (LaTeX may be present in $...$):
${input.questionStem}

${input.marks != null ? `Marks: ${input.marks}` : ''}

Return at most 3 topic candidates ordered by confidence.`;

    try {
      const resp = await this.client.messages.create({
        model: this.model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
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
}
