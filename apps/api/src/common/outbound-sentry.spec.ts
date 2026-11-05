import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ init: vi.fn(), send: vi.fn(), flush: vi.fn() }));
vi.mock('@sentry/nestjs', () => ({
  init: mocks.init,
  makeNodeTransport: () => ({ send: mocks.send, flush: mocks.flush }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('SENTRY_DSN', 'https://fake@example.invalid/1');
  vi.stubEnv('OUTBOUND_ALLOW', undefined);
  mocks.init.mockReset(); mocks.send.mockReset(); mocks.flush.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('Sentry outbound boundary', () => {
  it('does not initialize the SDK when the gate excludes sentry', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'public_translation,web_push');
    expect((await import('../instrument')).sentryEnabled).toBe(false);
    expect(mocks.init).toHaveBeenCalledTimes(0);
  });
  it('checks buffered sends as well as events after initialization', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'sentry');
    expect((await import('../instrument')).sentryEnabled).toBe(true);
    const options = mocks.init.mock.calls[0][0];
    const transport = options.transport({});
    mocks.send.mockResolvedValue({ statusCode: 200 });
    await transport.send([]);
    vi.stubEnv('OUTBOUND_ALLOW', '');
    expect(options.beforeSend({ message: 'example' })).toBeNull();
    await transport.send([]);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
