import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';
import { requestScope } from './model.mjs';
import { accessHistoryClient } from './historyClient.mjs';
import { historyActiveLabel, historyOperationLabel, historyRoleLabel, historyTimeLabel } from './historyModel.mjs';

export function AccessHistoryWorkspace(props) {
  const { companyId, actorId, role } = props;
  if (!companyId) return <div className="workspace-page"><PageHeader title="Access history" description="Choose a company to view specialist access changes." /></div>;
  if (!actorId || role !== 'owner') return <div className="workspace-page"><PageHeader title="Access history" />
    <p role="alert">Only a current company owner can view specialist access history.</p></div>;
  return <ScopedAccessHistory key={JSON.stringify([actorId, companyId, role])} {...props} />;
}

function ScopedAccessHistory({ companyId, companyName, client = accessHistoryClient }) {
  const [state, setState] = useState({ status: 'idle', result: null });
  const scope = useRef(null), inFlight = useRef(false);
  if (!scope.current) scope.current = requestScope();
  useEffect(() => () => { scope.current.cancel(); }, []);
  const read = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const token = scope.current.begin();
    setState({ status: 'loading', result: null });
    try {
      const result = await client.read(companyId, token.signal);
      if (token.isCurrent()) setState({ status: 'ready', result });
    } catch (error) {
      if (token.isCurrent()) setState({ status: error?.status === 401 || error?.status === 403 ? 'denied' : 'failed', result: null });
    } finally { if (token.isCurrent()) inFlight.current = false; }
  };
  return <div className="workspace-page">
    <PageHeader eyebrow="Payroll and personal tax" title="Access history" context={companyName}
      description="Specialist role grants, invitations, changes and removals. Each history view is recorded in the audit trail."
      actions={<Button onClick={read} disabled={state.status === 'loading'}>{state.status === 'idle' ? 'View history' : 'Refresh history'}</Button>} />
    <AccessHistoryContent state={state} />
  </div>;
}

function MembershipState({ role, active }) {
  if (role === null) return <span>Not present</span>;
  return <><span className="block font-medium">{historyRoleLabel(role)}</span><span className="text-muted-foreground">{historyActiveLabel(role, active)}</span></>;
}

export function AccessHistoryContent({ state }) {
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <section className="workspace-card p-4 sm:p-6" aria-busy="true"><p role="status">Loading access history…</p></section>;
  if (state.status === 'denied') return <section className="workspace-card p-4 sm:p-6"><p role="alert">Owner access could not be confirmed. Previous history has been cleared. Refresh history to check access again.</p></section>;
  if (state.status !== 'ready' || !state.result) return <section className="workspace-card p-4 sm:p-6"><p role="alert">Access history could not be loaded. Previous history has been cleared. Refresh history to try again.</p></section>;
  const { events, has_more } = state.result;
  return <section className="workspace-card space-y-4 p-4 sm:p-6">
    <p role="status" className="text-sm text-muted-foreground">{has_more
      ? 'Showing the latest 50 changes. Older changes are not shown.'
      : events.length ? `Showing ${events.length} recorded ${events.length === 1 ? 'change' : 'changes'}, newest first.` : 'No specialist access changes recorded.'}</p>
    {events.length > 0 && <div className="overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" tabIndex={0} role="region" aria-label="Specialist access history table">
      <table className="w-full text-left text-sm" aria-label="Specialist access history">
        <caption className="sr-only">Latest specialist access changes, newest first</caption>
        <thead className="border-b bg-muted/40"><tr>{['When (UTC)', 'Change', 'Before', 'After', 'Membership reference'].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{events.map(event => <tr key={event.id} className="border-b last:border-0">
          <td className="whitespace-nowrap px-4 py-3 align-top"><time dateTime={event.occurred_at} title={event.occurred_at}>{historyTimeLabel(event.occurred_at)}</time></td>
          <td className="px-4 py-3 align-top">{historyOperationLabel(event.operation)}</td>
          <td className="px-4 py-3 align-top"><MembershipState role={event.previous_role} active={event.previous_active} /></td>
          <td className="px-4 py-3 align-top"><MembershipState role={event.next_role} active={event.next_active} /></td>
          <td className="max-w-64 break-all px-4 py-3 align-top font-mono text-xs">{event.membership_id}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {events.some(event => (event.previous_role !== null && event.previous_active === null) || (event.next_role !== null && event.next_active === null)) &&
      <p className="text-xs text-muted-foreground">Not present means the membership did not exist at that point. Not recorded means its historical active status is unknown.</p>}
  </section>;
}
