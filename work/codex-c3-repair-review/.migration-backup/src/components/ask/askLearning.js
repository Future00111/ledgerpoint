// Ask Learning — remembers frequently selected records, recent selections
// and pinned records so the Ask Engine can rank familiar results higher.

const FREQ_KEY = 'lp.ask.freq';
const PIN_KEY = 'lp.ask.pins';
const RECENT_KEY = 'lp.ask.recentRecords';

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function recordKey(group, item) {
  return `${group}:${item?.id || ''}`;
}

export function getFrequency() {
  return read(FREQ_KEY, {});
}
export function getPins() {
  return read(PIN_KEY, []);
}
export function getRecentRecords() {
  return read(RECENT_KEY, []);
}

// Call whenever a record is opened from Ask — boosts its future ranking.
export function trackSelection(group, item) {
  if (!item?.id) return;
  const key = recordKey(group, item);
  const freq = getFrequency();
  freq[key] = (freq[key] || 0) + 1;
  write(FREQ_KEY, freq);
  const recent = getRecentRecords().filter((k) => k !== key);
  recent.unshift(key);
  write(RECENT_KEY, recent.slice(0, 20));
}

export function togglePin(group, item) {
  if (!item?.id) return getPins();
  const key = recordKey(group, item);
  const pins = getPins();
  const next = pins.includes(key) ? pins.filter((k) => k !== key) : [...pins, key];
  write(PIN_KEY, next);
  return next;
}

export function isPinned(group, item) {
  return getPins().includes(recordKey(group, item));
}

// Higher = ranked first. Pinned beats frequency beats recency.
export function rankBoost(group, item) {
  if (!item?.id) return 0;
  const key = recordKey(group, item);
  let boost = 0;
  if (getPins().includes(key)) boost += 1000000;
  boost += (getFrequency()[key] || 0) * 1000;
  const ridx = getRecentRecords().indexOf(key);
  if (ridx >= 0) boost += Math.max(0, 500 - ridx * 25);
  return boost;
}