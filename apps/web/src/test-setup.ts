import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia / IntersectionObserver. The exam
// shell does not use them today, but adding stubs here means future tests
// that touch Tailwind responsive utilities or scroll-into-view won't
// crash on first run.
if (typeof (globalThis as any).matchMedia === 'undefined') {
  (globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
