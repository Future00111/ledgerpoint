import { Link } from 'react-router-dom';
import { Download, History, RefreshCw, Search, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/workspace/PageHeader';
import EmptyState from '@/components/workspace/EmptyState';
import { ErrorBox, SkeletonRows } from '@/components/accounting/AccountingUI';
import { categories, actions, resourcePath } from './model.mjs';

export default function AuditWorkspace({ filters, onFilter, onApply, data, loading, error, validation, onRefresh, onExport,
  exporting = false, exportError, dirty = false, page = 0, onNext, onPrevious }) {
  const visible = loading || error ? null : data;
  return <div className="workspace-page">
    <PageHeader eyebrow="Business records" title="Audit history" description="Follow who recorded a change, when it happened and the record behind it."
      actions={<><Button variant="outline" className="min-h-11" disabled={loading} onClick={onRefresh}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh</Button><Button className="min-h-11" disabled={!visible || exporting || !!validation || dirty} onClick={onExport}><Download className="h-4 w-4" aria-hidden="true" />{exporting ? 'Preparing export…' : 'Export filtered CSV'}</Button></>} />
    <form onSubmit={onApply} className="workspace-panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto] sm:p-5" aria-label="Audit history filters">
      {[['from', 'From'], ['to', 'To']].map(([key, label]) => <div key={key}><Label htmlFor={`audit-${key}`}>{label}</Label><Input id={`audit-${key}`} type="date" min="1900-01-01" max="2199-12-31" value={filters[key]} onChange={event => onFilter(key, event.target.value)} /></div>)}
      <div><Label htmlFor="audit-category">Activity</Label><select id="audit-category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.category} onChange={event => onFilter('category', event.target.value)}>{categories.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <div><Label htmlFor="audit-action">Action</Label><select id="audit-action" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.action} onChange={event => onFilter('action', event.target.value)}>{actions.map(value => <option value={value} key={value}>{value === 'all' ? 'All actions' : value.replaceAll('_', ' ')}</option>)}</select></div>
      <div><Label htmlFor="audit-search">Reference or actor ID</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><Input id="audit-search" className="pl-9" value={filters.q} maxLength={100} placeholder="Invoice, file, account or actor…" onChange={event => onFilter('q', event.target.value)} /></div></div>
      <Button type="submit" variant="outline" className="self-end">Apply filters</Button>
      {validation && <p role="alert" className="text-sm text-red-800 sm:col-span-2 lg:col-span-6">{validation}</p>}
    </form>
    {dirty && <p role="status" className="text-sm text-muted-foreground">Filters have changed. Apply them to update the table and export.</p>}
    <ErrorBox error={error} onRetry={onRefresh} /><ErrorBox error={exportError} />
    <section className="workspace-panel" aria-label="Recorded changes">
      <div className="workspace-panel-header"><div><h2 className="workspace-section-title">Recorded changes</h2><p className="mt-1 text-xs text-muted-foreground">Newest first · recorded time in UTC · read-only</p></div><p className="text-sm text-muted-foreground" role="status">{visible ? `${visible.items.length} events on page ${page + 1}` : loading ? 'Loading history…' : 'History unavailable'}</p></div>
      {loading && <div className="p-5"><SkeletonRows rows={6} /></div>}
      {visible?.items.length === 0 && <EmptyState icon={History} title="No recorded changes match" description="Try a wider date range or another activity filter. This view only includes supported audit sources." />}
      {!!visible?.items.length && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/30 text-xs text-muted-foreground"><tr>{['Recorded (UTC)', 'Activity', 'Reference', 'Actor ID', 'Details'].map(label => <th className="px-5 py-3 font-medium" scope="col" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{visible.items.map(event => {
        const path = resourcePath(event);
        return <tr key={event.event_key} className="align-top"><td className="whitespace-nowrap px-5 py-4"><time dateTime={event.occurred_at}>{event.occurred_at.slice(0, 19).replace('T', ' ')}</time></td><td className="px-5 py-4"><p className="font-medium">{event.label}</p><p className="mt-1 text-xs text-muted-foreground">{categories.find(([id]) => id === event.category)?.[1] ?? 'Recorded activity'}</p></td><td className="max-w-xs break-words px-5 py-4">{path ? <Link className="inline-flex items-start gap-1 font-medium text-primary hover:underline" to={path}>{event.reference || 'Open record'}<ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /></Link> : event.reference || '—'}</td><td className="max-w-48 break-all px-5 py-4 text-xs">{event.actor_id || 'Not recorded'}</td><td className="max-w-md px-5 py-4"><details><summary className="cursor-pointer font-medium text-primary">View event</summary><div className="mt-3 space-y-2 text-xs"><p className="break-all"><span className="font-medium">Event ID:</span> {event.event_key}</p><p>Recorded: {event.occurred_at}</p>{event.reason && <p className="whitespace-pre-wrap break-words">Reason: {event.reason}</p>}{event.changed_fields.length > 0 && <p>Changed fields: {event.changed_fields.map(key => key.replaceAll('_', ' ')).join(', ')}</p>}{event.journal_id && <Link className="inline-block font-medium text-primary underline" to={`/accounting/journals/${encodeURIComponent(event.journal_id)}`}>View journal</Link>}<p className="text-muted-foreground">Linked pages show the current record. This event does not expose the original document payload.</p></div></details></td></tr>;
      })}</tbody></table></div>}
      {visible && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"><p className="text-xs text-muted-foreground">Events recorded up to {visible.as_of.slice(0, 19).replace('T', ' ')} UTC. Refresh to include newly committed events.</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={onPrevious}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={!visible.next_cursor} onClick={() => onNext(visible.next_cursor)}>Next<ChevronRight className="h-4 w-4" /></Button></div></div>}
    </section>
    <details className="rounded-xl border bg-muted/20 p-4 text-sm"><summary className="cursor-pointer font-medium">What this history includes</summary><div className="mt-3 max-w-4xl space-y-2 text-muted-foreground"><p>Document and earlier invoice draft changes, payments and their setup, uploads, awaiting-credit commands, account changes and canonical journal events.</p><p>One action can create several audit events. Event counts are not transaction totals. Sign-ins, company membership changes, unrecorded legacy changes and external email, banking or HMRC activity are not included.</p><p>Actor IDs identify the recorded account; names and emails are not looked up. CSV exports recheck your access and include at most 1,000 matching events. Larger exports require narrower filters.</p></div></details>
  </div>;
}
