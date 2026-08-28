import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { identityOf } from './student-identity-input';
import {
  authenticatedStudentWhere,
  resolveAuthenticatedStudent,
} from './authenticated-student';
import { identityConflicts } from './student-identity.guard';

/**
 * 阶段 5A —— token-only 学生身份的契约测试。
 *
 * 这一层测的是**判据本身**（纯函数 + 精确 ID 解析），不是每个 controller
 * 的接线。接线由类型系统 + 端点矩阵测试（同目录 endpoint-matrix.spec.ts）
 * 覆盖。
 */

const req = (opts: { auth?: { id: string; name: string }; query?: unknown; body?: unknown }) =>
  ({
    studentAuth: opts.auth,
    query: opts.query ?? {},
    body: opts.body ?? {},
    headers: {},
  }) as unknown as Request;

// ─────────────────────────────────────────────────────────────
// 兼容契约 —— 六条，逐条钉住
// ─────────────────────────────────────────────────────────────

describe('兼容契约', () => {
  it('**有效令牌 + 完全不带 name/studentId → 可用**，且走已认证路径', () => {
    const r = identityOf(req({ auth: { id: 's1', name: '张三' } }));
    expect(r.authStudentId).toBe('s1');
    expect(r.studentId).toBeUndefined();
    // studentName 保持空串 —— 它**不会**被用来查人（authStudentId 优先）
    expect(r.studentName).toBe('');
  });

  it('**令牌身份始终优先** —— 即使同时给了姓名，authStudentId 也在', () => {
    const r = identityOf(req({ auth: { id: 's1', name: '张三' } }), '张三', 's1');
    expect(r.authStudentId).toBe('s1');
  });

  it('令牌 + 一致的旧身份 → 仍然可用（守卫层不冲突）', () => {
    expect(identityConflicts({ id: 's1', name: '张三' }, { name: '张三', studentId: 's1' })).toBe(false);
    expect(identityConflicts({ id: 's1', name: '张三' }, { name: ' 张三 ' })).toBe(false);
  });

  it('**令牌 + 冲突的旧身份 → 冲突**（守卫据此 403 identity_mismatch）', () => {
    expect(identityConflicts({ id: 's1', name: '张三' }, { studentId: 's2' })).toBe(true);
    expect(identityConflicts({ id: 's1', name: '张三' }, { name: '李四' })).toBe(true);
  });

  it('**无令牌 + 有姓名 → 原样走旧路径**（旧客户端一字不改）', () => {
    const r = identityOf(req({}), '张三', 's9');
    expect(r.authStudentId).toBeUndefined();
    expect(r.studentName).toBe('张三');
    expect(r.studentId).toBe('s9');
  });

  it('**两者都没有 → 保持原有 name_required 错误契约**', () => {
    expect(() => identityOf(req({}))).toThrow(BadRequestException);
    try {
      identityOf(req({}), '   ');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ code: 'name_required' });
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 精确 ID 路径 —— 不查名、不消歧、不给建议，但不放宽资格
// ─────────────────────────────────────────────────────────────

describe('已认证的精确 ID 解析', () => {
  const fakePrisma = (row: { id: string; name: string } | null) => ({
    user: { findFirst: vi.fn().mockResolvedValue(row) },
  });

  it('**用 id 查，不用姓名**', async () => {
    const p = fakePrisma({ id: 's1', name: '张三' });
    await resolveAuthenticatedStudent(p, 's1');
    const where = (p.user.findFirst.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.id).toBe('s1');
    expect(where).not.toHaveProperty('name');
  });

  it('**不做同名消歧** —— 用的是 findFirst，不是 findMany + 候选人分支', async () => {
    const p = fakePrisma({ id: 's1', name: '张三' });
    await resolveAuthenticatedStudent(p, 's1');
    expect(p.user.findFirst).toHaveBeenCalledTimes(1);
    expect((p.user as Record<string, unknown>).findMany).toBeUndefined();
  });

  it('**不给近似姓名建议** —— 失败时抛的是资格错误，不带 suggestions', async () => {
    const p = fakePrisma(null);
    await expect(resolveAuthenticatedStudent(p, 's1')).rejects.toThrow(ForbiddenException);
    try {
      await resolveAuthenticatedStudent(p, 's1');
    } catch (e) {
      const body = (e as ForbiddenException).getResponse();
      expect(body).toEqual({ code: 'student_not_eligible' });
      expect(body).not.toHaveProperty('suggestions');
      expect(body).not.toHaveProperty('candidates');
    }
  });

  it('**资格没有被放宽** —— 四个条件一个不少', () => {
    const w = authenticatedStudentWhere('s1') as Record<string, unknown>;
    expect(w.role).toBe('student');
    expect(w.isActive).toBe(true);
    expect(w.archivedAt).toBeNull();
    expect(w.classEnrollments).toEqual({
      some: { role: 'student', class: { archivedAt: null } },
    });
  });

  it('资格取的是两个旧解析器里**更严**的那套（不是更宽）', () => {
    const w = authenticatedStudentWhere('s1') as Record<string, unknown>;
    // vocab 的旧解析器没查 role / archivedAt —— 这里查了，只会更严
    expect(Object.keys(w).sort()).toEqual(
      ['archivedAt', 'classEnrollments', 'id', 'isActive', 'role'].sort(),
    );
  });
});

// ─────────────────────────────────────────────────────────────
// 反向对照 —— 把 token-only 支持拿掉，这些必须变红
// ─────────────────────────────────────────────────────────────

describe('反向对照', () => {
  it('**若 identityOf 不再产出 authStudentId，第一条就会红**', () => {
    const r = identityOf(req({ auth: { id: 's1', name: '张三' } }));
    // 这一条正是「令牌单独可用」的全部依据
    expect(r.authStudentId).toBeDefined();
  });

  it('**若无令牌时也塞 authStudentId，旧路径就被悄悄改道 —— 这里挡住**', () => {
    expect(identityOf(req({}), '张三').authStudentId).toBeUndefined();
  });

  it('**若把令牌姓名塞回姓名解析器，studentName 会变成令牌里的名字 —— 这里挡住**', () => {
    // 明确禁止的实现方式：identityOf 不得用 auth.name 去填 studentName
    expect(identityOf(req({ auth: { id: 's1', name: '张三' } })).studentName).toBe('');
  });

  it('**若资格谓词被简化成只按 id 查，这条会红**', () => {
    const w = authenticatedStudentWhere('s1') as Record<string, unknown>;
    expect(Object.keys(w).length).toBeGreaterThan(1);
  });
});
