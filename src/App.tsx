import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import AuthPage from './components/Auth/AuthPage';
import DemoBanner from './components/common/DemoBanner';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

// Pages
import BusinessSetup from './components/Business/BusinessSetup';
import Dashboard from './components/Dashboard/Dashboard';
import CustomerList from './components/Customers/CustomerList';
import CustomerForm from './components/Customers/CustomerForm';
import CustomerLedger from './components/Customers/CustomerLedger';
import NewOrder from './components/Orders/NewOrder';
import InvoiceHistory from './components/Invoices/InvoiceHistory';
import InvoiceView from './components/Invoices/InvoiceView';
import StockDashboard from './components/Inventory/StockDashboard';
import ReadyStockPage from './components/Inventory/ReadyStockPage';
import PackagingStockPage from './components/Inventory/PackagingStockPage';
import AddStock from './components/Inventory/AddStock';
import ProductionEntry from './components/Inventory/ProductionEntry';
import PriceList from './components/Pricing/PriceList';
import ReportsPage from './components/Reports/ReportsPage';
import ExpensePage from './components/Expenses/ExpensePage';

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
      default:                 return <Dashboard />;
    }
  };

  return (
    <>
      {DEMO_MODE && <DemoBanner />}
      <div className={DEMO_MODE ? 'pt-10' : ''}>
        {pageContent()}
      </div>
    </>
  );
}
