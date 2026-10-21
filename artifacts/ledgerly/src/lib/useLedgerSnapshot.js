import { useQuery } from '@tanstack/react-query';
import { accounting } from '@/api/accountingDocuments.mjs';

export const ledgerDates = () => {
  const to = new Date().toISOString().slice(0, 10);
  return { from: `${to.slice(0, 4)}-01-01`, to };
};
export function useLedgerSnapshot(companyId, from = ledgerDates().from, to = ledgerDates().to, enabled = true) {
  const result = useQuery({ queryKey: ['posted-ledger', companyId, from, to], enabled: !!companyId && enabled,
    queryFn: ({ signal }) => accounting.reports(companyId, from, to, signal), staleTime: 0, retry: false });
  return { data: result.data, error: result.error, loading: result.isPending, refresh: result.refetch, from, to };
}
export const sumMinor = (rows, field) => rows.reduce((n, r) => n + BigInt(r[field] ?? '0'), 0n).toString();
