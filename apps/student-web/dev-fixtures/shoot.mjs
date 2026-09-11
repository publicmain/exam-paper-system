/**
 * 截图矩阵（审计 IOS-12 / §8.2）—— 用 Puppeteer 自带的 Chromium 按「页面 × 场景 × 视口 × 深浅色」截图，
 * 同时量两件机器能量的事：
 *   · 横向溢出：document.scrollingElement.scrollWidth > clientWidth（320px 等宽下必须为 false）；
 *   · 触控命中区：可见的 button / a / [role=button|tab|radio] / input 中，宽或高 < 44 CSS px 的清单。
 *
 * 这是 **Chromium 视口模拟**，不是 Safari 真机，报告里如实这么写。
 *
 *   node apps/student-web/dev-fixtures/shoot.mjs --base=http://localhost:5273 --out=.local/audit/screens/after \
 *        [--only=today,reading] [--widths=390,1180] [--dark]
 */
import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BASE = arg('base', 'http://localhost:5273');
const OUT = arg('out', '.local/audit/screens/after');
const ONLY = arg('only', '')?.split(',').filter(Boolean);
const WIDTHS = arg('widths', '')?.split(',').filter(Boolean).map(Number);
const THEMES = process.argv.includes('--dark') ? ['light', 'dark'] : process.argv.includes('--dark-only') ? ['dark'] : ['light'];
const FULL = process.argv.includes('--full');

/** 视口：宽 × 高（CSS px）。手机按竖屏；平板含竖横与分屏临界。 */
const VIEWPORTS = [
  { w: 320, h: 568, mobile: true },
  { w: 390, h: 844, mobile: true },
  { w: 430, h: 932, mobile: true },
  { w: 640, h: 900, mobile: false },
  { w: 744, h: 1133, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 820, h: 1180, mobile: true },
  { w: 1024, h: 768, mobile: true },
  { w: 1180, h: 820, mobile: true },
  { w: 1366, h: 1024, mobile: false },
];

/** 页面 × 场景。`setup` 在截图前在页面里执行（点开某个面板等）。 */
const SHOTS = [
  { id: 'login', path: '/login', scenario: 'fresh', auth: false },
  { id: 'register', path: '/register', scenario: 'fresh', auth: false },
  { id: 'today-fresh', path: '/today', scenario: 'fresh' },
  { id: 'today-midday', path: '/today', scenario: 'midday' },
  { id: 'today-backlog', path: '/today', scenario: 'backlog' },
  { id: 'today-done', path: '/today', scenario: 'done' },
  { id: 'today-weekend', path: '/today', scenario: 'weekend' },
  { id: 'today-overview-fail', path: '/today', scenario: 'midday', extra: '&fail=/vocab-v2/overview:500' },
  { id: 'today-offline', path: '/today', scenario: 'midday', extra: '&fail=/lesson/today:503' },
  { id: 'reading', path: '/lesson/reading?sessionId=fx_ses_olevel_20260915', scenario: 'midday', start: '/lesson/start' },
  { id: 'reading-authentic', path: '/lesson/reading?sessionId=fx_ses_ielts_authentic_20260915', scenario: 'midday', extra: '&level=ielts_authentic', start: '/lesson/start' },
  { id: 'reading-result', path: '/lesson/reading/result', scenario: 'done' },
  { id: 'scores', path: '/scores', scenario: 'done' },
  { id: 'score-detail', path: '/scores/fx_sub_olevel_20260911', scenario: 'done' },
  { id: 'vocab', path: '/vocab', scenario: 'midday' },
  { id: 'vocab-500', path: '/vocab', scenario: 'midday', extra: '&words=500' },
  { id: 'vocab-empty', path: '/vocab', scenario: 'fresh', extra: '&words=0' },
  { id: 'learn', path: '/coach/learn', scenario: 'midday' },
  { id: 'test', path: '/coach/test?sessionId=fx_test_2026-09-14', scenario: 'midday' },
  { id: 'summary', path: '/lesson/summary', scenario: 'done' },
  { id: 'account', path: '/account', scenario: 'midday' },
  { id: 'account-longname', path: '/account', scenario: 'midday', extra: '&student=' + encodeURIComponent('欧阳思琪·Nicole Tan Xin Yi') },
  { id: 'mistakes', path: '/mistakes', scenario: 'midday' },
];

const shots = ONLY?.length ? SHOTS.filter((s) => ONLY.some((o) => s.id.startsWith(o))) : SHOTS;
const viewports = WIDTHS?.length ? VIEWPORTS.filter((v) => WIDTHS.includes(v.w)) : VIEWPORTS;

mkdirSync(OUT, { recursive: true });
// 用本机已装的 Chrome（不下载浏览器）；没有就退到 Edge
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ headless: true, executablePath: EXE, args: ['--font-render-hinting=none'] });
const results = [];
try {
  for (const theme of THEMES) {
    for (const vp of viewports) {
      for (const shot of shots) {
        const page = await browser.newPage();
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
        await page.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: theme },
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ]);
        await page.evaluateOnNewDocument((auth) => {
          try {
            if (auth) localStorage.setItem('sw:token', 'fx-token');
            else localStorage.removeItem('sw:token');
            // 首页提醒弹窗一天一次；截首页主体时先记成「今天已提醒」，弹窗另截
            const d = new Date();
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            localStorage.setItem('sw:vocab-test-reminded', key);
          } catch {
            /* ignore */
          }
        }, shot.auth !== false);
        await fetch(`${BASE}/__fx/scenario?name=${shot.scenario}${shot.extra ?? ''}`);
        if (shot.start) await fetch(`${BASE}/__fx/api${shot.start}`, { method: 'POST' });
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
        await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle0', timeout: 20000 }).catch((e) => errors.push(`goto: ${e.message}`));
        await new Promise((r) => setTimeout(r, 400));
        const metrics = await page.evaluate(() => {
          const se = document.scrollingElement || document.documentElement;
          const small = [];
          for (const el of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="radio"], input:not([type="hidden"]), select, textarea, summary')) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
            // 视觉隐藏（sr-only，只在键盘聚焦时出现）的元素不在这里量；它们聚焦时另有 ≥44px 样式
            if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || (cs.position === 'absolute' && r.width <= 1 && r.height <= 1)) continue;
            // 正文里的词链接 / 行内查词不要求 44px 方块（审计 H5 说明）
            if (el.closest('[data-inline-word]')) continue;
            // 原生单选 / 复选：由包住它的 label 提供命中区
            if ((el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) {
              const lr = el.closest('label').getBoundingClientRect();
              if (lr.width >= 44 && lr.height >= 44) continue;
            }
            if (r.width < 44 || r.height < 44) {
              small.push({
                tag: el.tagName.toLowerCase(),
                name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30),
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }
          return {
            overflowX: se.scrollWidth > se.clientWidth + 1,
            scrollWidth: se.scrollWidth,
            clientWidth: se.clientWidth,
            docHeight: se.scrollHeight,
            h1: [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim()).slice(0, 2),
            small: small.slice(0, 40),
            smallCount: small.length,
          };
        });
        const file = `${shot.id}__${vp.w}x${vp.h}__${theme}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: FULL });
        results.push({ shot: shot.id, path: shot.path, scenario: shot.scenario, w: vp.w, h: vp.h, theme, file, errors, ...metrics });
        process.stdout.write(`${metrics.overflowX ? '✗' : '✓'} ${file}  small=${metrics.smallCount}${errors.length ? ' ERR' : ''}\n`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
  writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(results, null, 1));
}
