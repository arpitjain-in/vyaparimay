import React, { useMemo, useState } from 'react';
import {
  ShoppingCart, TrendingUp, PackageCheck, FlaskConical,
  ArrowRight, Users, IndianRupee,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS } from '../../data/products';
import { fmtINR, formatDate } from '../../utils/format';
import Layout from '../Layout/Layout';

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

function SalesBarChart({ data }: { data: { date: string; label: string; revenue: number }[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const activeDays = data.filter(d => d.revenue > 0).length;

  // Show x-axis label every 5 bars; always show today (last bar)
  const showLabel = (i: number) => i % 5 === 0 || i === data.length - 1;
  // Clamp tooltip so it doesn't overflow left/right edges
  const tooltipAlign = (i: number) =>
    i < 3 ? 'left-0' : i > data.length - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-500" />
          <span className="font-semibold text-slate-700">Last 30 Days Sales</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{activeDays} active day{activeDays !== 1 ? 's' : ''}</span>
          <span className="font-semibold text-slate-700">{fmtINR(totalRevenue)}</span>
        </div>
      </div>
      <div className="px-5 pt-5 pb-3">
        {/* Bars — wrapper stretches to h-28; bar is absolute from bottom */}
        <div className="flex gap-[3px] h-28">
          {data.map((d, i) => {
            const heightPct = d.revenue > 0 ? Math.max(3, (d.revenue / maxRevenue) * 100) : 1.5;
            const isToday = i === data.length - 1;
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={d.date}
                className="relative flex-1"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {isHovered && (
                  <div className={`absolute bottom-full mb-2 z-10 bg-slate-800 text-white rounded-lg px-2.5 py-1.5 pointer-events-none shadow-lg whitespace-nowrap ${tooltipAlign(i)}`}>
                    <div className="text-[10px] font-semibold">{d.label}</div>
                    <div className="text-[11px]">{d.revenue > 0 ? fmtINR(d.revenue) : 'No sales'}</div>
                  </div>
                )}
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`absolute bottom-0 left-0 right-0 rounded-sm transition-colors duration-75 ${
                    isHovered       ? 'bg-indigo-600'
                    : isToday       ? 'bg-indigo-500'
                    : d.revenue > 0 ? 'bg-indigo-300'
                    : 'bg-slate-100'
                  }`}
                />
              </div>
            );
          })}
        </div>
        {/* X-axis labels */}
        <div className="flex gap-[3px] mt-1.5">
          {data.map((d, i) => (
            <div key={d.date} className="relative flex-1 h-4">
              {showLabel(i) && (
                <span className={`absolute top-0 text-[9px] text-slate-400 whitespace-nowrap ${
                  i === 0 ? 'left-0' : i === data.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                }`}>
                  {d.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  // Actions don't trigger re-renders — keep destructured together.
  const { navigate, startNewOrder, getReadyStockStatus } = useStore();
  const invoices        = useStore(s => s.invoices);
  const businessProfile = useStore(s => s.businessProfile);
  const readyStock      = useStore(s => s.readyStock);
  const customers       = useStore(s => s.customers);
  const paymentReceipts = useStore(s => s.paymentReceipts);

  // Computed once per mount, refreshed when the component remounts (e.g. next day).
  const TODAY = useMemo(() => formatDate(new Date()), []);
  const dayLabel = useMemo(
    () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }),
    [],
  );

  // ── Today's figures ──────────────────────────────────────────────
  const todayInvoices = useMemo(
    () => invoices.filter(i => !i.cancelled && i.invoiceDate === TODAY),
    [invoices, TODAY],
  );
  const todayRevenue = useMemo(
    () => todayInvoices.reduce((s, i) => s + i.grandTotal, 0),
    [todayInvoices],
  );
  const todayCash = useMemo(
    () => todayInvoices.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0),
    [todayInvoices],
  );
  const todayCredit = useMemo(
    () => todayInvoices.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0),
    [todayInvoices],
  );

  // ── Weekly rolling (last 7 days) ──────────────────────────────────
  const weekRevenue = useMemo(() => {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return formatDate(d);
    });
    return invoices
      .filter(i => !i.cancelled && week.includes(i.invoiceDate))
      .reduce((s, i) => s + i.grandTotal, 0);
  }, [invoices]);

  // ── Last 30 days sales chart data ─────────────────────────────────
  const last30DaysSales = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return { date: formatDate(d), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), revenue: 0 };
    });
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      const day = days.find(d => d.date === inv.invoiceDate);
      if (day) day.revenue += inv.grandTotal;
    }
    return days;
  }, [invoices]);

  // ── Top debtors ───────────────────────────────────────────────────
  const topDebtors = useMemo(() => {
    return customers
      .filter(c => c.active)
      .map(c => {
        const totalInvoiced = invoices
          .filter(i => !i.cancelled && i.customerId === c.id)
          .reduce((s, i) => s + i.grandTotal, 0);
        const totalPaid = paymentReceipts
          .filter(r => r.customerId === c.id)
          .reduce((s, r) => s + r.amount, 0);
        const outstanding = c.openingBalance + totalInvoiced - totalPaid;
        return { customer: c, outstanding };
      })
      .filter(d => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 25);
  }, [customers, invoices, paymentReceipts]);

  // ── Today's sales by SKU ──────────────────────────────────────────
  const skuSalesList = useMemo(() => {
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
    return Object.values(todaySkuSales).sort((a, b) => b.amount - a.amount);
  }, [todayInvoices]);

  // ── Recent invoices (last 5) ──────────────────────────────────────
  const recentInvoices = useMemo(
    () => [...invoices]
      .filter(i => !i.cancelled)
      .sort((a, b) => b.invoiceNo.localeCompare(a.invoiceNo))
      .slice(0, 5),
    [invoices],
  );

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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Today's Revenue"
          value={fmtINR(todayRevenue)}
          sub={`${todayInvoices.length} order${todayInvoices.length !== 1 ? 's' : ''}`}
          icon={<IndianRupee size={18} className="text-emerald-600" />}
          accent="bg-emerald-50"
          onClick={() => navigate('invoice-history')}
        />
        <KpiCard
          label="7-Day Revenue"
          value={fmtINR(weekRevenue)}
          sub="Rolling last 7 days"
          icon={<TrendingUp size={18} className="text-indigo-600" />}
          accent="bg-indigo-50"
        />
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── Left: Today's Sales + 30-Day Chart + Invoices ────────── */}
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
                  <div className="text-sm text-slate-500">{skuSalesList.reduce((s, v) => s + v.qty, 0)} units</div>
                  <div className="text-sm font-bold text-slate-800 w-28 text-right">{fmtINR(todayRevenue)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Last 30 Days Sales Bar Chart */}
          <SalesBarChart data={last30DaysSales} />

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

        </div>
      </div>

      {/* ── Top Debtors ────────────────────────────────────────────── */}
      <div className="mt-5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-rose-500" />
            <span className="font-semibold text-slate-700">Top Customers by Outstanding Dues</span>
          </div>
          <button onClick={() => navigate('customer-list')} className="text-indigo-500 text-xs hover:underline flex items-center gap-0.5">
            All customers <ArrowRight size={12} />
          </button>
        </div>
        {topDebtors.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No outstanding dues.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide">
                <th className="px-5 py-2.5 text-left w-10">#</th>
                <th className="px-3 py-2.5 text-left">Customer</th>
                <th className="px-3 py-2.5 text-left">Firm</th>
                <th className="px-3 py-2.5 text-left">Mobile</th>
                <th className="px-5 py-2.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topDebtors.map(({ customer: c, outstanding }, i) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate('customer-ledger', { customerId: c.id })}
                >
                  <td className="px-5 py-2.5 text-slate-400 text-xs font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{c.name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{c.firmName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-slate-500">{c.mobile}</td>
                  <td className="px-5 py-2.5 text-right font-bold text-rose-600">{fmtINR(outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
