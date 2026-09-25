// Module-level notification store (framework-agnostic).
// Active toasts render top-right and auto-dismiss; dismissed toasts move to
// the Notification Centre history (persisted to localStorage).

const HISTORY_KEY = 'lp.notifications.history.v1';
const AUTO_MS = 5000;
const MAX_ACTIVE = 6;
const MAX_HISTORY = 100;

let state = { active: [], history: [] };
const listeners = new Set();
const timers = new Map();
const paused = new Set();

function load() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      const history = JSON.parse(raw);
      if (Array.isArray(history)) state.history = history.slice(0, MAX_HISTORY);
    }
  } catch {
    /* ignore */
  }
  state.active = [];
}
load();

function persist() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

function emit() {
  for (const l of listeners) l();
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function clearTimer(id) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
}

function schedule(id, type) {
  clearTimer(id);
  if (type === 'error') return; // errors persist until dismissed
  if (paused.has(id)) return;
  timers.set(id, setTimeout(() => dismiss(id), AUTO_MS));
}

export function getState() {
  return state;
}

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function push(n = {}) {
  const id = n.id || genId();
  const type = n.type || (n.variant === 'destructive' ? 'error' : 'info');
  const item = {
    id,
    type,
    title: n.title || '',
    description: n.description || '',
    route: n.route || null,
    createdAt: Date.now(),
    read: false,
  };
  state = {
    active: [item, ...state.active].slice(0, MAX_ACTIVE),
    history: [item, ...state.history].slice(0, MAX_HISTORY),
  };
  persist();
  emit();
  schedule(id, type);
  return { id, dismiss: () => dismiss(id) };
}

export function pause(id) {
  paused.add(id);
  clearTimer(id);
}

export function resume(id) {
  paused.delete(id);
  const it = state.active.find((a) => a.id === id);
  if (it) schedule(id, it.type);
}

export function dismiss(id) {
  clearTimer(id);
  paused.delete(id);
  if (!state.active.some((a) => a.id === id)) return;
  state = { active: state.active.filter((a) => a.id !== id), history: state.history };
  persist();
  emit();
}

export function markRead(id) {
  state = {
    ...state,
    history: state.history.map((h) => (h.id === id ? { ...h, read: true } : h)),
  };
  persist();
  emit();
}

export function markAllRead() {
  state = { ...state, history: state.history.map((h) => ({ ...h, read: true })) };
  persist();
  emit();
}

export function removeNotif(id) {
  clearTimer(id);
  paused.delete(id);
  state = {
    active: state.active.filter((a) => a.id !== id),
    history: state.history.filter((h) => h.id !== id),
  };
  persist();
  emit();
}

export function clearAll() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  paused.clear();
  state = { active: [], history: [] };
  persist();
  emit();
}