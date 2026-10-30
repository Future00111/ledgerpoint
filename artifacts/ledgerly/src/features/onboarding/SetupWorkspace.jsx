import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, RefreshCw, FileText, Receipt, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/workspace/PageHeader';
import { MIN_ACCOUNTING_DATE, MAX_ACCOUNTING_DATE } from './model.mjs';

function FirstTask({ title, description, task, to, list, parties, partyLabel, icon: Icon }) {
  return <article className="workspace-panel flex flex-col gap-4 p-5">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span><h3 className="font-semibold">{title}</h3></div>
    <p className="text-sm text-muted-foreground">{description}</p>
    <div className="space-y-1 text-sm">
      <p>{task.partyCount ? `${task.partyCount} active ${partyLabel} available to choose from.` : `Add a ${partyLabel.slice(0, -1)} before saving this draft.`}</p>
      {!task.canEdit && <p>Your access is view only for document drafts.</p>}
      {task.canEdit && !task.canCreateDraft && <p>Finish the relevant setup and choose an active {partyLabel.slice(0, -1)} in the native form.</p>}
      <p className="text-muted-foreground">Posting permission: {task.canPost ? 'granted' : 'not granted'}. {task.postingSetupAvailable ? 'Each document still requires its own posting review.' : 'Posting setup still needs attention.'}</p>
    </div>
    <div className="mt-auto flex flex-wrap gap-2">
      <Button asChild variant={task.canCreateDraft ? 'default' : 'outline'}><Link to={task.canCreateDraft ? to : list}>{task.canCreateDraft ? `Create ${title.toLowerCase()}` : `View ${title === 'Invoice' ? 'invoices' : 'bills'}`}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      <Button asChild variant="ghost"><Link to={parties}>{task.canEdit ? 'Manage' : 'View'} {partyLabel}</Link></Button>
    </div>
  </article>;
}

export default function SetupWorkspace({ company, readiness, date, onDateChange, loading, error, onRefresh, guided, onGuidedChange, guidanceWarning = '' }) {
  return <div className="workspace-page">
    <PageHeader eyebrow="Your business workspace" title="Business setup" description="Review your saved setup, then get on with your work. Come back whenever you need to."
      context={<span className="font-medium">{company.name}</span>}
      actions={<><Button variant="outline" onClick={onRefresh} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh checks</Button><Button asChild variant="outline"><Link to="/">Go to workspace<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></>} />
    <div className="workspace-panel flex flex-wrap items-center justify-between gap-4 p-4">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium" htmlFor="setup-date">Check document date<input id="setup-date" type="date" min={MIN_ACCOUNTING_DATE} max={MAX_ACCOUNTING_DATE} value={date} onChange={event => onDateChange(event.target.value)} className="rounded-lg border bg-background px-3 py-2" /></label>
      <Button type="button" variant="ghost" aria-pressed={guided} onClick={() => onGuidedChange(!guided)}><HelpCircle className="mr-2 h-4 w-4" />{guided ? 'Hide explanations' : 'Show explanations'}</Button>
    </div>
    {guidanceWarning && <p role="status" className="text-sm text-muted-foreground">{guidanceWarning}</p>}
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><p className="font-medium">Setup checks could not be verified.</p><p className="mt-1">{error.message}</p><Button variant="outline" className="mt-3" onClick={onRefresh}>Retry checks</Button></div>}
    {loading && <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Checking saved accounts, tax rules, periods and your access…</p>}
    {!loading && !error && readiness && <>
      <section className="workspace-panel overflow-hidden" aria-labelledby="setup-review-title">
        <div className="workspace-panel-header flex flex-wrap items-center justify-between gap-3"><div><h2 id="setup-review-title" className="workspace-section-title">Accounting setup review</h2><p className="mt-1 text-sm text-muted-foreground">{readiness.configuredCount} of {readiness.checks.length} setup checks available for {date}. This is a readiness check, not approval of a document.</p></div><Button asChild variant="outline"><Link to="/accounting/setup">Posting setup</Link></Button></div>
        <ol className="divide-y">{readiness.checks.map(check => <li key={check.id} data-testid={`setup-check-${check.id}`} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
          {check.ready ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <Circle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{check.title}</h3><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${check.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{check.ready ? 'Available' : 'Needs attention'}</span></div><p className="mt-1 text-sm text-muted-foreground">{check.detail}</p>{guided && <p className="mt-2 border-l-2 border-primary/25 pl-3 text-sm text-muted-foreground">{check.help}</p>}</div>
          <Link className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline" to={check.to}>{check.action}<span aria-hidden="true"> →</span></Link>
        </li>)}</ol>
      </section>
      {readiness.serverIssues.length > 0 && <details className="workspace-panel p-4"><summary className="cursor-pointer text-sm font-medium">Native setup messages ({readiness.serverIssues.length})</summary><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{readiness.serverIssues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      <section className="space-y-3" aria-labelledby="setup-first-task"><div><h2 id="setup-first-task" className="workspace-section-title">Start with a real task</h2><p className="mt-1 text-sm text-muted-foreground">Use the full invoice and bill workflows. Confirm the document date and tax treatment in the form. Saving a draft does not post, send or pay it.</p></div>
        <div className="grid gap-4 lg:grid-cols-2"><FirstTask title="Invoice" description="Bill a customer with the same controls you use every day." task={readiness.sales} to="/invoices/new" list="/invoices" parties="/customers" partyLabel="customers" icon={FileText} /><FirstTask title="Bill" description="Record a supplier invoice and keep its source evidence together." task={readiness.purchases} to="/bills/new" list="/bills" parties="/suppliers" partyLabel="suppliers" icon={Receipt} /></div>
      </section>
    </>}
    <section className="workspace-panel p-5"><h2 className="font-semibold">Keep your workflow</h2><p className="mt-1 text-sm text-muted-foreground">Setup does not restrict the workspace. Experienced users can go straight to the existing tools.</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-primary">{[['/documents', 'Supplier document inbox'], ['/awaiting-credits', 'Awaiting supplier credits'], ['/payments', 'Payments & allocations'], ['/reports', 'Reports'], ['/chart-of-accounts', 'Chart of accounts']].map(([to, label]) => <Link key={to} to={to} className="underline-offset-4 hover:underline">{label}</Link>)}</div><p className="mt-4 text-xs text-muted-foreground">Bank feeds, email connections and HMRC submissions are not connected by this setup. Opening a page or uploading a source file does not complete accounting setup.</p></section>
  </div>;
}
