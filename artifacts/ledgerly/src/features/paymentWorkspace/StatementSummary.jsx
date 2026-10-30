import { Money } from '@/components/accounting/AccountingUI';

export default function StatementSummary({ party, statement, from, to }) {
  return <section className="workspace-hero grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,.75fr)]" aria-label="Statement balances">
    <div><p className="workspace-kicker">{party.type === 'customer' ? 'Customer' : 'Supplier'} statement</p><h2 className="mt-2 break-words text-2xl font-semibold tracking-tight">{party.name}</h2><p className="mt-2 text-sm text-muted-foreground">{from} to {to}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Outstanding documents</dt><dd className="mt-1 text-lg font-semibold"><Money value={statement.closing} /></dd></div><div><dt className="text-xs text-muted-foreground">{party.type === 'customer' ? 'Unapplied customer credit' : 'Supplier prepayments'}</dt><dd className="mt-1 text-lg font-semibold"><Money value={statement.unapplied} /></dd></div></dl></div>
    <div className="flex flex-col justify-center border-t border-primary/15 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0"><p className="text-sm font-medium">Net account balance</p><p className="mt-3 break-words text-3xl font-semibold tracking-tight"><Money value={statement.net} /></p><p className="mt-3 text-xs leading-5 text-muted-foreground">Posted account balance through {to}, including unapplied money.</p></div>
  </section>;
}
