import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// 独立源拓扑（D7）：新端独占一个源的根路径，**没有 basename**。
//
// 刻意**不注册 Service Worker** —— 阶段 4A 不做 PWA 缓存。旧端那套
// （作用域 `/`、cache-first、离线兜底指向旧路由）是整个重建里最大的
// 单点风险，新端要等到有明确的 SW 退役/更新方案时再谈。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
