export const gbp = (n, opts = {}) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: opts.decimals ?? 0,
  }).format(Number(n) || 0);

export const gbp2 = (n) => gbp(n, { decimals: 2 });

export function deltaPct(cur, prev) {
  if (!prev) return cur ? 'New' : '—';
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  return (d > 0 ? '+' : '') + d.toFixed(0) + '%';
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function monthKey(d) {
  return (d || '').slice(0, 7);
}

export function thisMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function prevMonthKey() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString().slice(0, 7);
}

export function relativeTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(d);
}