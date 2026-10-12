import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { gbp, monthKey, thisMonthKey, prevMonthKey } from '@/lib/format';
import { X, Sparkles, ArrowRight } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const keyFor = (cid, date) => `lp.briefing.${cid}.${date}`;

// Once-per-day change summary shown at the top of the dashboard. It does NOT
// repeat the greeting, today's priority, business health, or the Ask entry
// point — those all have their own single home on the dashboard. Its sole job
// is to summarise what changed since the user's last visit.
export default function MorningBriefing({ company }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    setDismissed(localStorage.getItem(keyFor(company.id, todayStr())) === '1');
    let cancelled = false;
    (async () => {
      try {
        const [txns, inv, docs, bills, vat] = await Promise.all([
          base44.entities.BankTransaction.filter({ company_id: company.id }, '-date', 1000),
          base44.entities.SalesInvoice.filter({ company_id: company.id }, '-issue_date', 500),
          base44.entities.Document.filter({ company_id: company.id }),
          base44.entities.PurchaseBill.filter({ company_id: company.id }, '-bill_date', 500),
          base44.entities.VATReturn.filter({ company_id: company.id }, '-created_date', 5),
        ]);
        if (cancelled) return;
        const today = todayStr();
        const received = (txns || []).filter((t) => t.date === today).reduce((s, t) => s + (Number(t.money_in) || 0), 0);
        const billsUploaded = (docs || []).filter((d) => d.upload_date === today).length;
        const vatEst =
          (vat && vat[0] && Number(vat[0].vat_due)) ||
          (inv || []).reduce((s, i) => s + (Number(i.vat_total) || 0), 0) - (bills || []).reduce((s, b) => s + (Number(b.vat_total) || 0), 0);
        const tm = thisMonthKey();
        const pm = prevMonthKey();
        const net = (arr, key, dateField) =>
          (arr || []).filter((x) => ACTIVE.includes(x.status) && monthKey(x[dateField]) === key).reduce((s, x) => s + (Number(x.total) || 0), 0);
        const profitM = net(inv, tm, 'issue_date') - net(bills, tm, 'bill_date');
        const profitP = net(inv, pm, 'issue_date') - net(bills, pm, 'bill_date');
        const profitMove = profitM - profitP;
        setData({ received, billsUploaded, vatEst, profitMove });
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [company?.id]);

  if (dismissed || !data) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(keyFor(company.id, todayStr()), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const viewDetails = () => {
    dismiss();
    nav('/reports');
  };

  const profitUp = data.profitMove >= 0;
  const bullets = [];
  if (data.received > 0) bullets.push(`${gbp(data.received)} received`);
  if (data.billsUploaded > 0) bullets.push(`${data.billsUploaded} supplier bill${data.billsUploaded > 1 ? 's' : ''} uploaded`);
  bullets.push(`VAT estimate ${gbp(data.vatEst)}`);
  bullets.push(
    `Profit ${profitUp ? 'increased' : 'decreased'} ${gbp(Math.abs(data.profitMove))}`
  );

  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[0.07] via-primary/[0.025] to-card px-4 py-4 shadow-sm relative sm:px-5">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted text-muted-foreground"
        aria-label="Dismiss briefing"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="w-4 h-4" />
        </span>
        <div>
          <span className="text-sm font-semibold">Since your last visit</span>
          <p className="text-xs text-muted-foreground">A concise view of what changed.</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 pr-6 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        {bullets.map((b) => (
          <li key={b} className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={viewDetails}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border/80 bg-background hover:bg-card hover:shadow-sm transition-all"
      >
        View Details
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}