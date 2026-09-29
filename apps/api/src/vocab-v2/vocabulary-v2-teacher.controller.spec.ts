import { describe, expect, it, vi } from 'vitest';
import { VocabularyV2TeacherController } from './vocabulary-v2-teacher.controller';
import { MAX_PER_DAY } from './word-list-plan';

/**
 * 2026-09-29：早读课每天 30 个左右。上限从 20 提到 40 时，只改了 service 和老师后台，
 * 请求校验（zod）里还写死着 20 —— 本机端到端测试发 30 个词被这里拦下才发现。
 * 这里钉住：请求校验和 service 用同一个 MAX_PER_DAY。
 */
describe('老师发布每日词表：请求校验的词数上限', () => {
  const user = { id: 't-1', role: 'teacher' };
  const make = () => {
    const service = { publishTeacherAssignment: vi.fn(async () => ({ ok: true })) };
    return { service, ctl: new VocabularyV2TeacherController(service as any) };
  };
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`);

  it(`30 个、${MAX_PER_DAY} 个都放行`, async () => {
    for (const n of [30, MAX_PER_DAY]) {
      const { ctl, service } = make();
      await ctl.publish(user, { classId: 'c-1', date: '2026-09-29', words: words(n) });
      expect(service.publishTeacherAssignment).toHaveBeenCalledTimes(1);
    }
  });

  it(`${MAX_PER_DAY + 1} 个、0 个：400，不进 service`, async () => {
    for (const n of [MAX_PER_DAY + 1, 0]) {
      const { ctl, service } = make();
      expect(() => ctl.publish(user, { classId: 'c-1', date: '2026-09-29', words: words(n) })).toThrow();
      expect(service.publishTeacherAssignment).not.toHaveBeenCalled();
    }
  });
});
