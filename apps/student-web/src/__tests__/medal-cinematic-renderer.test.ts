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
  const rotation = { x: 0, y: 0, z: 0, set: vi.fn((x: number, y: number, z: number) => { rotation.x = x; rotation.y = y; rotation.z = z; }) };
  const de = { loading, reducedMotion: reduced, autoRotate: false, view: 'front', playing: false, capturePaused: false };
  const node = { setAttribute: vi.fn() };
  const context = {
    ka: new URLSearchParams(ceremony ? 'ceremony=1' : ''), Va: locked, zr: reduced,
    document: { documentElement: { dataset: {} }, hidden: false },
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
  return { ...context, run, rotation };
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

  it('the production render loop reaches the back halfway and completes after 1,600 ms', () => {
    const h = harness(); h.run('beginCinematicCeremony(); x0(300)');
    expect(h.rotation.y).toBe(0);
    h.run('x0(1100)');
    expect(h.rotation.y).toBeCloseTo(Math.PI);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started']);
    h.run('x0(1899)'); expect(h.de.playing).toBe(true);
    h.run('x0(1900)');
    expect(h.de.playing).toBe(false); expect(h.rotation.y).toBe(0);
    expect(h.Ws.mock.calls.map(call => call[0])).toEqual(['started', 'complete']);
    h.run('x0(2400)');
    expect(h.rotation.y).toBe(0); expect(h.Ws).toHaveBeenCalledTimes(2);
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
