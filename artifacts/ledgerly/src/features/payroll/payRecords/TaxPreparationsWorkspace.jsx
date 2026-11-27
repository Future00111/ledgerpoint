import PageHeader from '@/components/workspace/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatSalary } from './model.mjs';
import { buildTaxIntent, taxPermissions } from './taxModel.mjs';
import { taxPreparationsClient } from './taxClient.mjs';
import { useSensitiveEntry } from './useSensitiveEntry';
import { TaxExportButton } from './TaxExportButton';

const blankForm = () => ({ taxpayer: '', year: '', income: '' });
export function TaxPreparationsWorkspace(props) {
  const { companyId, actorId, role } = props;
  if (actorId && props.companyLoadFailed) return <div className="workspace-page"><PageHeader title="Personal tax inputs" />
    <p role="alert">Your company access could not be loaded.</p>
    <Button variant="outline" onClick={props.onRefreshAccess}>Retry company access</Button></div>;
  if (!companyId) return <div className="workspace-page"><PageHeader title="Personal tax inputs" description="Choose a company to enter or look up employment income." /></div>;
  if (!actorId || !taxPermissions(role).read) return <div className="workspace-page"><PageHeader title="Personal tax inputs" />
    <p role="alert">Your current company role does not provide access to personal tax inputs.</p></div>;
  return <ScopedTaxPreparations key={JSON.stringify([actorId, companyId, role])} {...props} />;
}

function ScopedTaxPreparations({ companyId, companyName, role, client = taxPreparationsClient, onRefreshAccess }) {
  const canPrepare = taxPermissions(role).prepare;
  const { id, form, attempt, phase, lookupId, record, message, validation, busy, locked, save, lookup, fresh, update, changeLookup, denyAccess } =
    useSensitiveEntry({ companyId, role, client, canPrepare, blankForm, buildIntent: buildTaxIntent, savedMessage: 'Tax input saved.' });
  return <div className="workspace-page">
    <PageHeader eyebrow="Personal tax preparation" title="Personal tax inputs" context={companyName}
      description="Annual employment-income inputs in GBP. This page does not calculate or file tax." />
    {message && <p className="rounded-xl border p-4 text-sm" role="status">{message}</p>}
    {validation && <p className="text-sm text-destructive" role="alert">{validation}</p>}
    {phase === 'blocked' && <div className="space-y-3 rounded-xl border p-4">
      <p role="alert">The record or your access could not be confirmed. Previous values have been cleared. This does not prove that a save failed. Check another record ID or refresh company access before entering an input.</p>
      {onRefreshAccess && <Button onClick={onRefreshAccess}>Refresh company access</Button>}
    </div>}
    <div className={`grid gap-6${canPrepare && phase !== 'blocked' ? ' xl:grid-cols-2' : ''}`}>
      {canPrepare && phase !== 'blocked' && <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="tax-entry-heading" aria-busy={busy}>
        <h2 id="tax-entry-heading" className="text-lg font-semibold">Enter employment income</h2>
        <p className="text-sm text-muted-foreground">Use this company’s internal taxpayer UUID. There is one annual employment-income input per taxpayer and year.</p>
        <form autoComplete="off" onSubmit={event => { event.preventDefault(); save(); }} className="space-y-4">
          <label className="block space-y-1 text-sm">Taxpayer reference<Input value={form.taxpayer} onChange={event => update('taxpayer', event.target.value)} disabled={locked} spellCheck={false} autoComplete="off" /></label>
          <label className="block space-y-1 text-sm">Tax year starting<Input inputMode="numeric" placeholder="2026" value={form.year} onChange={event => update('year', event.target.value)} disabled={locked} autoComplete="off" /></label>
          <label className="block space-y-1 text-sm">Employment income (GBP)<Input inputMode="decimal" placeholder="48000.00" value={form.income} onChange={event => update('income', event.target.value)} disabled={locked} autoComplete="off" /></label>
          <p className="text-xs text-muted-foreground">Enter pounds and pence without commas. Currency is fixed to GBP.</p>
          <label className="block space-y-1 text-sm">Record ID<Input value={id} readOnly spellCheck={false} /></label>
          <p className="text-xs text-muted-foreground">Keep this ID for later lookup. Tax details clear when you leave, reload or switch company.</p>
          {phase === 'draft' && <Button type="submit" disabled={busy}>Save tax input</Button>}
          {phase === 'saving' && <Button disabled>Saving tax input…</Button>}
          {phase === 'uncertain' && <Button type="button" disabled={busy} onClick={save}>Retry same request</Button>}
          {['uncertain', 'conflict'].includes(phase) && <Button type="button" variant="outline" disabled={busy} onClick={() => lookup(attempt.id)}>Check saved record</Button>}
          {phase === 'conflict' && <Button type="button" variant="outline" disabled={busy} onClick={fresh}>Start a new entry</Button>}
          {phase === 'saved' && <Button type="button" variant="outline" disabled={busy} onClick={fresh}>Start another record</Button>}
        </form>
      </section>}
      <section className="workspace-card space-y-4 p-4 sm:p-6" aria-labelledby="tax-lookup-heading" aria-busy={busy}>
        <h2 id="tax-lookup-heading" className="text-lg font-semibold">Look up a tax input</h2>
        <form autoComplete="off" onSubmit={event => { event.preventDefault(); lookup(); }} className="space-y-3">
          <label className="block space-y-1 text-sm">Tax input ID<Input value={lookupId} onChange={event => changeLookup(event.target.value)} disabled={busy || ['uncertain', 'conflict'].includes(phase)} spellCheck={false} autoComplete="off" /></label>
          <Button type="submit" variant="outline" disabled={busy || ['uncertain', 'conflict'].includes(phase)}>Look up tax input</Button>
        </form>
        {record && <TaxPreparationDetails record={record} role={role} />}
        {record && <TaxExportButton key={record.id} companyId={companyId} record={record} role={role} client={client} onDenied={denyAccess} />}
      </section>
    </div>
  </div>;
}

export function TaxPreparationDetails({ record, role }) {
  return <section className="space-y-3 rounded-xl border p-4" aria-label="Saved tax input">
    <h3 className="font-semibold">Saved tax input</h3>
    <dl className="space-y-3 text-sm">
      <div><dt className="text-muted-foreground">Record ID</dt><dd className="break-all">{record.id}</dd></div>
      <div><dt className="text-muted-foreground">Tax year starting</dt><dd>{record.tax_year_start}</dd></div>
      <div><dt className="text-muted-foreground">Employment income (GBP)</dt><dd className="text-xl font-semibold tabular-nums">{formatSalary(record.employment_income_pence)}</dd></div>
      {taxPermissions(role).prepare && record.taxpayer_id && <div><dt className="text-muted-foreground">Taxpayer reference</dt><dd className="break-all">{record.taxpayer_id}</dd></div>}
    </dl>
  </section>;
}
