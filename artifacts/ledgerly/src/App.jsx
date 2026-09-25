import { ClerkProvider, SignIn, SignUp, useAuth as useClerkAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { AppErrorBoundary } from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CompanyProvider } from '@/lib/useCompany';
import NotificationStack from '@/components/notifications/NotificationStack';

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
import AIAccountant from '@/pages/AIAccountant';
import AIAccountantInbox from '@/pages/AIAccountantInbox';
import AIAccountantTasks from '@/pages/AIAccountantTasks';
import AIAccountantReviews from '@/pages/AIAccountantReviews';
import AIAccountantRecommendations from '@/pages/AIAccountantRecommendations';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  variables: {
    colorPrimary: 'hsl(221 83% 53%)',
    colorForeground: 'hsl(222 47% 11%)',
    colorMutedForeground: 'hsl(215 16% 47%)',
    colorDanger: 'hsl(0 84% 60%)',
    colorBackground: 'hsl(210 20% 98%)',
    colorInput: 'hsl(214 32% 91%)',
    colorInputForeground: 'hsl(222 47% 11%)',
    colorNeutral: 'hsl(214 32% 91%)',
    fontFamily: "'Inter', sans-serif",
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground font-semibold',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground',
    formFieldLabel: 'text-foreground font-medium',
    footerActionLink: 'text-primary font-medium',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-muted-foreground',
    identityPreviewEditButton: 'text-primary',
    formFieldSuccessText: 'text-green-600',
    alertText: 'text-foreground',
    logoBox: 'mb-2',
    logoImage: 'h-8 w-auto',
    socialButtonsBlockButton: 'border border-border hover:bg-muted',
    formButtonPrimary: 'bg-primary hover:bg-primary/90',
    formFieldInput: 'border border-input bg-background text-foreground',
    footerAction: 'border-t border-border',
    dividerLine: 'bg-border',
    alert: 'border border-border',
    otpCodeFieldInput: 'border border-input',
    formFieldRow: 'gap-2',
    main: 'gap-4',
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoaded } = useClerkAuth();
  if (!isLoaded) return <LoadingSpinner />;

  return (
    <AuthProvider>
      <Routes>
        {/* Clerk-powered auth pages */}
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        {/* Legacy login routes → redirect to Clerk sign-in */}
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/register" element={<Navigate to="/sign-up" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/sign-in" replace />} />
        <Route path="/reset-password" element={<Navigate to="/sign-in" replace />} />
        <Route path="/setup" element={<SetupWizard />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/sign-in" replace />} />}>
          <Route element={<CompanyProvider><AppLayout /></CompanyProvider>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ai-accountant" element={<AIAccountant />} />
            <Route path="/ai-accountant/inbox" element={<AIAccountantInbox />} />
            <Route path="/ai-accountant/tasks" element={<AIAccountantTasks />} />
            <Route path="/ai-accountant/reviews" element={<AIAccountantReviews />} />
            <Route path="/ai-accountant/recommendations" element={<AIAccountantRecommendations />} />
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
    </AuthProvider>
  );
};

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
    >
      <QueryClientProvider client={queryClientInstance}>
        <Router basename={basePath}>
          <ScrollToTop />
          <AppErrorBoundary>
            <AuthenticatedApp />
          </AppErrorBoundary>
        </Router>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
