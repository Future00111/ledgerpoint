import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { accounting } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import EmptyState from '@/components/workspace/EmptyState';
import JournalReview from '@/features/reporting/JournalReview';
import { scopeKey, visibleRead, requestRead, validateJournal } from '@/features/reporting/model.mjs';

export default function AccountingJournal() {
  const { id } = useParams();
  const { activeCompany } = useCompany();
  return activeCompany ? <CompanyJournal key={`${activeCompany.id}:${id}`} company={activeCompany} id={id} />
    : <EmptyState title="Select a company" description="Choose a company to view its journal evidence." />;
}

function CompanyJournal({ company, id }) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: null, data: null, loading: true, error: null });
  const key = scopeKey(company.id, id, tick);
  useEffect(() => {
    const request = requestRead({ key, load: signal => accounting.journal(company.id, id, signal),
      validate: value => validateJournal(value, company.id, id), publish: setState });
    return request.cancel;
  }, [company.id, id, key]);
  const current = visibleRead(state, key);
  return <JournalReview company={company} data={current.data} error={current.error} loading={current.loading} onRetry={() => setTick(value => value + 1)} />;
}
