import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary, initSentry } from './lib/sentry';
import './index.css';

initSentry();

// 独立源拓扑（D7）：新端独占一个源的根路径，**没有 basename**。
//
// **不在这里注册 Service Worker。** 4A 不做 PWA 缓存 —— 旧端那套
// （作用域 `/`、cache-first、离线兜底指向旧路由）是整个重建里最大的
// 单点风险。2026-09-10 加的推送 worker（public/sw.js）只在学生自己点
// 「开启提醒」时才注册（lib/push.ts），而且它没有 fetch 监听器 ——
// 不缓存任何东西，新版本一发布刷新就是新的。

/** 整个页面炸了也给一条能走的路 —— 白屏是最糟的失败方式。 */
function Crashed() {
  return (
    <div style={{ padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ fontSize: 16, marginBottom: 12 }}>页面出了点问题。</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff' }}
      >
        刷新一下
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<Crashed />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
