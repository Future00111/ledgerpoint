import { useCallback, useEffect, useRef, useState } from 'react';
import { creditRecovery } from '@/api/creditRecovery.mjs';
import { createRequestGate } from './model.mjs';

export function useCreditClaims(companyId, billId) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ key: null, data: null, loading: true, error: null });
  const gate = useRef(createRequestGate());
  const key = JSON.stringify([companyId, billId ?? null]);
  useEffect(() => {
    const ticket = gate.current.begin();
    const controller = new AbortController();
    setState(previous => ({ key, data: previous.key === key ? previous.data : null, loading: true, error: null }));
    if (companyId) creditRecovery.list(companyId, billId, controller.signal)
      .then(data => {
        if (!gate.current.isCurrent(ticket) || controller.signal.aborted) return;
        if (!Array.isArray(data?.claims) || typeof data.can_manage !== 'boolean') throw new Error('Credit tracking could not be verified. Please retry.');
        setState({ key, data, loading: false, error: null });
      })
      .catch(error => {
        if (!gate.current.isCurrent(ticket) || controller.signal.aborted) return;
        setState({ key, data: null, loading: false, error });
      });
    else setState({ key, data: null, loading: false, error: null });
    return () => { gate.current.invalidate(); controller.abort(); };
  }, [companyId, billId, version, key]);
  const refresh = useCallback(() => setVersion(previous => previous + 1), []);
  return { ...(state.key === key ? state : { data: null, loading: true, error: null }), refresh };
}

/** Unmounting or switching the keyed company view makes pending results inert. */
export function useMutationScope() {
  const live = useRef(false);
  const controllers = useRef(new Set());
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); };
  }, []);
  return {
    begin() {
      const controller = new AbortController();
      controllers.current.add(controller);
      return { signal: controller.signal, current: () => live.current && !controller.signal.aborted,
        finish: () => controllers.current.delete(controller) };
    },
  };
}
