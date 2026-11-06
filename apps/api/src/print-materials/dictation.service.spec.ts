import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { DictationService } from './dictation.service';
import { DictationController, EntrySchema } from './dictation.controller';
import { AuditService } from '../audit/audit.service';
import { memoryPrisma } from '../vocab-v2/testing/memory-prisma';
import { dateOnly } from '../common/school-calendar';
import { VocabularyMemoryService } from '../vocab-v2/vocabulary-memory.service';

const teacher = { id: 'teacher', role: 'teacher' };
const entry = (requestId = 'request_0001', wrongSenseIds: string[] = []) => ({ requestId, status: 'entered' as const, wrongSenseIds });
function fixture() {
  const db = memoryPrisma();
  db.seed('class', { id: 'class', name: '演示班' });
  db.seed('classEnrollment', { classId: 'class', userId: 'teacher', role: 'subject_teacher' });
  for (const id of ['one', 'two', 'empty']) {
    db.seed('user', { id, email: `${id}@example.invalid`, name: id });
    db.seed('classEnrollment', { classId: 'class', userId: id, role: 'student' });
    db.seed('vocabularyV2Session', { id: `daily_${id}`, studentId: id, sessionKey: `v2:${id}:2026-11-04:daily`, status: 'in_progress' });
    if (id === 'empty') continue;
    for (const [index, status] of ['completed', 'completed', 'pending', 'skipped'].entries()) db.seed('vocabularyV2SessionItem', {
      id: `${id}_${index}`, sessionId: `daily_${id}`, senseId: `sense_${index}`, position: index + 1, status,
      contentSnapshot: { headword: `word${index}`, translation: `中文${index}` },
    });
    // Completed but not printable must not enter the frozen list.
    db.seed('vocabularyV2SessionItem', { id: `${id}_invalid`, sessionId: `daily_${id}`, senseId: 'invalid', position: 8, status: 'completed', contentSnapshot: {} });
  }
  const svc = new DictationService(db as any, new AuditService(db as any), new VocabularyMemoryService(db as any));
  const generate = () => svc.generate(teacher, 'class', '2026-11-04', '2026-11-05');
  return { db, svc, generate };
}
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-05T01:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('纸笔默写冻结与回填（内存事务，不连库）', () => {
  it('只读打开不生成；每人冻结实际完成且可打印的词，未录入不写记录', async () => {
    const { db, svc, generate } = fixture();
    expect((await svc.get(teacher, 'class')).sheet).toBeNull();
    const data = await generate();
    expect(data.sheet!.rows).toHaveLength(3);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0]).toMatchObject({ senseIds: ['sense_0', 'sense_1'], status: 'pending' });
    expect(db.rows('dictationSheetRow', { studentId: 'empty' })[0].senseIds).toEqual([]);
    expect(db.rows('learningEvidence')).toEqual([]);
  });
  it('并发生成只保留一张；之后学新词、改词库、再次生成不会扩充或覆盖回填', async () => {
    const { db, svc, generate } = fixture();
    const [a, b] = await Promise.all([generate(), generate()]);
    expect(a.sheet!.id).toBe(b.sheet!.id);
    expect(db.rows('dictationSheet')).toHaveLength(1);
    db.seed('vocabularySense', { id: 'sense_0', lexemeId: 'lexeme', senseKey: 'noun:01', pos: 'noun', translation: '后来改的词库' });
    await svc.save(teacher, 'class', a.sheet!.id, 'one', entry());
    await db.vocabularyV2SessionItem.update({ where: { id: 'one_2' }, data: { status: 'completed' } });
    const again = await generate();
    expect(again.sheet!.rows.find((r) => r.studentId === 'one')).toMatchObject({ status: 'entered', words: [{ senseId: 'sense_0' }, { senseId: 'sense_1' }] });
    expect(again.sheet!.rows.find((r) => r.studentId === 'one')!.words[0].translation).toBe('中文0');
    expect(db.rows('auditLog', { action: 'dictation.generated' })).toHaveLength(1);
    expect(db.rows('learningEvidence')).toHaveLength(2);
  });
  it('默认全对；勾错；缺考为 null；最后改录生效并保留旧记录', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await svc.save(teacher, 'class', sheet.id, 'one', entry());
    await svc.save(teacher, 'class', sheet.id, 'one', entry('request_0002', ['sense_1']));
    await svc.save(teacher, 'class', sheet.id, 'one', { ...entry('request_0003'), status: 'absent' });
    await svc.save(teacher, 'class', sheet.id, 'one', entry('request_0004'));
    const records = db.rows('learningEvidence');
    expect(records.map((r) => r.isCorrect)).toEqual([true, true, true, false, null, null, true, true]);
    expect(new Set(records.map((r) => r.sourceKey)).size).toBe(8);
    expect(records[4].detail.absent).toBe(true);
    expect(records[2].detail.supersedesVersion).toBe(records[0].detail.version);
    for (const r of records) expect(r).toMatchObject({ kind: 'paper_dictation', subject: 'vocab_sense', schoolDate: dateOnly('2026-11-05'), recordedById: 'teacher' });
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0]).toMatchObject({ status: 'entered', wrongSenseIds: [], enteredById: 'teacher' });
  });
  it('同一请求并发/重试只写一次，旧请求重放不覆盖后来改录；复用编号改内容拒绝', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await Promise.all([1, 2, 3].map(() => svc.save(teacher, 'class', sheet.id, 'one', entry())));
    expect(db.rows('learningEvidence')).toHaveLength(2);
    await svc.save(teacher, 'class', sheet.id, 'one', entry('request_0002', ['sense_0']));
    await svc.save(teacher, 'class', sheet.id, 'one', entry());
    expect(db.rows('learningEvidence')).toHaveLength(4);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].wrongSenseIds).toEqual(['sense_0']);
    await expect(svc.save(teacher, 'class', sheet.id, 'one', entry('request_0001', ['sense_0']))).rejects.toMatchObject({ status: 409 });
  });
  it('不同请求并发改录逐次保留，版本严格递增', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await Promise.all([svc.save(teacher, 'class', sheet.id, 'one', entry()), svc.save(teacher, 'class', sheet.id, 'one', entry('request_0002', ['sense_1']))]);
    const records = db.rows('learningEvidence');
    expect(records).toHaveLength(4);
    const versions = [...new Set(records.map((r) => r.detail.version))].sort();
    expect(versions).toHaveLength(2);
    expect(versions[1] > versions[0]).toBe(true);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].enteredAt.toISOString()).toBe(versions[1]);
    expect(db.rows('studentVocabularySense', { studentId: 'one' }).map((row) => row.reps)).toEqual([1, 1]);
  });
  it('一键仅处理尚未录入且有词的学生，保留错词/缺考，批量重试不写新记录', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await svc.save(teacher, 'class', sheet.id, 'one', { ...entry(), status: 'absent' });
    await Promise.all([1, 2].map(() => svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))));
    expect(db.rows('learningEvidence')).toHaveLength(4);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('absent');
    expect(db.rows('dictationSheetRow', { studentId: 'two' })[0].status).toBe('entered');
    expect(db.rows('dictationSheetRow', { studentId: 'empty' })[0].status).toBe('pending');
    expect(db.rows('studentVocabularySense', { studentId: 'one' })).toEqual([]);
    expect(db.rows('studentVocabularySense', { studentId: 'two' }).map((row) => row.reps)).toEqual([1, 1]);
  });
  it('并发批量与个人改录不会丢失错词', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await Promise.all([svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001')), svc.save(teacher, 'class', sheet.id, 'one', entry('single_001', ['sense_1']))]);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0]).toMatchObject({ status: 'entered', wrongSenseIds: ['sense_1'] });
  });
  it('无词行重复保存也幂等；错误词越界/缺考带错词拒绝', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await Promise.all([1, 2].map(() => svc.save(teacher, 'class', sheet.id, 'empty', entry())));
    expect(db.rows('auditLog', { action: 'dictation.row_saved' })).toHaveLength(1);
    expect(db.rows('learningEvidence')).toEqual([]);
    for (const input of [entry('request_0002', ['other']), { ...entry('request_0003', ['sense_0']), status: 'absent' as const }])
      await expect(svc.save(teacher, 'class', sheet.id, 'one', input)).rejects.toMatchObject({ status: 400 });
  });
  it('同班任课/班主任可用；跨班、学生、伪造单号/学生均拒绝且不写', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    for (const actor of [{ id: 'other', role: 'teacher' }, { id: 'one', role: 'student' }]) {
      await expect(svc.get(actor, 'class')).rejects.toMatchObject({ status: 403 });
      await expect(svc.generate(actor, 'class')).rejects.toMatchObject({ status: 403 });
      await expect(svc.save(actor, 'class', sheet.id, 'one', entry())).rejects.toMatchObject({ status: 403 });
    }
    await db.classEnrollment.update({ where: { classId_userId: { classId: 'class', userId: 'teacher' } }, data: { role: 'class_teacher' } });
    expect((await svc.get(teacher, 'class')).sheet).not.toBeNull();
    for (const role of ['admin', 'head_teacher']) expect((await svc.get({ id: role, role }, 'class')).sheet).not.toBeNull();
    await expect(svc.save(teacher, 'class', 'other_sheet', 'one', entry())).rejects.toMatchObject({ status: 404 });
    await expect(svc.save(teacher, 'class', sheet.id, 'outsider', entry())).rejects.toMatchObject({ status: 404 });
    expect(db.rows('learningEvidence')).toEqual([]);
  });
  it('上个教学日跳过周末、连续停课、跨月；既有单保持原默写日', async () => {
    const { db, svc, generate } = fixture();
    for (const date of ['2026-11-02', '2026-11-03', '2026-11-04']) db.seed('classNoSchoolDay', { classId: 'class', date: dateOnly(date) });
    expect((await svc.get(teacher, 'class')).learnedDate).toBe('2026-10-30');
    await generate();
    vi.setSystemTime(new Date('2026-11-06T01:00:00Z'));
    expect((await svc.generate(teacher, 'class', '2026-11-04', '2026-11-06')).heldOn).toBe('2026-11-05');
  });
  it('非法/未来日期拒绝；新加坡日界使用本地日期', async () => {
    const { svc } = fixture();
    for (const [learned, held] of [['2026-02-30', '2026-11-05'], ['2026-11-06', '2026-11-05'], ['2026-11-04', '2026-11-06']])
      await expect(svc.generate(teacher, 'class', learned, held)).rejects.toMatchObject({ status: 400 });
    vi.setSystemTime(new Date('2026-11-05T16:00:00Z'));
    expect((await svc.get(teacher, 'class')).heldOn).toBe('2026-11-06');
  });
  it('写记录或审计失败时整次保存回滚，原请求可重试', async () => {
    for (const model of ['learningEvidence', 'auditLog']) {
      const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
      const transaction = db.$transaction.bind(db);
      db.$transaction = ((run: any, opts: any) => transaction(async (tx: any) => {
        tx[model][model === 'auditLog' ? 'create' : 'createMany'] = async () => { throw new Error('write failed'); };
        return run(tx);
      }, opts)) as any;
      await expect(svc.save(teacher, 'class', sheet.id, 'one', entry())).rejects.toThrow('write failed');
      expect(db.rows('learningEvidence')).toEqual([]);
      expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('pending');
      db.$transaction = transaction;
      await svc.save(teacher, 'class', sheet.id, 'one', entry());
      expect(db.rows('learningEvidence')).toHaveLength(2);
    }
  });
  it('控制器拒绝未录入、缺少请求编号及多余字段', () => {
    expect(EntrySchema.safeParse({ ...entry(), status: 'pending' }).success).toBe(false);
    expect(EntrySchema.safeParse({ status: 'entered' }).success).toBe(false);
    const controller = new DictationController({} as any);
    expect(() => controller.generate(teacher, 'class', { unexpected: true }, {} as any)).toThrow();
    expect(() => controller.save(teacher, 'class', 'sheet', 'one', { ...entry(), studentId: 'other' }, {} as any)).toThrow();
  });

  it('批量排除有草稿的学生，排除名单规范化且同编号不能换名单', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    const save = (excludedStudentIds: string[]) => svc.save(teacher, 'class', sheet.id, null, { ...entry('bulk_0001'), excludedStudentIds } as any);
    expect(await save(['one', 'one'])).toMatchObject({ bulk: { succeededCount: 1, failedCount: 0, skippedCount: 0 } });
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('pending');
    expect(db.rows('learningEvidence').map((r) => r.studentId)).toEqual(['two', 'two']);
    await save(['one']);
    await expect(save([])).rejects.toMatchObject({ status: 409 });
    expect(db.rows('learningEvidence')).toHaveLength(2);
  });

  it('逐学生事务：一人中途失败只回滚该人，重放只补失败者且不覆盖后来的改录', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    const transact = db.$transaction;
    db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const insert = tx.learningEvidence.createMany;
      tx.learningEvidence.createMany = (args: any) => {
        if (args.data[0].studentId === 'two' && args.data[0].senseId === 'sense_1') throw new Error('student failed');
        return insert(args);
      };
      return run(tx);
    }, opts);
    expect(await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001')))
      .toMatchObject({ bulk: { succeededCount: 1, failedCount: 1, skippedCount: 0 } });
    expect(db.rows('learningEvidence')).toHaveLength(2);
    expect(db.rows('dictationSheetRow', { studentId: 'two' })[0].status).toBe('pending');
    expect(db.rows('studentVocabularySense', { studentId: 'two' })).toEqual([]);
    db.$transaction = transact;
    await svc.save(teacher, 'class', sheet.id, 'one', entry('amend_001', ['sense_0']));
    expect(await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001')))
      .toMatchObject({ bulk: { succeededCount: 2, failedCount: 0, skippedCount: 0 } });
    await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'));
    expect(db.rows('learningEvidence')).toHaveLength(6);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].wrongSenseIds).toEqual(['sense_0']);
    expect(db.rows('studentVocabularySense', { studentId: 'two' }).map((r) => r.reps)).toEqual([1, 1]);
  });

  it('重试只处理最初冻结的待录入名单，其他老师已录入的失败者跳过', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    const transact = db.$transaction;
    db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const insert = tx.learningEvidence.createMany;
      tx.learningEvidence.createMany = (args: any) => {
        if (args.data[0].studentId === 'two') throw new Error('student failed');
        return insert(args);
      };
      return run(tx);
    }, opts);
    await svc.save(teacher, 'class', sheet.id, null, { ...entry('bulk_0001'), excludedStudentIds: ['one'] } as any);
    db.$transaction = transact;
    await svc.save(teacher, 'class', sheet.id, 'two', { ...entry('absent_001'), status: 'absent' });
    expect(await svc.save(teacher, 'class', sheet.id, null, { ...entry('bulk_0001'), excludedStudentIds: ['one'] } as any))
      .toMatchObject({ bulk: { succeededCount: 0, failedCount: 0, skippedCount: 1 } });
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('pending');
    expect(db.rows('dictationSheetRow', { studentId: 'two' })[0].status).toBe('absent');
  });

  it('日历和历史查询按学生预取，词数增加不会增加读取次数', async () => {
    const counts: number[] = [];
    for (const wordCount of [2, 20]) {
      const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
      for (const row of db.rows('dictationSheetRow', { studentId: { in: ['one', 'two'] } }))
        await db.dictationSheetRow.update({ where: { id: row.id }, data: { senseIds: Array.from({ length: wordCount }, (_, i) => `sense_${i}`) } });
      let reads = 0; const transact = db.$transaction;
      db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
        for (const model of ['classEnrollment', 'classNoSchoolDay', 'learningEvidence']) {
          const read = tx[model].findMany;
          tx[model].findMany = (args: any) => { reads++; return read(args); };
        }
        return run(tx);
      }, opts);
      await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'));
      expect(db.rows('learningEvidence')).toHaveLength(wordCount * 2);
      counts.push(reads);
    }
    expect(counts).toEqual([6, 6]); // Two students: one history + two calendar reads each.
  });

  it('控制器接受可选排除名单并拒绝非法类型', async () => {
    const save = vi.fn(); const controller = new DictationController({ save } as any);
    await controller.remaining(teacher, 'class', 'sheet', { requestId: 'bulk_0001', excludedStudentIds: ['one'] }, {} as any);
    expect(save).toHaveBeenCalledWith(expect.anything(), 'class', 'sheet', null, expect.objectContaining({ excludedStudentIds: ['one'] }));
    expect(() => controller.remaining(teacher, 'class', 'sheet', { requestId: 'bulk_0002', excludedStudentIds: [1] }, {} as any)).toThrow();
  });

  it('80 人各 10 词逐人提交，首位失败后仍处理其余学生；重复请求只补首位', async () => {
    const { db, svc } = fixture();
    db.seed('dictationSheet', { id: 'large', classId: 'class', learnedDate: dateOnly('2026-11-04'), heldOn: dateOnly('2026-11-05') });
    for (let i = 0; i < 80; i++) db.seed('dictationSheetRow', {
      sheetId: 'large', studentId: `large_${String(i).padStart(2, '0')}`,
      senseIds: Array.from({ length: 10 }, (_, j) => `word_${j}`),
    });
    const transact = db.$transaction;
    const traces: Set<string>[] = [];
    db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const students = new Set<string>(); traces.push(students);
      const lock = tx.studentVocabularyProfile.upsert;
      tx.studentVocabularyProfile.upsert = (args: any) => { students.add(args.where.studentId); return lock(args); };
      const insert = tx.learningEvidence.createMany;
      tx.learningEvidence.createMany = (args: any) => {
        if (args.data[0].studentId === 'large_00') throw new Error('first student failed');
        return insert(args);
      };
      return run(tx);
    }, opts);
    expect(await svc.save(teacher, 'class', 'large', null, entry('bulk_large')))
      .toMatchObject({ bulk: { succeededCount: 79, failedCount: 1, skippedCount: 0 } });
    expect(traces).toHaveLength(81); // One manifest and 80 independent student transactions.
    expect(traces.every((ids) => ids.size <= 1)).toBe(true);
    expect(db.rows('learningEvidence')).toHaveLength(790);
    db.$transaction = transact;
    const retryTransactions = vi.spyOn(db, '$transaction');
    const result = await svc.save(teacher, 'class', 'large', null, entry('bulk_large'));
    expect(retryTransactions).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ bulk: { succeededCount: 80, failedCount: 0, skippedCount: 0 } });
    expect(db.rows('learningEvidence')).toHaveLength(800);
    expect(db.rows('studentVocabularySense').every((r) => r.reps === 1)).toBe(true);
  });

  it('批量同编号并发与事后重放，不重复记录或把后来的个人改录覆盖', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    const results = await Promise.all([1, 2, 3].map(() => svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))));
    for (const result of results) expect(result).toMatchObject({ bulk: { succeededCount: 2, failedCount: 0 } });
    expect(db.rows('auditLog', { action: 'dictation.remaining_started' })).toHaveLength(1);
    expect(db.rows('auditLog', { action: 'dictation.row_saved' })).toHaveLength(2);
    await svc.save(teacher, 'class', sheet.id, 'one', { ...entry('amend_001'), status: 'absent' });
    const writesBeforeReplay = db.writes.length;
    await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'));
    expect(db.writes).toHaveLength(writesBeforeReplay);
    expect(db.rows('learningEvidence')).toHaveLength(6);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('absent');
  });

  it.each(['manifest', 'row'])('批量审计失败不留下无收据的成功；原编号可重试（%s）', async (failure) => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    const transact = db.$transaction;
    db.$transaction = (run: any, opts: any) => transact(async (tx: any) => {
      const write = tx.auditLog.create;
      tx.auditLog.create = (args: any) => {
        if (args.data.action === (failure === 'manifest' ? 'dictation.remaining_started' : 'dictation.row_saved')) throw new Error('audit failed');
        return write(args);
      };
      return run(tx);
    }, opts);
    if (failure === 'manifest') await expect(svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))).rejects.toThrow('audit failed');
    else expect(await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))).toMatchObject({ bulk: { succeededCount: 0, failedCount: 2 } });
    expect(db.rows('learningEvidence')).toEqual([]);
    expect(db.rows('studentVocabularySense')).toEqual([]);
    db.$transaction = transact;
    expect(await svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))).toMatchObject({ bulk: { succeededCount: 2, failedCount: 0 } });
  });

  it('空批次、旧版已完成收据重放均不把未知结果当全对', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    db.seed('auditLog', { action: 'dictation.remaining_saved', entityId: sheet.id,
      metadata: { requestId: 'old_bulk_001', signature: 'remaining' } });
    const writes = db.writes.length;
    expect(await svc.save(teacher, 'class', sheet.id, null, entry('old_bulk_001')))
      .toMatchObject({ bulk: { succeededCount: 0, failedCount: 0, skippedCount: 0 } });
    expect(db.writes).toHaveLength(writes);
    expect(await svc.save(teacher, 'class', sheet.id, null, { ...entry('empty_bulk'), excludedStudentIds: ['one', 'two'] }))
      .toMatchObject({ bulk: { succeededCount: 0, failedCount: 0, skippedCount: 0 } });
    expect(db.rows('learningEvidence')).toEqual([]);
    expect(db.rows('dictationSheetRow').every((row) => row.status === 'pending')).toBe(true);
  });
});
