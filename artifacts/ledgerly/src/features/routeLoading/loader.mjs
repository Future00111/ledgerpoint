/** A rejected React.lazy value stays rejected. Retry must replace that value as well as its promise. */
export class RouteChunkError extends Error {
  constructor() {
    super('The page module could not be loaded.');
    this.name = 'RouteChunkError';
  }
}

export function createRouteLoader(importPage) {
  let promise = null;
  let failed = false;
  return {
    load() {
      if (!promise) {
        failed = false;
        promise = Promise.resolve().then(importPage).then(module => {
          if (!module || module.default == null) throw new RouteChunkError();
          return module;
        }).catch(() => {
          failed = true;
          // Do not expose import URLs, module contents or arbitrary browser errors.
          throw new RouteChunkError();
        });
      }
      return promise;
    },
    retry() {
      // A double click cannot discard an in-flight request or reload a successful module.
      if (!failed) return false;
      promise = null;
      failed = false;
      return true;
    },
  };
}
