import { beforeEach, describe, expect, it } from 'vitest';
import { QrService, ORIGINAL_VARIANT, normaliseVariant } from './qr.service';

/**
 * 贴墙码分身（2026-08-13）。
 *
 * 贴墙码固定不变，学生可以拍成照片带回家扫，考勤分辨不出人是否真的
 * 在墙前。做法：同一个班同时签发多张**都能用**的码、各带一个标签，
 * 换墙上那张时不通知学生 —— 当天扫到旧标签的，用的必然是之前拍的
 * 照片。这几条锁住「两张都能用」和「后台分得清」这两个前提。
 */

const CLASS = 'cmoux0jj900m9oc28r4sptjj0';

/** 只测签发/校验，不碰数据库：resolveTodaySession 用假的会话表替身。 */
function svc(sessionId: string | null = 'sess_1') {
  const prisma: any = {
    morningQuizSession: {
      findFirst: async () => (sessionId ? { id: sessionId } : null),
    },
  };
  return new QrService(prisma);
}

describe('normaliseVariant', () => {
  it('规范化成小写', () => {
    expect(normaliseVariant('W34')).toBe('w34');
  });
  it('空值与保留名视为不带标签', () => {
    expect(normaliseVariant(undefined)).toBeUndefined();
    expect(normaliseVariant('')).toBeUndefined();
    expect(normaliseVariant('   ')).toBeUndefined();
    expect(normaliseVariant(ORIGINAL_VARIANT)).toBeUndefined();
  });
  it('带点的标签一律拒绝 —— 点是 token 的分隔符，会把校验切错位', () => {
    expect(normaliseVariant('a.b')).toBeUndefined();
  });
  it('非法字符与超长一律拒绝', () => {
    expect(normaliseVariant('墙上那张')).toBeUndefined();
    expect(normaliseVariant('a'.repeat(17))).toBeUndefined();
    expect(normaliseVariant('w 34')).toBeUndefined();
  });
});

describe('两张码同时有效，且后台分得清', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-for-qr';
  });

  it('旧的三段式码继续有效，记为 original', async () => {
    const s = svc();
    const token = s.staticTokenForClass(CLASS);
    expect(token.split('.')).toHaveLength(3);
    const d = await s.verify(token);
    expect(d.sessionId).toBe('sess_1');
    expect(d.qrVariant).toBe(ORIGINAL_VARIANT);
  });

  it('带标签的四段式码同样有效，并回报标签', async () => {
    const s = svc();
    const token = s.staticTokenForClass(CLASS, 'w34');
    expect(token.split('.')).toHaveLength(4);
    const d = await s.verify(token);
    expect(d.sessionId).toBe('sess_1');
    expect(d.qrVariant).toBe('w34');
  });

  it('两张码指向同一场考试 —— 学生扫哪张都能正常答题', async () => {
    const s = svc();
    const a = await s.verify(s.staticTokenForClass(CLASS));
    const b = await s.verify(s.staticTokenForClass(CLASS, 'w34'));
    expect(a.sessionId).toBe(b.sessionId);
  });

  it('不同标签签出不同 token —— 否则无法分辨扫的是哪一张', () => {
    const s = svc();
    const a = s.staticTokenForClass(CLASS, 'w34');
    const b = s.staticTokenForClass(CLASS, 'w35');
    expect(a).not.toBe(b);
  });

  it('同一标签每次签发结果一致 —— 印一次能一直贴', () => {
    const s = svc();
    expect(s.staticTokenForClass(CLASS, 'w34')).toBe(s.staticTokenForClass(CLASS, 'w34'));
  });

  it('伪造标签（改标签不改签名）会被拒', async () => {
    const s = svc();
    const real = s.staticTokenForClass(CLASS, 'w34');
    const forged = real.replace('.w34.', '.w99.');
    await expect(s.verify(forged)).rejects.toThrow();
  });

  it('把标签直接塞进原始码也会被拒', async () => {
    const s = svc();
    const [v, cls, sig] = s.staticTokenForClass(CLASS).split('.');
    await expect(s.verify(`${v}.${cls}.w34.${sig}`)).rejects.toThrow();
  });

  it('五段及以上一律 malformed', async () => {
    const s = svc();
    await expect(s.verify(`v2.${CLASS}.a.b.c`)).rejects.toThrow();
  });
});
