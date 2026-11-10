import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import AccountingDocumentForm from '../../artifacts/ledgerly/src/pages/AccountingDocumentForm';
import AccountingDocumentList from '../../artifacts/ledgerly/src/pages/AccountingDocumentList';
import AccountingJournal from '../../artifacts/ledgerly/src/pages/AccountingJournal';
import AccountingReports from '../../artifacts/ledgerly/src/pages/AccountingReports';
import Payments from '../../artifacts/ledgerly/src/pages/Payments';
import Suppliers from '../../artifacts/ledgerly/src/pages/Suppliers';
import Statements from '../../artifacts/ledgerly/src/pages/Statements';
import BankAccounts from '../../artifacts/ledgerly/src/pages/BankAccounts';
import BankTransactions from '../../artifacts/ledgerly/src/pages/BankTransactions';
import {Toaster} from '../../artifacts/ledgerly/src/components/ui/toaster';

// Test-only identity transport. Real native financial APIs, no response mocks.
const nativeFetch=window.fetch.bind(window);
window.fetch=(url,options={})=>{
  const target=new URL(url,location.href);
  if(target.origin!==location.origin) throw Error('External fixture requests prohibited');
  return nativeFetch(url,{...options,headers:{...options.headers,'x-test-actor':'job20-synthetic-owner'}});
};
nativeFetch('/fixture').then(r=>r.json()).then(company=>{
  window.syntheticCompany=company;
  createRoot(document.getElementById('root')).render(<BrowserRouter><QueryClientProvider client={new QueryClient({
    defaultOptions:{queries:{retry:false}},
  })}>
    <p>SYNTHETIC DISPOSABLE ACCEPTANCE — native accounting, test identity (not Clerk). No business records or bank transfers.</p>
    <nav>{[['/invoices','Invoices'],['/invoices/new','New invoice'],['/bills','Bills'],
      ['/suppliers','Suppliers'],['/bills/new','New bill'],['/sales-credit-notes','Customer credits'],['/supplier-credit-notes','Supplier credits'],
      ['/statements','Statements'],['/payments','Payments'],['/bank-accounts','Bank accounts'],['/bank-transactions','Banking'],['/accounting/reports','Reports']].map(([to,label])=><Link style={{marginRight:18}} key={to} to={to}>{label}</Link>)}</nav>
    <Routes>
      <Route path="/invoices" element={<AccountingDocumentList kind="sales_invoice"/>}/>
      <Route path="/invoices/new" element={<AccountingDocumentForm kind="sales_invoice"/>}/>
      <Route path="/invoices/:id" element={<AccountingDocumentForm kind="sales_invoice"/>}/>
      <Route path="/bills" element={<AccountingDocumentList kind="purchase_bill"/>}/>
      <Route path="/bills/new" element={<AccountingDocumentForm kind="purchase_bill"/>}/>
      <Route path="/bills/:id" element={<AccountingDocumentForm kind="purchase_bill"/>}/>
      <Route path="/suppliers" element={<Suppliers/>}/>
      <Route path="/statements" element={<Statements/>}/>
      <Route path="/sales-credit-notes" element={<AccountingDocumentList kind="sales_credit_note"/>}/>
      <Route path="/sales-credit-notes/new" element={<AccountingDocumentForm kind="sales_credit_note"/>}/>
      <Route path="/sales-credit-notes/:id" element={<AccountingDocumentForm kind="sales_credit_note"/>}/>
      <Route path="/supplier-credit-notes" element={<AccountingDocumentList kind="supplier_credit_note"/>}/>
      <Route path="/supplier-credit-notes/new" element={<AccountingDocumentForm kind="supplier_credit_note"/>}/>
      <Route path="/supplier-credit-notes/:id" element={<AccountingDocumentForm kind="supplier_credit_note"/>}/>
      <Route path="/payments" element={<Payments/>}/>
      <Route path="/bank-accounts" element={<BankAccounts/>}/>
      <Route path="/bank-transactions" element={<BankTransactions/>}/>
      <Route path="/accounting/journals/:id" element={<AccountingJournal/>}/>
      <Route path="/accounting/reports" element={<AccountingReports/>}/>
    </Routes><Toaster/>
  </QueryClientProvider></BrowserRouter>);
});
