const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export const HEALTH_TIERS = [
  { min: 90, label: 'Excellent', tone: 'emerald' },
  { min: 75, label: 'Good', tone: 'emerald' },
  { min: 50, label: 'Moderate', tone: 'amber' },
  { min: 25, label: 'High risk', tone: 'amber' },
  { min: 0, label: 'Critical', tone: 'rose' },
];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Multi-factor Customer Health score (0–100).
// Factors: days overdue, outstanding balance, number of overdue invoices,
// average payment days, revenue trend, purchase frequency, customer lifetime
// value and historical payment behaviour.
//
// Overdue severity applies a HARD CEILING so a seriously delinquent account
// can never present as healthy — no contradictory states. e.g. £105k overdue
// with a 236-day oldest debt is capped at 24 (Critical) regardless of how
// valuable or historically reliable the customer is.
export function computeCustomerHealth(input = {}) {
  const {
    overdueCount = 0, overdueTotal = 0, oldestOverdueDays = 0,
    outstanding = 0, avgPaymentDays = null, terms = 30,
    revenue12m = 0, revenueLastYear = 0, revenueYtd = 0,
    invoiceCount12m = 0, lifetimeValue = 0, creditExceeded = false,
    hasInvoices = false,
  } = input;

  let score = 100;

  // 1. Historical payment behaviour (avg days vs terms)
  let historical;
  if (avgPaymentDays == null) {
    historical = hasInvoices ? 'No payments recorded yet.' : 'New customer — no payment history yet.';
  } else {
    const late = avgPaymentDays - terms;
    if (late <= 0) {
      historical = `Reliable payer — averages ${avgPaymentDays} days (within ${terms}-day terms).`;
    } else if (late <= 7) {
      score -= 6;
      historical = `Pays ~${late} day${late === 1 ? '' : 's'} late (avg ${avgPaymentDays} days).`;
    } else if (late <= 14) {
      score -= 12;
      historical = `Often pays late — avg ${avgPaymentDays} days (${late} days beyond terms).`;
    } else if (late <= 30) {
      score -= 18;
      historical = `Consistently late — avg ${avgPaymentDays} days.`;
    } else {
      score -= 24;
      historical = `Severely late — avg ${avgPaymentDays} days, well beyond terms.`;
    }
  }

  // 2. Overdue severity — hard ceiling + per-invoice / balance penalty
  let overdueCeiling = 100;
  let overduePenalty = 0;
  if (overdueCount > 0) {
    if (oldestOverdueDays > 120) overdueCeiling = 24;
    else if (oldestOverdueDays > 90) overdueCeiling = 39;
    else if (oldestOverdueDays > 60) overdueCeiling = 49;
    else if (oldestOverdueDays > 14) overdueCeiling = 74;
    else overdueCeiling = 89;

    overduePenalty = Math.min(12, overdueCount * 3);
    if (revenue12m > 0) {
      const ratio = overdueTotal / revenue12m;
      if (ratio >= 1) overduePenalty += 16;
      else if (ratio >= 0.5) overduePenalty += 10;
      else if (ratio >= 0.25) overduePenalty += 6;
    } else if (overdueTotal > 0) {
      overduePenalty += 12;
    }
  }
  score -= overduePenalty;

  // 3. Credit limit breach
  if (creditExceeded) score -= 8;

  // 4. Revenue trend
  const revPct = revenueLastYear > 0 ? (revenueYtd - revenueLastYear) / revenueLastYear * 100 : null;
  if (revPct != null) {
    if (revPct > 10) score += 4;
    else if (revPct > 0) score += 2;
    else if (revPct < -10) score -= 6;
    else if (revPct < 0) score -= 3;
  }

  // 5. Purchase frequency
  if (invoiceCount12m >= 12) score += 3;
  else if (invoiceCount12m >= 4) score += 1;
  else if (invoiceCount12m === 0 && hasInvoices) score -= 4;
  else if (invoiceCount12m === 0) score -= 6;

  // 6. Customer lifetime value
  if (lifetimeValue >= 100000) score += 3;
  else if (lifetimeValue >= 20000) score += 1;

  score = clamp(Math.round(score), 0, 100);
  // The overdue ceiling is the dominant control — it overrides any bonuses so
  // a delinquent account can never read as healthy.
  score = Math.min(score, overdueCeiling);

  const tier = HEALTH_TIERS.find((t) => score >= t.min);

  // Current account status
  let current, currentTone;
  if (overdueCount > 0) {
    current = `${gbp.format(overdueTotal)} overdue across ${overdueCount} invoice${overdueCount > 1 ? 's' : ''} · oldest ${oldestOverdueDays} days.`;
    currentTone = oldestOverdueDays > 60 || creditExceeded ? 'rose' : 'amber';
  } else if (outstanding > 0) {
    current = `${gbp.format(outstanding)} outstanding — not yet due.`;
    currentTone = 'emerald';
  } else {
    current = 'Account is clear — no outstanding balance.';
    currentTone = 'emerald';
  }

  return { score, label: tier.label, tone: tier.tone, historical, current, currentTone };
}