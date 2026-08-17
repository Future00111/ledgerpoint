import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { Star, X, Plus } from 'lucide-react';

const KEY = 'lp.dashboard.watchlist.v1';

const OPTIONS = [
  { label: 'Customers', route: '/customers' },
  { label: 'Suppliers', route: '/suppliers' },
  { label: 'Invoices', route: '/invoices' },
  { label: 'Bank Accounts', route: '/bank-accounts' },
  { label: 'Reports', route: '/reports' },
  { label: 'VAT', route: '/vat' },
  { label: 'Documents', route: '/documents' },
  { label: 'Transactions', route: '/transactions' },
];

function loadPins() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(r) && r.length) return r;
  } catch {
    /* ignore */
  }
  return OPTIONS.slice(0, 6);
}

export default function WatchlistWidget() {
  const nav = useNavigate();
  const [pins, setPins] = useState(loadPins);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(pins));
  }, [pins]);

  const remove = (route) => setPins((p) => p.filter((x) => x.route !== route));
  const add = (route) => {
    const opt = OPTIONS.find((o) => o.route === route);
    if (opt && !pins.find((p) => p.route === route)) setPins((p) => [...p, opt]);
    setAdding(false);
  };
  const available = OPTIONS.filter((o) => !pins.find((p) => p.route === o.route));

  if (pins.length === 0)
    return (
      <EmptyState
        icon={Star}
        title="Nothing pinned yet"
        description="Pin customers, suppliers, accounts and reports to keep them one tap away."
      />
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {pins.map((p) => (
          <div key={p.route} className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors">
            <button onClick={() => nav(p.route)} className="text-xs font-medium text-foreground">
              {p.label}
            </button>
            <button onClick={() => remove(p.route)} className="text-muted-foreground hover:text-foreground rounded-full p-0.5" aria-label={`Unpin ${p.label}`}>
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="flex flex-wrap gap-1.5">
          {available.map((o) => (
            <button key={o.route} onClick={() => add(o.route)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted">
              <Plus className="w-3 h-3" />
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        available.length > 0 && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Plus className="w-3.5 h-3.5" />
            Add to watchlist
          </button>
        )
      )}
    </div>
  );
}