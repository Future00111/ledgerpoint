import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState, StatusBadge } from '../WidgetPrimitives';
import { fmtDate } from '@/lib/format';
import { FolderOpen } from 'lucide-react';

export default function DocumentsReviewWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.Document.filter({ company_id: cid, status: { $in: ['pending_review', 'pending_extraction'] } }, '-created_date', 100)
  );

  if (loading) return <ListSkeleton />;
  const items = (data || []).slice(0, h === 2 ? 10 : 6);
  if (!items.length)
    return <EmptyState icon={FolderOpen} title="No documents to review" description="Uploaded documents pending extraction or review appear here." />;

  return (
    <div className="space-y-1">
      {items.map((d) => (
        <button key={d.id} onClick={() => nav('/documents')} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-left">
          <span className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{d.name}</p>
            <p className="text-[11px] text-muted-foreground">{d.document_type} · {fmtDate(d.document_date || d.upload_date)}</p>
          </span>
          <StatusBadge status={d.status} />
        </button>
      ))}
    </div>
  );
}