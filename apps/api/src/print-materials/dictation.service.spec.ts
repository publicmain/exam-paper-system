import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { DictationService } from './dictation.service';
import { DictationController, EntrySchema } from './dictation.controller';
import { AuditService } from '../audit/audit.service';
import { memoryPrisma } from '../vocab-v2/testing/memory-prisma';
import { dateOnly } from '../common/school-calendar';

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
  const svc = new DictationService(db as any, new AuditService(db as any));
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
  });
  it('一键仅处理尚未录入且有词的学生，保留错词/缺考，批量重试不写新记录', async () => {
    const { db, svc, generate } = fixture(); const sheet = (await generate()).sheet!;
    await svc.save(teacher, 'class', sheet.id, 'one', { ...entry(), status: 'absent' });
    await Promise.all([1, 2].map(() => svc.save(teacher, 'class', sheet.id, null, entry('bulk_0001'))));
    expect(db.rows('learningEvidence')).toHaveLength(4);
    expect(db.rows('dictationSheetRow', { studentId: 'one' })[0].status).toBe('absent');
    expect(db.rows('dictationSheetRow', { studentId: 'two' })[0].status).toBe('entered');
    expect(db.rows('dictationSheetRow', { studentId: 'empty' })[0].status).toBe('pending');
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
});
