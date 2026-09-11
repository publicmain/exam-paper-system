/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 独立源拓扑（D7）：新端**独占一个源的根路径**，没有 /app 前缀。
// base 保持 '/' —— 换域名不影响构建产物。
//
// STUDENT_FX=1 且是 dev server 时才挂开发期假接口（dev-fixtures/，只为截图走查）；
// 生产构建与测试都不加载它。
export default defineConfig(async ({ command }) => ({
  plugins: [
    react(),
    ...(command === 'serve' && process.env.STUDENT_FX === '1'
      ? [(await import('./dev-fixtures/plugin.mjs')).fixturePlugin()]
      : []),
  ],
  base: '/',
  server: { port: 5273, host: '0.0.0.0' },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 本机常有多个测试进程并行（API / 教师端 / 学生端），默认 5 秒在高负载下会误报超时；
    // 只放宽时间预算，不改任何断言。
    testTimeout: 15_000,
  },
}));
