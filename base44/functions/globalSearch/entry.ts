import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Normalise for matching: lowercase, strip punctuation, collapse spaces.
function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, k) => k);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = ai === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// Partial (normalised) match OR fuzzy token match (minor spelling mistakes).
function matchOne(normQuery, queryTokens, fieldVals) {
  if (!normQuery) return false;
  const normVals = fieldVals.map(normalize).filter(Boolean);
  if (!normVals.length) return false;
  if (normVals.some((v) => v.includes(normQuery))) return true;
  if (!queryTokens.length) return false;
  const fieldTokens = normVals.join(' ').split(' ').filter(Boolean);
  if (!fieldTokens.length) return false;
  return queryTokens.every((qt) =>
    fieldTokens.some(
      (ft) => ft.includes(qt) || qt.includes(ft) || levenshtein(qt, ft) <= (qt.length <= 4 ? 1 : 2)
    )
  );
}

// Looser scoring for "similar records" when nothing is found.
function similarScore(normQuery, queryTokens, nameVals) {
  const normVals = nameVals.map(normalize).filter(Boolean);
  if (!normVals.length) return Infinity;
  const fieldTokens = new Set(normVals.join(' ').split(' ').filter(Boolean));
  let overlap = 0;
  queryTokens.forEach((qt) => {
    if (fieldTokens.has(qt)) overlap++;
  });
  if (overlap > 0) return 100 - overlap;
  let best = Infinity;
  normVals.forEach((v) => {
    best = Math.min(best, levenshtein(normQuery, v));
  });
  return best;
}

