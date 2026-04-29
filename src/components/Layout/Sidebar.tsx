import React from 'react';
import {
  LayoutDashboard, Users, ShoppingCart, FileText,
  Package, IndianRupee, Settings, ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AppPage } from '../../types';

interface NavItem {
  label: string;
  page: AppPage;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { label: 'Dashboard',    page: 'dashboard',       icon: <LayoutDashboard size={18} /> },
  { label: 'Customers',    page: 'customer-list',   icon: <Users size={18} /> },
  { label: 'New Order',    page: 'new-order',       icon: <ShoppingCart size={18} /> },
  { label: 'Invoices',     page: 'invoice-history', icon: <FileText size={18} /> },
  { label: 'Inventory',    page: 'stock-dashboard', icon: <Package size={18} /> },
  { label: 'Price List',   page: 'price-list',      icon: <IndianRupee size={18} /> },
  { label: 'Settings',     page: 'setup',           icon: <Settings size={18} /> },
];

export default function Sidebar() {
  const { currentPage, navigate, businessProfile, currentOrder } = useStore();

  const handleNav = (page: AppPage) => {
    if (page === 'new-order') {
      useStore.getState().startNewOrder();
    } else {
      navigate(page);
    }
  };

  return (
    <aside className="w-56 min-h-screen bg-slate-800 flex flex-col shadow-xl">
      {/* Logo / Business Name */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            VM
          </div>
          <div>
            <div className="text-white text-sm font-semibold leading-tight">
              {businessProfile?.name ?? 'Vyaparimay'}
            </div>
            <div className="text-slate-400 text-xs">Flour Mill</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {NAV.map(item => {
          const active = currentPage === item.page ||
            (item.page === 'new-order' && currentPage === 'new-order');
          return (
            <button
              key={item.page}
              onClick={() => handleNav(item.page)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.page === 'new-order' && currentOrder && (
                <span className="bg-amber-400 text-slate-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {currentOrder.items.length}
                </span>
              )}
              {active && <ChevronRight size={14} />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
        Vyaparimay v1.0
      </div>
    </aside>
  );
}
