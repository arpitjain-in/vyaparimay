import React from 'react';
import { Users, FileText, Package, ShoppingCart, AlertTriangle, TrendingUp } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { RAW_MATERIALS, PACKAGING_MATERIALS } from '../../data/products';
import { fmtINR } from '../../utils/format';
import Layout from '../Layout/Layout';

function StatCard({ label, value, icon, color, onClick }:
  { label: string; value: string | number; icon: React.ReactNode; color: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 text-left w-full hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const {
    customers, invoices, rawMaterialStock, packagingStock,
    reorderLevels, navigate, startNewOrder, businessProfile,
  } = useStore();

  const today = new Date().toLocaleDateString('en-GB');
  const todayInvoices = invoices.filter(inv => !inv.cancelled && inv.invoiceDate === today.replace(/\//g, '/'));
  const todayRevenue = todayInvoices.reduce((s, inv) => s + inv.grandTotal, 0);

  const activeCustomers = customers.filter(c => c.active).length;
  const totalInvoices = invoices.filter(inv => !inv.cancelled).length;

  // Low stock items
  const lowRaw = RAW_MATERIALS.filter(rm => {
    const stock = rawMaterialStock[rm.id] ?? 0;
    const reorder = reorderLevels.raw[rm.id] ?? 0;
    return stock === 0 || (reorder > 0 && stock <= reorder);
  });

  const lowPkg = PACKAGING_MATERIALS.filter(pm => {
    const stock = packagingStock[pm.id] ?? 0;
    const reorder = reorderLevels.packaging[pm.id] ?? 0;
    return stock === 0 || (reorder > 0 && stock <= reorder);
  });

  const totalLowStock = lowRaw.length + lowPkg.length;

  // Recent invoices (last 5)
  const recentInvoices = [...invoices]
    .filter(inv => !inv.cancelled)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 5);

  return (
    <Layout
      title={`Welcome, ${businessProfile?.name ?? 'Mill'}`}
      actions={
        <button
          onClick={startNewOrder}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <ShoppingCart size={16} /> New Order
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Customers"
          value={activeCustomers}
          icon={<Users size={22} className="text-blue-600" />}
          color="bg-blue-50"
          onClick={() => navigate('customer-list')}
        />
        <StatCard
          label="Total Invoices"
          value={totalInvoices}
          icon={<FileText size={22} className="text-green-600" />}
          color="bg-green-50"
          onClick={() => navigate('invoice-history')}
        />
        <StatCard
          label="Today's Revenue"
          value={fmtINR(todayRevenue)}
          icon={<TrendingUp size={22} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          label="Low Stock Alerts"
          value={totalLowStock}
          icon={<AlertTriangle size={22} className={totalLowStock > 0 ? 'text-amber-600' : 'text-gray-400'} />}
          color={totalLowStock > 0 ? 'bg-amber-50' : 'bg-gray-50'}
          onClick={() => navigate('stock-dashboard')}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent Invoices */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-700">Recent Invoices</h2>
            <button
              onClick={() => navigate('invoice-history')}
              className="text-indigo-600 text-sm hover:underline"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No invoices yet. Start by creating a new order.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Invoice No', 'Date', 'Customer', 'Amount', 'Payment'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentInvoices.map(inv => (
                    <tr
                      key={inv.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('invoice-view', { invoiceId: inv.id })}
                    >
                      <td className="px-4 py-3 font-mono text-indigo-600 font-medium">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.invoiceDate}</td>
                      <td className="px-4 py-3 text-gray-800">{inv.customerSnapshot.name}</td>
                      <td className="px-4 py-3 font-semibold">{fmtINR(inv.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.paymentMode === 'Cash'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>{inv.paymentMode}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions + Low Stock */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'New Order', icon: <ShoppingCart size={16} />, action: startNewOrder, color: 'bg-indigo-600 hover:bg-indigo-700' },
                { label: 'Add Customer', icon: <Users size={16} />, action: () => navigate('customer-form'), color: 'bg-blue-600 hover:bg-blue-700' },
                { label: 'Add Stock', icon: <Package size={16} />, action: () => navigate('add-stock'), color: 'bg-green-600 hover:bg-green-700' },
                { label: 'Invoice History', icon: <FileText size={16} />, action: () => navigate('invoice-history'), color: 'bg-gray-600 hover:bg-gray-700' },
              ].map(({ label, icon, action, color }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`w-full ${color} text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Low Stock */}
          {totalLowStock > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-amber-200">
              <div className="px-5 py-4 border-b border-amber-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <h2 className="font-semibold text-amber-700">Low Stock Alert</h2>
              </div>
              <div className="p-4 space-y-2">
                {lowRaw.map(rm => (
                  <div key={rm.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">{rm.name}</span>
                    <span className="font-medium text-red-600">{rawMaterialStock[rm.id] ?? 0} kg</span>
                  </div>
                ))}
                {lowPkg.map(pm => (
                  <div key={pm.id} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate">{pm.name}</span>
                    <span className="font-medium text-red-600">{packagingStock[pm.id] ?? 0} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
