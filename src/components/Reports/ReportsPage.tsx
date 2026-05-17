import React, { useMemo, useState } from 'react';
import { BarChart3, PackageCheck, Box, FileDown, TrendingUp, Banknote, CreditCard } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES, PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import { fmtINR, formatDate } from '../../utils/format';
import type { Invoice, ReadyStockTransaction, PackagingEntry } from '../../types';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toOrd(ddmmyyyy: string): number {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return Number(yyyy) * 10000 + Number(mm) * 100 + Number(dd);
}

function dateStr(d: Date): string {
  return formatDate(d);
}

// ─── Rolling period ───────────────────────────────────────────────────────────

type RollingPeriod = 'today' | '1w' | '2w' | '1m';

const PERIOD_LABELS: Record<RollingPeriod, string> = {
  today: 'Today',
  '1w':  '1 Week',
  '2w':  '2 Weeks',
  '1m':  '1 Month',
};

function getRollingRange(period: RollingPeriod): { start: string; end: string } {
  const today = new Date();
  const end = dateStr(today);
  const startD = new Date(today);
  switch (period) {
    case 'today': break;
    case '1w':  startD.setDate(today.getDate() - 6);  break;
    case '2w':  startD.setDate(today.getDate() - 13); break;
    case '1m':  startD.setDate(today.getDate() - 29); break;
  }
  return { start: dateStr(startD), end };
}

