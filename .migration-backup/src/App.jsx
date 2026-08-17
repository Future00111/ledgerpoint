import NotificationStack from "@/components/notifications/NotificationStack"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CompanyProvider } from '@/lib/useCompany';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Companies from '@/pages/Companies';
import Customers from '@/pages/Customers';
import Suppliers from '@/pages/Suppliers';
import Invoices from '@/pages/Invoices';
import InvoiceForm from '@/pages/InvoiceForm';
import InvoiceDetail from '@/pages/InvoiceDetail';
import Collections from '@/pages/Collections';
import Bills from '@/pages/Bills';
import BillForm from '@/pages/BillForm';
import SalesCreditNotes from '@/pages/SalesCreditNotes';
import SalesCreditNoteForm from '@/pages/SalesCreditNoteForm';
import SupplierCreditNotes from '@/pages/SupplierCreditNotes';
import SupplierCreditNoteForm from '@/pages/SupplierCreditNoteForm';
import BankAccounts from '@/pages/BankAccounts';
import BankTransactions from '@/pages/BankTransactions';
import Reconciliation from '@/pages/Reconciliation';
import VATReturns from '@/pages/VATReturns';
import VATReturnDetail from '@/pages/VATReturnDetail';
import Documents from '@/pages/Documents';
import EmailCapture from '@/pages/EmailCapture';
import EmailRules from '@/pages/EmailRules';
import Reports from '@/pages/Reports';
import AccountantPortal from '@/pages/AccountantPortal';
import Settings from '@/pages/Settings';
import ChartOfAccounts from '@/pages/ChartOfAccounts';
import GeneralLedger from '@/pages/GeneralLedger';
import SetupWizard from '@/pages/SetupWizard';
import Insights from '@/pages/Insights';
import SmartSuggestions from '@/pages/SmartSuggestions';
import DevelopmentTools from '@/pages/DevelopmentTools';
import Automation from '@/pages/Automation';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/setup" element={<SetupWizard />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<CompanyProvider><AppLayout /></CompanyProvider>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<InvoiceForm />} />
          <Route path="/invoices/:id" element={<InvoiceForm />} />
          <Route path="/invoices/:id/view" element={<InvoiceDetail />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/bills/new" element={<BillForm />} />
          <Route path="/bills/:id" element={<BillForm />} />
          <Route path="/sales-credit-notes" element={<SalesCreditNotes />} />
          <Route path="/sales-credit-notes/new" element={<SalesCreditNoteForm />} />
          <Route path="/sales-credit-notes/:id" element={<SalesCreditNoteForm />} />
          <Route path="/supplier-credit-notes" element={<SupplierCreditNotes />} />
          <Route path="/supplier-credit-notes/new" element={<SupplierCreditNoteForm />} />
          <Route path="/supplier-credit-notes/:id" element={<SupplierCreditNoteForm />} />
          <Route path="/bank-accounts" element={<BankAccounts />} />
          <Route path="/transactions" element={<BankTransactions />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/vat" element={<VATReturns />} />
          <Route path="/vat/:id" element={<VATReturnDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/email-capture" element={<EmailCapture />} />
          <Route path="/email-rules" element={<EmailRules />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/accountant" element={<AccountantPortal />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/general-ledger" element={<GeneralLedger />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/smart-suggestions" element={<SmartSuggestions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/dev-tools" element={<DevelopmentTools />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <NotificationStack />
          <AppErrorBoundary>
            <AuthenticatedApp />
          </AppErrorBoundary>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App