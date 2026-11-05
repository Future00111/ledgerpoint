import { Component, Suspense, lazy, useState } from 'react';
import { createRouteLoader, RouteChunkError } from '@/features/routeLoading/loader.mjs';

export function RouteLoading() {
  return <div role="status" aria-live="polite" className="p-6 text-sm text-muted-foreground">Loading page…</div>;
}

export function RouteLoadFailure({ onRetry, onReload = () => window.location.reload() }) {
  return <section role="alert" className="m-6 max-w-xl space-y-3 rounded-xl border bg-card p-6">
    <h1 className="text-lg font-semibold">This page could not be loaded</h1>
    <p className="text-sm text-muted-foreground">Check your connection and try again. You can still use the workspace navigation. If the problem continues, reload this page.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={onRetry} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try loading again</button>
      <button type="button" onClick={onReload} className="rounded-lg border px-4 py-2 text-sm font-medium">Reload this page</button>
    </div>
  </section>;
}

export class RouteChunkBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError(error) {
    // Rendering/business errors still belong to the existing application error boundary.
    if (!(error instanceof RouteChunkError)) throw error;
    return { failed: true };
  }
  render() {
    return this.state.failed ? <RouteLoadFailure onRetry={this.props.onRetry} /> : this.props.children;
  }
}

/** Declare at module scope. The workspace shell and auth/company providers stay mounted. */
export function lazyRoute(importPage) {
  return createLazyRoute(createRouteLoader(importPage));
}

export function createLazyRoute(loader) {
  return function LazyRoute(props) {
    // React.lazy caches rejection per value. Each mount must read the current
    // shared loader rather than resurrecting a rejected value after navigation.
    const [{ Page, attempt }, setPage] = useState(() => ({ Page: lazy(loader.load), attempt: 0 }));
    const retry = () => {
      loader.retry();
      // Another instance may already have retried the shared loader. Replace this
      // instance's rejected lazy value even when that import is pending/resolved.
      setPage(previous => ({ Page: lazy(loader.load), attempt: previous.attempt + 1 }));
    };
    return <RouteChunkBoundary key={attempt} onRetry={retry}>
      <Suspense fallback={<RouteLoading />}><Page {...props} /></Suspense>
    </RouteChunkBoundary>;
  };
}
