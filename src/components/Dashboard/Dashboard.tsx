import React from 'react';
import {
  ShoppingCart, TrendingUp, FlaskConical, PackageCheck,
  AlertTriangle, ArrowRight, Users, IndianRupee,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES, PACKAGING_MATERIALS } from '../../data/products';
import { fmtINR, formatDate } from '../../utils/format';
import Layout from '../Layout/Layout';

const TODAY = formatDate(new Date());

function KpiCard({
  label, value, sub, icon, accent, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left w-full hover:shadow-md transition-shadow group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-slate-800 leading-none">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      <div className="text-sm text-slate-500 mt-2 font-medium">{label}</div>
    </button>
  );
}

export default function Dashboard() {
  const {
    customers, invoices, packagingStock, reorderLevels,
    navigate, startNewOrder, businessProfile,
    productionLogs, readyStock, getReadyStockStatus,
  } = useStore();

  // ── Today's figures ──────────────────────────────────────────────
  const todayInvoices = invoices.filter(i => !i.cancelled && i.invoiceDate === TODAY);
  const todayRevenue  = todayInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const todayCash     = todayInvoices.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const todayCredit   = todayInvoices.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0);

  // ── Today's production ───────────────────────────────────────────
  const todayLogs = productionLogs.filter(l => l.date === TODAY);
  const todayProduction: Record<string, number> = {};
  for (const log of todayLogs) {
    todayProduction[log.productName] = (todayProduction[log.productName] ?? 0) + log.quantityProduced;
  }
  const todayTotalKg = Object.values(todayProduction).reduce((s, v) => s + v, 0);

  // ── Weekly rolling (last 7 days) ──────────────────────────────────
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return formatDate(d);
  });
  const weekRevenue = invoices
    .filter(i => !i.cancelled && week.includes(i.invoiceDate))
    .reduce((s, i) => s + i.grandTotal, 0);
  const weekProduction = productionLogs
    .filter(l => week.includes(l.date))
    .reduce((s, l) => s + l.quantityProduced, 0);

  // ── Ready stock alerts ────────────────────────────────────────────
  const lowReadyItems = PRODUCTS.filter(p => {
    const status = getReadyStockStatus(p.id);
    return status === 'low' || status === 'out';
  });
  const lowPkgItems = PACKAGING_MATERIALS.filter(pm => {
    const stock = packagingStock[pm.id] ?? 0;
    const reorder = reorderLevels.packaging[pm.id] ?? 0;
    return stock === 0 || (reorder > 0 && stock <= reorder);
  });

  // ── Today's sales by SKU ──────────────────────────────────────────
  const todaySkuSales: Record<string, { name: string; qty: number; amount: number }> = {};
  for (const inv of todayInvoices) {
    for (const item of inv.items) {
      if (!todaySkuSales[item.skuId]) {
        const sku = PRODUCTS.find(p => p.id === item.skuId);
        todaySkuSales[item.skuId] = { name: sku ? `${sku.product} – ${sku.variant}` : item.skuId, qty: 0, amount: 0 };
      }
      todaySkuSales[item.skuId].qty += item.quantity;
      todaySkuSales[item.skuId].amount += item.quantity * item.rate;
    }
  }
  const skuSalesList = Object.values(todaySkuSales).sort((a, b) => b.amount - a.amount);

  // ── Recent invoices (last 5) ──────────────────────────────────────
  const recentInvoices = [...invoices]
    .filter(i => !i.cancelled)
    .sort((a, b) => b.invoiceNo.localeCompare(a.invoiceNo))
    .slice(0, 5);

  const dayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Layout
      title={businessProfile?.name ?? 'Dashboard'}
      subtitle={dayLabel}
      actions={
        <button
          onClick={startNewOrder}
          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm shadow-indigo-200 transition-colors"
        >
          <ShoppingCart size={15} /> New Order
        </button>
      }
    >
      {/* ── KPI row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Today's Revenue"
          value={fmtINR(todayRevenue)}
          sub={`${todayInvoices.length} order${todayInvoices.length !== 1 ? 's' : ''}`}
          icon={<IndianRupee size={18} className="text-emerald-600" />}
          accent="bg-emerald-50"
          onClick={() => navigate('invoice-history')}
        />
        <KpiCard
          label="Today's Production"
          value={`${todayTotalKg.toFixed(1)} kg`}
          sub={todayLogs.length > 0 ? Object.entries(todayProduction).map(([k, v]) => `${k}: ${v}kg`).join(', ') : 'No entries today'}
          icon={<FlaskConical size={18} className="text-amber-600" />}
          accent="bg-amber-50"
          onClick={() => navigate('production-entry')}
        />
        <KpiCard
          label="7-Day Revenue"
          value={fmtINR(weekRevenue)}
          sub={`${weekProduction.toFixed(0)} kg produced`}
          icon={<TrendingUp size={18} className="text-indigo-600" />}
          accent="bg-indigo-50"
        />
        <KpiCard
          label="Stock Alerts"
          value={lowReadyItems.length + lowPkgItems.length}
          sub={lowReadyItems.length > 0 ? `${lowReadyItems.length} SKU${lowReadyItems.length > 1 ? 's' : ''} low/out` : 'All good'}
          icon={<AlertTriangle size={18} className={lowReadyItems.length + lowPkgItems.length > 0 ? 'text-rose-500' : 'text-slate-400'} />}
          accent={lowReadyItems.length + lowPkgItems.length > 0 ? 'bg-rose-50' : 'bg-slate-50'}
          onClick={() => navigate('ready-stock')}
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── Left: Today's Sales + Production ─────────────────────── */}
        <div className="col-span-8 space-y-5">

          {/* Today's Sales Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="text-indigo-500" />
                <span className="font-semibold text-slate-700">Today's Sales</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                {todayCash > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Cash {fmtINR(todayCash)}</span>}
                {todayCredit > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Credit {fmtINR(todayCredit)}</span>}
                <button onClick={() => navigate('invoice-history')} className="text-indigo-500 hover:underline flex items-center gap-0.5">
                  All invoices <ArrowRight size={12} />
                </button>
              </div>
            </div>
            {skuSalesList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No sales yet today.{' '}
                <button onClick={startNewOrder} className="text-indigo-500 hover:underline">Create first order →</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {skuSalesList.map(item => (
                  <div key={item.name} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="flex-1 text-sm font-medium text-slate-700">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.qty} units</div>
                    <div className="text-sm font-semibold text-slate-800 w-28 text-right">{fmtINR(item.amount)}</div>
                  </div>
                ))}
                <div className="flex items-center gap-4 px-5 py-3 bg-slate-50">
                  <div className="flex-1 text-sm font-bold text-slate-700">Total</div>
                  <div className="text-sm text-slate-500">{Object.values(todaySkuSales).reduce((s, v) => s + v.qty, 0)} units</div>
                  <div className="text-sm font-bold text-slate-800 w-28 text-right">{fmtINR(todayRevenue)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Today's Production */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FlaskConical size={15} className="text-amber-500" />
                <span className="font-semibold text-slate-700">Today's Production</span>
              </div>
              <button onClick={() => navigate('production-entry')} className="text-indigo-500 text-xs hover:underline flex items-center gap-0.5">
                Log production <ArrowRight size={12} />
              </button>
            </div>
            {todayLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No production logged today.{' '}
                <button onClick={() => navigate('production-entry')} className="text-indigo-500 hover:underline">Log now →</button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-0 divide-x divide-slate-100">
                {PRODUCT_CATEGORIES.map(cat => {
                  const kg = todayProduction[cat] ?? 0;
                  return (
                    <div key={cat} className={`px-5 py-4 text-center ${kg > 0 ? '' : 'opacity-40'}`}>
                      <div className="text-xl font-bold text-slate-800">{kg > 0 ? kg.toFixed(1) : '—'}</div>
                      <div className="text-xs text-slate-500 mt-1">{cat}</div>
                      {kg > 0 && <div className="text-xs text-amber-600 mt-0.5">kg</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Invoices (compact) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <span className="font-semibold text-slate-700 text-sm">Recent Invoices</span>
              <button onClick={() => navigate('invoice-history')} className="text-indigo-500 text-xs hover:underline flex items-center gap-0.5">
                View all <ArrowRight size={12} />
              </button>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No invoices yet.</div>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {recentInvoices.map(inv => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate('invoice-view', { invoiceId: inv.id })}
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-indigo-600 font-semibold w-32">{inv.invoiceNo}</td>
                      <td className="px-3 py-2.5 text-slate-600">{inv.customerSnapshot.name}</td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">{inv.invoiceDate}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800 text-right">{fmtINR(inv.grandTotal)}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.paymentMode === 'Cash'
                            ? 'bg-emerald-100 text-emerald-700'
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

        {/* ── Right: Quick actions + Alerts + Ready stock ───────────── */}
        <div className="col-span-4 space-y-5">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</div>
            <div className="space-y-2">
              {[
                { label: 'New Order', icon: <ShoppingCart size={14} />, action: startNewOrder, cls: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
                { label: 'Log Production', icon: <FlaskConical size={14} />, action: () => navigate('production-entry'), cls: 'bg-amber-500 hover:bg-amber-600 text-white' },
                { label: 'Add Customer', icon: <Users size={14} />, action: () => navigate('customer-form'), cls: 'bg-slate-700 hover:bg-slate-800 text-white' },
                { label: 'Modify Ready Stock', icon: <PackageCheck size={14} />, action: () => navigate('ready-stock'), cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
              ].map(({ label, icon, action, cls }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`w-full ${cls} text-sm px-4 py-2.5 rounded-xl flex items-center gap-2.5 font-medium transition-colors`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ready Stock Snapshot */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PackageCheck size={14} className="text-emerald-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ready Stock</span>
              </div>
              <button onClick={() => navigate('ready-stock')} className="text-indigo-500 text-xs hover:underline">Manage</button>
            </div>
            <div className="divide-y divide-slate-50">
              {PRODUCTS.slice(0, 6).map(sku => {
                const count = readyStock[sku.id] ?? 0;
                const status = getReadyStockStatus(sku.id);
                return (
                  <div key={sku.id} className="flex items-center gap-3 px-4 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{sku.variant}</div>
                      <div className="text-xs text-slate-400">{sku.product}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${count === 0 ? 'text-rose-500' : status === 'low' ? 'text-amber-600' : 'text-slate-800'}`}>
                        {count}
                      </div>
                      <div className="text-xs text-slate-400">units</div>
                    </div>
                    <div className={`w-1.5 h-6 rounded-full shrink-0 ${count === 0 ? 'bg-rose-400' : status === 'low' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stock Alerts */}
          {(lowReadyItems.length + lowPkgItems.length) > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-rose-100">
                <AlertTriangle size={14} className="text-rose-500" />
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Alerts</span>
              </div>
              <div className="divide-y divide-rose-100 p-2">
                {lowReadyItems.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center px-2 py-2 text-xs">
                    <span className="text-slate-700 truncate">{p.variant}</span>
                    <span className={`font-bold ml-2 shrink-0 ${(readyStock[p.id] ?? 0) === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                      {readyStock[p.id] ?? 0} left
                    </span>
                  </div>
                ))}
                {lowPkgItems.slice(0, 3).map(pm => (
                  <div key={pm.id} className="flex justify-between items-center px-2 py-2 text-xs">
                    <span className="text-slate-700 truncate">{pm.name}</span>
                    <span className="font-bold text-amber-600 ml-2 shrink-0">{packagingStock[pm.id] ?? 0}</span>
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
