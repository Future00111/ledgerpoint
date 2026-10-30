/** Remount all financial rows, selection and dialogs before another company is displayed. */
export default function BankWorkspaceScope({ company, loading, Workspace }) {
  if (loading) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading your companies…</p>;
  if (!company?.id) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;
  return <Workspace key={company.id} company={company} />;
}

export function BankReadStatus({ loading, error, suggestionsLoading, suggestionsError, onRetry, onRetrySuggestions }) {
  return <>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950"><p>{error}</p><button type="button" className="mt-2 font-medium underline" onClick={onRetry}>Retry bank transactions</button></div>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading bank transactions…</p>}
    {suggestionsError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p>{suggestionsError}</p><button type="button" className="mt-2 font-medium underline" onClick={onRetrySuggestions}>Retry suggested matches</button></div>}
    {suggestionsLoading && !loading && <p role="status" className="text-xs text-muted-foreground">Loading suggested matches…</p>}
  </>;
}
