import { describe, it, expect, vi } from 'vitest';
import { IeltsIngestService } from './ielts-ingest.service';

/** R10 — verify the IELTS ingest writer:
 *   - lazily creates ExamBoard / Subject / Component
 *   - skips Question rows whose sourceRef is already present (idempotent)
 *   - writes rows in the seed-local-mq.ts shape so morning-quiz
 *     pickPassageAndCreatePaper can immediately pool them
 */

function fakePrisma(over: { existingSourceRefs?: Set<string> } = {}): any {
  const existing = over.existingSourceRefs ?? new Set<string>();
  const created: any[] = [];
  let nextId = 1;
  return {
    _created: created,
    examBoard: {
      upsert: vi.fn(async ({ create }: any) => ({ id: 'board1', ...create })),
    },
    subject: {
      upsert: vi.fn(async ({ create }: any) => ({ id: 'subj1', ...create })),
    },
    syllabusComponent: {
      upsert: vi.fn(async ({ create }: any) => ({ id: 'comp1', ...create })),
    },
    question: {
      findFirst: vi.fn(async ({ where }: any) => {
        const ref = where?.sourceRef;
        return existing.has(ref) ? { id: `existing-${ref}` } : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = `q${nextId++}`;
        const row = { id, ...data };
        created.push(row);
        return row;
      }),
    },
  };
}

const ACTOR = { id: 'admin1' };

const sampleInput = {
  bookCode: 'cambridge_ielts_8',
  testNumber: 1,
  passageNumber: 1,
  passage: {
    title: 'A Chronicle of Timekeeping',
    body: 'Our conception of time depends on the way we measure it.\n\nA …\n\nB …',
  },
  questions: [
    {
      n: 1,
      questionType: 'short_answer' as const,
      taskType: 'matching_information',
      instruction: 'Reading Passage 1 has six paragraphs, A–F.',
      stem: 'a description of an early timekeeping invention affected by cold temperatures',
      options: null,
      answer: 'B',
    },
    {
      n: 7,
      questionType: 'mcq' as const,
      taskType: 'yes_no_not_given',
      instruction: 'Do the following statements agree with the views of the writer?',
      stem: 'Atomic clocks have been adopted by every country worldwide.',
      options: [
        { key: 'A', text: 'YES', correct: false },
        { key: 'B', text: 'NO', correct: false },
        { key: 'C', text: 'NOT GIVEN', correct: true },
      ],
      answer: 'C',
    },
  ],
};

