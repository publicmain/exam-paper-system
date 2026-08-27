import { describe, it, expect } from 'vitest';
import {
  assertStudentAppRoutingConfig,
  isValidStudentAppOrigin,
  normalizeStudentAppOrigin,
  parseStudentAppV2,
  studentAppVersionFor,
} from './student-app-routing';

describe('STUDENT_APP_V2 解析', () => {
  it('空 / 未设 → off', () => {
    expect(parseStudentAppV2(undefined)).toEqual({ kind: 'off' });
    expect(parseStudentAppV2('')).toEqual({ kind: 'off' });
    expect(parseStudentAppV2('   ')).toEqual({ kind: 'off' });
  });

  it('布尔值', () => {
    for (const v of ['on', 'true', 'ALL', '1']) expect(parseStudentAppV2(v).kind).toBe('all');
    for (const v of ['off', 'FALSE', '0']) expect(parseStudentAppV2(v).kind).toBe('off');
  });

  it('**按学生灰度必须带 student: 前缀**', () => {
    expect(parseStudentAppV2('student:a,b')).toEqual({ kind: 'students', ids: ['a', 'b'] });
    expect(parseStudentAppV2('student: a , b ')).toEqual({ kind: 'students', ids: ['a', 'b'] });
  });

  it('**拼错的布尔值不会被当成一个学生 id**（all-day 那个坑）', () => {
    expect(parseStudentAppV2('ture').kind).toBe('invalid');
    expect(parseStudentAppV2('yes').kind).toBe('invalid');
    // 裸 id 列表也不行 —— 必须显式前缀
    expect(parseStudentAppV2('t1_normal,t2').kind).toBe('invalid');
  });

  it('`student:` 后面空着 = 配置错误，不是 off', () => {
    expect(parseStudentAppV2('student:').kind).toBe('invalid');
    expect(parseStudentAppV2('student: , ').kind).toBe('invalid');
  });
});

describe('版本判定 —— fail-closed 到 v1', () => {
  it('off → 一律 v1', () => {
    expect(studentAppVersionFor({ kind: 'off' }, 't1')).toBe('v1');
  });
  it('all → v2', () => {
    expect(studentAppVersionFor({ kind: 'all' }, 't1')).toBe('v2');
  });
  it('点名的学生 → v2，没点名的 → v1', () => {
    const cfg = parseStudentAppV2('student:t1,t2');
    expect(studentAppVersionFor(cfg, 't1')).toBe('v2');
    expect(studentAppVersionFor(cfg, 't3')).toBe('v1');
  });
  it('**学生 id 缺失 → v1**（不是 v2）', () => {
    const cfg = parseStudentAppV2('student:t1');
    expect(studentAppVersionFor(cfg, null)).toBe('v1');
    expect(studentAppVersionFor(cfg, undefined)).toBe('v1');
    expect(studentAppVersionFor(cfg, '  ')).toBe('v1');
  });
  it('**非法配置 → v1**（不是崩，也不是 v2）', () => {
    expect(studentAppVersionFor(parseStudentAppV2('ture'), 't1')).toBe('v1');
  });
});

describe('STUDENT_APP_ORIGIN 规范化', () => {
  it('去掉尾斜杠', () => {
    expect(normalizeStudentAppOrigin('https://a.example.invalid/')).toBe('https://a.example.invalid');
    expect(normalizeStudentAppOrigin('https://a.example.invalid///')).toBe('https://a.example.invalid');
  });
  it('空 → null', () => {
    expect(normalizeStudentAppOrigin(undefined)).toBeNull();
    expect(normalizeStudentAppOrigin('  ')).toBeNull();
  });
  it('**带路径 / 查询串的不算合法 origin**', () => {
    expect(isValidStudentAppOrigin('https://a.example.invalid/app')).toBe(false);
    expect(isValidStudentAppOrigin('https://a.example.invalid?x=1')).toBe(false);
    expect(isValidStudentAppOrigin('a.example.invalid')).toBe(false);
    expect(isValidStudentAppOrigin('ftp://a.example.invalid')).toBe(false);
  });
  it('合法 origin 与「没配」都算通过', () => {
    expect(isValidStudentAppOrigin('https://a.example.invalid')).toBe(true);
    expect(isValidStudentAppOrigin('http://localhost:5273')).toBe(true);
    expect(isValidStudentAppOrigin(null)).toBe(true);
  });
});

describe('启动守卫 —— 生产环境非法配置必须拒绝启动', () => {
  it('生产 + 非法 STUDENT_APP_V2 → 抛', () => {
    expect(() =>
      assertStudentAppRoutingConfig({ NODE_ENV: 'production', STUDENT_APP_V2: 'ture' }),
    ).toThrow(/STUDENT_APP_V2/);
  });

  it('生产 + 非法 origin → 抛', () => {
    expect(() =>
      assertStudentAppRoutingConfig({
        NODE_ENV: 'production',
        STUDENT_APP_V2: 'off',
        STUDENT_APP_ORIGIN: 'https://a.example.invalid/app',
      }),
    ).toThrow(/STUDENT_APP_ORIGIN/);
  });

  it('**生产 + 开了 v2 却没配 origin → 抛**（被点名的学生没有地址可去）', () => {
    expect(() =>
      assertStudentAppRoutingConfig({ NODE_ENV: 'production', STUDENT_APP_V2: 'student:t1' }),
    ).toThrow(/STUDENT_APP_ORIGIN/);
  });

  it('生产 + 全关（默认）→ 通过', () => {
    expect(() => assertStudentAppRoutingConfig({ NODE_ENV: 'production' })).not.toThrow();
  });

  it('生产 + 完整配置 → 通过，且摘要里带上范围', () => {
    const s = assertStudentAppRoutingConfig({
      NODE_ENV: 'production',
      STUDENT_APP_V2: 'student:t1,t2',
      STUDENT_APP_ORIGIN: 'https://a.example.invalid',
    });
    expect(s).toContain('2 student(s)');
    expect(s).toContain('https://a.example.invalid');
  });

  it('**非生产环境只警告、不抛** —— 本地经常写半截值', () => {
    expect(() => assertStudentAppRoutingConfig({ NODE_ENV: 'test', STUDENT_APP_V2: 'ture' })).not.toThrow();
    expect(assertStudentAppRoutingConfig({ NODE_ENV: 'test', STUDENT_APP_V2: 'ture' })).toMatch(/INVALID/);
  });
});

describe('反向对照 —— 判据被改回去就会红', () => {
  it('若 fail-closed 改成 fail-open，「学生 id 缺失」这一条必然变红', () => {
    // 这一条钉的是「拿不准就留在旧端」。把 studentAppVersionFor 改成
    // 「id 缺失时返回 v2」，上面那个用例会立刻失败 —— 这就是它的鉴别力。
    expect(studentAppVersionFor(parseStudentAppV2('student:t1'), '')).toBe('v1');
  });
});
