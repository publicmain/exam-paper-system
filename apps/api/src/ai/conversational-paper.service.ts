import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  QuickPaperInput,
  QuickPaperService,
  QuickPaperResult,
  QuickPaperTopic,
} from './quick-paper.service';

/**
 * R16: natural-language Quick Paper entry point.
 *
 * Teacher types a free-text description like:
 *   "4024 OL.4, 重点二次函数图像和零点, 5 题, 难度 3-4, 要图, 约 40 分钟"
 * and the service:
 *   1) calls Claude (haiku, fast/cheap) to parse the text into a strict
 *      QuickPaperInput shape
 *   2) validates the parsed topics against the syllabus's real topic
 *      taxonomy in the DB (so an AI hallucinated "OL.13" can't crash the
 *      downstream generate call)
 *   3) hands the validated spec to QuickPaperService.generate, which
 *      runs the existing author → audit → diagram → assemble pipeline
 *
 * Why a separate service:
 *   - keeps QuickPaperService focused on assembly; this layer is purely
 *     "NL → spec"
 *   - uses haiku (~10× cheaper than sonnet) for the parse step; sonnet
 *     stays on the actual question-authoring call
 *   - logs the interpretation to AuditLog so we can debug "the teacher
 *     said X but the paper had Y" complaints by replaying the parse
 *
 * v0 is single-shot: one description → one paper. Multi-turn ("re-gen
 * Q2 harder", "add 3 more on circles") layers cleanly on top later by
 * making this service stateful — kept out of scope for the first ship.
 */

const PARSE_MODEL_DEFAULT = 'claude-haiku-4-5';

/** Strict shape Claude must emit. We then map it to QuickPaperInput. */
interface ParsedSpec {
  topics: Array<{ code: string; count: number }>;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  includeDiagrams?: boolean;
  weeklyFocus?: string;
  multiPart?: boolean;
  paperName?: string;
  durationMin?: number;
  /** Set by Claude when it gives up parsing; surfaced verbatim to teacher. */
  error?: string;
}

export interface ConversationalGenerateInput {
  syllabusCode: string;
  /** Free-text description from the teacher. */
  message: string;
  classLabel?: string | null;
}

export interface ConversationalGenerateResult extends QuickPaperResult {
  /** Echo of the spec Claude parsed out of the message, so the teacher
   *  can see what the system thought they asked for. */
  interpreted: {
    topics: QuickPaperTopic[];
    difficulty: number | null;
    includeDiagrams: boolean;
    weeklyFocus: string | null;
    multiPart: boolean;
    parseCostUsd: number;
    parseModel: string;
  };
}

