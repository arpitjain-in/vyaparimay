import React from 'react';
import {
  LayoutDashboard, Users, ShoppingCart, FileText,
  PackageCheck, Box, IndianRupee, Settings,
  FlaskConical, LogOut, BarChart3, Wallet,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { AppPage } from '../../types';
import { formatDate } from '../../utils/format';
import { signOut } from '../../lib/db';

interface NavItem {
  label: string;
  page: AppPage;
  icon: React.ReactNode;
  badge?: () => React.ReactNode;
}

type NavSection = { heading: string; items: NavItem[] };

const TODAY = formatDate(new Date());

export default function Sidebar() {
  const { currentPage, navigate, businessProfile, currentOrder, invoices, readyStock, reorderLevels, getReadyStockStatus } = useStore();

  const handleNav = (page: AppPage) => {
    if (page === 'new-order') {
      useStore.getState().startNewOrder();
    } else {
      navigate(page);
    }
  };

  const todaySales = invoices.filter(i => !i.cancelled && i.invoiceDate === TODAY).length;

  const SECTIONS: NavSection[] = [
    {
      heading: 'Overview',
      items: [
        { label: 'Dashboard', page: 'dashboard', icon: <LayoutDashboard size={16} /> },
      ],
    },
    {
      heading: 'Sales',
      items: [
        {
          label: 'New Order', page: 'new-order', icon: <ShoppingCart size={16} />,
          badge: () => currentOrder && currentOrder.items.length > 0
            ? <span className="bg-amber-400 text-slate-900 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">{currentOrder.items.length}</span>
            : null,
        },
        {
          label: 'Customers', page: 'customer-list', icon: <Users size={16} />,
        },
        {
          label: 'Invoices', page: 'invoice-history', icon: <FileText size={16} />,
          badge: () => todaySales > 0
            ? <span className="bg-indigo-400/30 text-indigo-200 text-xs rounded-full px-1.5 leading-5">{todaySales}</span>
            : null,
        },
        { label: 'Price List', page: 'price-list', icon: <IndianRupee size={16} /> },
      ],
    },
    {
      heading: 'Inventory',
      items: [
        { label: 'Ready Stock', page: 'ready-stock', icon: <PackageCheck size={16} /> },
        { label: 'Packaging', page: 'packaging-stock', icon: <Box size={16} /> },
        { label: 'Production Log', page: 'production-entry', icon: <FlaskConical size={16} /> },
      ],
    },
    {
      heading: 'Reports',
      items: [
        { label: 'Reports', page: 'reports', icon: <BarChart3 size={16} /> },
      ],
    },
    {
      heading: 'Finance',
      items: [
        { label: 'Expenses', page: 'expense', icon: <Wallet size={16} /> },
      ],
    },
    {
      heading: 'System',
      items: [
        { label: 'Settings', page: 'setup', icon: <Settings size={16} /> },
      ],
    },
  ];

  const initials = (businessProfile?.name ?? 'VM')
    .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-900/40 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate leading-tight">
              {businessProfile?.name ?? 'Vyaparimay'}
            </div>
            <div className="text-slate-400 text-xs mt-0.5">Flour Mill</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
        {SECTIONS.map(section => (
          <div key={section.heading}>
            <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {section.heading}
            </div>
            {section.items.map(item => {
              const active = currentPage === item.page;
              return (
                <button
                  key={item.page}
                  onClick={() => handleNav(item.page)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span className={active ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.badge?.()}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/60 space-y-2">
        <div className="text-xs text-slate-500">{TODAY}</div>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors text-xs"
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
