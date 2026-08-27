/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 独立源拓扑（D7）：新端**独占一个源的根路径**，没有 /app 前缀。
// base 保持 '/' —— 换域名不影响构建产物。
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5273, host: '0.0.0.0' },
  build: { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
