import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const assetRoot = path.resolve(__dirname, '../../public/medals/v5');
const renderer = fs.readFileSync(path.join(assetRoot, 'renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(assetRoot, 'viewer.html'), 'utf8');
const start = renderer.indexOf('/* Cinematic ceremony:');
const end = renderer.indexOf('/* End cinematic ceremony. */');
const ceremonySource = renderer.slice(start, end);
const renderLoop = renderer.slice(renderer.indexOf('function x0(s){'), renderer.indexOf('function En(){'));

// Exercise the actual bundled ceremony functions without mocking all of Three.js.
function harness({ ceremony = true, locked = false, reduced = false, loading = false } = {}) {
  const listeners: Record<string, () => void> = {};
  const rotation = { x: 0, y: 0, z: 0, set: vi.fn((x: number, y: number, z: number) => { rotation.x = x; rotation.y = y; rotation.z = z; }) };
  const de = { loading, reducedMotion: reduced, autoRotate: false, view: 'front', playing: false, capturePaused: false };
  const node = { setAttribute: vi.fn() };
  const context = {
    ka: new URLSearchParams(ceremony ? 'ceremony=1' : ''), Va: locked, zr: reduced,
    document: { documentElement: { dataset: {} }, hidden: false, addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; } },
    de, Nt: { rotation }, Ha: { matches: false }, Ut: {},
    yt: { domElement: { classList: { remove: vi.fn() } }, render: vi.fn() },
    _i: new Map(), Br: null, gi: null, ts: 0, es: 0, xi: 0, dd: 0,
    Wl: 300, za: 0, ni: {}, Et: {}, cn: { lerp: (a: number, b: number, p: number) => a + (b - a) * p },
    performance: { now: () => 300 },
    un: { dataset: {} }, vi: { classList: { add: vi.fn() } },
    Pe: () => node, Ws: vi.fn(), Ga: vi.fn(), en: vi.fn(),
    Wa: vi.fn(() => { de.playing = false; de.capturePaused = false; }),
    En: () => ({ ...de }),
  };
  const scope = vm.createContext(context);
  vm.runInContext(ceremonySource, scope);
  vm.runInContext('function An(){return finishCinematicCeremony()}' + renderLoop, scope);
  const run = (source: string) => vm.runInContext(source, scope);
  /** Drive real animation frames: `step` ms apart, as a browser would. */
  const frames = (from: number, count: number, step = 16) => {
    let at = from;
    for (let index = 0; index < count; index += 1) { at += step; run(`x0(${at})`); }
    return at;
  };
  return { ...context, run, rotation, frames, listeners };
}

describe('cinematic 3D coin ceremony', () => {
  it('holds the ready medal at the front until an explicit start, and starts only once', () => {
    const h = harness();
    expect(h.de.playing).toBe(false);
    expect(h.Ws).not.toHaveBeenCalled();
    h.run('beginCinematicCeremony()');
    expect(h.de.playing).toBe(true);
    expect(h.run('xi')).toBe(1.6);
    expect(h.run('dd')).toBe(300);
    expect(h.Ws).toHaveBeenCalledTimes(1); expect(h.Ws).toHaveBeenCalledWith('started');
    h.run('beginCinematicCeremony()');
    expect(h.Ws).toHaveBeenCalledTimes(1);
  });

  it('turns once, only around the vertical axis, then holds the exact front', () => {
    const h = harness(); h.run('beginCinematicCeremony()');
    let previous = -1;
    for (let step = 0; step <= 20; step++) {
      h.run(`setCeremonyProgress(${step / 20})`);
      expect(h.rotation.x).toBe(0); expect(h.rotation.z).toBe(0);
      expect(h.rotation.y).toBeGreaterThanOrEqual(previous);
      expect(h.rotation.y).toBeLessThanOrEqual(Math.PI * 2);
      previous = h.rotation.y;
    }
    expect(h.rotation.y).toBeCloseTo(Math.PI * 2);
    h.run('setCeremonyProgress(.5)');
    expect(h.rotation.y).toBeCloseTo(Math.PI);
    h.run('finishCinematicCeremony()');
    expect(h.rotation.y).toBe(0); expect(h.de.playing).toBe(false);
    expect(h.de.view).toBe('front');
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    h.run('finishCinematicCeremony(); beginCinematicCeremony()');
    expect(h.Ws).toHaveBeenCalledTimes(2);
  });

  it('reduced motion finishes without a spin or completion deadlock', () => {
    const h = harness({ reduced: true }); h.run('beginCinematicCeremony()');
    expect(h.rotation.y).toBe(0); expect(h.de.playing).toBe(false);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    expect(h.run('ceremonyCompleted')).toBe(true);
  });

  it('the production render loop reaches the back halfway and completes after 1,600 ms of frames', () => {
    const h = harness(); h.run('beginCinematicCeremony()');
    h.frames(300, 50); // 50 × 16 ms = 0.8 s
    expect(h.rotation.y).toBeCloseTo(Math.PI);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started']);
    const at = h.frames(300 + 50 * 16, 49);
    expect(h.de.playing).toBe(true);
    h.run(`x0(${at + 16})`);
    expect(h.de.playing).toBe(false); expect(h.rotation.y).toBe(0);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    h.frames(at + 16, 5);
    expect(h.rotation.y).toBe(0); expect(h.Ws).toHaveBeenCalledTimes(2);
  });

  // 2026-09-18：手机上「转到一半卡一下，直接跳到结束状态」。原来进度按墙上时间算，
  // 卡顿后的第一帧就 >=1。现在按每帧实际间隔累计（上限 50 ms），卡顿只会让它慢，不会跳过。
  it('a long stall slows the spin instead of skipping it', () => {
    const h = harness(); h.run('beginCinematicCeremony()');
    h.run('x0(2300)'); // 主线程卡了 2 秒
    expect(h.de.playing).toBe(true);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started']);
    expect(h.rotation.y).toBeLessThan(Math.PI / 4);
    const seen: number[] = [];
    let at = 2300;
    for (let index = 0; index < 200 && h.de.playing; index += 1) { at += 16; h.run(`x0(${at})`); seen.push(h.rotation.y); }
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    expect(seen.some(y => Math.abs(y - Math.PI) < 0.3)).toBe(true); // 背面真的露过
    expect(seen.some(y => y > Math.PI * 1.7)).toBe(true); // 也转回过正面前的最后一段
  });

  it('a very slow device still ends within four seconds', () => {
    const h = harness(); h.run('beginCinematicCeremony()');
    // 8 fps：每帧只推进 50 ms，光靠帧数要 3.2 s 以上，这里由墙上时间封顶收尾。
    let at = 300;
    for (let index = 0; index < 40 && h.de.playing; index += 1) { at += 125; h.run(`x0(${at})`); }
    expect(h.de.playing).toBe(false);
    expect(at - 300).toBeLessThanOrEqual(4125);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
  });

  it('a completion while the tab is hidden is delivered when it comes back', () => {
    const h = harness(); h.run('beginCinematicCeremony()');
    h.document.hidden = true;
    h.frames(300, 120);
    expect(h.run('ceremonyCompleted')).toBe(true);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started']);
    h.document.hidden = false;
    h.listeners.visibilitychange?.();
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    h.listeners.visibilitychange?.();
    expect(h.Ws).toHaveBeenCalledTimes(2);
  });

  it.each([{ ceremony: false }, { locked: true }, { loading: true }])('does not start in an ineligible state: %o', options => {
    const h = harness(options); h.run('beginCinematicCeremony()');
    expect(h.de.playing).toBe(false); expect(h.Ws).not.toHaveBeenCalled();
  });

  it('provides deterministic capture positions without restarting the spin', () => {
    const h = harness(); h.run('captureCinematicCeremony(.5)');
    expect(h.de.capturePaused).toBe(true); expect(h.rotation.y).toBeCloseTo(Math.PI);
    h.run('captureCinematicCeremony(1)');
    expect(h.rotation.y).toBeCloseTo(Math.PI * 2);
    expect(h.Ws).toHaveBeenCalledTimes(1); expect(h.Ws).toHaveBeenCalledWith('started');
  });

  it('polishes a shared metal surface only once, without changing its color or geometry', () => {
    const h = harness();
    const result = h.run(`(() => {
      const color={r:.83,g:.58,b:.2},geometry={};
      const material={metalness:.88,roughness:.21,color};
      const a={material,geometry},b={material,geometry};
      configureCeremonySurface(a); configureCeremonySurface(b);
      return {roughness:material.roughness,colorUnchanged:material.color===color,geometryUnchanged:a.geometry===geometry,cast:a.castShadow,receive:a.receiveShadow};
    })()`);
    expect(result.roughness).toBeCloseTo(.168);
    expect(result.colorUnchanged).toBe(true); expect(result.geometryUnchanged).toBe(true);
    expect(result.cast).toBe(true); expect(result.receive).toBe(true);
  });

  it('never changes collection-view lighting or materials', () => {
    const h = harness({ ceremony: false });
    const result = h.run(`(() => { const mesh={material:{metalness:.88,roughness:.21}}; configureCeremonySurface(mesh); configureCeremonyStudio(); configureCeremonyEnvironment({}); return mesh; })()`);
    expect(result.material.roughness).toBe(.21);
    expect(result.castShadow).toBeUndefined(); expect(result.receiveShadow).toBeUndefined();
  });

  it('makes only ceremony transparent and effect-free, preserving the normal viewer', () => {
    expect(html).toContain('html[data-ceremony="true"],html[data-ceremony="true"] body,html[data-ceremony="true"] #stage{background:transparent}');
    expect(html).toContain('[data-ceremony="true"] .reveal-overlay');
    expect(html).toContain('[data-ceremony="true"] .reveal-progress');
    expect(renderer).toContain('yt.setClearColor(0,0)');
    expect(renderer).toContain('!ceremonyMode&&h0&&requestAnimationFrame(Xa)');
    expect(renderer).toContain('function _0(){if(ceremonyMode)return;');
    expect(renderer).toContain('s.origin!==location.origin||s.source!==parent||s.data?.type!=="equistar-medal-control"');
  });

  it('matches the parent ceremony iframe light scheme without changing the ordinary viewer scheme', () => {
    // A dark iframe element embedding a light child can get an opaque browser
    // canvas despite transparent CSS. Both sides must explicitly agree.
    const withoutComments = html.replace(/\/\*[\s\S]*?\*\//g, '');
    const lightRules = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => /color-scheme\s*:\s*light\s*(?:;|$)/.test(match[2]));
    expect(lightRules.length).toBeGreaterThan(0);
    expect(lightRules.some((match) => match[1].trim() === 'html[data-ceremony="true"]')).toBe(true);
    for (const rule of lightRules) {
      expect(rule[1].split(',').every(selector => selector.includes('[data-ceremony="true"]'))).toBe(true);
    }
  });
});
