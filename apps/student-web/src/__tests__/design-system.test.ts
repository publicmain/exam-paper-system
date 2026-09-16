/**
 * 设计系统守卫（2026-09-11 审计 IOS-02 / IOS-03）。
 *
 * 1. 颜色只能用语义 token —— 原生调色板类名（text-slate-400 这种）既过不了对比度，
 *    深色模式下也不会变。
 * 2. token 的每一对「文字 / 底色」「控件边界 / 底色」在浅深两套下都达到 WCAG 2.2
 *    的门槛（正文 4.5:1，控件边界 3:1）。数值从 tokens.css 现读现算，不信注释。
 * 3. 深色模式对每个浅色 token 都有定义，不会有「只翻了背景」的漏网变量。
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 去掉注释，免得「为什么不用 text-slate-400」这种说明被当成违规。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

const PALETTE =
  /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|divide|outline|from|to|via|fill|stroke|placeholder|decoration|caret|accent)-(?:white|black|slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)(?:-\d{2,3})?(?:\/\d{1,3})?(?![\w-])/;
const HEX_CLASS = /(?<![\w-])(?:bg|text|border|ring|shadow|from|to|via)-\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/;

describe('颜色只走语义 token', () => {
  const files = walk(SRC);

  it('**学生端源码里没有原生调色板类名**', () => {
    const hits: string[] = [];
    for (const f of files) {
      const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const m = line.match(PALETTE);
        if (m) hits.push(`${path.relative(SRC, f)}:${i + 1} ${m[0]}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('**类名里没有写死的十六进制颜色**（#007aff 白字只有 4.02:1）', () => {
    const hits: string[] = [];
    for (const f of files) {
      const lines = stripComments(fs.readFileSync(f, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const m = line.match(HEX_CLASS);
        if (m) hits.push(`${path.relative(SRC, f)}:${i + 1} ${m[0]}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('反向夹具：守卫抓得住原生调色板和写死颜色', () => {
    expect(PALETTE.test('className="text-slate-400"')).toBe(true);
    expect(PALETTE.test('hover:bg-blue-600/80')).toBe(true);
    expect(PALETTE.test('border-t-slate-200')).toBe(true);
    expect(PALETTE.test('text-ink-3 bg-accent-soft')).toBe(false);
    expect(HEX_CLASS.test('bg-[#007aff]')).toBe(true);
    expect(HEX_CLASS.test('shadow-[0_8px_22px_#007aff33]')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// token 对比度 —— 从 tokens.css 现读现算
// ─────────────────────────────────────────────────────────────

type Theme = Record<string, [number, number, number]>;

function parseTokens(): { light: Theme; dark: Theme } {
  const css = fs.readFileSync(path.join(SRC, 'design', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const read = (block: string): Theme => {
    const out: Theme = {};
    for (const m of block.matchAll(/--c-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
      out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
    }
    return out;
  };
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  expect(darkStart).toBeGreaterThan(0);
  const light = read(css.slice(0, darkStart));
  const dark = { ...light, ...read(css.slice(darkStart)) };
  return { light, dark };
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** [前景, 背景, 门槛]。文字 4.5，控件边界 / 必要非文字 3。 */
const PAIRS: Array<[string, string, number]> = [
  ['ink', 'canvas', 4.5],
  ['ink', 'surface', 4.5],
  ['ink-2', 'surface', 4.5],
  ['ink-2', 'canvas', 4.5],
  ['ink-3', 'surface', 4.5],
  ['ink-3', 'surface-2', 4.5],
  ['ink-3', 'canvas', 4.5],
  ['ink-3', 'fill', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'canvas', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['accent', 'surface-2', 4.5],
  ['on-accent', 'accent-fill', 4.5],
  ['on-accent', 'accent-hover', 4.5],
  ['on-accent', 'accent-pressed', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-soft', 4.5],
  ['warning', 'surface', 4.5],
  ['warning', 'warning-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['ink', 'highlight', 4.5],
  ['on-inverse', 'inverse', 4.5],
  ['on-accent', 'danger-fill', 4.5],
  ['on-accent', 'success-fill', 4.5],
  ['control-line', 'surface', 3],
  ['control-line', 'canvas', 3],
  ['accent-fill', 'canvas', 3],
  ['focus', 'surface', 3],
];

describe('token 对比度（WCAG 2.2，浅深两套）', () => {
  const { light, dark } = parseTokens();
  for (const [name, theme] of [
    ['浅色', light],
    ['深色', dark],
  ] as const) {
    for (const [fg, bg, need] of PAIRS) {
      it(`${name}：${fg} 在 ${bg} 上 ≥ ${need}:1`, () => {
        expect(theme[fg], `缺 --c-${fg}`).toBeDefined();
        expect(theme[bg], `缺 --c-${bg}`).toBeDefined();
        expect(contrast(theme[fg], theme[bg])).toBeGreaterThanOrEqual(need);
      });
    }
  }

  it('**深色模式给每一个颜色 token 都重新定了值**（不是只翻背景）', () => {
    const css = fs.readFileSync(path.join(SRC, 'design', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
    const lightNames = [...css.slice(0, darkStart).matchAll(/--c-([\w-]+):/g)].map((m) => m[1]);
    const darkNames = new Set([...css.slice(darkStart).matchAll(/--c-([\w-]+):/g)].map((m) => m[1]));
    // 遮罩色深浅都是黑，唯一允许不重定义的
    const missing = lightNames.filter((n) => !darkNames.has(n) && n !== 'scrim');
    expect(missing).toEqual([]);
  });

  it('**Tailwind 里引用的每个 token 都在 tokens.css 里有定义**', () => {
    const cfg = fs.readFileSync(path.resolve(SRC, '..', 'tailwind.config.js'), 'utf8');
    const used = [...cfg.matchAll(/v\('([\w-]+)'\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(20);
    for (const n of used) expect(light[n], `tailwind 引用了未定义的 --c-${n}`).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// 深色的两个入口（2026-09-16 学生端明暗切换）
//
// 学生能手动选亮 / 暗之后，深色就有了两个入口：系统的媒体查询，和 <html> 上的
// `data-theme="dark"`。CSS 没法让两个选择器共用一段声明（`light-dark()` 要
// Safari 17.5+，学生的旧 iPad 到不了），所以值写了两遍 —— 这一节保证它们不漂。
// ─────────────────────────────────────────────────────────────

/** 取出 `marker` 后面那对大括号里的全部内容（按花括号配对切）。 */
function blockAfter(css: string, marker: string): string {
  const at = css.indexOf(marker);
  expect(at, `tokens.css 里找不到 ${marker}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`${marker} 的大括号没闭合`);
}

/** 一段声明 → { 变量名: 值 }（空白归一，方便逐字比对）。 */
function decls(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of block.split(';')) {
    const i = part.indexOf('--');
    if (i < 0) continue;
    const colon = part.indexOf(':', i);
    if (colon < 0) continue;
    out[part.slice(i, colon).trim()] = part.slice(colon + 1).trim().replace(/\s+/g, ' ');
  }
  return out;
}

describe('深色的两个入口（手动切换）', () => {
  const css = fs.readFileSync(path.join(SRC, 'design', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it("**媒体查询给手动选择让路**：写成 `:root:not([data-theme='light'])`", () => {
    const media = blockAfter(css, '@media (prefers-color-scheme: dark)');
    expect(media).toContain(":root:not([data-theme='light'])");
    // 裸 `:root {` 会让「系统深色 + 学生选亮色」变成深色 —— 那开关就是假的
    expect(media).not.toMatch(/:root\s*\{/);
  });

  it('**手动暗色与系统暗色逐字一致** —— 改一处必须改另一处', () => {
    const fromMedia = decls(blockAfter(css, ":root:not([data-theme='light'])"));
    const fromAttr = decls(blockAfter(css, ":root[data-theme='dark']"));
    expect(Object.keys(fromAttr).sort()).toEqual(Object.keys(fromMedia).sort());
    expect(fromAttr).toEqual(fromMedia);
    expect(Object.keys(fromMedia).length).toBeGreaterThan(20);
  });

  it('两个手动档各自声明 color-scheme —— 否则表单控件和滚动条还按系统那套画', () => {
    expect(blockAfter(css, ":root[data-theme='light']")).toContain('color-scheme: light');
    expect(blockAfter(css, ":root[data-theme='dark']")).toContain('color-scheme: dark');
  });
});
