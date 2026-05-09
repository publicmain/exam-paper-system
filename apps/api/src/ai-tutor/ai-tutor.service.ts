import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../common/prisma.service';

// Sonnet pricing (USD per 1M tokens). Mirrors ai-question-generator.service.ts.
// If pricing changes we should bump the constants here AND the question
// generator together — they share the same model.
const PRICE_INPUT_PER_M = 3;
const PRICE_OUTPUT_PER_M = 15;

// Hard ceiling on user input length per chat turn. Prevents a malicious
// student from pasting megabytes of text to drive up token cost in a
// single message before the daily cap can react.
const MAX_STUDENT_MSG_CHARS = 4000;

// Hard ceiling on assistant response. Tutor answers are short paragraphs;
// 800 tokens (~600 words) is plenty and bounds worst-case per-turn spend.
const ASSISTANT_MAX_TOKENS = 800;

// We only feed the most recent N turns of chat history to the model. This
// bounds the input-token cost per turn even if the conversation runs for a
// long time. Older turns stay in the DB for audit but stop contributing
// cost after the window.
const HISTORY_TURNS_WINDOW = 8;

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger('AiTutorService');
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    if (!apiKey || apiKey.startsWith('sk-ant-replace')) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — tutor calls will return stub responses.',
      );
      this.client = null;
    } else {
      // Round-7 H35: explicit retry budget.
      this.client = new Anthropic({ apiKey, maxRetries: 3 });
    }
  }

  /** Per-student daily cap in USD. Pulled from env at every check so an
   *  ops change doesn't require a redeploy. Hard floor of $0 (parses
   *  weird env strings to 0 and refuses any spend). Default $0.50 / day. */
  private dailyCapUsd(): number {
    const raw = process.env.TUTOR_DAILY_USD_PER_STUDENT_CAP;
    if (raw == null || raw === '') return 0.5;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  /** Sum of TutorSession.totalCostUsd for one student since 00:00 UTC today.
   *  Used to gate new chat messages against the daily cap. */
  private async dailySpendForStudent(studentId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const rows: Array<{ totalCostUsd: number }> = await (this.prisma as any).tutorSession.findMany({
      where: { studentId, startedAt: { gte: start } },
      select: { totalCostUsd: true },
    });
    return rows.reduce((acc, r) => acc + (r.totalCostUsd ?? 0), 0);
  }

  // ------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------

  /** Student creates a new tutor session. Validates that the
   *  submission (if supplied) belongs to them and that the
   *  paperQuestion (if supplied) belongs to that submission's paper.
   *  Without the cross-check, a student could probe foreign submission
   *  / paperQuestion ids for existence. */
  async createSession(
    body: { submissionId?: string | null; paperQuestionId?: string | null },
    student: ActorCtx,
  ) {
    if (student.role !== 'student') {
      throw new ForbiddenException('student-only route');
    }

    let submissionId: string | null = body.submissionId ?? null;
    let paperQuestionId: string | null = body.paperQuestionId ?? null;

    if (submissionId) {
      const sub = await this.prisma.studentSubmission.findUnique({
        where: { id: submissionId },
        include: { assignment: { select: { paperId: true } } },
      });
      if (!sub) throw new NotFoundException('submission not found');
      if (sub.studentId !== student.id) {
        // 404 not 403: we don't want to confirm existence of foreign
        // submission ids to a probing student.
        throw new NotFoundException('submission not found');
      }
      if (paperQuestionId) {
        const pq = await this.prisma.paperQuestion.findFirst({
          where: { id: paperQuestionId, paperId: sub.assignment.paperId },
          select: { id: true },
        });
        if (!pq) {
          throw new NotFoundException('paperQuestion does not belong to this submission');
        }
      }
    } else if (paperQuestionId) {
      // Without a submission anchor, the student could request any
      // paperQuestion id — and the tutor would happily explain it,
      // leaking question content from papers they're not enrolled in.
      // Refuse: a tutor session must always be tied to a submission the
      // student owns.
      throw new BadRequestException('paperQuestionId requires submissionId');
    }

    return (this.prisma as any).tutorSession.create({
      data: {
        studentId: student.id,
        submissionId,
        paperQuestionId,
      },
    });
  }

  /** Student or admin reads full session detail (messages included). */
  async getSession(sessionId: string, actor: ActorCtx) {
    const session = await (this.prisma as any).tutorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('session not found');
    if (actor.role === 'student') {
      if (session.studentId !== actor.id) {
        throw new ForbiddenException('not your session');
      }
    } else if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException('insufficient role');
    }
    // Sanitize messages: never return costUsd to a student. Admins see
    // it for the audit view.
    if (actor.role === 'student') {
      return {
        ...session,
        messages: (session.messages ?? []).map((m: any) => {
          const { costUsd, ...rest } = m;
          return rest;
        }),
      };
    }
    return session;
  }

  // ------------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------------

  /** Student appends a message to a session. We:
   *   1. Verify ownership and the daily cap.
   *   2. Persist the student turn.
   *   3. Build a system prompt that includes the question stem +
   *      student's submitted answer + (if available) the markScheme.
   *      The markScheme is *system-only* context — the user-facing
   *      reply must not reproduce it verbatim.
   *   4. Call Claude (or stub).
   *   5. Persist assistant turn with costUsd, bump session totalCostUsd.
   *
   *   Returns the assistant message (without costUsd) plus the running
   *   session.totalCostUsd is recomputed and surfaced so the UI can show
   *   "you have used $X.XX of $0.50 today" — we DO leak the daily-cap
   *   total to the student because they need it to self-pace, but
   *   per-message costs stay admin-only.
   */
  async appendMessage(sessionId: string, body: { content: string }, student: ActorCtx) {
    if (student.role !== 'student') {
      throw new ForbiddenException('student-only route');
    }
    const content = (body?.content ?? '').toString();
    if (!content.trim()) {
      throw new BadRequestException('content is required');
    }
    if (content.length > MAX_STUDENT_MSG_CHARS) {
      throw new BadRequestException(
        `content too long (max ${MAX_STUDENT_MSG_CHARS} chars)`,
      );
    }

    const session = await (this.prisma as any).tutorSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: HISTORY_TURNS_WINDOW * 2 + 1, // student+assistant pairs
        },
      },
    });
    if (!session) throw new NotFoundException('session not found');
    if (session.studentId !== student.id) {
      throw new ForbiddenException('not your session');
    }
    if (session.endedAt) {
      throw new BadRequestException('session is closed');
    }

    // ---- Cost gate: per-student daily cap --------------------------
    const cap = this.dailyCapUsd();
    const spentToday = await this.dailySpendForStudent(student.id);
    if (cap > 0 && spentToday >= cap) {
      // 429 keeps the UI's "rate-limited" paths clean. Body explains.
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'daily AI tutor budget reached',
          spentUsd: Number(spentToday.toFixed(4)),
          capUsd: cap,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ---- Persist student turn --------------------------------------
    const studentMsg = await (this.prisma as any).tutorMessage.create({
      data: { sessionId, role: 'student', content },
    });

    // ---- Build system context (server-side ONLY uses markScheme) ---
    const ctx = await this.loadQuestionContext(session);

    // ---- Call Claude (or stub) -------------------------------------
    const { reply, costUsd } = await this.askClaude({
      historyMessages: session.messages ?? [],
      latestStudent: content,
      ctx,
    });

    // ---- Persist assistant turn + bump session total ---------------
    const safeReply = this.scrubLeakedMarkScheme(reply, ctx.markSchemeText);
    const assistantMsg = await (this.prisma as any).tutorMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: safeReply,
        costUsd,
      },
    });
    const updated = await (this.prisma as any).tutorSession.update({
      where: { id: sessionId },
      data: { totalCostUsd: { increment: costUsd } },
      select: { id: true, totalCostUsd: true },
    });

    this.logger.log(
      `tutor msg session=${sessionId} student=${student.id} cost=$${costUsd.toFixed(
        4,
      )} dailySpent=$${(spentToday + costUsd).toFixed(4)} cap=$${cap.toFixed(2)}`,
    );

    return {
      studentMessage: { id: studentMsg.id, role: 'student', content, createdAt: studentMsg.createdAt },
      assistantMessage: {
        id: assistantMsg.id,
        role: 'assistant',
        content: safeReply,
        createdAt: assistantMsg.createdAt,
        // costUsd intentionally omitted from student-facing payload.
      },
      session: {
        id: updated.id,
        totalCostUsd: Number((updated.totalCostUsd ?? 0).toFixed(4)),
      },
      dailyCap: {
        spentUsd: Number((spentToday + costUsd).toFixed(4)),
        capUsd: cap,
      },
    };
  }

  // ------------------------------------------------------------------
  // Admin: usage rollup
  // ------------------------------------------------------------------
  /** Sum cost across all sessions in a window. Admin-only. */
  async usage(args: { from?: string; to?: string }, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException('admin or head_teacher only');
    }
    const where: any = {};
    if (args.from || args.to) {
      where.startedAt = {};
      if (args.from) where.startedAt.gte = new Date(args.from);
      if (args.to) where.startedAt.lte = new Date(args.to);
    }
    const sessions: Array<{ id: string; studentId: string; totalCostUsd: number; startedAt: Date }>
      = await (this.prisma as any).tutorSession.findMany({
        where,
        select: { id: true, studentId: true, totalCostUsd: true, startedAt: true },
      });
    const total = sessions.reduce((acc, s) => acc + (s.totalCostUsd ?? 0), 0);
    const perStudent = new Map<string, number>();
    for (const s of sessions) {
      perStudent.set(s.studentId, (perStudent.get(s.studentId) ?? 0) + (s.totalCostUsd ?? 0));
    }
    return {
      from: args.from ?? null,
      to: args.to ?? null,
      sessionCount: sessions.length,
      totalUsd: Number(total.toFixed(4)),
      perStudent: Array.from(perStudent.entries())
        .map(([studentId, usd]) => ({ studentId, usd: Number(usd.toFixed(4)) }))
        .sort((a, b) => b.usd - a.usd),
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Load the paperQuestion stem, the student's submitted answer for that
   *  question (if any), and the markScheme/answer key text. Strictly
   *  server-side — the markScheme is fed to the model as system context
   *  but must not be reproduced verbatim in the assistant's reply
   *  (system prompt explicitly forbids it; scrubLeakedMarkScheme is a
   *  belt-and-braces post-filter). */
  private async loadQuestionContext(session: any): Promise<{
    stem: string | null;
    studentAnswer: string | null;
    markSchemeText: string | null;
  }> {
    if (!session.paperQuestionId) {
      return { stem: null, studentAnswer: null, markSchemeText: null };
    }
    const pq = await this.prisma.paperQuestion.findUnique({
      where: { id: session.paperQuestionId },
      include: { question: true },
    });
    if (!pq) return { stem: null, studentAnswer: null, markSchemeText: null };

    const snapshot: any = pq.snapshotContent ?? {};
    const stem: string =
      (typeof snapshot.stem === 'string' && snapshot.stem) ||
      (pq.question?.content as any)?.stem ||
      '';

    const markSchemeText = this.formatMarkScheme(
      pq.question?.markScheme ?? null,
      pq.question?.answerContent ?? null,
      snapshot,
    );

    let studentAnswer: string | null = null;
    if (session.submissionId) {
      const script = await this.prisma.answerScript.findUnique({
        where: {
          submissionId_paperQuestionId: {
            submissionId: session.submissionId,
            paperQuestionId: session.paperQuestionId,
          },
        },
      });
      if (script) {
        studentAnswer = script.textAnswer ?? script.selectedOption ?? null;
      }
    }

    return { stem, studentAnswer, markSchemeText };
  }

  /** Flatten a markScheme JSON blob into plain text for the system prompt.
   *  We accept several shapes the schema allows. */
  private formatMarkScheme(markScheme: any, answerContent: any, snapshot: any): string | null {
    const parts: string[] = [];
    if (Array.isArray(markScheme)) {
      for (const m of markScheme) {
        if (m && typeof m.point === 'string') {
          parts.push(`- ${m.point}${typeof m.marks === 'number' ? ` [${m.marks} marks]` : ''}`);
        }
      }
    } else if (markScheme && typeof markScheme === 'object') {
      try { parts.push(JSON.stringify(markScheme)); } catch { /* ignore */ }
    }
    if (answerContent && typeof answerContent === 'object') {
      const ac: any = answerContent;
      if (typeof ac.text === 'string') parts.push(`Final answer: ${ac.text}`);
      if (Array.isArray(ac.parts)) {
        for (const p of ac.parts) {
          if (p && typeof p.answer === 'string') {
            parts.push(`(${p.label ?? ''}) ${p.answer}`);
          }
        }
      }
    }
    if (snapshot && typeof snapshot === 'object') {
      const sn: any = snapshot;
      if (typeof sn.markScheme === 'string') parts.push(sn.markScheme);
      if (typeof sn.answer === 'string') parts.push(`Final answer: ${sn.answer}`);
    }
    if (parts.length === 0) return null;
    return parts.join('\n');
  }

  /** Belt-and-braces filter: if the assistant returned a long verbatim
   *  substring of the markScheme we substitute a placeholder. The system
   *  prompt asks Claude not to copy-paste the mark scheme; this catches
   *  the rare case where it does anyway. */
  private scrubLeakedMarkScheme(reply: string, markSchemeText: string | null): string {
    if (!markSchemeText) return reply;
    // Compare line-by-line on stripped lines >= 40 chars (short shared
    // phrasing like "Final answer:" is fine; long shared sentences are
    // suspicious). 40 is empirical: shorter than a typical mark-scheme
    // bullet, longer than a sentence fragment.
    const msLines = markSchemeText.split('\n').map((l) => l.trim()).filter((l) => l.length >= 40);
    if (msLines.length === 0) return reply;
    let out = reply;
    for (const line of msLines) {
      if (out.includes(line)) {
        out = out.split(line).join('[mark scheme detail omitted — explain in your own words]');
      }
    }
    return out;
  }

  /** Send the conversation to Claude. Returns the reply text and the
   *  USD cost computed from token usage. If ANTHROPIC_API_KEY is not
   *  configured we return a deterministic stub at zero cost (used in
   *  the test harness). */
  private async askClaude(args: {
    historyMessages: Array<{ role: string; content: string }>;
    latestStudent: string;
    ctx: { stem: string | null; studentAnswer: string | null; markSchemeText: string | null };
  }): Promise<{ reply: string; costUsd: number }> {
    const systemHeader = `You are a friendly AI tutor for a high-school student reviewing an exam paper they have just submitted.

GROUND RULES — non-negotiable:
- Explain the underlying concept first, then walk through how to derive the correct solution step by step.
- After explaining, quiz the student with ONE related practice problem (do not solve it).
- Be encouraging. Praise honest effort; do not shame wrong answers.
- DO NOT copy the mark-scheme text verbatim. Paraphrase it in your own words.
- DO NOT reveal the mark scheme as a block of text labelled "mark scheme" — explain the reasoning instead.
- Answer ONLY questions about THIS paperQuestion or directly-related concepts. If the student asks about anything else (homework for another subject, personal advice, etc.) politely redirect them.
- Keep replies under ~250 words.`;

    const ctxBlock: string[] = [];
    if (args.ctx.stem) {
      ctxBlock.push(`QUESTION:\n${args.ctx.stem}`);
    }
    if (args.ctx.studentAnswer) {
      ctxBlock.push(`STUDENT'S SUBMITTED ANSWER:\n${args.ctx.studentAnswer}`);
    } else if (args.ctx.stem) {
      ctxBlock.push(`STUDENT'S SUBMITTED ANSWER: (left blank)`);
    }
    if (args.ctx.markSchemeText) {
      // Server-side only — see scrubLeakedMarkScheme.
      ctxBlock.push(
        `INTERNAL MARK SCHEME (DO NOT COPY VERBATIM, DO NOT QUOTE; use only as a guide for the correct reasoning):\n${args.ctx.markSchemeText}`,
      );
    }

    if (!this.client) {
      // Stub mode: pretend to tutor, charge $0. Used by tests / dev.
      const stub = args.ctx.stem
        ? `Let's review this question together. The key concept here is the one tested by the question stem above. Can you walk me through what you tried? (Stub response — ANTHROPIC_API_KEY not configured.)`
        : `Hi! Tell me which question you'd like help with. (Stub response — ANTHROPIC_API_KEY not configured.)`;
      return { reply: stub, costUsd: 0 };
    }

    // Trim history to the configured window. Map roles into Anthropic's
    // user/assistant alternation. Tutor messages we stored as 'student'
    // become role 'user' (Anthropic doesn't have a 'student' role).
    const trimmed = (args.historyMessages ?? []).slice(-(HISTORY_TURNS_WINDOW * 2));
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const m of trimmed) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    messages.push({ role: 'user', content: args.latestStudent });

    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: ASSISTANT_MAX_TOKENS,
      system: [
        { type: 'text', text: systemHeader },
        // Cache the per-question context — many turns of the same chat
        // re-use it. Anthropic charges the cached portion at ~10% of
        // input price after the first call.
        ...(ctxBlock.length > 0
          ? [{ type: 'text', text: ctxBlock.join('\n\n'), cache_control: { type: 'ephemeral' } }]
          : []),
      ] as any,
      messages,
    });
    const text = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    const inputTokens = resp.usage?.input_tokens ?? 0;
    const outputTokens = resp.usage?.output_tokens ?? 0;
    const costUsd =
      (inputTokens * PRICE_INPUT_PER_M + outputTokens * PRICE_OUTPUT_PER_M) / 1_000_000;

    return { reply: text || '(no response)', costUsd };
  }
}
