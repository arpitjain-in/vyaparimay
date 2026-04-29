import React from 'react';
import { useStore } from './store/useStore';

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
import AddStock from './components/Inventory/AddStock';
import ProductionEntry from './components/Inventory/ProductionEntry';
import PriceList from './components/Pricing/PriceList';

export default function App() {
  const { currentPage, businessProfile } = useStore();

  // First-run: business profile not set
  if (!businessProfile && currentPage !== 'setup') {
    return <BusinessSetup />;
  }

  switch (currentPage) {
    case 'setup':           return <BusinessSetup />;
    case 'dashboard':       return <Dashboard />;
    case 'customer-list':   return <CustomerList />;
    case 'customer-form':   return <CustomerForm />;
    case 'customer-ledger': return <CustomerLedger />;
    case 'new-order':       return <NewOrder />;
    case 'invoice-history': return <InvoiceHistory />;
    case 'invoice-view':    return <InvoiceView />;
    case 'stock-dashboard': return <StockDashboard />;
    case 'add-stock':       return <AddStock />;
    case 'production-entry': return <ProductionEntry />;
    case 'price-list':      return <PriceList />;
    default:                return <Dashboard />;
  }
}
