import { Component, ReactNode } from 'react';

/**
 * U5 — top-level React ErrorBoundary so an exception in one route /
 * widget doesn't blank the whole app. Mounted in App.tsx around the
 * authenticated routes; renders a friendly recovery card with a Reload
 * button instead of letting React's default unmount-the-tree behaviour
 * leave the user with an empty page.
 *
 * We deliberately do NOT log the raw error message to the user (it
 * leaks stack frames). The summary lives in the dev console.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string | null }
> {
  state = { hasError: false, message: null as string | null };

  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: String(err?.message ?? err).slice(0, 200) };
  }

  componentDidCatch(error: any, info: any) {
    // Log to the browser console; production should also emit to Sentry
    // (when wired). NEVER include `message` in user-visible UI.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, message: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="max-w-lg mx-auto py-12 px-6 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 shadow-sm">
          <div className="text-3xl mb-3">⚠</div>
          <h2 className="text-lg font-semibold text-rose-900 mb-2">
            页面加载失败 · Something went wrong
          </h2>
          <p className="text-sm text-rose-800 leading-relaxed mb-4">
            刷新页面通常可以恢复。如果反复出现，请联系管理员，
            截图给他这个页面 URL。
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium"
            >
              刷新页面
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="px-3 py-1.5 rounded-md border border-rose-300 text-rose-800 text-sm hover:bg-rose-100"
            >
              再试一次
            </button>
          </div>
        </div>
      </div>
    );
  }
}
