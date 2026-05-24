import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import AuthPage from './components/Auth/AuthPage';
import DemoBanner from './components/common/DemoBanner';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Eagerly loaded — render immediately on every session
import BusinessSetup from './components/Business/BusinessSetup';
import Dashboard from './components/Dashboard/Dashboard';

// Lazy-loaded — only fetched when the user navigates to that page
const CustomerList     = lazy(() => import('./components/Customers/CustomerList'));
const CustomerForm     = lazy(() => import('./components/Customers/CustomerForm'));
const CustomerLedger   = lazy(() => import('./components/Customers/CustomerLedger'));
const NewOrder         = lazy(() => import('./components/Orders/NewOrder'));
const InvoiceHistory   = lazy(() => import('./components/Invoices/InvoiceHistory'));
const InvoiceView      = lazy(() => import('./components/Invoices/InvoiceView'));
const StockDashboard   = lazy(() => import('./components/Inventory/StockDashboard'));
const ReadyStockPage   = lazy(() => import('./components/Inventory/ReadyStockPage'));
const PackagingStockPage = lazy(() => import('./components/Inventory/PackagingStockPage'));
const AddStock         = lazy(() => import('./components/Inventory/AddStock'));
const ProductionEntry  = lazy(() => import('./components/Inventory/ProductionEntry'));
const PriceList        = lazy(() => import('./components/Pricing/PriceList'));
const ReportsPage      = lazy(() => import('./components/Reports/ReportsPage'));
const ExpensePage      = lazy(() => import('./components/Expenses/ExpensePage'));
const SalaryListPage   = lazy(() => import('./components/Salary/SalaryListPage'));
const SalaryDetailPage = lazy(() => import('./components/Salary/SalaryDetailPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

export default function App() {
  const { currentPage, businessProfile, isInitialized, initError, initializeApp } = useStore();
  const [session, setSession] = useState<Session | null | 'loading'>(
    DEMO_MODE ? ({} as Session) : 'loading',
  );

  useEffect(() => {
    if (DEMO_MODE) {
      // Skip Supabase auth entirely in demo mode.
      initializeApp();
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        // Reset app state on sign-out
        useStore.setState({ isInitialized: false, orgId: null, businessProfile: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!DEMO_MODE && session && session !== 'loading') {
      initializeApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Checking auth (only in non-demo mode)
  if (!DEMO_MODE && session === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
      </div>
    );
  }

  // Not authenticated (only in non-demo mode)
  if (!DEMO_MODE && !session) {
    return <AuthPage />;
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-sm">Loading your data…</p>
        </div>
      </div>
    );
  }

  // First-run: business profile not set
  if (!businessProfile && currentPage !== 'setup') {
    return (
      <>
        {DEMO_MODE && <DemoBanner />}
        <div className={DEMO_MODE ? 'pt-10' : ''}>
          <BusinessSetup />
        </div>
      </>
    );
  }

  const pageContent = () => {
    switch (currentPage) {
      case 'setup':            return <BusinessSetup />;
      case 'dashboard':        return <Dashboard />;
      case 'customer-list':    return <CustomerList />;
      case 'customer-form':    return <CustomerForm />;
      case 'customer-ledger':  return <CustomerLedger />;
      case 'new-order':        return <NewOrder />;
      case 'invoice-history':  return <InvoiceHistory />;
      case 'invoice-view':     return <InvoiceView />;
      case 'stock-dashboard':  return <ReadyStockPage />;
      case 'ready-stock':      return <ReadyStockPage />;
      case 'packaging-stock':  return <PackagingStockPage />;
      case 'add-stock':        return <AddStock />;
      case 'production-entry': return <ProductionEntry />;
      case 'price-list':       return <PriceList />;
      case 'reports':          return <ReportsPage />;
      case 'expense':          return <ExpensePage />;
      case 'salary-list':      return <SalaryListPage />;
      case 'salary-detail':    return <SalaryDetailPage />;
      default:                 return <Dashboard />;
    }
  };

  return (
    <>
      {DEMO_MODE && <DemoBanner />}
      <div className={DEMO_MODE ? 'pt-10' : ''}>
        <Suspense fallback={<PageLoader />}>
          {pageContent()}
        </Suspense>
      </div>
    </>
  );
}
