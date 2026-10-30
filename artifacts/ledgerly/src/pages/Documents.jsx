import { useState } from 'react';
import { useCompany } from '@/lib/useCompany';
import IntakeWorkspace from '@/features/documentIntake/IntakeWorkspace';
import DocumentArchive from '@/features/documentIntake/DocumentArchive';

export default function Documents() {
  const { activeCompany } = useCompany();
  const [archiveOpen, setArchiveOpen] = useState(false);
  if (!activeCompany) return <p className="py-12 text-center text-muted-foreground">Please select a company first.</p>;
  return <div className="workspace-page"><IntakeWorkspace key={activeCompany.id} companyId={activeCompany.id} />
    <details className="workspace-card mt-6 p-5" onToggle={event => setArchiveOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Earlier document archive</summary>
      <p className="mb-5 mt-2 text-sm text-muted-foreground">Previously saved documents and their existing tools remain here. Use the native upload and review workflow above for new supplier files. Automatic extraction and email providers are not connected.</p>
      {archiveOpen && <DocumentArchive key={activeCompany.id} />}
    </details>
  </div>;
}
