// Reconciliation engine — pure, rules-based helpers that answer the five
// questions the Banking & Reconciliation workspace exists to answer.
// No black-box AI: every figure and reason is derivable from live data.
import { gbp } from '@/lib/format';

const HIGH_CONFIDENCE = 85;
const MEDIUM_CONFIDENCE = 60;
const SECONDS_PER_TXN = 90; // ~1.5 min to clear a review transaction

function formatDuration(mins) {
  if (mins <= 0) return 'Complete';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const txnAmount = (t) => Number(t.money_in || 0) + Number(t.money_out || 0);

export const RECON_THRESHOLDS = { HIGH_CONFIDENCE, MEDIUM_CONFIDENCE };

// The bank dashboard + five-question summary.
export function computeReconMetrics(transactions, suggestions, bankAccounts) {
  const txns = transactions || [];
  const total = txns.length;
  const matched = txns.filter((t) => t.status === 'matched').length;
  const review = txns.filter((t) => t.status === 'review').length;

  let autoMatchable = 0;
  let requiringReview = 0;
  for (const t of txns) {
    if (t.status !== 'review') continue;
    const top = suggestions[t.id]?.[0];
    if (top && top.confidence >= HIGH_CONFIDENCE) autoMatchable++;
    else requiringReview++;
  }

  const completionPct = total > 0 ? Math.round((matched / total) * 100) : 100;
  const remaining = review;
  const estimatedMinutes = Math.max(remaining ? 1 : 0, Math.round((remaining * SECONDS_PER_TXN) / 60));
  const totalBalance = (bankAccounts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);

  return {
    totalBalance,
    total,
    reconciled: matched,
    remaining,
    reviewCount: review,
    autoMatchableCount: autoMatchable,
    requiringReviewCount: requiringReview,
    completionPct,
    estimatedMinutes,
    estimatedLabel: formatDuration(estimatedMinutes),
    isComplete: remaining === 0,
  };
}

// Prioritised "What Needs Attention" — large, duplicate, unmatched, errors, feed.
export function computeAttentionItems(transactions, suggestions, bankAccounts) {
  const items = [];
  const review = (transactions || []).filter((t) => t.status === 'review');

  // 1. Bank feed interruptions (highest priority)
  const interrupted = (bankAccounts || []).filter(
    (a) => a.connection_type === 'open_banking' && a.open_banking_status !== 'connected'
  );
  if (interrupted.length) {
    items.push({
      key: 'feed', type: 'feed', severity: 'critical',
      title: `${interrupted.length} bank feed${interrupted.length > 1 ? 's' : ''} interrupted`,
      description: interrupted.map((a) => a.account_name).join(', '),
      count: interrupted.length,
    });
  }

  // 2. Possible duplicates (same description + amount + date)
  const dupMap = {};
  for (const t of review) {
    const k = `${(t.description || '').toLowerCase().trim()}|${txnAmount(t)}|${t.date}`;
    (dupMap[k] = dupMap[k] || []).push(t);
  }
  const dupGroups = Object.values(dupMap).filter((g) => g.length > 1);
  const dupTxns = dupGroups.flatMap((g) => g);
  if (dupTxns.length) {
    items.push({
      key: 'duplicate', type: 'duplicate', severity: 'critical',
      title: `${dupTxns.length} possible duplicate${dupTxns.length > 1 ? 's' : ''}`,
      description: 'Same amount, description and date — verify before matching.',
      transactionIds: dupTxns.map((t) => t.id),
      count: dupTxns.length,
    });
  }

  // 3. Large transactions
  const large = review.filter((t) => txnAmount(t) > 1000);
  if (large.length) {
    items.push({
      key: 'large', type: 'large', severity: 'warning',
      title: `${large.length} large transaction${large.length > 1 ? 's' : ''} to approve`,
      description: 'Over £1,000 — review before matching.',
      transactionIds: large.map((t) => t.id),
      count: large.length,
    });
  }

  // 4. Unmatched (no AI suggestion at all)
  const unmatched = review.filter((t) => !suggestions[t.id] || !suggestions[t.id].length);
  if (unmatched.length) {
    items.push({
      key: 'unmatched', type: 'unmatched', severity: 'warning',
      title: `${unmatched.length} unmatched transaction${unmatched.length > 1 ? 's' : ''}`,
      description: 'No AI suggestion — categorise manually.',
      transactionIds: unmatched.map((t) => t.id),
      count: unmatched.length,
    });
  }

  // 5. Potential errors (low-confidence suggestions)
  const lowConf = review.filter((t) => {
    const s = suggestions[t.id];
    return s && s[0] && s[0].confidence < MEDIUM_CONFIDENCE;
  });
  if (lowConf.length) {
    items.push({
      key: 'error', type: 'error', severity: 'warning',
      title: `${lowConf.length} low-confidence match${lowConf.length > 1 ? 'es' : ''}`,
      description: 'AI unsure — verify before approving.',
      transactionIds: lowConf.map((t) => t.id),
      count: lowConf.length,
    });
  }

  return items;
}

// "What should I do next?" — single, ranked recommendation.
export function computeNextAction(transactions, suggestions, metrics) {
  const review = (transactions || []).filter((t) => t.status === 'review');

  // Highest-confidence auto-match first (fewest clicks).
  let best = null;
  for (const t of review) {
    const top = suggestions[t.id]?.[0];
    if (top && (!best || top.confidence > best.confidence)) {
      best = { transactionId: t.id, confidence: top.confidence, suggestion: top };
    }
  }
  if (best && best.confidence >= HIGH_CONFIDENCE) {
    return {
      label: `Approve match to ${best.suggestion.record_number}`,
      reason: `${best.confidence}% confidence — ${best.suggestion.reasons.join(', ').toLowerCase()}.`,
      transactionId: best.transactionId,
      tone: 'positive',
    };
  }

  // Duplicates next.
  const large = review.find((t) => txnAmount(t) > 1000);
  if (large) {
    return {
      label: `Review large transaction: ${large.description || 'untitled'}`,
      reason: `${gbp(txnAmount(large))} — high value, verify before matching.`,
      transactionId: large.id,
      tone: 'warning',
    };
  }

  // Any remaining review transaction.
  if (review.length) {
    const t = review[0];
    const top = suggestions[t.id]?.[0];
    if (top) {
      return {
        label: `Verify match for ${t.description || 'transaction'}`,
        reason: `Best suggestion ${top.record_number} at ${top.confidence}% — below auto-approve threshold.`,
        transactionId: t.id,
        tone: 'info',
      };
    }
    return {
      label: `Categorise "${t.description || 'transaction'}"`,
      reason: 'No AI suggestion — choose a ledger account.',
      transactionId: t.id,
      tone: 'info',
    };
  }

  return {
    label: 'Reconciliation complete',
    reason: 'Every transaction is reconciled. Nothing to do here.',
    transactionId: null,
    tone: 'positive',
  };
}

export function confidenceTone(c) {
  if (c == null) return { label: 'No match', badge: 'bg-slate-100 text-slate-600', ring: 'text-slate-500' };
  if (c >= HIGH_CONFIDENCE) return { label: 'High', badge: 'bg-emerald-100 text-emerald-700', ring: 'text-emerald-600' };
  if (c >= MEDIUM_CONFIDENCE) return { label: 'Medium', badge: 'bg-amber-100 text-amber-700', ring: 'text-amber-600' };
  return { label: 'Low', badge: 'bg-rose-100 text-rose-700', ring: 'text-rose-600' };
}