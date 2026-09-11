/**
 * VOC15 · 查词 / 收词时翻译失败：如实反馈，不显示假翻译（审计 2026-09-11 §5.3）。
 *
 * 翻译服务本身的口径（429 冷却、5xx、超时、无中文、只用 Azure 不换供应商）在
 * `vocab/realtime-translation.degradation.spec.ts`；这里钉的是收词接口把这些
 * 状态怎么交给学生端：
 *   · 词典 / 词表有释义 → 根本不调机翻；
 *   · 没有可靠中文 → 503 + reason + 能不能重试（+ 等几秒），库里什么都不建；
 *   · 词有了、只是例句译文暂时拿不到 → 词照常加入，例句标「译文暂缺、可重试」，
 *     不拿英文或空串冒充译文。
 */
import { describe, expect, it } from 'vitest';
import type { TranslationResult } from '../vocab/realtime-translation.service';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

function scriptedTranslator(script: Record<string, TranslationResult>) {
  const calls: string[] = [];
  return {
    calls,
    async translate(text: string) {
      return (await this.translateDetailed(text)).text;
    },
    async translateDetailed(text: string): Promise<TranslationResult> {
      calls.push(text);
      return script[text] ?? { text: `译:${text}`, status: 'ok', retryable: false, provider: 'azure' };
    },
  };
}

function setup(script: Record<string, TranslationResult> = {}) {
  const db = newDb();
  const stu = seedStudent(db, { id: 'stu-a', level: 'olevel', classId: 'class-a' });
  const [injury] = seedOfficialWords(db, 'ngsl', 1801, 1);
  const translator = scriptedTranslator(script);
  const svc = makeService(db, translator);
  return { db, stu, injury, svc, translator };
}

describe('VOC15 收词时的翻译失败口径', () => {
  it('Azure 限流：503 translation_unavailable，带 reason / retryable / retryAfterSec，库里什么都不建', async () => {
    const { db, stu, svc } = setup({ zorbling: { text: null, status: 'rate_limited', retryable: true, retryAfterSec: 7, provider: 'azure' } });
    db.resetWrites();
    await expect(svc.collect(stu, { headword: 'zorbling', action: 'learn' })).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'translation_unavailable', reason: 'rate_limited', retryable: true, retryAfterSec: 7 }),
    });
    expect(db.writes).toEqual([]);
  });

  it('供应商回来的不是中文：说「暂无可靠中文」，不可重试，不把英文当翻译', async () => {
    const { db, stu, svc } = setup({ tekong: { text: null, status: 'no_chinese', retryable: false, provider: 'azure' } });
    await expect(svc.collect(stu, { headword: 'tekong', action: 'lookup_only' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'translation_unavailable', reason: 'no_chinese', retryable: false, message: '暂时没有这个词可靠的中文释义。' }),
    });
    expect(db.rows('vocabularyLexeme', { headword: 'tekong' })).toHaveLength(0);
  });

  it('本地词典有这个词：不调机翻', async () => {
    const { db, stu, svc, translator } = setup();
    db.seed('dictEntry', { word: 'kopitiam', translation: 'n. 咖啡店', definition: 'a coffee shop', pos: 'n' });
    const result = await svc.collect(stu, { headword: 'kopitiam', action: 'lookup_only' });
    expect(result.sense.translation).toContain('咖啡店');
    expect(translator.calls).toEqual([]);
  });

  it('词有了、只是例句译文拿不到：词照常加入；例句译文如实标暂缺、可重试，共享例句不标 ready', async () => {
    const sentence = 'The runner hid his injury from the coach.';
    const { db, stu, injury, svc } = setup({ [sentence]: { text: null, status: 'timeout', retryable: true, provider: 'azure' } });
    db.seed('paper', { id: 'paper-a', name: 'Paper A' });
    db.seed('question', { id: 'q-a', content: { passage: `It rained. ${sentence} Nobody knew.` } });
    db.seed('paperQuestion', { paperId: 'paper-a', questionId: 'q-a' });
    db.seed('paperAssignment', { id: 'pa-a', paperId: 'paper-a', classId: 'class-a', assignedById: 't1' });
    db.seed('morningQuizSession', { id: 'mqs-a', paperAssignmentId: 'pa-a', classId: 'class-a', date: new Date('2026-09-10T00:00:00.000Z'), level: 'olevel' });
    const result = await svc.collect(stu, { headword: 'injury', action: 'learn', contextSentence: sentence, sourceRef: 'assignment:pa-a' });
    expect(result.added).toBe(true);
    expect(result.context).toEqual(expect.objectContaining({ sentence, translation: null, translationStatus: 'timeout', retryable: true }));
    const shared = db.rows('vocabularyContext', { senseId: injury.senseId, kind: 'article_original' });
    expect(shared).toHaveLength(1);
    expect(shared[0].translation).toBe('');
    expect(shared[0].qualityStatus).toBe('needs_translation');
  });
});
