import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useBusinessHealth } from './useBusinessHealth';
import { useAsk } from '@/components/ask/AskProvider';
import { gbp, monthKey, thisMonthKey, prevMonthKey } from '@/lib/format';
import { X, Sparkles, ArrowRight } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const keyFor = (cid, date) => `lp.briefing.${cid}.${date}`;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Once-per-day summary shown at the top of the dashboard. Dismissed for the
// day after reading; reappears the next day.
export default function MorningBriefing({ company }) {
  const { openAsk } = useAsk();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [userName, setUserName] = useState('');
  const health = useBusinessHealth(company?.id);

  useEffect(() => {
    base44.auth.me().then((u) => setUserName((u?.full_name || '').split(' ')[0])).catch(() => setUserName(''));
  }, []);

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

  const profitLabel = `${data.profitMove >= 0 ? '+' : '−'}${gbp(Math.abs(data.profitMove))}`;
  const profitTone = data.profitMove >= 0 ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-4 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted text-muted-foreground"
        aria-label="Dismiss briefing"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">
          {greeting()}, {userName || 'there'}.
        </span>
      </div>
      <p className="text-sm text-muted-foreground pr-6">
        Since your last visit: {gbp(data.received)} payments received · {data.billsUploaded} bills uploaded · VAT estimate {gbp(data.vatEst)} · profit movement{' '}
        <span className={`font-medium ${profitTone}`}>{profitLabel}</span>.
      </p>
      {health.priority && !health.loading && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Today’s biggest priority:</span>
          <Link to={health.priority.route} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {health.priority.label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
      <button
        onClick={() => openAsk('Give me a summary of my business today')}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Ask Ledgerly
      </button>
    </div>
  );
}