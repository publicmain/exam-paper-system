/**
 * public/sw.js：缓存只是锦上添花，坏了不能拖垮页面（2026-10-08）。
 *
 * 背景：一台老师电脑的 Chrome 存储坏了（caches.open / storage.estimate 都报
 * 「Unexpected internal error」）。旧版 SW 拿到 200 的页面后 `await caches.open()`
 * 抛错 → 掉进 catch → caches.match 也抛 → respondWith 被拒 → 每个页面都是
 * ERR_FAILED，而服务器日志全是 200。这里把 sw.js 原样装进一个假的 SW 全局里跑。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const SRC = readFileSync(path.resolve(__dirname, '../../../public/sw.js'), 'utf8');
const ORIGIN = 'https://teacher.example';

type Res = { ok: boolean; status: number; body: string; clone(): Res };
const res = (body: string, status = 200): Res => ({ ok: status < 400, status, body, clone() { return this; } });

function brokenCaches() {
  const boom = () => Promise.reject(new Error('Unexpected internal error.'));
  return { open: vi.fn(boom), match: vi.fn(boom), keys: vi.fn(boom), delete: vi.fn(boom) };
}

function workingCaches(entries: Record<string, Res>) {
  const store = new Map(Object.entries(entries));
  const key = (r: any) => (typeof r === 'string' ? r : new URL(r.url).pathname);
  return {
    open: vi.fn(async () => ({ put: vi.fn(async (r: any, v: Res) => { store.set(key(r), v); }) })),
    match: vi.fn(async (r: any) => store.get(key(r))),
    keys: vi.fn(async () => ['zaoce-pwa-v4']),
    delete: vi.fn(async () => true),
  };
}

function loadSw(caches: any, fetchImpl: (req: any) => Promise<Res>) {
  const handlers: Record<string, (e: any) => void> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: any) => void) => { handlers[type] = fn; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };
  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', SRC)(self, caches, vi.fn(fetchImpl));
  const dispatchFetch = (pathname: string, mode = 'navigate') => {
    let responded: Promise<Res> | undefined;
    handlers.fetch({ request: { method: 'GET', mode, url: ORIGIN + pathname }, respondWith: (p: Promise<Res>) => { responded = p; } });
    return responded!;
  };
  return { self, handlers, dispatchFetch };
}

describe('sw.js — 缓存坏了页面照常打开', () => {
  it('存储坏了：页面拿网络的 200，不再 ERR_FAILED', async () => {
    const { dispatchFetch } = loadSw(brokenCaches(), async () => res('<html>shell</html>'));
    await expect(dispatchFetch('/papers/new')).resolves.toMatchObject({ status: 200, body: '<html>shell</html>' });
  });

  it('存储坏了：静态资源也直接走网络', async () => {
    const { dispatchFetch } = loadSw(brokenCaches(), async () => res('js'));
    await expect(dispatchFetch('/assets/index-abc.js', 'no-cors')).resolves.toMatchObject({ status: 200, body: 'js' });
  });

  it('存储坏了：激活时清旧缓存失败也照样接管页面', async () => {
    const { self, handlers } = loadSw(brokenCaches(), async () => res(''));
    let pending: Promise<unknown> | undefined;
    handlers.activate({ waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await expect(pending).resolves.toBeUndefined();
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('离线 + 缓存正常：仍回退到缓存的外壳（原有行为不变）', async () => {
    const { dispatchFetch } = loadSw(workingCaches({ '/': res('cached shell') }), async () => { throw new TypeError('offline'); });
    await expect(dispatchFetch('/papers/new')).resolves.toMatchObject({ body: 'cached shell' });
  });

  it('离线 + 存储坏了：没东西可回退，照常报网络错误', async () => {
    const { dispatchFetch } = loadSw(brokenCaches(), async () => { throw new TypeError('offline'); });
    await expect(dispatchFetch('/papers/new')).rejects.toThrow('offline');
  });

  it('在线 + 缓存正常：页面照样写进缓存，供离线时用', async () => {
    const caches = workingCaches({});
    const { dispatchFetch } = loadSw(caches, async () => res('fresh'));
    await dispatchFetch('/my-lesson');
    await vi.waitFor(() => expect(caches.open).toHaveBeenCalledWith('zaoce-pwa-v5'));
    await expect(caches.match('/my-lesson')).resolves.toMatchObject({ body: 'fresh' });
  });
});