const REPORTS = [
  { label: 'Profit & Loss Report', route: '/reports' },
  { label: 'Balance Sheet Report', route: '/reports' },
  { label: 'Trial Balance Report', route: '/reports' },
  { label: 'Cash Flow Report', route: '/reports' },
  { label: 'Aged Debtors Report', route: '/reports' },
  { label: 'Aged Creditors Report', route: '/reports' },
  { label: 'VAT Summary Report', route: '/reports' },
  { label: 'General Ledger', route: '/general-ledger' },
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const companyId = body.company_id;
    const query = (body.query || '').trim();
    if (!companyId || query.length < 2) return Response.json({ groups: [], similar: [] });

    const normQuery = normalize(query);
    const queryTokens = normQuery.split(' ').filter(Boolean);

    // Search order: Customers, Suppliers, Companies, Invoices, Bills,
    // Credit Notes, Bank Transactions, Documents, Reports (then extras).
    const sources = [
      { label: 'Customers', type: 'Customer', fields: ['name', 'email', 'customer_reference'], labelFn: (r) => r.name, subFn: (r) => r.email, route: () => '/customers', nameFields: ['name'] },
      { label: 'Suppliers', type: 'Supplier', fields: ['name', 'email', 'supplier_reference'], labelFn: (r) => r.name, subFn: (r) => r.email, route: () => '/suppliers', nameFields: ['name'] },
      { label: 'Invoices', type: 'SalesInvoice', fields: ['invoice_number', 'customer_name', 'reference'], labelFn: (r) => r.invoice_number, subFn: (r) => r.customer_name, route: (r) => `/invoices/${r.id}`, nameFields: ['invoice_number', 'customer_name'] },
      { label: 'Bills', type: 'PurchaseBill', fields: ['bill_number', 'supplier_name', 'reference'], labelFn: (r) => r.bill_number, subFn: (r) => r.supplier_name, route: (r) => `/bills/${r.id}`, nameFields: ['bill_number', 'supplier_name'] },
      { label: 'Credit Notes', type: 'SalesCreditNote', fields: ['credit_note_number', 'customer_name', 'reason'], labelFn: (r) => r.credit_note_number, subFn: (r) => r.customer_name, route: (r) => `/sales-credit-notes/${r.id}`, nameFields: ['credit_note_number', 'customer_name'] },
      { label: 'Supplier Credit Notes', type: 'SupplierCreditNote', fields: ['credit_note_number', 'supplier_name', 'reason'], labelFn: (r) => r.credit_note_number, subFn: (r) => r.supplier_name, route: (r) => `/supplier-credit-notes/${r.id}`, nameFields: ['credit_note_number', 'supplier_name'] },
      { label: 'Bank Transactions', type: 'BankTransaction', fields: ['description', 'reference'], labelFn: (r) => r.description, subFn: (r) => r.reference, route: () => '/transactions', nameFields: ['description'] },
      { label: 'Documents', type: 'Document', fields: ['name', 'supplier_or_customer', 'reference_number'], labelFn: (r) => r.name, subFn: (r) => r.supplier_or_customer, route: () => '/documents', nameFields: ['name', 'supplier_or_customer'] },
      { label: 'Ledger Accounts', type: 'ChartOfAccount', fields: ['code', 'name'], labelFn: (r) => r.name, subFn: (r) => r.code, route: () => '/chart-of-accounts', nameFields: ['name'] },
      { label: 'VAT Returns', type: 'VATReturn', fields: ['reference', 'period_start'], labelFn: (r) => r.reference || 'VAT Return', subFn: (r) => r.period_start, route: (r) => `/vat/${r.id}`, nameFields: ['reference'] },
      { label: 'Journal Entries', type: 'JournalEntry', fields: ['description', 'reference', 'account_name', 'account_code'], labelFn: (r) => r.reference || r.description, subFn: (r) => (r.account_name ? `${r.account_code || ''} ${r.account_name}`.trim() : r.description), route: () => '/general-ledger', nameFields: ['description', 'reference'] },
    ];

    const fetched = await Promise.all(
      sources.map(async (s) => {
        let list = [];
        try {
          list = await base44.asServiceRole.entities[s.type].filter({ company_id: companyId }, '-updated_date', 200);
        } catch (_e) {
          list = [];
        }
        return { s, list: list || [] };
      })
    );

    const groups = [];
    for (const { s, list } of fetched) {
      const matched = list
        .filter((r) => matchOne(normQuery, queryTokens, s.fields.map((f) => r[f])))
        .slice(0, 6)
        .map((r) => ({
          id: r.id,
          label: s.labelFn(r) || 'Untitled',
          sublabel: s.subFn(r) || '',
          route: s.route(r),
        }));
      if (matched.length) groups.push({ label: s.label, items: matched });
    }

    // Companies — search across the user's accessible companies (for switching).
    try {
      const cu = await base44.asServiceRole.entities.CompanyUser.filter(
        { user_email: user.email, status: 'active' },
        '-created_date',
        50
      );
      const ids = [...new Set((cu || []).map((c) => c.company_id).filter(Boolean))];
      const companies = (
        await Promise.all(ids.map((id) => base44.asServiceRole.entities.Company.get(id).catch(() => null)))
      ).filter(Boolean);
      const cMatched = companies
        .filter((r) => matchOne(normQuery, queryTokens, [r.name, r.registration_number, r.vat_number]))
        .slice(0, 6)
        .map((r) => ({ id: r.id, label: r.name || 'Untitled', sublabel: r.registration_number || '', route: '/companies' }));
      if (cMatched.length) groups.splice(2, 0, { label: 'Companies', items: cMatched }); // after Suppliers
    } catch (_e) {
      /* companies unavailable */
    }

    // Reports — static catalogue.
    const rMatched = REPORTS.filter((r) => matchOne(normQuery, queryTokens, [r.label])).map((r) => ({
      label: r.label,
      sublabel: 'Report',
      route: r.route,
    }));
    if (rMatched.length) groups.push({ label: 'Reports', items: rMatched });

    // Similar records when nothing matched.
    let similar = [];
    if (!groups.length) {
      const cands = [];
      for (const { s, list } of fetched) {
        list.forEach((r) => {
          const nameVals = s.nameFields.map((f) => r[f]);
          const score = similarScore(normQuery, queryTokens, nameVals);
          if (score < Infinity) cands.push({ score, label: s.labelFn(r) || 'Untitled', sublabel: s.label, route: s.route(r) });
        });
      }
      similar = cands
        .filter((c) => c.score <= 3 || c.score > 90) // token overlap (>90) or near spelling
        .sort((a, b) => a.score - b.score)
        .slice(0, 5);
    }

    return Response.json({ groups, similar });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}