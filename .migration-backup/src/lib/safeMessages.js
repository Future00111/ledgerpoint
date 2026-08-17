// Customer Safe Mode — application-wide UX rule.
// Customers never see technical/developer information; only friendly business
// language. Developer users (role === 'developer') and the development
// environment keep full technical detail.
import { useAuth } from '@/lib/AuthContext';
import { push as pushNotif } from '@/components/notifications/notifications';

const DEV_ENV =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.DEV || import.meta.env.MODE === 'development')) ||
  false;

export function isDevMode(user) {
  return !!(DEV_ENV || (user && user.role === 'developer'));
}

export function useDevMode() {
  const { user } = useAuth();
  return isDevMode(user);
}

// Heuristics for content that should never reach a customer.
const TECHNICAL_PATTERNS = [
  /^\s*[{[]/, // raw JSON / arrays
  /\bUUID\b/i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i, // uuid prefix
  /\b(Internal Server Error|Stack|Traceback|TypeError|ReferenceError|SyntaxError|ECONN\w*|ENOENT)\b/i,
  /\b\d{3}\b\s*(Error|Exception)/i,
  /\bat\s.+:\d+:\d+/, // stack frame
  /_id|company_id|invoice_id|entity/i, // raw field keys / ids
];

export function looksTechnical(str) {
  if (str == null) return false;
  if (typeof str !== 'string') return true; // objects/arrays are technical
  const s = str.trim();
  if (!s) return false;
  return TECHNICAL_PATTERNS.some((re) => re.test(s));
}

const FRIENDLY = {
  network: {
    title: 'Connection problem',
    description:
      "Ledgerly couldn't connect to the server. Please check your connection and try again.",
  },
  server: {
    title: 'Something went wrong',
    description:
      'Something went wrong while saving your changes. Please try again. If the problem continues, contact support.',
  },
  validation: {
    title: 'Missing information',
    description:
      'This could not be saved because some required information is missing. Please check the form and try again.',
  },
  auth: {
    title: 'Sign-in required',
    description: 'Your session has expired. Please sign in again to continue.',
  },
  notfound: {
    title: 'Not found',
    description: "We couldn't find what you were looking for. It may have been moved or deleted.",
  },
  generic: {
    title: 'Something went wrong',
    description: 'Something went wrong. Please try again. If the problem continues, contact support.',
  },
};

function newErrorId() {
  return 'ERR-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Always record in logs — but logs are only emitted in dev mode / dev env.
export function logError(err, context, errorId) {
  if (!DEV_ENV) return;
  // eslint-disable-next-line no-console
  console.error('[Ledgerly]', errorId || '', context || '', err);
}

// Convert any thrown value into a friendly, customer-safe message plus an
// internal error id for logging. Developer mode keeps the raw detail attached.
export function friendlyError(err, context = '') {
  const errorId = newErrorId();
  const raw =
    (err && (err.message || err.error || (typeof err === 'string' ? err : ''))) || '';
  const status = err && err.status;

  let kind = 'generic';
  if (status === 401 || status === 403) kind = 'auth';
  else if (status === 404) kind = 'notfound';
  else if (status >= 500) kind = 'server';
  else if (/valid|missing|required|schema|must be/i.test(raw)) kind = 'validation';
  else if (/network|fetch|timeout|ECONN|offline/i.test(raw)) kind = 'network';

  logError(err, context || kind, errorId);

  const base = FRIENDLY[kind];
  if (DEV_ENV) {
    return { ...base, errorId, technical: raw, status };
  }
  return { ...base, errorId };
}

// Sanitize a single string for customer display.
export function sanitizeForUser(str, fallback = FRIENDLY.generic.description) {
  if (!str) return '';
  if (DEV_ENV) return String(str);
  return looksTechnical(str) ? fallback : String(str);
}

// Sanitize a notification object for display (keeps id/route; rewords text).
export function sanitizeNotification(n, devMode) {
  if (devMode) return n;
  return {
    ...n,
    title: looksTechnical(n.title) ? FRIENDLY.generic.title : n.title || '',
    description: looksTechnical(n.description) ? FRIENDLY.generic.description : n.description || '',
  };
}

// Convenience helpers for call sites that want the friendly path directly.
export function errorToast(err, context = '') {
  const f = friendlyError(err, context);
  return pushNotif({
    type: 'error',
    title: f.title,
    description: f.description,
  });
}

export function successToast(title, description) {
  return pushNotif({ type: 'success', title, description });
}

export function infoToast(title, description) {
  return pushNotif({ type: 'info', title, description });
}

export function warningToast(title, description) {
  return pushNotif({ type: 'warning', title, description });
}

export { FRIENDLY };