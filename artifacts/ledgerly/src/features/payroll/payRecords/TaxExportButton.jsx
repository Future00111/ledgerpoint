import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestScope } from './model.mjs';
import { canExportTax, requestTaxDownload } from './taxExport.mjs';

/** Parent is keyed by actor/company/role and removes this component whenever its result is cleared. */
export function TaxExportButton({ companyId, record, role, client, onDenied }) {
  const scope = useRef(null), inFlight = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  if (!scope.current) scope.current = requestScope();
  useLayoutEffect(() => () => scope.current.cancel(), []);
  if (!canExportTax(role)) return null;
  const download = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const token = scope.current.begin();
    setBusy(true); setError(''); setMessage('');
    try {
      if (await requestTaxDownload({ client, companyId, record, role, token })) setMessage('CSV download requested.');
    } catch (failure) {
      if (!token.isCurrent()) return;
      if (failure?.status === 401 || failure?.status === 403) onDenied();
      else setError('The CSV could not be downloaded. Try again or look up the record again.');
    } finally {
      if (token.isCurrent()) { inFlight.current = false; setBusy(false); }
    }
  };
  return <div className="space-y-2">
    <Button type="button" variant="outline" disabled={busy} onClick={download}>{busy ? 'Preparing CSV…' : 'Download CSV'}</Button>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    {message && <p className="text-sm" role="status">{message}</p>}
  </div>;
}
