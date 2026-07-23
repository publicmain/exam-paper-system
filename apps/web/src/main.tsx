import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// U7 — brand-token CSS (placeholder until design hands over real assets).
import './styles/brand.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Catches every lazy() page chunk in App.tsx, whichever branch of
          the route guard renders. The student entry points (/my-history +
          its detail page) are eager, so this fallback never shows for
          them — it only covers staff pages loading their own chunk. */}
      <Suspense fallback={<div className="p-8 text-gray-500">加载中…</div>}>
        <App />
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);

// PWA: register the service worker so the app is installable
// ("添加到主屏幕"). Production-only — in dev the SW would cache Vite's
// HMR assets and fight the dev server. The SW is network-first for the
// shell + API, so deploys are never stale.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure is non-fatal — the app still works as a
      // normal website, just not installable.
    });
  });
}
