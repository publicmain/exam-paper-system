import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MarkerService } from './marker.service';

// ─────────────────────────── MarkerService.finalize ──────────────────────────
//
// Regression guards for the 2026-05-25 e2e finding: totalScore was inflated
// because manualScore summed ALL non-MCQ scripts (including Path-1 auto-graded
// short answers that were already in autoScore). Fix splits scripts by
// markedById and recomputes autoScore from script state.

const MARKER = { id: 'teacher-1', role: 'teacher', ip: null };

function mockPrisma(opts: {
  scripts: Array<{
    type: 'mcq' | 'short_answer';
    awardedMarks: number | null;
    markedById: string | null;
  }>;
  /** What the row's stale autoScore looked like at finalSubmit time — used to
   *  prove the new logic does NOT trust this value blindly. */
  staleAutoScore?: number;
  subStatus?: string;
  claimStatus?: 'active' | 'released';
  claimMarkerId?: string;
}) {
  const sub = {
    id: 'sub-1',
    status: opts.subStatus ?? 'submitted',
    autoScore: opts.staleAutoScore ?? 0,
    scripts: opts.scripts.map((s, i) => ({
      id: `script-${i}`,
      awardedMarks: s.awardedMarks,
      markedById: s.markedById,
      paperQuestion: { question: { questionType: s.type } },
    })),
  };
  const updateManyArgs: any[] = [];
  return {
    _captured: { updateManyArgs },
    studentSubmission: {
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        if (where.id === 'sub-1') return Promise.resolve(sub);
        return Promise.resolve(null);
      }),
      updateMany: vi.fn().mockImplementation((args: any) => {
        updateManyArgs.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
    markerAssignment: {
      findUnique: vi.fn().mockResolvedValue({
        submissionId: 'sub-1',
        status: opts.claimStatus ?? 'active',
        markerId: opts.claimMarkerId ?? MARKER.id,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    audit: undefined,
  } as any;
}

function makeSvc(prisma: any) {
  // MarkerService takes only prisma; audit is set to a no-op-friendly dummy
  // because finalize doesn't write an audit log directly (the claim+release
  // is the audit trail). The constructor signature in marker.module.ts wires
  // PrismaService only.
  return new MarkerService(prisma);
}

describe('MarkerService.finalize — score accounting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mixed Path-1 auto + marker grading: no double-count (e2e regression)', async () => {
    // Mirrors the 2026-05-25 e2e walkthrough exactly:
    //   13 questions: 9 SA (Q1–9), 4 MCQ (Q10–13)
    //   Q1/2/3/6/7 → Path-1 exact-match auto-graded 1 each (markedById null, awarded 1)
    //   Q4/5 → marker awarded 1 each (markedById = teacher, awarded 1)
    //   Q8/9 → marker awarded 0 each (markedById = teacher, awarded 0)
    //   Q10–13 MCQ → all wrong (markedById null, awarded 0)
    // Correct: 5 (Path-1) + 2 (marker) + 0 (MCQ) = 7 / 13
    // Old behaviour: autoScore (5 stale) + manualScore (7, double-counts Path-1) = 12. WRONG.
    const prisma = mockPrisma({
      staleAutoScore: 5, // what finalSubmit had written (= MCQ 0 + Path-1 SA 5)
      scripts: [
        // Q1–Q3: Path-1 auto-graded short answers
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        // Q4–Q5: marker-graded (correct)
        { type: 'short_answer', awardedMarks: 1, markedById: 'teacher-1' },
        { type: 'short_answer', awardedMarks: 1, markedById: 'teacher-1' },
        // Q6–Q7: Path-1 auto-graded short answers
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        // Q8–Q9: marker-graded (wrong, 0)
        { type: 'short_answer', awardedMarks: 0, markedById: 'teacher-1' },
        { type: 'short_answer', awardedMarks: 0, markedById: 'teacher-1' },
        // Q10–Q13: MCQ all wrong
        { type: 'mcq', awardedMarks: 0, markedById: null },
        { type: 'mcq', awardedMarks: 0, markedById: null },
        { type: 'mcq', awardedMarks: 0, markedById: null },
        { type: 'mcq', awardedMarks: 0, markedById: null },
      ],
    });
    const svc = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    const data = prisma._captured.updateManyArgs[0].data;
    expect(data.autoScore).toBe(5); // 5 Path-1 SA + 0 MCQ — recomputed from scripts, not from stale row
    expect(data.manualScore).toBe(2); // only marker-touched: Q4 + Q5 = 2 (Q8/9 are 0)
    expect(data.totalScore).toBe(7); // NOT 12
    expect(data.status).toBe('marked');
  });

  it('all SA marker-graded, no Path-1 hits: manualScore = sum of marker awards', async () => {
    const prisma = mockPrisma({
      staleAutoScore: 0,
      scripts: [
        { type: 'short_answer', awardedMarks: 1, markedById: 'teacher-1' },
        { type: 'short_answer', awardedMarks: 2, markedById: 'teacher-1' },
        { type: 'mcq', awardedMarks: 1, markedById: null },
        { type: 'mcq', awardedMarks: 0, markedById: null },
      ],
    });
    const svc = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    const data = prisma._captured.updateManyArgs[0].data;
    expect(data.autoScore).toBe(1); // MCQ correct only
    expect(data.manualScore).toBe(3); // 1 + 2
    expect(data.totalScore).toBe(4);
  });

  it('teacher overrides a Path-1 auto-grade: autoScore drops that contribution', async () => {
    // Path-1 awarded 1 for "stoicism" but teacher decides the answer was off
    // (e.g. wrong synonym in context) and overrides to 0. The override sets
    // markedById, so the script moves from the auto bucket to the manual
    // bucket. Both autoScore (recomputed) and manualScore reflect the new
    // truth — no stale 1 stuck in autoScore.
    const prisma = mockPrisma({
      staleAutoScore: 2, // 1 Path-1 SA + 1 MCQ — what finalSubmit wrote
      scripts: [
        // Path-1 SA that teacher overrode to 0
        { type: 'short_answer', awardedMarks: 0, markedById: 'teacher-1' },
        // MCQ correct
        { type: 'mcq', awardedMarks: 1, markedById: null },
      ],
    });
    const svc = makeSvc(prisma);
    await svc.finalize('sub-1', MARKER);
    const data = prisma._captured.updateManyArgs[0].data;
    expect(data.autoScore).toBe(1); // just the MCQ — the overridden SA no longer counts as auto
    expect(data.manualScore).toBe(0); // teacher awarded 0
    expect(data.totalScore).toBe(1);
  });

  it('ungraded SA item present → 400, no DB write', async () => {
    const prisma = mockPrisma({
      scripts: [
        { type: 'short_answer', awardedMarks: 1, markedById: null },
        { type: 'short_answer', awardedMarks: null, markedById: null }, // still pending
        { type: 'mcq', awardedMarks: 1, markedById: null },
      ],
    });
    const svc = makeSvc(prisma);
    await expect(svc.finalize('sub-1', MARKER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.studentSubmission.updateMany).not.toHaveBeenCalled();
  });
});
