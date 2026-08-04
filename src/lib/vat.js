export function nextVatDeadlineDate(freq) {
  const now = new Date();
  const y = now.getFullYear();
  if (freq === 'monthly') {
    let d = new Date(y, now.getMonth() + 1, 7);
    if (d < now) d = new Date(y + 1, now.getMonth() + 1, 7);
    return d;
  }
  const c = [
    new Date(y, 1, 7),
    new Date(y, 4, 7),
    new Date(y, 7, 7),
    new Date(y, 10, 7),
    new Date(y + 1, 1, 7),
  ].filter((x) => x >= now);
  return c[0] || null;
}

export function nextVatDeadlineDays(freq) {
  const d = nextVatDeadlineDate(freq);
  if (!d) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

export function currentQuarter() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}