@Injectable()
export class ConversationalPaperService {
  private readonly logger = new Logger('ConversationalPaper');
  private readonly client: Anthropic | null;
  private readonly parseModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quickPaper: QuickPaperService,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.parseModel = process.env.ANTHROPIC_PARSE_MODEL || PARSE_MODEL_DEFAULT;
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.client = null;
    } else {
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  async generateFromMessage(
    input: ConversationalGenerateInput,
    actor: { id: string; role: string; ip?: string | null },
  ): Promise<ConversationalGenerateResult> {
    if (!this.client) {
      throw new ServiceUnavailableException('ANTHROPIC_API_KEY not configured.');
    }
    const message = (input.message ?? '').trim();
    if (message.length < 3) {
      throw new BadRequestException('Message is too short to interpret.');
    }
    if (message.length > 2000) {
      throw new BadRequestException('Message is too long (>2000 chars).');
    }

    const topics = await this.loadAllowedTopics(input.syllabusCode);
    if (topics.length === 0) {
      throw new BadRequestException(
        `Syllabus '${input.syllabusCode}' has no topics seeded; cannot interpret.`,
      );
    }

    const { spec, parseCostUsd } = await this.interpretMessage(
      input.syllabusCode,
      message,
      topics,
    );
    if (spec.error) {
      throw new BadRequestException(`Cannot interpret: ${spec.error}`);
    }

    const validatedTopics = this.validateTopics(spec.topics, topics);
    if (validatedTopics.length === 0) {
      throw new BadRequestException(
        'Parsed spec contained no recognisable topics for this syllabus.',
      );
    }

    const quickInput: QuickPaperInput = {
      syllabusCode: input.syllabusCode,
      topics: validatedTopics,
      durationMin: spec.durationMin,
      includeDiagrams: spec.includeDiagrams ?? true,
      difficulty: spec.difficulty,
      multiPart: spec.multiPart ?? true,
      paperName: spec.paperName,
      classLabel: input.classLabel ?? undefined,
      weeklyFocus: spec.weeklyFocus ?? null,
    };

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'ai.chat_paper.interpret',
      entityType: 'chat_paper_request',
      entityId: `chat-${Date.now()}`,
      metadata: {
        syllabusCode: input.syllabusCode,
        message: message.slice(0, 500),
        parsedSpec: spec,
        validatedTopics,
        parseCostUsd: Math.round(parseCostUsd * 10000) / 10000,
        parseModel: this.parseModel,
      },
      ip: actor.ip ?? null,
    });

    const result = await this.quickPaper.generate(quickInput, actor);

    return {
      ...result,
      interpreted: {
        topics: validatedTopics,
        difficulty: spec.difficulty ?? null,
        includeDiagrams: spec.includeDiagrams ?? true,
        weeklyFocus: spec.weeklyFocus ?? null,
        multiPart: spec.multiPart ?? true,
        parseCostUsd: Math.round(parseCostUsd * 10000) / 10000,
        parseModel: this.parseModel,
      },
    };
  }

  /** Fetch the syllabus's topic taxonomy, so we can (a) ground Claude in
   *  the real list of allowed codes and (b) reject hallucinated codes
   *  before they reach the generator. */
  private async loadAllowedTopics(
    syllabusCode: string,
  ): Promise<Array<{ code: string; name: string }>> {
    const subject = await this.prisma.subject.findFirst({
      where: { code: syllabusCode },
      include: { components: { include: { topics: true } } },
    });
    if (!subject) return [];
    const map = new Map<string, string>();
    for (const c of subject.components) {
      for (const t of c.topics) {
        if (!map.has(t.code)) map.set(t.code, t.name);
      }
    }
    return [...map.entries()].map(([code, name]) => ({ code, name }));
  }

  /** Conservative validation: drop any topic whose code isn't in the
   *  syllabus's taxonomy, clamp counts to 1..10, cap total to 30 to
   *  match QuickPaperService's own gates. */
  private validateTopics(
    parsed: Array<{ code: string; count: number }>,
    allowed: Array<{ code: string; name: string }>,
  ): QuickPaperTopic[] {
    const allowedCodes = new Set(allowed.map((t) => t.code));
    const seen = new Set<string>();
    const out: QuickPaperTopic[] = [];
    let total = 0;
    for (const t of parsed ?? []) {
      const code = String(t?.code ?? '').trim();
      const count = Math.max(1, Math.min(10, Math.round(Number(t?.count ?? 0))));
      if (!code || !allowedCodes.has(code) || seen.has(code) || count <= 0) continue;
      if (total + count > 30) break;
      out.push({ code, count });
      total += count;
      seen.add(code);
    }
    return out;
  }

  private async interpretMessage(
    syllabusCode: string,
    message: string,
    topics: Array<{ code: string; name: string }>,
  ): Promise<{ spec: ParsedSpec; parseCostUsd: number }> {
    const topicList = topics.map((t) => `- ${t.code}: ${t.name}`).join('\n');
    const system = [
      'You are a strict JSON-emitting parser for a school exam-paper generator.',
      'A teacher will describe an exam paper they want; you extract a JSON spec.',
      'You NEVER answer the math question itself; you ONLY plan the paper.',
      '',
      `Syllabus: CIE ${syllabusCode}.`,
      'Allowed topic codes (use these exact codes — do NOT invent new ones):',
      topicList,
      '',
      'Output STRICT JSON only — no commentary, no markdown fence. Shape:',
      '{',
      '  "topics": [ { "code": "OL.4", "count": 5 } ],   // required, 1..30 questions total across topics',
      '  "difficulty": 3,                                  // optional 1..5; "中等"≈3, "较难"≈4, "难"≈5',
      '  "includeDiagrams": true,                          // optional, default true; "无图"/"不要图" → false',
      '  "weeklyFocus": "二次函数图像 + 零点",               // optional — verbatim emphasis phrases the teacher mentioned',
      '  "multiPart": true,                                // optional, default true',
      '  "paperName": "...",                               // optional, leave unset to let the system name it',
      '  "durationMin": 40                                 // optional, derive from the teacher message "约 X 分钟"; otherwise unset',
      '}',
      '',
      'Rules:',
      '- If the teacher describes multiple sections, emit multiple topics; e.g. "2 道二次函数 + 3 道概率" → two entries.',
      '- Map natural-language difficulty words: 简单/易=1, 基础=2, 中等/标准=3, 较难=4, 极难/奥赛=5.',
      '- Map "本周重点 X" / "重点 X" / "focus on X" / "强化 X" into weeklyFocus verbatim.',
      '- If teacher mentions "不出图" / "无图" / "no diagram", set includeDiagrams: false.',
      '- If you cannot determine ANY topic, output { "error": "human-readable Chinese reason" } and nothing else.',
      '- Never invent a topic code that is not in the allowed list above; if no listed topic matches, prefer "error".',
    ].join('\n');

    const t0 = Date.now();
    const resp = await this.client!.messages.create({
      model: this.parseModel,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: message }],
    });
    const text = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    const elapsedMs = Date.now() - t0;

    // Haiku 4.5 published pricing (subject to change). We log the
    // estimate rather than the exact spend; the AnthropicSDK does not
    // return $ directly on messages.create. Order of magnitude is fine
    // since this call is dominated by sonnet on generate downstream.
    const inputTokens = resp.usage.input_tokens ?? 0;
    const outputTokens = resp.usage.output_tokens ?? 0;
    const parseCostUsd =
      (inputTokens * 1.0 + outputTokens * 5.0) / 1_000_000;

    let spec: ParsedSpec;
    try {
      const cleaned = stripFenceIfPresent(text);
      spec = JSON.parse(cleaned) as ParsedSpec;
    } catch (e: any) {
      throw new ServiceUnavailableException(
        `Failed to parse chat-paper spec from Claude: ${e.message?.slice(0, 200)}`,
      );
    }

    this.logger.log(
      `chat-paper interpret ok syllabus=${syllabusCode} ` +
        `topics=${spec.topics?.length ?? 0} ` +
        `cost=$${parseCostUsd.toFixed(5)} elapsed=${elapsedMs}ms`,
    );
    return { spec, parseCostUsd };
  }
}

function stripFenceIfPresent(text: string): string {
  const m = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
  return (m ? m[1] : text).trim();
}
