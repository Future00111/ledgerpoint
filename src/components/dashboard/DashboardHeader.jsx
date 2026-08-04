import React, { useState, useEffect } from 'react';
import { useCompany } from '@/lib/useCompany';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHeader() {
  const { activeCompany } = useCompany();
  const [userName, setUserName] = useState('');
  const [score, setScore] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    base44
      .auth
      .me()
      .then((u) => setUserName((u?.full_name || '').split(' ')[0]))
      .catch(() => setUserName(''));
  }, []);

  useEffect(() => {
    if (!activeCompany?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [accts, txns, docs, vat, inv] = await Promise.all([
          base44.entities.BankAccount.filter({ company_id: activeCompany.id }),
          base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 500),
          base44.entities.Document.filter({ company_id: activeCompany.id }),
          base44.entities.VATReturn.filter({ company_id: activeCompany.id }),
          base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }, '-due_date', 300),
        ]);
        if (cancelled) return;
        const review = (txns || []).filter((t) => t.status === 'review').length;
        const pendingDocs = (docs || []).filter((d) => d.status === 'pending_review' || d.status === 'pending_extraction').length;
        const draftVat = (vat || []).filter((v) => v.status === 'draft' || v.status === 'ready_for_review').length;
        const today = new Date().toISOString().slice(0, 10);
        const overdue = (inv || []).filter(
          (i) => ['approved', 'sent', 'part_paid'].includes(i.status) && (Number(i.balance_due) || 0) > 0 && i.due_date < today
        ).length;
        let s = 0;
        s += (accts || []).length > 0 ? 20 : 0;
        s += review === 0 ? 20 : Math.max(0, 20 - Math.min(10, review));
        s += pendingDocs === 0 ? 20 : Math.max(0, 20 - Math.min(10, pendingDocs));
        s += review === 0 ? 20 : Math.max(0, 20 - Math.min(10, review));
        s += draftVat === 0 ? 20 : 10;
        setScore(s);
        const n = [];
        n.push(review === 0 ? 'Bank reconciled' : `${review} transactions to review`);
        n.push(draftVat === 0 ? 'VAT ready' : 'VAT return pending');
        n.push(overdue === 0 ? 'No overdue invoices' : `${overdue} invoices overdue`);
        setNotes(n.slice(0, 3));
      } catch {
        if (!cancelled) setScore(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCompany?.id]);

  const color = score == null ? '' : score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600';
  const firstName = userName || 'there';
  const shapeMsg =
    score == null
      ? '…'
      : score >= 90
      ? 'your business is in great shape today.'
      : score >= 70
      ? 'your business is in good shape.'
      : score >= 50
      ? 'your business needs a little attention.'
      : 'your business needs attention.';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Ledgerly thinks {shapeMsg}</p>
        {notes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {notes.map((n, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
      {score != null && (
        <div className="rounded-xl border border-border bg-card p-4 min-w-[200px] flex-shrink-0">
          <p className="text-[11px] font-medium text-muted-foreground">Business Health</p>
          <p className={`text-2xl font-bold ${color}`}>
            {score}
            <span className="text-sm font-normal text-muted-foreground">/100</span>
          </p>
          <Progress value={score} className="h-1.5 mt-2" />
        </div>
      )}
    </div>
  );
}