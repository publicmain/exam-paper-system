/**
 * ⚠️ 临时的 staging 免密夹具登录 —— 闸门与写死账号的行为测试。
 *
 * 这一片守的是一个**免密入口**，所以断言的重点不是「它能用」，而是
 * **它在别的地方一定用不了**：
 *
 *   · 开关不设 → 端点表现为不存在（404），前端按钮不渲染；
 *   · 开关设了但项目 / 域名对不上 → **拒绝启动**（生产的护栏就是这一条）；
 *   · 请求给不了任何身份 —— 账号写死，方法连入参都没有；
 *   · 资格照常查，`av` 取当下值（教师重置仍然一刀切掉旧令牌）；
 *   · 不写库：PIN、注册状态、`studentAuthVersion` 一个都不动。
 */
import { describe, it, expect, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import {
  STAGING_API_PUBLIC_DOMAIN,
  STAGING_FIXTURE_ENV_KEY,
  STAGING_FIXTURE_STUDENT_ID,
  STAGING_FIXTURE_WEB_ENV_KEY,
  STAGING_PROJECT_ID,
  StagingFixtureConfigError,
  assertStagingFixtureLoginConfig,
  readStagingFixtureLoginConfig,
} from './staging-fixture-login';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';

const GOOD_ENV = {
  STAGING_FIXTURE_LOGIN: 't6_done',
  RAILWAY_PROJECT_ID: STAGING_PROJECT_ID,
  RAILWAY_PUBLIC_DOMAIN: STAGING_API_PUBLIC_DOMAIN,
};

// ─────────────────────────────────────────────────────────────
// 1 —— 常量
// ─────────────────────────────────────────────────────────────

describe('闸门常量', () => {
  it('**只认识一个虚构账号**', () => {
    expect(STAGING_FIXTURE_STUDENT_ID).toBe('t6_done');
  });

  it('身份常量指向 staging，不是别的项目', () => {
    expect(STAGING_PROJECT_ID).toBe('ed8c31c0-6499-4611-830a-64043189f7d0');
    expect(STAGING_API_PUBLIC_DOMAIN).toBe('stg-api-production-46cf.up.railway.app');
    expect(STAGING_FIXTURE_ENV_KEY).toBe('STAGING_FIXTURE_LOGIN');
    expect(STAGING_FIXTURE_WEB_ENV_KEY).toBe('VITE_STAGING_FIXTURE_LOGIN');
  });

  it('**源码里没有任何覆盖开关**', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'staging-fixture-login.ts'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const w of ['FORCE', 'force', 'OVERRIDE', 'override', 'BYPASS', 'bypass', 'SKIP']) {
      expect(code, `出现了 ${w}`).not.toContain(w);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2 —— 配置闸门
// ─────────────────────────────────────────────────────────────

describe('配置闸门', () => {
  it('**不设开关 = 关闭**，而且不是错误', () => {
    expect(readStagingFixtureLoginConfig({})).toEqual({ enabled: false });
    expect(readStagingFixtureLoginConfig({ STAGING_FIXTURE_LOGIN: '' })).toEqual({ enabled: false });
    expect(assertStagingFixtureLoginConfig({})).toMatchObject({ ok: true });
  });

  it('三样齐全才打开', () => {
    expect(readStagingFixtureLoginConfig(GOOD_ENV)).toEqual({
      enabled: true,
      studentId: 't6_done',
    });
    expect(assertStagingFixtureLoginConfig(GOOD_ENV)).toMatchObject({ ok: true });
  });

  it('**开关值不是逐字 t6_done → 拒绝启动**（拼错的值不许把它打开）', () => {
    for (const bad of ['t5_review', 'T6_DONE', ' t6_done', 't6_done ', 'yes', 'true', '1']) {
      const env = { ...GOOD_ENV, STAGING_FIXTURE_LOGIN: bad };
      expect(() => readStagingFixtureLoginConfig(env), bad).toThrow(StagingFixtureConfigError);
      expect(assertStagingFixtureLoginConfig(env), bad).toMatchObject({ ok: false });
    }
  });

  it('**项目 id 对不上 → 拒绝启动**（生产的护栏就是这一条）', () => {
    for (const bad of [undefined, '', 'c634fa12-fa7f-460b-a113-3bf4b9566c99']) {
      const env = { ...GOOD_ENV, RAILWAY_PROJECT_ID: bad };
      expect(() => readStagingFixtureLoginConfig(env), String(bad)).toThrow(/RAILWAY_PROJECT_ID/);
      const r = assertStagingFixtureLoginConfig(env);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain(STAGING_PROJECT_ID);
    }
  });

  it('**公开域名对不上 → 拒绝启动**（别的服务也不行）', () => {
    for (const bad of [undefined, '', 'nurturing-radiance.up.railway.app', 'stg-web-production.up.railway.app']) {
      const env = { ...GOOD_ENV, RAILWAY_PUBLIC_DOMAIN: bad };
      expect(() => readStagingFixtureLoginConfig(env), String(bad)).toThrow(/RAILWAY_PUBLIC_DOMAIN/);
      expect(assertStagingFixtureLoginConfig(env).ok).toBe(false);
    }
  });

  it('**一个生产形状的环境即使误配了开关也起不来**', () => {
    const prodish = {
      STAGING_FIXTURE_LOGIN: 't6_done',
      NODE_ENV: 'production',
      RAILWAY_PROJECT_ID: 'c634fa12-fa7f-460b-a113-3bf4b9566c99',
      RAILWAY_PUBLIC_DOMAIN: 'nurturing-radiance.up.railway.app',
    };
    const r = assertStagingFixtureLoginConfig(prodish);
    expect(r.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 3 —— 端点
// ─────────────────────────────────────────────────────────────

function makeController(svc: Partial<StudentAuthService>) {
  return new StudentAuthController(svc as StudentAuthService, {} as any, {} as any);
}

describe('端点：关着的时候不存在，开着的时候只能签发 t6_done', () => {
  const withEnv = async (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const saved: Record<string, string | undefined> = {};
    for (const k of Object.keys(env)) {
      saved[k] = process.env[k];
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k]!;
    }
    try {
      await fn();
    } finally {
      for (const k of Object.keys(saved)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k]!;
      }
    }
  };

  it('**开关不设 → 404，而且根本不调 service**', async () => {
    const spy = vi.fn();
    const c = makeController({ stagingFixtureSession: spy as any });
    await withEnv({ STAGING_FIXTURE_LOGIN: undefined }, async () => {
      await expect(c.stagingFixtureSession()).rejects.toBeInstanceOf(NotFoundException);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('**项目对不上 → 抛错，不签发**', async () => {
    const spy = vi.fn();
    const c = makeController({ stagingFixtureSession: spy as any });
    await withEnv(
      { ...GOOD_ENV, RAILWAY_PROJECT_ID: 'c634fa12-fa7f-460b-a113-3bf4b9566c99' },
      async () => {
        await expect(c.stagingFixtureSession()).rejects.toThrow(/RAILWAY_PROJECT_ID/);
      },
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('**齐全 → 调 service，且一个参数都不传**', async () => {
    const spy = vi.fn(async () => ({ token: 'T', student: { id: 't6_done' } }));
    const c = makeController({ stagingFixtureSession: spy as any });
    await withEnv(GOOD_ENV, async () => {
      await expect(c.stagingFixtureSession()).resolves.toMatchObject({ token: 'T' });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual([]); // 没有请求体，也没有任何入参
  });

  it('**方法签名里没有任何请求参数**（浏览器指定不了登谁）', () => {
    expect(StudentAuthController.prototype.stagingFixtureSession.length).toBe(0);
    const src = StudentAuthController.prototype.stagingFixtureSession.toString();
    expect(src).not.toMatch(/name|studentId|pin|role/i);
  });
});

// ─────────────────────────────────────────────────────────────
// 4 —— service：写死账号、照查资格、不写库
// ─────────────────────────────────────────────────────────────

describe('service：只能是 t6_done', () => {
  function makeService(findFirst: any) {
    const prisma = { user: { findFirst, update: vi.fn(), updateMany: vi.fn() } } as any;
    const jwt = { signAsync: vi.fn(async (claims: any) => `token:${claims.id}:${claims.av}`) } as any;
    return { svc: new StudentAuthService(prisma, jwt), prisma, jwt };
  }

  const ROW = {
    id: 't6_done',
    email: 't6_done@example.invalid',
    name: '测试六号',
    nickname: null,
    avatar: null,
    studentAuthVersion: 7,
  };

  it('**查询条件写死 id=t6_done，且带全部资格条件**', async () => {
    const findFirst = vi.fn(async (_args: any) => ROW);
    const { svc } = makeService(findFirst);
    await svc.stagingFixtureSession();
    const where = (findFirst.mock.calls[0]?.[0] as any).where;
    expect(where.id).toBe('t6_done');
    expect(where.role).toBe('student');
    expect(where.isActive).toBe(true);
    expect(where.archivedAt).toBeNull();
    expect(where.classEnrollments).toEqual({
      some: { role: 'student', class: { archivedAt: null } },
    });
  });

  it('**令牌 claims 与正常登录同形**，`av` 取当下的撤销版本', async () => {
    const { svc, jwt } = makeService(vi.fn(async () => ROW));
    const r = await svc.stagingFixtureSession();
    expect(r.token).toBe('token:t6_done:7');
    const [claims, opts] = jwt.signAsync.mock.calls[0];
    expect(claims).toEqual({
      id: 't6_done',
      email: 't6_done@example.invalid',
      role: 'student',
      name: '测试六号',
      av: 7,
    });
    expect(opts).toEqual({ expiresIn: '30d' });
    expect(r.student).toEqual({ id: 't6_done', name: '测试六号', nickname: '测试六号', avatar: null });
  });

  it('**一次库写都没有** —— 不动 PIN、注册状态、studentAuthVersion，连 lastLogin 都不写', async () => {
    const { svc, prisma } = makeService(vi.fn(async () => ROW));
    await svc.stagingFixtureSession();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('**账号不在 / 被停用 / 班级归档 → 不签发**，明说不可用', async () => {
    const { svc, jwt } = makeService(vi.fn(async () => null));
    await expect(svc.stagingFixtureSession()).rejects.toBeInstanceOf(NotFoundException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('**方法不收任何入参** —— 换个账号这条路在类型层面就不存在', () => {
    expect(StudentAuthService.prototype.stagingFixtureSession.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 5 —— 反向夹具：证明这些守卫真的会红
// ─────────────────────────────────────────────────────────────

describe('反向夹具', () => {
  it('**把账号改成可传参会被抓到**', () => {
    const hostile = 'async stagingFixtureSession(studentId: string) { return this.issue(studentId); }';
    expect(/stagingFixtureSession\(\s*\w/.test(hostile)).toBe(true);
  });

  it('**去掉项目 id 这道闸会被抓到**', () => {
    const env = { ...GOOD_ENV, RAILWAY_PROJECT_ID: 'someone-elses-project' };
    expect(() => readStagingFixtureLoginConfig(env)).toThrow();
  });

  it('**把「不设 = 关闭」改成「不设 = 开启」会被抓到**', () => {
    expect(readStagingFixtureLoginConfig({}).enabled).toBe(false);
  });
});
