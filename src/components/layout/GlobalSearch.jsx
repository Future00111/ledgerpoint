import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Search, Loader2, Clock } from 'lucide-react';
import { getRecent, pushRecent } from './recentItems';

export default function GlobalSearch() {
  const { activeCompany } = useCompany();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  // ⌘K / Ctrl+K to focus search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !activeCompany) {
      setGroups([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('globalSearch', {
          company_id: activeCompany.id,
          query: q,
        });
        if (!cancelled) setGroups(res?.data?.groups || res?.groups || []);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, activeCompany]);

  useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path, label) => {
    pushRecent({ label, path });
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const showResults =
    open && (loading || groups.length > 0 || (query.trim().length < 2 && recent.length > 0));
  const showRecent = query.trim().length < 2;

  return (
    <div className="relative w-full" ref={boxRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search customers, invoices, bills…  (⌘K)"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/70 border border-transparent focus:border-border focus:bg-white text-sm outline-none transition-colors"
          aria-label="Global search"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-border shadow-lg max-h-[60vh] overflow-y-auto z-50">
          {showRecent ? (
            <div className="p-2">
              <p className="px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Recently viewed
              </p>
              {recent.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">No recent items yet.</p>
              ) : (
                recent.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => go(r.path, r.label)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {r.label}
                  </button>
                ))
              )}
            </div>
          ) : groups.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No results found.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="p-2">
                <p className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wide">{g.label}</p>
                {g.items.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => go(it.route, it.label)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{it.label}</span>
                    {it.sublabel && <span className="text-muted-foreground ml-1.5 text-xs">{it.sublabel}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}