function PeriodPicker({
  value,
  onChange,
}: {
  value: RollingPeriod;
  onChange: (p: RollingPeriod) => void;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm self-start">
      {(Object.keys(PERIOD_LABELS) as RollingPeriod[]).map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === p
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

const PDF_STYLES = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 16px; }
  .biz-name { font-size: 17px; font-weight: 700; color: #312e81; }
  .report-title { font-size: 12px; font-weight: 600; color: #4f46e5; margin-top: 3px; }
  .report-meta { font-size: 9px; color: #64748b; margin-top: 2px; }
  .section { margin-bottom: 16px; }
  .cat-header { background: #f1f5f9; padding: 5px 10px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; border-bottom: none; }
  .cat-name { font-weight: 700; font-size: 11px; color: #334155; }
  .cat-total { font-weight: 700; font-size: 11px; color: #4f46e5; }
  .pills { background: #eef2ff; padding: 5px 10px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
  .pill { display: inline-block; background: #e0e7ff; color: #3730a3; font-size: 9px; font-weight: 600; padding: 1px 7px; border-radius: 10px; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
  thead tr { background: #f8fafc; }
  th { padding: 5px 10px; font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 5px 10px; font-size: 10px; border-top: 1px solid #f1f5f9; color: #334155; }
  .amt { color: #4f46e5; font-weight: 600; }
  .green { color: #059669; font-weight: 600; }
  .red { color: #e11d48; font-weight: 600; }
  .amber { color: #d97706; font-weight: 600; }
  .bold { font-weight: 700; }
  .summary-grid { display: flex; gap: 10px; margin-bottom: 16px; }
  .summary-card { flex: 1; padding: 10px 14px; border-radius: 8px; }
  .summary-card.indigo { background: #eef2ff; }
  .summary-card.emerald { background: #f0fdf4; }
  .summary-card.amber { background: #fffbeb; }
  .summary-label { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 3px; }
  .summary-value { font-size: 15px; font-weight: 700; }
  .summary-card.indigo .summary-value { color: #4338ca; }
  .summary-card.emerald .summary-value { color: #15803d; }
  .summary-card.amber .summary-value { color: #b45309; }
  .footer { font-size: 8px; color: #94a3b8; text-align: right; margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
`;

function wrapPdfHtml(body: string): string {
  const generated = formatDate(new Date());
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Report</title><style>${PDF_STYLES}</style></head><body>${body}<div class="footer">Vyaparimay &nbsp;&middot;&nbsp; Generated ${generated}</div></body></html>`;
}

function buildOverviewPdfHtml(
  bizName: string,
  salesPeriod: RollingPeriod,
  stockPeriod: RollingPeriod,
  invoices: Invoice[],
  txns: ReadyStockTransaction[],
): string {
  const salesRange = getRollingRange(salesPeriod);
  const stockRange = getRollingRange(stockPeriod);
  const salesStartOrd = toOrd(salesRange.start);
  const salesEndOrd   = toOrd(salesRange.end);
  const stockStartOrd = toOrd(stockRange.start);
  const stockEndOrd   = toOrd(stockRange.end);

  const salesLabel = salesPeriod === 'today' ? salesRange.start : `${salesRange.start} – ${salesRange.end}`;
  const stockLabel = stockPeriod === 'today' ? stockRange.start : `${stockRange.start} – ${stockRange.end}`;

  // ── Sales data ──
  const filtered = invoices.filter(inv => {
    if (inv.cancelled) return false;
    const ord = toOrd(inv.invoiceDate);
    return ord >= salesStartOrd && ord <= salesEndOrd;
  });
  const skuTotals: Record<string, { qty: number; amount: number }> = {};
  for (const inv of filtered) {
    for (const item of inv.items) {
      if (!skuTotals[item.skuId]) skuTotals[item.skuId] = { qty: 0, amount: 0 };
      skuTotals[item.skuId].qty    += item.quantity;
      skuTotals[item.skuId].amount += item.lineTotal;
    }
  }
  const totalRevenue  = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const cashTotal     = filtered.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const creditTotal   = filtered.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0);
  const totalInvoices = filtered.length;

  // ── Ready stock sold data ──
  const skuSold: Record<string, number> = {};
  for (const t of txns) {
    if (t.type !== 'DEDUCT') continue;
    const ord = toOrd(t.date);
    if (ord < stockStartOrd || ord > stockEndOrd) continue;
    skuSold[t.skuId] = (skuSold[t.skuId] ?? 0) + t.quantity;
  }

  const now = new Date();
  const ts  = `${formatDate(now)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  let body = `<div class="header">
    <div class="biz-name">${bizName}</div>
    <div class="report-title">Sales &amp; Ready Stock Report</div>
    <div class="report-meta">Generated: ${ts}</div>
  </div>`;

  // ── Sales section ──
  body += `<div style="font-size:13px;font-weight:700;color:#312e81;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;">
    Sales &nbsp;<span style="font-size:9px;font-weight:400;color:#64748b;">${PERIOD_LABELS[salesPeriod]} &nbsp;(${salesLabel})</span>
  </div>`;

  if (totalInvoices === 0) {
    body += '<p style="color:#94a3b8;padding:12px 0 20px">No sales in this period.</p>';
  } else {
    body += `<div class="summary-grid" style="margin-bottom:12px;">
      <div class="summary-card indigo">
        <div class="summary-label">Total Sales</div>
        <div class="summary-value">${fmtINR(totalRevenue)}</div>
        <div style="font-size:9px;color:#4338ca;margin-top:2px">${totalInvoices} invoice${totalInvoices !== 1 ? 's' : ''}</div>
      </div>
      <div class="summary-card emerald">
        <div class="summary-label">Cash Collected</div>
        <div class="summary-value">${fmtINR(cashTotal)}</div>
      </div>
      <div class="summary-card amber">
        <div class="summary-label">On Credit</div>
        <div class="summary-value">${fmtINR(creditTotal)}</div>
      </div>
    </div>`;

    for (const cat of PRODUCT_CATEGORIES) {
      const catSkus = PRODUCTS.filter(p => p.product === cat && skuTotals[p.id]);
      if (catSkus.length === 0) continue;
      const catTotal = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.amount ?? 0), 0);
      const catQty   = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.qty ?? 0), 0);
      const byUnit: Record<string, number> = {};
      for (const sku of catSkus) byUnit[sku.unit] = (byUnit[sku.unit] ?? 0) + (skuTotals[sku.id]?.qty ?? 0);
      const pills = Object.entries(byUnit).map(([unit, qty]) =>
        `<span class="pill">${qty} ${unit}${qty !== 1 ? 's' : ''}</span>`).join('');
      const rows = catSkus.map(sku => {
        const t = skuTotals[sku.id];
        return `<tr><td class="bold">${sku.variant}</td><td class="center">${sku.unit}</td><td class="right bold">${t.qty}</td><td class="right amt">${fmtINR(t.amount)}</td></tr>`;
      }).join('');
      body += `<div class="section">
        <div class="cat-header"><span class="cat-name">${cat}</span><span class="cat-total">${fmtINR(catTotal)} &nbsp;&middot;&nbsp; ${catQty} units</span></div>
        <div class="pills">${pills}</div>
        <table><thead><tr><th>Variant</th><th class="center">Unit</th><th class="right">Qty Sold</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }
  }

  // ── Ready stock sold section ──
  body += `<div style="font-size:13px;font-weight:700;color:#065f46;margin:20px 0 10px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;">
    Ready Stock Sold &nbsp;<span style="font-size:9px;font-weight:400;color:#64748b;">${PERIOD_LABELS[stockPeriod]} &nbsp;(${stockLabel})</span>
  </div>`;

  let hasStockContent = false;
  for (const cat of PRODUCT_CATEGORIES) {
    const catSkus = PRODUCTS.filter(p => p.product === cat && skuSold[p.id]);
    if (catSkus.length === 0) continue;
    hasStockContent = true;
    const totalSold = catSkus.reduce((s, p) => s + (skuSold[p.id] ?? 0), 0);
    const rows = catSkus.map(sku => {
      const qty = skuSold[sku.id] ?? 0;
      return `<tr><td class="bold">${sku.variant}</td><td class="center">${sku.unit}</td><td class="right red bold">${qty}</td></tr>`;
    }).join('');
    body += `<div class="section">
      <div class="cat-header"><span class="cat-name">${cat}</span><span class="cat-total" style="color:#059669">${totalSold} units sold</span></div>
      <table><thead><tr><th>Variant</th><th class="center">Unit</th><th class="right" style="color:#e11d48">Units Sold</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }
  if (!hasStockContent) {
    body += '<p style="color:#94a3b8;padding:12px 0">No ready stock sold in this period.</p>';
  }

  return wrapPdfHtml(body);
}

function buildPackagingPdfHtml(
  bizName: string,
  packagingStock: Record<string, number>,
  entries: PackagingEntry[],
): string {
  const stats: Record<string, { purchased: number; used: number; damaged: number }> = {};
  for (const e of entries) {
    if (!stats[e.materialId]) stats[e.materialId] = { purchased: 0, used: 0, damaged: 0 };
    if (e.entryType === 'purchase') stats[e.materialId].purchased += e.quantity;
    if (e.entryType === 'used')     stats[e.materialId].used     += e.quantity;
    if (e.entryType === 'damaged')  stats[e.materialId].damaged  += e.quantity;
  }

  const active = PACKAGING_MATERIALS.filter(m => (packagingStock[m.id] ?? 0) > 0 || stats[m.id]);
  const now = new Date();
  const ts  = `${formatDate(now)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  let body = `<div class="header"><div class="biz-name">${bizName}</div><div class="report-title">Packaging Inventory</div><div class="report-meta">Current stock snapshot &nbsp;&middot;&nbsp; Generated: ${ts}</div></div>`;

  if (active.length === 0) {
    body += '<p style="color:#94a3b8;text-align:center;padding:30px">No packaging stock data available.</p>';
  } else {
    const rows = active.map(mat => {
      const balance = packagingStock[mat.id] ?? 0;
      const s = stats[mat.id];
      const purchased = s?.purchased ?? 0;
      const used      = s?.used ?? 0;
      const damaged   = s?.damaged ?? 0;
      return `<tr>
        <td class="bold">${mat.name}</td>
        <td class="right green">${purchased > 0 ? purchased.toLocaleString('en-IN') : '—'}</td>
        <td class="right red">${used > 0 ? used.toLocaleString('en-IN') : '—'}</td>
        <td class="right amber">${damaged > 0 ? damaged.toLocaleString('en-IN') : '—'}</td>
        <td class="right bold">${balance.toLocaleString('en-IN')}</td>
      </tr>`;
    }).join('');
    body += `<table>
      <thead><tr><th>Material</th><th class="right" style="color:#059669">Purchased</th><th class="right" style="color:#e11d48">Used</th><th class="right" style="color:#d97706">Damaged</th><th class="right">Balance</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }
  return wrapPdfHtml(body);
}

function openPdfWindow(html: string): void {
  const w = window.open('', '_blank', 'width=794,height=1123');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ─── Sales Section ────────────────────────────────────────────────────────────

function SalesSection({ period }: { period: RollingPeriod }) {
  const { invoices } = useStore();
  const { start, end } = getRollingRange(period);
  const startOrd = toOrd(start);
  const endOrd = toOrd(end);

  const filtered = useMemo(
    () => invoices.filter(inv => {
      if (inv.cancelled) return false;
      const ord = toOrd(inv.invoiceDate);
      return ord >= startOrd && ord <= endOrd;
    }),
    [invoices, startOrd, endOrd],
  );

  const skuTotals = useMemo(() => {
    const map: Record<string, { qty: number; amount: number }> = {};
    for (const inv of filtered) {
      for (const item of inv.items) {
        if (!map[item.skuId]) map[item.skuId] = { qty: 0, amount: 0 };
        map[item.skuId].qty += item.quantity;
        map[item.skuId].amount += item.lineTotal;
      }
    }
    return map;
  }, [filtered]);

  const totalRevenue = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const cashTotal    = filtered.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const creditTotal  = filtered.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0);
  const totalInvoices = filtered.length;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-10 text-slate-400">
        <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No sales in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-indigo-50 rounded-xl p-4 col-span-1">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-indigo-500" />
            <span className="text-xs text-indigo-500 font-medium">Total Sales</span>
          </div>
          <div className="text-xl font-bold text-indigo-700">{fmtINR(totalRevenue)}</div>
          <div className="text-xs text-indigo-400 mt-0.5">{totalInvoices} invoice{totalInvoices !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Banknote size={13} className="text-emerald-600" />
            <span className="text-xs text-emerald-600 font-medium">Cash Collected</span>
          </div>
          <div className="text-xl font-bold text-emerald-700">{fmtINR(cashTotal)}</div>
          <div className="text-xs text-emerald-400 mt-0.5">{filtered.filter(i => i.paymentMode === 'Cash').length} invoices</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard size={13} className="text-amber-600" />
            <span className="text-xs text-amber-600 font-medium">On Credit</span>
          </div>
          <div className="text-xl font-bold text-amber-700">{fmtINR(creditTotal)}</div>
          <div className="text-xs text-amber-400 mt-0.5">{filtered.filter(i => i.paymentMode === 'Credit').length} invoices</div>
        </div>
      </div>

      {/* Per-category breakdown */}
      {PRODUCT_CATEGORIES.map(cat => {
        const catSkus = PRODUCTS.filter(p => p.product === cat && skuTotals[p.id]);
        if (catSkus.length === 0) return null;

        const catTotal = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.amount ?? 0), 0);
        const catQty   = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.qty ?? 0), 0);

        const byUnit: Record<string, number> = {};
        for (const sku of catSkus) {
          byUnit[sku.unit] = (byUnit[sku.unit] ?? 0) + (skuTotals[sku.id]?.qty ?? 0);
        }

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{cat}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">{catQty} units</span>
                <span className="text-sm font-bold text-indigo-600">{fmtINR(catTotal)}</span>
              </div>
            </div>
            <div className="px-5 py-2.5 flex flex-wrap gap-2 border-b border-slate-50 bg-indigo-50/30">
              {Object.entries(byUnit).map(([unit, qty]) => (
                <span key={unit} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">
                  {qty} {unit}{qty !== 1 ? 's' : ''}
                </span>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-50">
                  <th className="text-left px-5 py-2 font-medium">Variant</th>
                  <th className="text-center px-3 py-2 font-medium">Unit</th>
                  <th className="text-right px-3 py-2 font-medium">Qty Sold</th>
                  <th className="text-right px-5 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {catSkus.map(sku => {
                  const t = skuTotals[sku.id];
                  if (!t) return null;
                  return (
                    <tr key={sku.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2.5 text-slate-700 font-medium">{sku.variant}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sku.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{t.qty}</td>
                      <td className="px-5 py-2.5 text-right text-indigo-600 font-medium">{fmtINR(t.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ready Stock Section ──────────────────────────────────────────────────────

function ReadyStockSection({ period }: { period: RollingPeriod }) {
  const { readyStockTransactions } = useStore();
  const { start, end } = getRollingRange(period);
  const startOrd = toOrd(start);
  const endOrd = toOrd(end);

  // Only show SKUs that were DEDUCT-ed (sold) in the period
  const skuSold = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of readyStockTransactions) {
      if (t.type !== 'DEDUCT') continue;
      const ord = toOrd(t.date);
      if (ord < startOrd || ord > endOrd) continue;
      map[t.skuId] = (map[t.skuId] ?? 0) + t.quantity;
    }
    return map;
  }, [readyStockTransactions, startOrd, endOrd]);

  const hasData = Object.keys(skuSold).length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-10 text-slate-400">
        <PackageCheck size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No ready stock sold in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PRODUCT_CATEGORIES.map(cat => {
        const catSkus = PRODUCTS.filter(p => p.product === cat && skuSold[p.id]);
        if (catSkus.length === 0) return null;

        const totalSold = catSkus.reduce((s, p) => s + (skuSold[p.id] ?? 0), 0);

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{cat}</span>
              <span className="text-xs text-slate-500">{totalSold} units sold</span>
            </div>
            {/* SKU pills */}
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {catSkus.map(sku => {
                const qty = skuSold[sku.id] ?? 0;
                return (
                  <div key={sku.id} className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{sku.variant}</span>
                    <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                      {qty} {sku.unit}{qty !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Packaging Inventory ──────────────────────────────────────────────────────

function PackagingInventory() {
  const { packagingStock, packagingEntries } = useStore();

  const stats = useMemo(() => {
    const map: Record<string, { purchased: number; used: number; damaged: number }> = {};
    for (const e of packagingEntries) {
      if (!map[e.materialId]) map[e.materialId] = { purchased: 0, used: 0, damaged: 0 };
      if (e.entryType === 'purchase') map[e.materialId].purchased += e.quantity;
      if (e.entryType === 'used')     map[e.materialId].used     += e.quantity;
      if (e.entryType === 'damaged')  map[e.materialId].damaged  += e.quantity;
    }
    return map;
  }, [packagingEntries]);

  const hasData = PACKAGING_MATERIALS.some(m => (packagingStock[m.id] ?? 0) > 0 || stats[m.id]);

  if (!hasData) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Box size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No packaging stock data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
        <span className="font-semibold text-slate-700">Current Packaging Stock</span>
        <span className="ml-2 text-xs text-slate-400">as of today</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/30">
            <th className="text-left px-5 py-2.5 font-medium">Material</th>
            <th className="text-right px-4 py-2.5 font-medium text-emerald-600">Purchased</th>
            <th className="text-right px-4 py-2.5 font-medium text-rose-500">Used</th>
            <th className="text-right px-4 py-2.5 font-medium text-amber-500">Damaged</th>
            <th className="text-right px-5 py-2.5 font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {PACKAGING_MATERIALS.map(mat => {
            const balance = packagingStock[mat.id] ?? 0;
            const s = stats[mat.id];
            if (!s && balance === 0) return null;
            const purchased = s?.purchased ?? 0;
            const used      = s?.used ?? 0;
            const damaged   = s?.damaged ?? 0;

            return (
              <tr key={mat.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-2.5 text-slate-700 font-medium">{mat.name}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">
                  {purchased > 0 ? purchased.toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-rose-500 font-medium">
                  {used > 0 ? used.toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-amber-500 font-medium">
                  {damaged > 0 ? damaged.toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className={`font-bold text-base ${balance > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                    {balance.toLocaleString('en-IN')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

type Tab = 'overview' | 'packaging';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [salesPeriod, setSalesPeriod] = useState<RollingPeriod>('1m');
  const [stockPeriod, setStockPeriod] = useState<RollingPeriod>('today');

  const {
    businessProfile, invoices,
    readyStock, readyStockTransactions,
    packagingStock, packagingEntries,
  } = useStore();

  const bizName = businessProfile?.name ?? 'Vyaparimay';

  const handleDownloadPdf = () => {
    const html = activeTab === 'overview'
      ? buildOverviewPdfHtml(bizName, salesPeriod, stockPeriod, invoices, readyStockTransactions)
      : buildPackagingPdfHtml(bizName, packagingStock, packagingEntries);
    openPdfWindow(html);
  };

  const pdfButton = (
    <button
      onClick={handleDownloadPdf}
      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
    >
      <FileDown size={15} />
      Download PDF
    </button>
  );

  return (
    <Layout title="Reports" subtitle="Sales, ready stock and packaging inventory summaries" actions={pdfButton}>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Tab bar */}
        <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={15} />
            Sales & Stock
          </button>
          <button
            onClick={() => setActiveTab('packaging')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'packaging'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Box size={15} />
            Packaging Inventory
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* ── Sales ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-500" />
                  Sales
                </h2>
                <PeriodPicker value={salesPeriod} onChange={setSalesPeriod} />
              </div>
              <SalesSection period={salesPeriod} />
            </section>

            {/* ── Ready Stock ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <PackageCheck size={16} className="text-emerald-500" />
                  Ready Stock Sold
                </h2>
                <PeriodPicker value={stockPeriod} onChange={setStockPeriod} />
              </div>
              <ReadyStockSection period={stockPeriod} />
            </section>
          </div>
        )}

        {activeTab === 'packaging' && <PackagingInventory />}
      </div>
    </Layout>
  );
}
