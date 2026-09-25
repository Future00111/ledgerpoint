/**
 * Entity API client — replaces base44.entities.*
 *
 * Usage mirrors the original base44 SDK:
 *   import { Company, SalesInvoice, ... } from '@/api/entities';
 *   const items = await SalesInvoice.filter({ company_id: '...', status: { $in: ['a','b'] } }, '-issue_date', 300);
 *   const item  = await SalesInvoice.create({ ... });
 *   await SalesInvoice.update(id, { ... });
 *   await SalesInvoice.delete(id);
 */

const API_BASE = '/api/entities';

// Supported filter operators: { $in: [...] }
function buildParams(filters = {}, order, limit) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      // Handle $in operator: serialize as key[]=v1&key[]=v2
      if (v.$in && Array.isArray(v.$in)) {
        for (const item of v.$in) params.append(`${k}[]`, String(item));
      }
      // Other operators ignored for now (add as needed)
    } else {
      params.set(k, String(v));
    }
  }
  if (order) params.set('_order', order);
  if (limit) params.set('_limit', String(limit));
  return params;
}

function entity(name) {
  return {
    async filter(filters = {}, order, limit) {
      const params = buildParams(filters, order, limit);
      const res = await fetch(`${API_BASE}/${name}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async list(filters = {}, order, limit) {
      return this.filter(filters, order, limit);
    },

    async get(id) {
      const res = await fetch(`${API_BASE}/${name}/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async create(data) {
      const res = await fetch(`${API_BASE}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async update(id, data) {
      const res = await fetch(`${API_BASE}/${name}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async delete(id) {
      const res = await fetch(`${API_BASE}/${name}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async bulkCreate(records) {
      const res = await fetch(`${API_BASE}/${name}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(records),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    async bulkUpdate(records) {
      const res = await fetch(`${API_BASE}/${name}/bulk-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(records),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

export const Company              = entity('Company');
export const CompanyUser          = entity('CompanyUser');
export const Customer             = entity('Customer');
export const Supplier             = entity('Supplier');
export const SalesInvoice         = entity('SalesInvoice');
export const PurchaseBill         = entity('PurchaseBill');
export const SalesCreditNote      = entity('SalesCreditNote');
export const SupplierCreditNote   = entity('SupplierCreditNote');
export const BankAccount          = entity('BankAccount');
export const BankTransaction      = entity('BankTransaction');
export const ChartOfAccount       = entity('ChartOfAccount');
export const JournalEntry         = entity('JournalEntry');
export const VATReturn            = entity('VATReturn');
export const Document             = entity('Document');
export const EmailAccount         = entity('EmailAccount');
export const EmailRule            = entity('EmailRule');
export const EmailCaptureLog      = entity('EmailCaptureLog');
export const EmailScanConfig      = entity('EmailScanConfig');
export const Insight              = entity('Insight');
export const Automation           = entity('Automation');
export const AutomationActivity   = entity('AutomationActivity');
export const WorkflowActivity     = entity('WorkflowActivity');
export const AccountLearning      = entity('AccountLearning');
export const AccountSuggestionLog = entity('AccountSuggestionLog');
export const SuggestionRule       = entity('SuggestionRule');
export const SuggestionSettings   = entity('SuggestionSettings');
export const TransactionComment   = entity('TransactionComment');
