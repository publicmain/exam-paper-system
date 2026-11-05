/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind 0.0.0.0 so iPad / phone on the same LAN can reach the dev
    // server. Required for the morning-quiz QR-scan flow when the
    // projector / student devices are different from the dev host.
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // 第二个 HTML 入口：快速考勤（马里奥主题静态页）。2026-11-05 之前它放在
    // public/ 里、名单写死在页面里，任何人不登录就能打开。挪成 Vite 入口
    // 是为了让页面拿到构建期的 VITE_API_URL，登录后从接口读名单。
    // 用相对路径（相对 apps/web，即 vite 的 root / npm run build 的 cwd）：
    // 本机 C:\Users\...\Projects 是指向 D:\ 的 junction，写成绝对路径时
    // root 与入口不在同一盘符，vite 会报 "fileName must not be absolute"。
    rollupOptions: {
      input: {
        main: 'index.html',
        quickAttendance: 'quick-attendance.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
