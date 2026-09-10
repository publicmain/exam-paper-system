import { describe, expect, it } from 'vitest';
import { HttpException, NotFoundException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

/**
 * Sentry 装饰器挂上之后，异常过滤器**没配 DSN 时**的行为必须一字不变。
 * 这条测的不是 Sentry，是「加了它别把原来的东西弄坏」。
 */
function fakeHost(method = 'GET', url = '/api/x') {
  let status = 0;
  let body: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(b: unknown) { body = b; return this; },
  };
  const req = { method, originalUrl: url, url };
  const host: any = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) };
  return { host, get status() { return status; }, get body() { return body; } };
}

describe('异常过滤器 + Sentry 装饰器（无 DSN）', () => {
  const filter = new GlobalExceptionFilter();

  it('HttpException 原样透传', () => {
    const h = fakeHost();
    filter.catch(new NotFoundException({ code: 'nope' }), h.host);
    expect(h.status).toBe(404);
    expect(h.body).toMatchObject({ code: 'nope' });
  });

  it('未建模的错误 → 500，不带堆栈（生产）', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const h = fakeHost('POST', '/api/y');
      filter.catch(new Error('db exploded'), h.host);
      expect(h.status).toBe(500);
      expect(h.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('自带 status 的错误按它的 status 回', () => {
    const h = fakeHost();
    filter.catch(Object.assign(new Error('teapot'), { status: 418 }), h.host);
    expect(h.status).toBe(418);
  });

  it('HttpException 的 5xx 也走透传（不被装饰器吞掉）', () => {
    const h = fakeHost();
    filter.catch(new HttpException({ code: 'upstream' }, 503), h.host);
    expect(h.status).toBe(503);
    expect(h.body).toMatchObject({ code: 'upstream' });
  });
});
