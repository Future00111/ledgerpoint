/**
 * Temporary compatibility shim for unmigrated entity and integration callers.
 * Authentication is provided by Clerk directly; this object has no auth API.
 */

import {
  Company, CompanyUser, Customer, Supplier,
  SalesInvoice, PurchaseBill, SalesCreditNote, SupplierCreditNote,
  BankAccount, BankTransaction, ChartOfAccount, JournalEntry,
  VATReturn, Document, EmailAccount, EmailRule, EmailCaptureLog,
  EmailScanConfig, Insight, Automation, AutomationActivity,
  WorkflowActivity, AccountLearning, AccountSuggestionLog,
  SuggestionRule, SuggestionSettings, TransactionComment,
} from '@/api/entities';

import {
  InvokeLLM, GenerateImage, ExtractDataFromUploadedFile,
  SendEmail, UploadFile,
} from '@/api/integrations';

export const base44 = {
  entities: {
    Company, CompanyUser, Customer, Supplier,
    SalesInvoice, PurchaseBill, SalesCreditNote, SupplierCreditNote,
    BankAccount, BankTransaction, ChartOfAccount, JournalEntry,
    VATReturn, Document, EmailAccount, EmailRule, EmailCaptureLog,
    EmailScanConfig, Insight, Automation, AutomationActivity,
    WorkflowActivity, AccountLearning, AccountSuggestionLog,
    SuggestionRule, SuggestionSettings, TransactionComment,
  },

  integrations: {
    Core: {
      InvokeLLM,
      GenerateImage,
      ExtractDataFromUploadedFile,
      SendEmail,
      UploadFile,
    },
  },

  // base44.functions.invoke — calls /api/functions/:name server-side handlers
  functions: {
    invoke: async (name, args = {}) => {
      const res = await fetch(`/api/functions/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(args),
      });
      const json = await res.json().catch(() => ({ error: res.statusText }));
      if (!res.ok) {
        const err = Object.assign(new Error(json.error || `${name} failed`), { status: res.status, notYetAvailable: json.notYetAvailable });
        throw err;
      }
      return json;
    },
  },
};
