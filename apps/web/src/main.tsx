import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// U7 — brand-token CSS (placeholder until design hands over real assets).
import './styles/brand.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
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