describe('IeltsIngestService.ingestPassage', () => {
  it('creates Subject + Component + Question rows on a fresh ingest', async () => {
    const prisma = fakePrisma();
    const svc = new IeltsIngestService(prisma);

    const r = await svc.ingestPassage(sampleInput as any, ACTOR);

    expect(r.created).toBe(2);
    expect(r.skipped).toBe(0);
    expect(r.sourceRefPrefix).toBe('IELTS/cambridge_ielts_8/Test1/P1');
    expect(prisma.examBoard.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.subject.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.syllabusComponent.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.question.create).toHaveBeenCalledTimes(2);
  });

  it('writes content + answerContent + sourceRef in the seed-local-mq shape', async () => {
    const prisma = fakePrisma();
    const svc = new IeltsIngestService(prisma);
    await svc.ingestPassage(sampleInput as any, ACTOR);

    const q1 = prisma._created[0];
    // sourceRef matches pickPassageAndCreatePaper's regex
    expect(q1.sourceRef).toBe('IELTS/cambridge_ielts_8/Test1/P1/Q1');
    expect(q1.sourceRef).toMatch(/^([^/]+\/[^/]+\/Test\d+\/P\d+)\//);
    expect(q1.sourceType).toBe('past_paper_reference');
    expect(q1.provenanceTag).toBe('cambridge_ielts_8_authentic');
    // R10 L5: ingest defaults to draft so a typo can never reach a
    // student before admin sign-off.
    expect(q1.status).toBe('draft');
    expect(q1.questionType).toBe('short_answer');

    // content has passage + passageTitle + taskType + stem
    expect(q1.content.passage).toContain('Our conception of time');
    expect(q1.content.passageTitle).toBe('A Chronicle of Timekeeping');
    expect(q1.content.taskType).toBe('matching_information');
    expect(q1.content.stem).toBe(
      'Reading Passage 1 has six paragraphs, A–F.\n\na description of an early timekeeping invention affected by cold temperatures',
    );

    // answerContent.text is the canonical key for autoGradeScripts
    expect(q1.answerContent).toEqual({ text: 'B' });
    // short_answer has no options
    expect(q1.options).toBeUndefined();
  });

  it('writes MCQ options when present', async () => {
    const prisma = fakePrisma();
    const svc = new IeltsIngestService(prisma);
    await svc.ingestPassage(sampleInput as any, ACTOR);

    const q7 = prisma._created[1];
    expect(q7.questionType).toBe('mcq');
    expect(q7.options).toEqual([
      { key: 'A', text: 'YES', correct: false },
      { key: 'B', text: 'NO', correct: false },
      { key: 'C', text: 'NOT GIVEN', correct: true },
    ]);
    expect(q7.answerContent).toEqual({ text: 'C' });
  });

  it('is idempotent — already-ingested questions are skipped', async () => {
    const existing = new Set([
      'IELTS/cambridge_ielts_8/Test1/P1/Q1',
      'IELTS/cambridge_ielts_8/Test1/P1/Q7',
    ]);
    const prisma = fakePrisma({ existingSourceRefs: existing });
    const svc = new IeltsIngestService(prisma);

    const r = await svc.ingestPassage(sampleInput as any, ACTOR);

    expect(r.created).toBe(0);
    expect(r.skipped).toBe(2);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  it('creates only the missing rows on partial re-ingest', async () => {
    const existing = new Set(['IELTS/cambridge_ielts_8/Test1/P1/Q1']);
    const prisma = fakePrisma({ existingSourceRefs: existing });
    const svc = new IeltsIngestService(prisma);

    const r = await svc.ingestPassage(sampleInput as any, ACTOR);

    expect(r.created).toBe(1);
    expect(r.skipped).toBe(1);
    expect(prisma.question.create).toHaveBeenCalledTimes(1);
  });

  // ───────── R10 L5: approve gate ─────────

  it('approveBySourceRefPrefix promotes draft rows to active', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma: any = {
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'q1', status: 'draft' },
          { id: 'q2', status: 'draft' },
          { id: 'q3', status: 'active' }, // already approved earlier
        ]),
        updateMany,
      },
    };
    const svc = new IeltsIngestService(prisma);
    const r = await svc.approveBySourceRefPrefix(
      'IELTS/cambridge_ielts_8/Test1/P1',
    );
    expect(r.promoted).toBe(2);
    expect(r.alreadyActive).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['q1', 'q2'] } },
      data: { status: 'active' },
    });
  });

  it('approveBySourceRefPrefix is a no-op when all rows already active', async () => {
    const updateMany = vi.fn();
    const prisma: any = {
      question: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'q1', status: 'active' },
          { id: 'q2', status: 'active' },
        ]),
        updateMany,
      },
    };
    const svc = new IeltsIngestService(prisma);
    const r = await svc.approveBySourceRefPrefix(
      'IELTS/cambridge_ielts_8/Test1/P1',
    );
    expect(r.promoted).toBe(0);
    expect(r.alreadyActive).toBe(2);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('approveBySourceRefPrefix rejects malformed prefix', async () => {
    const svc = new IeltsIngestService({} as any);
    await expect(
      svc.approveBySourceRefPrefix('cambridge_ielts_8/Test1/P1'), // missing IELTS/
    ).rejects.toThrow(/bad sourceRefPrefix/);
    await expect(
      svc.approveBySourceRefPrefix('IELTS/cambridge_ielts_8/Test1/P1/Q1'), // too deep
    ).rejects.toThrow(/bad sourceRefPrefix/);
  });
});
