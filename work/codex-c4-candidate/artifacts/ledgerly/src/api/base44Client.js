/**
 * Compatibility shim — replaces @base44/sdk client.
 * All entity CRUD goes through entities.js REST routes.
 * Auth is handled by Clerk; auth methods are no-ops or redirect.
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
  auth: {
    me: async () => {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (!res.ok) throw Object.assign(new Error('Unauthorized'), { status: res.status });
      return res.json();
    },
    isAuthenticated: () => false,
    // All these are handled by Clerk's UI — kept as no-ops to avoid crashes
    loginViaEmailPassword: () => Promise.resolve(),
    loginWithProvider: (provider) => {
      window.location.href = `/sign-in`;
    },
    logout: () => Promise.resolve(),
    register: () => Promise.resolve(),
    verifyOtp: () => Promise.resolve({}),
    resendOtp: () => Promise.resolve(),
    setToken: () => {},
    redirectToLogin: () => { window.location.href = '/sign-in'; },
    resetPasswordRequest: () => Promise.resolve(),
    resetPassword: () => Promise.resolve(),
  },

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
