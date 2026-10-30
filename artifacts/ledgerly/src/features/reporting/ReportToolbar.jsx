import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REPORT_TABS, MIN_DATE, MAX_DATE, closingReport } from './model.mjs';

export function ReportNavigation({ tab, onChange }) {
  return <nav aria-label="Financial reports" className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
    {REPORT_TABS.map(([key, label]) => <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} data-testid={`tab-${key}`} onClick={() => onChange(key)} className={`min-h-10 rounded-lg px-3 py-2 text-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${tab === key ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</button>)}
  </nav>;
}

export default function ReportToolbar({ tab, from, to, validation, onDate, onPreset }) {
  const closing = closingReport(tab);
  return <section className="workspace-card space-y-3 p-4" aria-label="Report period">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap gap-3">
        {!closing && <div><Label htmlFor="report-from">From</Label><Input id="report-from" data-testid="input-from" type="date" min={MIN_DATE} max={MAX_DATE} value={from} aria-invalid={!!validation} aria-describedby={validation ? 'report-date-error' : 'report-date-basis'} onChange={e => onDate('from', e.target.value)} /></div>}
        <div><Label htmlFor="report-to">{closing ? 'As at' : 'To'}</Label><Input id="report-to" data-testid="input-to" type="date" min={MIN_DATE} max={MAX_DATE} value={to} aria-invalid={!!validation} aria-describedby={validation ? 'report-date-error' : 'report-date-basis'} onChange={e => onDate('to', e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Report date shortcuts">{(closing ? [['year', 'Today'], ['last-month', 'Last month end']] : [['month', 'This month'], ['last-month', 'Last month'], ['quarter', 'This quarter'], ['year', 'Calendar year to date']]).map(([key, label]) => <button key={key} type="button" className="min-h-10 rounded-full border px-3 py-2 text-xs font-medium hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => onPreset(key)}>{label}</button>)}</div>
    </div>
    <p id="report-date-basis" className="text-xs text-muted-foreground">{closing ? 'Closing balances include all posted entries up to and including this date.' : tab === 'parties' ? 'Transactions cover these dates. Account balances include all postings through the end date.' : 'Movements posted between these dates, including both dates. Drafts are excluded.'}</p>
    {validation && <p id="report-date-error" role="alert" className="text-sm text-red-800">{validation}</p>}
  </section>;
}
