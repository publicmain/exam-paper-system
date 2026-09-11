import { describe, expect, it } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RATE_LIMIT_KEY, type RateLimitOptions } from './rate-limit.guard';
import { PUBLIC_KEY } from './auth.guard';
import { StudentIdentityGuard } from './student-identity.guard';
import { VocabularyV2Controller } from '../vocab-v2/vocabulary-v2.controller';
import { LessonController } from '../lesson/lesson.controller';
import { VocabController } from '../vocab/vocab.controller';
import { MorningQuizController } from '../morning-quiz/morning-quiz.controller';
import { PushController } from '../push/push.controller';
import { WritingCheckController } from '../writing-check/writing-check.controller';
import { StudentAuthController } from '../student-auth/student-auth.controller';

/**
 * S06（2026-09-11 审计）—— 学生侧限流的**分桶口径**清点。
 *
 * 全校共用一个出口 IP。原来学生接口几乎都声明 `scope: 'ip'`（它们诞生在
 * 「按姓名匿名访问」的年代），于是一个班同时学词、答题，全班共用一个桶：
 * `test/answer` 每分钟 120 次，35 个人一起答 13 道题就会互相 429。
 *
 * 现在的口径：
 *   · 学生身份守卫那一路（`@Public()` + StudentIdentityGuard）的限流一律
 *     `scope: 'user'` —— 带有效令牌按学生分桶；不带 / 令牌无效 / 已撤销的
 *     请求在限流守卫里落 IP 桶（rate-limit.guard 的 userScopeId），匿名暴力
 *     仍受 IP 防护；
 *   · 本来就匿名的入口（登录、注册、注册状态、班级列表、staging 夹具）保持 IP；
 *   · `PATCH /student-auth/me/english-level`：原来留给词汇组（UI01 的方法），两组合并后
 *     改为按学生分桶（2026-09-11）。
 *
 * 从控制器元数据推导，新加一条学生接口忘了按用户分桶，这里当场红。
 */

function limitedRoutes(C: any) {
  const base = (Reflect.getMetadata(PATH_METADATA, C) as string) ?? '';
  const sig = ((Reflect.getMetadata(GUARDS_METADATA, C) ?? []) as unknown[]).includes(StudentIdentityGuard);
  const out: { key: string; scope: string; isPublic: boolean; sig: boolean }[] = [];
  for (const name of Object.getOwnPropertyNames(C.prototype)) {
    const fn = C.prototype[name];
    if (typeof fn !== 'function' || name === 'constructor') continue;
    const p = Reflect.getMetadata(PATH_METADATA, fn);
    if (p === undefined) continue;
    const rl = Reflect.getMetadata(RATE_LIMIT_KEY, fn) as RateLimitOptions | undefined;
    if (!rl) continue;
    const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, fn) as number];
    out.push({
      key: `${method} /${base}/${p}`.replace(/\/+/g, '/').replace(/\/$/, ''),
      scope: rl.scope ?? 'ip',
      isPublic: Reflect.getMetadata(PUBLIC_KEY, fn) === true,
      sig,
    });
  }
  return out;
}

describe('S06 · 学生身份那一路的限流一律按用户分桶', () => {
  for (const C of [VocabularyV2Controller, LessonController, VocabController, MorningQuizController, PushController, WritingCheckController]) {
    it(`${C.name}：@Public + StudentIdentityGuard 的限流都是 user scope`, () => {
      const rows = limitedRoutes(C).filter((r) => r.isPublic && r.sig);
      expect(rows.length, C.name).toBeGreaterThan(0);
      for (const r of rows) expect(r.scope, r.key).toBe('user');
    });
  }
});

describe('S06 · student-auth：带令牌的按用户，匿名入口按 IP', () => {
  const rows = Object.fromEntries(limitedRoutes(StudentAuthController).map((r) => [r.key, r.scope]));

  it('改密码、我的主页、改难度：user scope', () => {
    expect(rows['POST /student-auth/change-pin']).toBe('user');
    expect(rows['GET /student-auth/me']).toBe('user');
    expect(rows['PATCH /student-auth/me/english-level']).toBe('user');
  });

  it('登录 / 注册 / 注册状态 / 班级列表 / staging 夹具：仍是 IP（匿名入口，防暴力）', () => {
    for (const k of [
      'POST /student-auth/login',
      'POST /student-auth/register',
      'POST /student-auth/self-register',
      'GET /student-auth/registration-status',
      'GET /student-auth/registration-classes',
      'POST /student-auth/staging-fixture-session',
    ]) {
      expect(rows[k], k).toBe('ip');
    }
  });

});
