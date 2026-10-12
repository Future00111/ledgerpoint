import { useState, useEffect } from 'react';

// Each widget loads its own data independently so one slow/failing
// widget never blocks the dashboard.
export function useWidgetData(companyId, fetcher) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!companyId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    Promise.resolve(fetcher(companyId))
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: e });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return state;
}