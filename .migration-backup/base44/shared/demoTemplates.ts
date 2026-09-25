// Demo data engine — shared by manageDemoCompany & generateDemoData.
// Adding a new template = add an entry to TEMPLATES. No other changes needed.

export const VAT_RATE = '20';

export function vatOf(rate) {
  return rate === '0' ? 0 : rate === '5' ? 0.05 : 0.2;
}
export function round2(n) {
  return Math.round(n * 100) / 100;
}
export function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}
export function dateBack(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
export function addDaysISO(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_ACCOUNTS = [
  { code: '4000', name: 'Sales Income', type: 'income', tax_rate: 20 },
  { code: '5000', name: 'Cost of Sales', type: 'cost_of_sales', tax_rate: 20 },
  { code: '6000', name: 'General Expenses', type: 'expense', tax_rate: 20 },
  { code: '6100', name: 'Utilities', type: 'expense', tax_rate: 20 },
  { code: '6200', name: 'Rent', type: 'expense', tax_rate: 20 },
  { code: '6300', name: 'Insurance', type: 'expense', tax_rate: 20 },
  { code: '6400', name: 'Wages', type: 'expense', tax_rate: 0 },
  { code: '6500', name: 'Fuel', type: 'expense', tax_rate: 20 },
  { code: '1200', name: 'Bank', type: 'asset', tax_rate: 0 },
  { code: '1100', name: 'Trade Debtors', type: 'asset', tax_rate: 0 },
  { code: '2100', name: 'Trade Creditors', type: 'liability', tax_rate: 0 },
  { code: '2200', name: 'VAT Control', type: 'vat', tax_rate: 0 },
  { code: '3000', name: 'Capital', type: 'equity', tax_rate: 0 },
];

export const EXPENSE_CODE = {
  parts: '5000', tools: '5000', fuel: '5000',
  utilities: '6100', rent: '6200', insurance: '6300',
  wages: '6400', office: '6000', professional_fees: '6000', other: '6000',
};

export const TEMPLATES = {
  general_business: {
    label: 'General Business', business_type: 'general_business',
    customers: ['Client Alpha', 'Client Beta', 'Client Gamma', 'Client Delta', 'Client Epsilon', 'Client Zeta', 'Client Eta', 'Client Theta', 'Client Iota', 'Client Kappa'],
    suppliers: ['Office Supplies Co', 'Utilities Provider', 'IT Services Ltd', 'Marketing Agency', 'Cleaning Co', 'Stationery Plus', 'Telecoms Ltd', 'Insurance Brokers', 'Banking Partner', 'Logistics Co'],
    income: [
      { description: 'Professional Services', min: 200, max: 3000, qty: [1, 3] },
      { description: 'Product Sale', min: 50, max: 1000, qty: [1, 4] },
      { description: 'Consultancy', min: 500, max: 5000, qty: [1, 2] },
    ],
    expenses: [
      { description: 'Office Supplies', category: 'office', min: 20, max: 300 },
      { description: 'Utilities', category: 'utilities', min: 60, max: 400 },
      { description: 'Rent', category: 'rent', min: 800, max: 2500 },
      { description: 'Insurance', category: 'insurance', min: 80, max: 400 },
      { description: 'Wages', category: 'wages', min: 500, max: 3000 },
      { description: 'Professional Fees', category: 'professional_fees', min: 100, max: 1000 },
      { description: 'Fuel', category: 'fuel', min: 50, max: 300 },
      { description: 'Tools', category: 'tools', min: 30, max: 400 },
    ],
  },
  garage: {
    label: 'Garage', business_type: 'garage',
    customers: ['Acme Motors Ltd', 'Brighton Autos', 'City Cab Co', 'Eastside Recovery', 'FastFit Garage', 'Greenfield Transport', 'Hillcrest Logistics', 'Metro Delivery', 'Northside Fleet', 'Premier Couriers'],
    suppliers: ['Euro Car Parts', 'GSF Car Parts', 'TPS', 'Screwfix', 'Shell', 'BP', 'Snap-on', 'British Gas', 'BT Business', 'Autodata'],
    income: [
      { description: 'Labour', min: 80, max: 350, qty: [1, 4] },
      { description: 'MOT', min: 54.85, max: 54.85, qty: [1, 1] },
      { description: 'Tyres', min: 60, max: 180, qty: [1, 4] },
      { description: 'Diagnostics', min: 45, max: 120, qty: [1, 2] },
      { description: 'Air Conditioning', min: 60, max: 150, qty: [1, 1] },
      { description: 'Parts', min: 25, max: 300, qty: [1, 5] },
    ],
    expenses: [
      { description: 'Parts Order', category: 'parts', min: 50, max: 800 },
      { description: 'Tools', category: 'tools', min: 30, max: 400 },
      { description: 'Fuel', category: 'fuel', min: 80, max: 400 },
      { description: 'Utilities', category: 'utilities', min: 60, max: 300 },
      { description: 'Insurance', category: 'insurance', min: 80, max: 250 },
      { description: 'Rent', category: 'rent', min: 800, max: 1200 },
      { description: 'Office', category: 'office', min: 20, max: 150 },
      { description: 'Professional Fees', category: 'professional_fees', min: 100, max: 500 },
    ],
  },
  construction: {
    label: 'Construction', business_type: 'construction',
    customers: ['Taylor Homes', 'Persimmon Build', 'Bellway Group', 'Berkeley Homes', 'Redrow Ltd', 'Local Council', 'Schools Trust', 'Retail Park Co', 'Office Build Ltd', 'Private Client'],
    suppliers: ['Travis Perkins', 'Jewson', 'BMF', 'Hirebase', 'Selco', 'Wickes', 'Toolstation', 'HSS Hire', 'British Gas', 'NFU Mutual'],
    income: [
      { description: 'Building Works', min: 500, max: 20000, qty: [1, 3] },
      { description: 'Labour Charge', min: 200, max: 2000, qty: [1, 5] },
      { description: 'Materials Supplied', min: 100, max: 5000, qty: [1, 4] },
    ],
    expenses: [
      { description: 'Materials', category: 'parts', min: 100, max: 3000 },
      { description: 'Tools', category: 'tools', min: 30, max: 600 },
      { description: 'Fuel', category: 'fuel', min: 80, max: 500 },
      { description: 'Wages', category: 'wages', min: 800, max: 4000 },
      { description: 'Insurance', category: 'insurance', min: 100, max: 600 },
      { description: 'Rent', category: 'rent', min: 500, max: 2000 },
      { description: 'Professional Fees', category: 'professional_fees', min: 150, max: 1200 },
    ],
  },
  retail: {
    label: 'Retail', business_type: 'retail',
    customers: ['Online Shopper Ltd', 'High Street Stores', 'Marketplace Buyer', 'Wholesale Buyer Co', 'Etsy Reseller', 'Trade Counter Ltd', 'Pop-up Shop Co', 'Ebay Powerseller', 'Amazon FBA Co', 'Direct Customer'],
    suppliers: ['Stripe', 'Square', 'PayPal', 'Amazon', 'Wholesale Goods Ltd', 'Boxed Supplies Co', 'Pallet Distributors', 'Cargo Imports', 'QuickShip Ltd', 'BulkBuy Wholesale'],
    income: [
      { description: 'Card Sales', min: 20, max: 600, qty: [1, 5] },
      { description: 'Cash Sales', min: 5, max: 200, qty: [1, 6] },
      { description: 'Online Order', min: 30, max: 450, qty: [1, 4] },
    ],
    expenses: [
      { description: 'Stock Purchases', category: 'parts', min: 100, max: 2000 },
      { description: 'Packaging', category: 'tools', min: 30, max: 200 },
      { description: 'Utilities', category: 'utilities', min: 80, max: 500 },
      { description: 'Rent', category: 'rent', min: 1000, max: 4000 },
      { description: 'Card Machine Fees', category: 'office', min: 20, max: 150 },
      { description: 'Insurance', category: 'insurance', min: 60, max: 300 },
      { description: 'Wages', category: 'wages', min: 600, max: 3000 },
    ],
  },
  restaurant: {
    label: 'Restaurant', business_type: 'restaurant',
    customers: ['Walk-in Customers', 'Online Orders', 'Deliveroo', 'Just Eat', 'Uber Eats', 'Table Booking Co', 'Event Booking Ltd', 'Office Lunch Account', 'Catering Client A', 'Catering Client B'],
    suppliers: ['Brake Bros', 'Booker', 'Bidfood', 'Makro', 'Carlsberg UK', 'Coca-Cola', 'British Gas', 'Severn Trent', 'Cardstream', 'Unilever Food'],
    income: [
      { description: 'Food Sales', min: 20, max: 400, qty: [1, 8] },
      { description: 'Drink Sales', min: 10, max: 200, qty: [1, 6] },
      { description: 'Function Booking', min: 200, max: 2000, qty: [1, 1] },
    ],
    expenses: [
      { description: 'Food Purchases', category: 'parts', min: 100, max: 1500 },
      { description: 'Drink Purchases', category: 'other', min: 80, max: 800 },
      { description: 'Utilities', category: 'utilities', min: 100, max: 800 },
      { description: 'Rent', category: 'rent', min: 1200, max: 4000 },
      { description: 'Wages', category: 'wages', min: 800, max: 5000 },
      { description: 'Card Machine Payments', category: 'office', min: 50, max: 400 },
      { description: 'Insurance', category: 'insurance', min: 80, max: 400 },
    ],
  },
  consultant: {
    label: 'Consultant', business_type: 'consultant',
    customers: ['Acme Corp', 'Beta Ltd', 'Gamma Industries', 'Delta Holdings', 'Epsilon Tech', 'Zeta Partners', 'Eta Ventures', 'Theta Solutions', 'Iota Group', 'Kappa Digital'],
    suppliers: ['Microsoft 365', 'Adobe', 'Slack', 'AWS', 'LinkedIn', 'Trainline', 'Premier Inn', 'Marriott', 'QBE Insurance', 'Xero'],
    income: [
      { description: 'Consulting Services', min: 1000, max: 8000, qty: [1, 3] },
      { description: 'Monthly Retainer', min: 1500, max: 5000, qty: [1, 1] },
      { description: 'Project Milestone', min: 2000, max: 10000, qty: [1, 1] },
    ],
    expenses: [
      { description: 'Software Subscriptions', category: 'office', min: 20, max: 200 },
      { description: 'Travel', category: 'other', min: 30, max: 400 },
      { description: 'Hotels', category: 'other', min: 80, max: 250 },
      { description: 'Professional Insurance', category: 'insurance', min: 50, max: 300 },
      { description: 'Professional Fees', category: 'professional_fees', min: 100, max: 800 },
      { description: 'Utilities', category: 'utilities', min: 40, max: 200 },
      { description: 'Wages', category: 'wages', min: 500, max: 2000 },
    ],
  },
  property: {
    label: 'Property', business_type: 'property',
    customers: ['Tenant A', 'Tenant B', 'Tenant C', 'Tenant D', 'Property Management Co', 'Letting Agent Ltd', 'Commercial Tenant', 'Retail Tenant', 'Office Tenant', 'Residential Tenant'],
    suppliers: ['British Gas', 'Thames Water', 'Local Council', 'EPC Assessor', 'Plumber Co', 'Electrician Ltd', 'Gardener Services', 'Insurance Co', 'Mortgage Lender', 'Cleaning Co'],
    income: [
      { description: 'Rental Income', min: 600, max: 3000, qty: [1, 3] },
      { description: 'Service Charge', min: 50, max: 500, qty: [1, 2] },
      { description: 'Property Management Fee', min: 100, max: 800, qty: [1, 1] },
    ],
    expenses: [
      { description: 'Repairs', category: 'parts', min: 50, max: 1000 },
      { description: 'Utilities', category: 'utilities', min: 60, max: 500 },
      { description: 'Insurance', category: 'insurance', min: 80, max: 600 },
      { description: 'Professional Fees', category: 'professional_fees', min: 100, max: 1000 },
      { description: 'Wages', category: 'wages', min: 400, max: 1500 },
      { description: 'Ground Rent', category: 'rent', min: 200, max: 1000 },
    ],
  },
  ecommerce: {
    label: 'E-commerce', business_type: 'ecommerce',
    customers: ['Amazon Buyer', 'Ebay Buyer', 'Shopify Customer', 'Etsy Buyer', 'Wish Shopper', 'Online Order Co', 'Wholesale Account', 'Dropship Client', 'Subscription Customer', 'Guest Checkout'],
    suppliers: ['Shopify', 'AWS', 'Royal Mail', 'DPD', 'Hermes', 'Alibaba', 'China Factory', 'UK Warehouse', 'Stripe', 'Klarna'],
    income: [
      { description: 'Online Sales', min: 15, max: 500, qty: [1, 6] },
      { description: 'Subscription', min: 9.99, max: 49.99, qty: [1, 3] },
      { description: 'Shipping Income', min: 3, max: 30, qty: [1, 5] },
    ],
    expenses: [
      { description: 'Stock', category: 'parts', min: 100, max: 3000 },
      { description: 'Packaging', category: 'tools', min: 30, max: 300 },
      { description: 'Postage', category: 'other', min: 20, max: 500 },
      { description: 'Software', category: 'office', min: 20, max: 300 },
      { description: 'Advertising', category: 'other', min: 50, max: 1500 },
      { description: 'Wages', category: 'wages', min: 600, max: 3000 },
      { description: 'Insurance', category: 'insurance', min: 60, max: 300 },
    ],
  },
};

export function getTemplate(key) {
  return TEMPLATES[key] || TEMPLATES.general_business;
}

function makeLine(line, vatRate, withCategory) {
  const qty = line.qty ? randInt(line.qty[0], line.qty[1]) : 1;
  const unit = round2(randFloat(line.min, line.max));
  const amount = round2(qty * unit);
  const vat = round2(amount * vatOf(vatRate));
  const obj = { description: line.description, quantity: qty, unit_price: unit, vat_rate: vatRate, amount, vat_amount: vat, line_total: round2(amount + vat) };
  if (withCategory && line.category) obj.category = line.category;
  return obj;
}

function totals(lines) {
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vat_total = round2(lines.reduce((s, l) => s + l.vat_amount, 0));
  return { subtotal, vat_total, total: round2(subtotal + vat_total) };
}

export function buildCustomers(tpl, companyId, n) {
  return tpl.customers.slice(0, n).map((name, i) => ({
    company_id: companyId, name, contact_name: name,
    email: name.toLowerCase().replace(/[^a-z]/g, '') + '@example.co.uk',
    phone: '0' + randInt(7000000000, 7999999999),
    payment_terms: pick([7, 14, 30, 60]), status: 'active',
  }));
}
export function buildSuppliers(tpl, companyId, n) {
  return tpl.suppliers.slice(0, n).map((name, i) => ({
    company_id: companyId, name,
    email: name.toLowerCase().replace(/[^a-z]/g, '') + '@example.com',
    phone: '0' + randInt(7000000000, 7999999999),
    default_expense_category: pick(['parts', 'tools', 'utilities', 'rent', 'insurance', 'office', 'professional_fees', 'other']),
    payment_terms: pick([7, 14, 30, 60]), status: 'active',
  }));
}
export function buildBankAccounts(companyId, n) {
  const names = ['Business Account', 'Savings Account', 'Deposit Account'];
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      company_id: companyId, account_name: names[i] || `Account ${i + 1}`,
      bank_name: pick(['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander', 'Monzo']),
      sort_code: `${randInt(10, 99)}-${randInt(10, 99)}-${randInt(10, 99)}`,
      account_number: String(randInt(10000000, 99999999)),
      currency: 'GBP', opening_balance: pick([0, 1000, 5000, 10000]),
      current_balance: pick([500, 2500, 8000, 15000]), status: 'active',
    });
  }
  return arr;
}
export function buildInvoices(tpl, companyId, customers, n, monthsBack, prefix) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const cust = pick(customers);
    const issue = dateBack(randInt(0, monthsBack * 30));
    const terms = pick([7, 14, 30, 60]);
    const lines = [];
    for (let j = 0, c = randInt(1, 3); j < c; j++) lines.push(makeLine(pick(tpl.income), VAT_RATE));
    const t = totals(lines);
    const status = pick(['draft', 'approved', 'sent', 'paid', 'paid', 'part_paid', 'overdue']);
    const paid = status === 'paid';
    const part = status === 'part_paid';
    const amount_paid = paid ? t.total : part ? round2(t.total * 0.5) : 0;
    arr.push({
      company_id: companyId, customer_id: cust.id, customer_name: cust.name,
      invoice_number: `${prefix}-${randInt(10000, 99999)}-${i}`,
      issue_date: issue, due_date: addDaysISO(issue, terms), payment_terms: terms,
      status, line_items: lines, subtotal: t.subtotal, vat_total: t.vat_total, total: t.total,
      amount_paid, balance_due: round2(t.total - amount_paid),
    });
  }
  return arr;
}
export function buildBills(tpl, companyId, suppliers, n, monthsBack, prefix) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const sup = pick(suppliers);
    const issue = dateBack(randInt(0, monthsBack * 30));
    const terms = pick([7, 14, 30, 60]);
    const lines = [];
    for (let j = 0, c = randInt(1, 3); j < c; j++) lines.push(makeLine(pick(tpl.expenses), VAT_RATE, true));
    const t = totals(lines);
    const status = pick(['draft', 'awaiting_review', 'approved', 'paid', 'paid', 'part_paid', 'overdue']);
    const paid = status === 'paid';
    const part = status === 'part_paid';
    const amount_paid = paid ? t.total : part ? round2(t.total * 0.5) : 0;
    arr.push({
      company_id: companyId, supplier_id: sup.id, supplier_name: sup.name,
      bill_number: `${prefix}-${randInt(10000, 99999)}-${i}`,
      bill_date: issue, due_date: addDaysISO(issue, terms), status,
      line_items: lines, subtotal: t.subtotal, vat_total: t.vat_total, total: t.total,
      amount_paid, balance_due: round2(t.total - amount_paid),
      category: lines[0].category,
    });
  }
  return arr;
}
export function buildSalesCreditNotes(tpl, companyId, customers, invoices, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const inv = pick(invoices);
    const lines = (inv.line_items || []).slice(0, 1).map((l) => makeLine(l, VAT_RATE));
    const t = totals(lines);
    arr.push({
      company_id: companyId, customer_id: inv.customer_id, customer_name: inv.customer_name,
      original_invoice_id: inv.id, original_invoice_number: inv.invoice_number,
      credit_note_number: `CN-${randInt(10000, 99999)}-${i}`,
      credit_note_date: addDaysISO(inv.issue_date, randInt(1, 30)),
      reason: pick(['Return', 'Overcharge', 'Cancellation', 'Goodwill']),
      status: 'issued', line_items: lines, subtotal: t.subtotal, vat_total: t.vat_total, total: t.total,
    });
  }
  return arr;
}
export function buildSupplierCreditNotes(tpl, companyId, suppliers, bills, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const bill = pick(bills);
    const lines = (bill.line_items || []).slice(0, 1).map((l) => makeLine(l, VAT_RATE, true));
    const t = totals(lines);
    arr.push({
      company_id: companyId, supplier_id: bill.supplier_id, supplier_name: bill.supplier_name,
      original_bill_id: bill.id, original_bill_number: bill.bill_number,
      credit_note_number: `SCN-${randInt(10000, 99999)}-${i}`,
      credit_note_date: addDaysISO(bill.bill_date, randInt(1, 30)),
      reason: pick(['Return', 'Overcharge', 'Damaged', 'Cancellation']),
      status: 'approved', line_items: lines, subtotal: t.subtotal, vat_total: t.vat_total, total: t.total,
    });
  }
  return arr;
}
export function buildBankTransactions(tpl, companyId, accounts, invoices, bills, n, monthsBack) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const acct = pick(accounts);
    const date = dateBack(randInt(0, monthsBack * 30));
    if (Math.random() < 0.5) {
      const inv = invoices.length ? pick(invoices) : null;
      const amt = inv ? inv.total : round2(randFloat(20, 1000));
      const matched = inv && Math.random() < 0.6;
      arr.push({
        company_id: companyId, bank_account_id: acct.id, bank_account_name: acct.account_name,
        date, description: inv ? `Payment ${inv.invoice_number}` : pick(tpl.income).description,
        money_in: amt, money_out: 0, balance: 0, type: 'income', amount: amt,
        status: matched ? 'matched' : 'review',
        matched_type: matched ? 'sales_invoice' : undefined,
        matched_record_id: matched ? inv.id : undefined,
        matched_record_number: matched ? inv.invoice_number : undefined,
        linked_invoice_id: matched ? inv.id : undefined, reconciled: matched,
      });
    } else {
      const bill = bills.length ? pick(bills) : null;
      const amt = bill ? bill.total : round2(randFloat(20, 800));
      const matched = bill && Math.random() < 0.6;
      arr.push({
        company_id: companyId, bank_account_id: acct.id, bank_account_name: acct.account_name,
        date, description: bill ? `Payment ${bill.bill_number}` : pick(tpl.expenses).description,
        money_in: 0, money_out: amt, balance: 0, type: 'expense', amount: amt,
        status: matched ? 'matched' : 'review',
        matched_type: matched ? 'purchase_bill' : undefined,
        matched_record_id: matched ? bill.id : undefined,
        matched_record_number: matched ? bill.bill_number : undefined,
        linked_bill_id: matched ? bill.id : undefined, reconciled: matched,
        category: bill ? bill.category : pick(['parts', 'tools', 'utilities', 'rent', 'insurance', 'wages', 'fuel', 'office', 'professional_fees', 'other']),
      });
    }
  }
  return arr;
}
export function buildDocuments(companyId, suppliers, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const sup = suppliers.length ? pick(suppliers) : { name: 'Supplier' };
    const status = pick(['pending_review', 'pending_extraction', 'approved']);
    arr.push({
      company_id: companyId, name: `${sup.name} invoice ${i + 1}.pdf`,
      document_type: pick(['purchase_invoice', 'receipt', 'bank_statement', 'other']),
      upload_date: dateBack(randInt(0, 120)), document_date: dateBack(randInt(0, 120)),
      supplier_or_customer: sup.name, reference_number: `DOC-${randInt(1000, 9999)}-${i}`,
      net_amount: round2(randFloat(20, 800)), vat_amount: 0, gross_amount: 0,
      status, file_url: '', mime_type: 'application/pdf', file_size: randInt(20000, 800000),
    });
  }
  return arr;
}
export function buildEmailCaptures(companyId, n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      company_id: companyId,
      email_sender: pick(['invoices@supplier.com', 'billing@example.com', 'accounts@vendor.co.uk']),
      email_subject: `Invoice ${randInt(1000, 9999)} from supplier`,
      attachment_name: `invoice_${i + 1}.pdf`,
      date_found: new Date().toISOString(),
      status: 'captured',
    });
  }
  return arr;
}
export function buildVATReturns(companyId, invoices, bills, n) {
  const arr = [];
  const now = new Date();
  for (let q = 0; q < n; q++) {
    const end = new Date(now.getFullYear(), now.getMonth() - q * 3, 0);
    const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
    const ps = start.toISOString().slice(0, 10);
    const pe = end.toISOString().slice(0, 10);
    const inv = invoices.filter((i) => i.issue_date >= ps && i.issue_date <= pe);
    const bil = bills.filter((b) => b.bill_date >= ps && b.bill_date <= pe);
    const box1 = round2(inv.reduce((s, i) => s + (i.vat_total || 0), 0));
    const box6 = round2(inv.reduce((s, i) => s + (i.subtotal || 0), 0));
    const box4 = round2(bil.reduce((s, b) => s + (b.vat_total || 0), 0));
    const box7 = round2(bil.reduce((s, b) => s + (b.subtotal || 0), 0));
    arr.push({
      company_id: companyId, period_start: ps, period_end: pe, vat_scheme: 'standard',
      status: q === 0 ? 'draft' : 'submitted', locked: q !== 0,
      box1_output_vat: box1, box2_acquisitions: 0, box3_total_vat_due: box1,
      box4_vat_reclaimed: box4, box5_net_vat: round2(box1 - box4),
      box6_total_sales: box6, box7_total_purchases: box7,
      box8_total_acquisitions: 0, box9_total_supplies: 0,
      submission_date: q === 0 ? undefined : addDaysISO(pe, 5),
      reference: `VAT-${start.getFullYear()}Q${Math.floor(start.getMonth() / 3) + 1}`,
    });
  }
  return arr;
}
export function buildJournalEntries(companyId, accounts, invoices, bills, n) {
  const byCode = {};
  accounts.forEach((a) => (byCode[a.code] = a));
  const line = (date, ref, desc, code, debit, credit, sourceType, sourceId, sourceRef) => {
    const a = byCode[code];
    return {
      company_id: companyId, date, reference: ref, description: desc,
      account_id: a ? a.id : undefined, account_code: code, account_name: a ? a.name : code,
      debit: round2(debit || 0), credit: round2(credit || 0),
      source_type: sourceType, source_record_id: sourceId, source_reference: sourceRef,
      is_system_generated: true,
    };
  };
  const arr = [];
  for (const inv of invoices.slice(0, 20)) {
    if (arr.length >= n) break;
    arr.push(line(inv.issue_date, `INV ${inv.invoice_number}`, `Sale ${inv.invoice_number}`, '1100', inv.total, 0, 'sales_invoice', inv.id, inv.invoice_number));
    arr.push(line(inv.issue_date, `INV ${inv.invoice_number}`, `VAT ${inv.invoice_number}`, '2200', inv.vat_total, 0, 'sales_invoice', inv.id, inv.invoice_number));
    arr.push(line(inv.issue_date, `INV ${inv.invoice_number}`, `Sales ${inv.invoice_number}`, '4000', 0, inv.subtotal, 'sales_invoice', inv.id, inv.invoice_number));
  }
  for (const bill of bills.slice(0, 20)) {
    if (arr.length >= n) break;
    arr.push(line(bill.bill_date, `BILL ${bill.bill_number}`, `Bill ${bill.bill_number}`, EXPENSE_CODE[bill.category] || '6000', bill.subtotal, 0, 'purchase_bill', bill.id, bill.bill_number));
    arr.push(line(bill.bill_date, `BILL ${bill.bill_number}`, `VAT ${bill.bill_number}`, '2200', bill.vat_total, 0, 'purchase_bill', bill.id, bill.bill_number));
    arr.push(line(bill.bill_date, `BILL ${bill.bill_number}`, `Creditor ${bill.bill_number}`, '2100', 0, bill.total, 'purchase_bill', bill.id, bill.bill_number));
  }
  return arr.slice(0, n);
}

export async function deleteCompanyData(sr, companyId) {
  const types = [
    'JournalEntry', 'VATReturn', 'EmailCaptureLog', 'Document',
    'BankTransaction', 'SupplierCreditNote', 'SalesCreditNote',
    'PurchaseBill', 'SalesInvoice', 'Supplier', 'Customer',
    'BankAccount', 'ChartOfAccount',
  ];
  const counts = {};
  for (const t of types) {
    try {
      const r = await sr.entities[t].deleteMany({ company_id: companyId });
      counts[t] = r?.deleted_count ?? r?.count ?? 'ok';
    } catch (e) {
      counts[t] = 'error';
    }
  }
  return counts;
}

export const COMPANY_ENTITY_TYPES = [
  'SalesInvoice', 'PurchaseBill', 'SalesCreditNote', 'SupplierCreditNote',
  'BankTransaction', 'BankAccount', 'Document', 'EmailCaptureLog',
  'VATReturn', 'JournalEntry', 'ChartOfAccount', 'Customer', 'Supplier',
];