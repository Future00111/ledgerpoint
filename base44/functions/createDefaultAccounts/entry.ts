import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Bank Account', type: 'asset', tax_rate: 0, is_active: true },
  { code: '1100', name: 'Trade Debtors', type: 'asset', tax_rate: 0, is_active: true },
  
  // Liabilities
  { code: '2100', name: 'Trade Creditors', type: 'liability', tax_rate: 0, is_active: true },
  { code: '2200', name: 'VAT Control', type: 'vat', tax_rate: 20, is_active: true },
  
  // Income
  { code: '4000', name: 'Sales', type: 'income', tax_rate: 20, is_active: true },
  { code: '4100', name: 'Parts Sales', type: 'income', tax_rate: 20, is_active: true },
  { code: '4200', name: 'Labour Sales', type: 'income', tax_rate: 20, is_active: true },
  { code: '4300', name: 'MOT Income', type: 'income', tax_rate: 20, is_active: true },
  
  // Cost of Sales / Purchases
  { code: '5000', name: 'Purchases', type: 'cost_of_sales', tax_rate: 20, is_active: true },
  { code: '5100', name: 'Parts Purchases', type: 'cost_of_sales', tax_rate: 20, is_active: true },
  
  // Expenses
  { code: '6100', name: 'Fuel', type: 'expense', tax_rate: 20, is_active: true },
  { code: '6200', name: 'Rent', type: 'expense', tax_rate: 0, is_active: true },
  { code: '6300', name: 'Utilities', type: 'expense', tax_rate: 20, is_active: true },
  { code: '6400', name: 'Insurance', type: 'expense', tax_rate: 20, is_active: true },
  { code: '6500', name: 'Wages', type: 'expense', tax_rate: 0, is_active: true },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { company_id } = await req.json();
    if (!company_id) return Response.json({ error: 'Missing company_id' }, { status: 400 });

    // Check if default accounts already exist
    const existing = await base44.entities.ChartOfAccount.filter({ company_id });
    if (existing.length > 0) {
      return Response.json({ count: 0 });
    }

    const accountsToCreate = DEFAULT_ACCOUNTS.map(acc => ({
      ...acc,
      company_id
    }));

    await base44.entities.ChartOfAccount.bulkCreate(accountsToCreate);

    return Response.json({ count: accountsToCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});