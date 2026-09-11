/**
 * 学生端 Tailwind 配置。
 *
 * 颜色只用下面这组**语义名**（值来自 `src/design/tokens.css`，浅深两套）。
 * 原生调色板（slate / blue / rose …）仍在 Tailwind 里，但学生端代码不许直接用 ——
 * `src/__tests__/design-system.test.ts` 会扫源码拦下来。原因：直接写 `text-slate-400`
 * 既过不了对比度（白底 2.56:1），深色模式下也不会跟着变。
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2') },
        fill: { DEFAULT: v('fill'), strong: v('fill-strong') },
        line: v('line'),
        control: v('control-line'),
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3'), 4: v('ink-4') },
        inverse: { DEFAULT: v('inverse'), on: v('on-inverse') },
        accent: {
          DEFAULT: v('accent'),
          fill: v('accent-fill'),
          hover: v('accent-hover'),
          pressed: v('accent-pressed'),
          soft: v('accent-soft'),
          on: v('on-accent'),
        },
        success: { DEFAULT: v('success'), soft: v('success-soft'), fill: v('success-fill') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), fill: v('danger-fill') },
        focus: v('focus'),
        highlight: v('highlight'),
        scrim: v('scrim'),
      },
      borderRadius: {
        control: 'var(--r-control)',
        group: 'var(--r-group)',
        sheet: 'var(--r-sheet)',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      fontSize: {
        // 本项目字号（rem，跟随浏览器文字大小设置；不是 Apple 的 pt 值）
        caption: ['0.8125rem', { lineHeight: '1.4' }], // 13px
        footnote: ['0.875rem', { lineHeight: '1.45' }], // 14px
        callout: ['0.9375rem', { lineHeight: '1.45' }], // 15px
        body: ['1.0625rem', { lineHeight: '1.5' }], // 17px
        reading: ['1.125rem', { lineHeight: '1.75' }], // 18px 阅读正文
        headline: ['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }],
        title3: ['1.25rem', { lineHeight: '1.35', fontWeight: '600' }], // 20px
        title2: ['1.5rem', { lineHeight: '1.3', fontWeight: '700' }], // 24px
        title1: ['1.75rem', { lineHeight: '1.25', fontWeight: '700' }], // 28px
        large: ['2rem', { lineHeight: '1.2', fontWeight: '700' }], // 32px
      },
      spacing: {
        page: 'var(--page-x)',
        tabbar: 'var(--tabbar-h)',
        sidebar: 'var(--sidebar-w)',
        rail: 'var(--rail-w)',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
