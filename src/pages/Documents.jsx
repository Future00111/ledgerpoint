import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Plus, Search, FileText, Receipt, Undo2, Landmark, Trash2, Eye, Sparkles, Link2 } from 'lucide-react';
import moment from 'moment';
import { Link } from 'react-router-dom';
import DocumentForm from '@/components/documents/DocumentForm';
import DocumentView from '@/components/documents/DocumentView';
import ExtractionReview from '@/components/documents/ExtractionReview';
import CreateRecordDialog from '@/components/documents/CreateRecordDialog';
import CreatePurchaseBillDialog from '@/components/documents/CreatePurchaseBillDialog';
import { useToast } from '@/components/ui/use-toast';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const TYPE_ICONS = {
  purchase_invoice: Receipt,
  sales_invoice: FileText,
  receipt: Receipt,
  credit_note: Undo2,
  bank_statement: Landmark,
  other: FileText,
};

const TYPE_LABELS = {
  purchase_invoice: 'Purchase Invoice',
  sales_invoice: 'Sales Invoice',
  receipt: 'Receipt',
  credit_note: 'Credit Note',
  bank_statement: 'Bank Statement',
  other: 'Other',
};

const STATUS_STYLES = {
  pending_extraction: 'bg-muted text-muted-foreground',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS = {
  pending_extraction: 'Pending Extraction',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const LINKED_RECORD_MAP = {
  PurchaseBill: { label: 'Linked Bill', path: '/bills' },
  SalesInvoice: { label: 'Linked Invoice', path: '/invoices' },
  SalesCreditNote: { label: 'Linked Credit Note', path: '/sales-credit-notes' },
  SupplierCreditNote: { label: 'Linked Credit Note', path: '/supplier-credit-notes' },
};

export default function Documents() {
  const { activeCompany } = useCompany();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [createDoc, setCreateDoc] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [billDoc, setBillDoc] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (activeCompany) loadDocuments(); }, [activeCompany]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Document.filter({ company_id: activeCompany.id }, '-upload_date', 200);
      setDocuments(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openView = (doc) => { setViewDoc(doc); setViewOpen(true); };

  const handleApprove = async () => {
    if (!viewDoc) return;
    setActionLoading(true);
    try {
      const updated = await base44.entities.Document.update(viewDoc.id, { status: 'approved' });
      setViewDoc(updated);
      toast({ title: 'Document approved' });
      await loadDocuments();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!viewDoc) return;
    setActionLoading(true);
    try {
      const updated = await base44.entities.Document.update(viewDoc.id, { status: 'rejected' });
      setViewDoc(updated);
      toast({ title: 'Document rejected' });
      await loadDocuments();
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async (doc) => {
    if (!confirm('Delete this document?')) return;
    try { await base44.entities.Document.delete(doc.id); toast({ title: 'Deleted' }); await loadDocuments(); }
    catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const counts = {
    all: documents.length,
    pending_extraction: documents.filter(d => d.status === 'pending_extraction').length,
    pending_review: documents.filter(d => d.status === 'pending_review').length,
    approved: documents.filter(d => d.status === 'approved').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
  };

  const filtered = documents.filter(d => {
    const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.supplier_or_customer?.toLowerCase().includes(search.toLowerCase()) ||
      d.reference_number?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (tab === 'all') return true;
    return d.status === tab;
  });

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  const tabs = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'pending_extraction', label: 'Pending Extraction', count: counts.pending_extraction },
    { value: 'pending_review', label: 'Pending Review', count: counts.pending_review },
    { value: 'approved', label: 'Approved', count: counts.approved },
    { value: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload and manage business documents</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="w-4 h-4" />Upload Document</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name, supplier, or reference..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${tab === t.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
            <Badge variant="secondary" className={`text-xs ${tab === t.value ? 'bg-primary/10 text-primary' : ''}`}>{t.count}</Badge>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search ? 'No documents match your search' : 'No documents yet'}</p>
            {!search && <Button onClick={() => setFormOpen(true)} variant="outline" className="mt-4 gap-2"><Plus className="w-4 h-4" />Upload your first document</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map(doc => {
            const Icon = TYPE_ICONS[doc.document_type] || FileText;
            return (
              <Card key={doc.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{doc.name}</p>
                          <Badge variant="secondary" className={`text-xs ${STATUS_STYLES[doc.status]}`}>{STATUS_LABELS[doc.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {TYPE_LABELS[doc.document_type]}
                          {doc.supplier_or_customer ? ` · ${doc.supplier_or_customer}` : ''}
                          {doc.reference_number ? ` · Ref: ${doc.reference_number}` : ''}
                          {doc.document_date ? ` · ${moment(doc.document_date).format('DD MMM YYYY')}` : ''}
                        </p>
                        {doc.linked_record_type && doc.linked_record_id && LINKED_RECORD_MAP[doc.linked_record_type] && (
                          <Link to={`${LINKED_RECORD_MAP[doc.linked_record_type].path}/${doc.linked_record_id}`} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 w-fit">
                            <Link2 className="w-3 h-3" />
                            {LINKED_RECORD_MAP[doc.linked_record_type].label}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(doc.gross_amount)}</p>
                        {doc.net_amount > 0 && <p className="text-xs text-muted-foreground">Net: {formatCurrency(doc.net_amount)}</p>}
                      </div>
                      {doc.status === 'pending_review' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setReviewDoc(doc); setReviewOpen(true); }} title="Review extraction"><Sparkles className="w-3.5 h-3.5 text-amber-600" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(doc)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(doc)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentForm open={formOpen} onOpenChange={setFormOpen} companyId={activeCompany?.id} onSaved={loadDocuments} onExtracted={(doc) => { setReviewDoc(doc); setReviewOpen(true); }} />
      <DocumentView open={viewOpen} onOpenChange={setViewOpen} document={viewDoc} onApprove={handleApprove} onReject={handleReject} actionLoading={actionLoading} onCreateRecord={() => { setViewOpen(false); setCreateDoc(viewDoc); setCreateOpen(true); }} />
      <CreateRecordDialog open={createOpen} onOpenChange={setCreateOpen} document={createDoc} onCreated={loadDocuments} />
      <ExtractionReview open={reviewOpen} onOpenChange={setReviewOpen} document={reviewDoc} onConfirmed={loadDocuments} onRejected={loadDocuments} onCreatePurchaseBill={(d) => { setBillDoc(d); setBillOpen(true); }} />
      <CreatePurchaseBillDialog open={billOpen} onOpenChange={setBillOpen} document={billDoc} onCreated={loadDocuments} />
    </div>
  );
}