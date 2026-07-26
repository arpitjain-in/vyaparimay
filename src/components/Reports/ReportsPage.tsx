import React, { useMemo } from 'react';
import {
  BarChart3, PackageCheck, Box, FileDown, Weight, Users, BookOpen,
  TrendingUp, Wallet, Receipt, AlertTriangle, IndianRupee, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES, PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import { fmtINR, formatDate } from '../../utils/format';
import type { Invoice, PackagingEntry, PaymentReceipt, Expense, SalaryRecord, Customer } from '../../types';
import { useState } from 'react';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toOrd(ddmmyyyy: string): number {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return Number(yyyy) * 10000 + Number(mm) * 100 + Number(dd);
}

function dateStr(d: Date): string {
  return formatDate(d);
}

function fmtKg(kg: number): string {
  if (kg === 0) return '0 kg';
  if (kg % 1 === 0) return `${kg.toLocaleString('en-IN')} kg`;
  return `${kg.toFixed(1)} kg`;
}

// ─── Period definitions ───────────────────────────────────────────────────────

interface PeriodDef {
  label: string;
  sublabel: string;
  startOrd: number;
  endOrd: number;
}

function monthName(d: Date): string {
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

/** Summary table rows: month-2, month-1, current month, this week, today */
function getFixedPeriods(): PeriodDef[] {
  const today = new Date();
  const todayS   = dateStr(today);
  const todayOrd = toOrd(todayS);

  // This week: Monday → today
  const weekStartD = new Date(today);
  const dow = weekStartD.getDay();
  weekStartD.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const weekStartS = dateStr(weekStartD);

  // Month helpers
  const m = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset, 1);

  const currStart  = m(0);
  const prevStart  = m(-1);
  const prev2Start = m(-2);
  const prevEnd    = new Date(today.getFullYear(), today.getMonth(), 0);    // last day of last month
  const prev2End   = new Date(today.getFullYear(), today.getMonth() - 1, 0); // last day of month-2

  return [
    {
      label:    monthName(prev2Start),
      sublabel: `${dateStr(prev2Start)} – ${dateStr(prev2End)}`,
      startOrd: toOrd(dateStr(prev2Start)),
      endOrd:   toOrd(dateStr(prev2End)),
    },
    {
      label:    monthName(prevStart),
      sublabel: `${dateStr(prevStart)} – ${dateStr(prevEnd)}`,
      startOrd: toOrd(dateStr(prevStart)),
      endOrd:   toOrd(dateStr(prevEnd)),
    },
    {
      label:    `${monthName(currStart)} (Current)`,
      sublabel: `${dateStr(currStart)} – ${todayS}`,
      startOrd: toOrd(dateStr(currStart)),
      endOrd:   todayOrd,
    },
    {
      label:    'This Week',
      sublabel: weekStartS === todayS ? todayS : `${weekStartS} – ${todayS}`,
      startOrd: toOrd(weekStartS),
      endOrd:   todayOrd,
    },
    {
      label:    'Yesterday',
      sublabel: dateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)),
      startOrd: toOrd(dateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))),
      endOrd:   toOrd(dateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))),
    },
    {
      label:    'Today',
      sublabel: todayS,
      startOrd: todayOrd,
      endOrd:   todayOrd,
    },
  ];
}

/** The 3 calendar months used for the SKU breakdown */
function getMonthlyPeriods(): PeriodDef[] {
  const today = new Date();
  const todayS   = dateStr(today);
  const todayOrd = toOrd(todayS);
  const m = (offset: number) => new Date(today.getFullYear(), today.getMonth() + offset, 1);

  const currStart  = m(0);
  const prevStart  = m(-1);
  const prev2Start = m(-2);
  const prevEnd    = new Date(today.getFullYear(), today.getMonth(), 0);
  const prev2End   = new Date(today.getFullYear(), today.getMonth() - 1, 0);

  return [
    {
      label:    monthName(prev2Start),
      sublabel: dateStr(prev2Start),
      startOrd: toOrd(dateStr(prev2Start)),
      endOrd:   toOrd(dateStr(prev2End)),
    },
    {
      label:    monthName(prevStart),
      sublabel: dateStr(prevStart),
      startOrd: toOrd(dateStr(prevStart)),
      endOrd:   toOrd(dateStr(prevEnd)),
    },
    {
      label:    `${monthName(currStart)} (Current)`,
      sublabel: dateStr(currStart),
      startOrd: toOrd(dateStr(currStart)),
      endOrd:   todayOrd,
    },
  ];
}

// ─── Period stats calculator ──────────────────────────────────────────────────

interface PeriodStats {
  invoiceCount: number;
  invoiceTotal: number;
  moneyReceived: number;
  totalUnits: number;
  totalWeightKg: number;
}

function calcPeriodStats(
  invoices: Invoice[],
  receipts: PaymentReceipt[],
  startOrd: number,
  endOrd: number,
): PeriodStats {
  const filtered = invoices.filter(inv => {
    if (inv.cancelled) return false;
    const ord = toOrd(inv.invoiceDate);
    return ord >= startOrd && ord <= endOrd;
  });

  const invoiceTotal = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const cashTotal    = filtered.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const receiptsTotal = receipts
    .filter(r => { const o = toOrd(r.date); return o >= startOrd && o <= endOrd; })
    .reduce((s, r) => s + r.amount, 0);

  let totalUnits = 0;
  let totalWeightKg = 0;
  for (const inv of filtered) {
    for (const item of inv.items) {
      totalUnits     += item.quantity;
      totalWeightKg  += item.quantity * item.weight;
    }
  }

  return {
    invoiceCount: filtered.length,
    invoiceTotal,
    moneyReceived: cashTotal + receiptsTotal,
    totalUnits,
    totalWeightKg,
  };
}

// ─── Money Received — per-customer breakdown ─────────────────────────────────

interface MoneyReceivedRow {
  key: string;
  date: string;       // DD/MM/YYYY
  customerId: string;
  customerName: string;
  firmName?: string;
  amount: number;
  source: 'Cash Sale' | 'Receipt';
}

function buildMoneyReceivedBreakdown(
  invoices: Invoice[],
  receipts: PaymentReceipt[],
  customers: Customer[],
  startOrd: number,
  endOrd: number,
): MoneyReceivedRow[] {
  const rows: MoneyReceivedRow[] = [];

  for (const inv of invoices) {
    if (inv.cancelled || inv.paymentMode !== 'Cash') continue;
    const ord = toOrd(inv.invoiceDate);
    if (ord < startOrd || ord > endOrd) continue;
    rows.push({
      key: `inv-${inv.id}`,
      date: inv.invoiceDate,
      customerId: inv.customerId,
      customerName: inv.customerSnapshot.name,
      firmName: inv.customerSnapshot.firmName,
      amount: inv.grandTotal,
      source: 'Cash Sale',
    });
  }

  for (const r of receipts) {
    const ord = toOrd(r.date);
    if (ord < startOrd || ord > endOrd) continue;
    const cust = customers.find(c => c.id === r.customerId);
    rows.push({
      key: `rec-${r.id}`,
      date: r.date,
      customerId: r.customerId,
      customerName: cust?.name ?? r.customerId,
      firmName: cust?.firmName,
      amount: r.amount,
      source: 'Receipt',
    });
  }

  return rows.sort((a, b) => toOrd(a.date) - toOrd(b.date));
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
  .section-heading { font-size: 13px; font-weight: 700; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; }
  .section-heading.indigo { color: #312e81; }
  .section-heading.emerald { color: #065f46; }
  .section { margin-bottom: 14px; }
  .cat-header { background: #f1f5f9; padding: 5px 10px; border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; border-bottom: none; }
  .cat-name { font-weight: 700; font-size: 11px; color: #334155; }
  .cat-total { font-weight: 700; font-size: 11px; color: #4f46e5; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
  thead tr { background: #f8fafc; }
  th { padding: 6px 10px; font-size: 9px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
  th.right, td.right { text-align: right; }
  th.center, td.center { text-align: center; }
  td { padding: 6px 10px; font-size: 10px; border-top: 1px solid #f1f5f9; color: #334155; }
  .amt  { color: #4f46e5; font-weight: 600; }
  .green { color: #059669; font-weight: 600; }
  .amber { color: #d97706; font-weight: 600; }
  .bold { font-weight: 700; }
  .muted { color: #94a3b8; }
  .period-label { font-weight: 700; font-size: 10px; }
  .period-sub { font-size: 8px; color: #64748b; }
  .footer { font-size: 8px; color: #94a3b8; text-align: right; margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
`;

function wrapPdfHtml(body: string): string {
  const generated = formatDate(new Date());
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Report</title><style>${PDF_STYLES}</style></head><body>${body}<div class="footer">Millbook &nbsp;&middot;&nbsp; Generated ${generated}</div></body></html>`;
}

function buildOverviewPdfHtml(
  bizName: string,
  invoices: Invoice[],
  receipts: PaymentReceipt[],
  readyStock: Record<string, number>,
): string {
  const periods = getFixedPeriods();

  const now = new Date();
  const ts  = `${formatDate(now)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  let body = `<div class="header">
    <div class="biz-name">${bizName}</div>
    <div class="report-title">Sales &amp; Ready Stock Report</div>
    <div class="report-meta">Generated: ${ts}</div>
  </div>`;

  // ── Sales summary table ──
  body += `<div class="section-heading indigo">Sales Summary</div>`;

  const activePeriods = getFixedPeriods().filter(p => {
    if (p.label === 'This Week' || p.label === 'Today' || p.label === 'Yesterday') return true;
    return invoices.some(inv => {
      if (inv.cancelled) return false;
      const ord = toOrd(inv.invoiceDate);
      return ord >= p.startOrd && ord <= p.endOrd;
    });
  });

  const summaryRows = activePeriods.map(p => {
    const s = calcPeriodStats(invoices, receipts, p.startOrd, p.endOrd);
    const e = s.invoiceCount === 0;
    return `<tr>
      <td><div class="period-label">${p.label}</div><div class="period-sub">${p.sublabel}</div></td>
      <td class="right ${e ? 'muted' : 'bold'}">${e ? '—' : s.invoiceCount}</td>
      <td class="right ${e ? 'muted' : 'amt'}">${e ? '—' : fmtINR(s.invoiceTotal)}</td>
      <td class="right ${e ? 'muted' : 'green'}">${e ? '—' : fmtINR(s.moneyReceived)}</td>
      <td class="right ${e ? 'muted' : ''}">${e ? '—' : s.totalUnits.toLocaleString('en-IN')}</td>
      <td class="right ${e ? 'muted' : ''}">${e ? '—' : fmtKg(s.totalWeightKg)}</td>
    </tr>`;
  }).join('');

  body += `<table>
    <thead><tr>
      <th>Period</th><th class="right">Invoices</th><th class="right">Invoice Total</th>
      <th class="right">Money Received</th><th class="right">Units</th><th class="right">Weight</th>
    </tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>`;

  // ── SKU breakdown by month (only months with sales) ──
  const monthlyPeriods = getMonthlyPeriods().filter(mp =>
    invoices.some(inv => {
      if (inv.cancelled) return false;
      const ord = toOrd(inv.invoiceDate);
      return ord >= mp.startOrd && ord <= mp.endOrd;
    })
  );

  // skuMonthly[skuId][monthIndex] = { qty, weightKg }
  const skuMonthly: Record<string, { qty: number; weightKg: number }[]> = {};
  for (const inv of invoices) {
    if (inv.cancelled) continue;
    const ord = toOrd(inv.invoiceDate);
    for (let mi = 0; mi < monthlyPeriods.length; mi++) {
      const mp = monthlyPeriods[mi];
      if (ord < mp.startOrd || ord > mp.endOrd) continue;
      for (const item of inv.items) {
        if (!skuMonthly[item.skuId]) skuMonthly[item.skuId] = monthlyPeriods.map(() => ({ qty: 0, weightKg: 0 }));
        skuMonthly[item.skuId][mi].qty      += item.quantity;
        skuMonthly[item.skuId][mi].weightKg += item.quantity * item.weight;
      }
    }
  }

  const monthHeaders = monthlyPeriods.map(p =>
    `<th class="right" colspan="2">${p.label}</th>`).join('');
  const monthSubHeaders = monthlyPeriods.map(() =>
    `<th class="right">Units</th><th class="right">Weight</th>`).join('');

  body += `<div class="section-heading indigo" style="margin-top:18px">SKU Sales by Month</div>`;

  for (const cat of PRODUCT_CATEGORIES) {
    const catSkus = PRODUCTS.filter(p => p.product === cat && skuMonthly[p.id]);
    if (catSkus.length === 0) continue;
    const skuRows = catSkus.map(sku => {
      const months = skuMonthly[sku.id];
      const cells = months.map(m =>
        `<td class="right bold">${m.qty > 0 ? m.qty : '—'}</td><td class="right">${m.qty > 0 ? fmtKg(m.weightKg) : '—'}</td>`
      ).join('');
      return `<tr><td class="bold">${sku.variant}</td><td class="center">${sku.unit}</td>${cells}</tr>`;
    }).join('');
    body += `<div class="section">
      <div class="cat-header"><span class="cat-name">${cat}</span></div>
      <table>
        <thead>
          <tr><th rowspan="2">Variant</th><th class="center" rowspan="2">Unit</th>${monthHeaders}</tr>
          <tr>${monthSubHeaders}</tr>
        </thead>
        <tbody>${skuRows}</tbody>
      </table>
    </div>`;
  }

  // ── Ready stock availability ──
  body += `<div class="section-heading emerald">Ready Stock Availability &nbsp;<span style="font-size:9px;font-weight:400;color:#64748b">as of today</span></div>`;

  for (const cat of PRODUCT_CATEGORIES) {
    const catSkus = PRODUCTS.filter(p => p.product === cat);
    if (catSkus.length === 0) continue;
    const totalAvailable = catSkus.reduce((s, p) => s + (readyStock[p.id] ?? 0), 0);
    const rows = catSkus.map(sku => {
      const qty = readyStock[sku.id] ?? 0;
      const cls = qty === 0 ? 'muted' : qty <= 5 ? 'amber' : 'green';
      return `<tr><td class="bold">${sku.variant}</td><td class="center">${sku.unit}</td><td class="right ${cls} bold">${qty}</td></tr>`;
    }).join('');
    body += `<div class="section">
      <div class="cat-header"><span class="cat-name">${cat}</span><span class="cat-total" style="color:#059669">${totalAvailable} units</span></div>
      <table><thead><tr><th>Variant</th><th class="center">Unit</th><th class="right" style="color:#059669">Available</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
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
        <td class="right" style="color:#e11d48;font-weight:600">${used > 0 ? used.toLocaleString('en-IN') : '—'}</td>
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

// ─── Sales Summary Table ──────────────────────────────────────────────────────

function SalesSummaryTable() {
  const { invoices, paymentReceipts, customers } = useStore();
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  // Filter out the individual month rows that have zero sales (keep week/today rows always)
  const periods = useMemo(
    () => getFixedPeriods().filter(p => {
      // "This Week" and "Today" always shown; month rows only if they have sales
      if (p.label === 'This Week' || p.label === 'Today' || p.label === 'Yesterday') return true;
      return invoices.some(inv => {
        if (inv.cancelled) return false;
        const ord = toOrd(inv.invoiceDate);
        return ord >= p.startOrd && ord <= p.endOrd;
      });
    }),
    [invoices],
  );
  // Only include months that have at least one sale
  const monthlyPeriods = useMemo(
    () => getMonthlyPeriods().filter(mp =>
      invoices.some(inv => {
        if (inv.cancelled) return false;
        const ord = toOrd(inv.invoiceDate);
        return ord >= mp.startOrd && ord <= mp.endOrd;
      })
    ),
    [invoices],
  );

  const rows = useMemo(
    () => periods.map(p => ({ ...p, stats: calcPeriodStats(invoices, paymentReceipts, p.startOrd, p.endOrd) })),
    [invoices, paymentReceipts, periods],
  );

  // skuMonthly[skuId][monthIndex] = { qty, weightKg }
  const skuMonthly = useMemo(() => {
    const map: Record<string, { qty: number; weightKg: number }[]> = {};
    for (const inv of invoices) {
      if (inv.cancelled) continue;
      const ord = toOrd(inv.invoiceDate);
      for (let mi = 0; mi < monthlyPeriods.length; mi++) {
        const mp = monthlyPeriods[mi];
        if (ord < mp.startOrd || ord > mp.endOrd) continue;
        for (const item of inv.items) {
          if (!map[item.skuId]) map[item.skuId] = monthlyPeriods.map(() => ({ qty: 0, weightKg: 0 }));
          map[item.skuId][mi].qty      += item.quantity;
          map[item.skuId][mi].weightKg += item.quantity * item.weight;
        }
      }
    }
    return map;
  }, [invoices, monthlyPeriods]);

  return (
    <div className="space-y-6">
      {/* ── Summary table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
              <th className="text-left px-5 py-3 font-medium">Period</th>
              <th className="text-right px-3 py-3 font-medium">Invoices</th>
              <th className="text-right px-3 py-3 font-medium">Invoice Total</th>
              <th className="text-right px-3 py-3 font-medium text-emerald-600">Money Received</th>
              <th className="text-right px-3 py-3 font-medium">Units</th>
              <th className="text-right px-5 py-3 font-medium">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, sublabel, startOrd, endOrd, stats: s }) => {
              const empty = s.invoiceCount === 0;
              const isExpanded = expandedPeriod === label;
              const breakdown = isExpanded
                ? buildMoneyReceivedBreakdown(invoices, paymentReceipts, customers, startOrd, endOrd)
                : [];
              return (
                <React.Fragment key={label}>
                  <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{label}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{sublabel}</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {empty ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-700">{s.invoiceCount}</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {empty ? <span className="text-slate-300">—</span> : <span className="font-bold text-indigo-600">{fmtINR(s.invoiceTotal)}</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {empty || s.moneyReceived === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedPeriod(isExpanded ? null : label)}
                          className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-700"
                          title="Show which customers this was received from"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {fmtINR(s.moneyReceived)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {empty ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-700">{s.totalUnits.toLocaleString('en-IN')}</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {empty ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-600">{fmtKg(s.totalWeightKg)}</span>}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-slate-50 last:border-0 bg-emerald-50/40">
                      <td colSpan={6} className="px-5 py-3">
                        <div className="text-xs font-medium text-emerald-700 mb-2">Money Received — by customer ({label})</div>
                        <div className="rounded-lg border border-emerald-100 overflow-hidden bg-white">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-slate-400 bg-slate-50">
                                <th className="text-left px-4 py-2 font-medium">Date</th>
                                <th className="text-left px-4 py-2 font-medium">Customer</th>
                                <th className="text-left px-4 py-2 font-medium">Firm</th>
                                <th className="text-left px-4 py-2 font-medium">Source</th>
                                <th className="text-right px-4 py-2 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {breakdown.map(b => (
                                <tr key={b.key} className="border-t border-slate-50">
                                  <td className="px-4 py-2 text-slate-500">{b.date}</td>
                                  <td className="px-4 py-2 text-slate-700">{b.customerName}</td>
                                  <td className="px-4 py-2 text-slate-500">{b.firmName ?? '—'}</td>
                                  <td className="px-4 py-2 text-slate-500">{b.source}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-emerald-600">{fmtINR(b.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── SKU breakdown by month ── */}
      {PRODUCT_CATEGORIES.map(cat => {
        const catSkus = PRODUCTS.filter(p => p.product === cat && skuMonthly[p.id]);
        if (catSkus.length === 0) return null;
        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <span className="font-semibold text-slate-700">{cat} — SKU Sales by Month</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-5 py-2.5 font-medium">Variant</th>
                    {monthlyPeriods.map(mp => (
                      <th key={mp.label} className="text-right px-4 py-2.5 font-medium" colSpan={2}>
                        {mp.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-xs text-slate-300 border-b border-slate-50 bg-slate-50/30">
                    <th className="px-5 py-1.5" />
                    {monthlyPeriods.map(mp => (
                      <React.Fragment key={mp.label}>
                        <th className="text-right px-3 py-1.5 font-medium">Units</th>
                        <th className="text-right px-4 py-1.5 font-medium">Weight</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catSkus.map(sku => {
                    const months = skuMonthly[sku.id];
                    return (
                      <tr key={sku.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-2.5 font-medium text-slate-700">{sku.variant}</td>
                        {months.map((m, mi) => (
                          <React.Fragment key={mi}>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                              {m.qty > 0 ? m.qty : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-500 text-xs">
                              {m.qty > 0 ? fmtKg(m.weightKg) : <span className="text-slate-300">—</span>}
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Ready Stock Availability ─────────────────────────────────────────────────

function ReadyStockSection() {
  const { readyStock } = useStore();

  return (
    <div className="space-y-4">
      {PRODUCT_CATEGORIES.map(cat => {
        const catSkus = PRODUCTS.filter(p => p.product === cat);
        if (catSkus.length === 0) return null;
        const totalAvailable = catSkus.reduce((s, p) => s + (readyStock[p.id] ?? 0), 0);

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{cat}</span>
              <span className="text-xs text-slate-500">{totalAvailable} units available</span>
            </div>
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {catSkus.map(sku => {
                const qty = readyStock[sku.id] ?? 0;
                const containerCls = qty === 0
                  ? 'bg-slate-50 border-slate-200'
                  : qty <= 5 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100';
                const badgeCls = qty === 0
                  ? 'bg-slate-100 text-slate-400'
                  : qty <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
                return (
                  <div key={sku.id} className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${containerCls}`}>
                    <span className="text-sm font-medium text-slate-700">{sku.variant}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
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

// ─── Monthly Customer Report ──────────────────────────────────────────────────

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

interface CustomerMonthRow {
  customerId: string;
  customerName: string;
  totalDebit: number;
  totalCredit: number;
  weightWF: number;
  weightBR: number;
  weightBS: number;
  weightTotal: number;
}

function buildCustomerMonthData(
  selectedMonth: string,
  invoices: Invoice[],
  paymentReceipts: PaymentReceipt[],
  customers: { id: string; name: string }[],
): CustomerMonthRow[] {
  const [yearS, monthS] = selectedMonth.split('-');
  const year = Number(yearS);
  const month = Number(monthS);

  const map: Record<string, CustomerMonthRow> = {};

  const getOrCreate = (customerId: string, customerName: string): CustomerMonthRow => {
    if (!map[customerId]) {
      map[customerId] = { customerId, customerName, totalDebit: 0, totalCredit: 0, weightWF: 0, weightBR: 0, weightBS: 0, weightTotal: 0 };
    }
    return map[customerId];
  };

  for (const inv of invoices) {
    if (inv.cancelled) continue;
    const [, mm, yyyy] = inv.invoiceDate.split('/').map(Number);
    if (yyyy !== year || mm !== month) continue;
    const entry = getOrCreate(inv.customerId, inv.customerSnapshot.name);
    entry.totalDebit += inv.grandTotal;
    for (const item of inv.items) {
      const kg = item.quantity * item.weight;
      entry.weightTotal += kg;
      if (item.skuId.startsWith('WF-')) entry.weightWF += kg;
      else if (item.skuId.startsWith('BR-')) entry.weightBR += kg;
      else if (item.skuId.startsWith('BS-')) entry.weightBS += kg;
    }
  }

  for (const receipt of paymentReceipts) {
    const [, mm, yyyy] = receipt.date.split('/').map(Number);
    if (yyyy !== year || mm !== month) continue;
    const cust = customers.find(c => c.id === receipt.customerId);
    const entry = getOrCreate(receipt.customerId, cust?.name ?? receipt.customerId);
    entry.totalCredit += receipt.amount;
  }

  return Object.values(map).sort((a, b) => a.customerId.localeCompare(b.customerId));
}

function buildMonthlyCustomerReportPdfHtml(
  bizName: string,
  monthLabel: string,
  rows: CustomerMonthRow[],
): string {
  const now = new Date();
  const ts = `${formatDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const totDebit  = rows.reduce((s, r) => s + r.totalDebit, 0);
  const totCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
  const totWF     = rows.reduce((s, r) => s + r.weightWF, 0);
  const totBR     = rows.reduce((s, r) => s + r.weightBR, 0);
  const totBS     = rows.reduce((s, r) => s + r.weightBS, 0);
  const totAll    = rows.reduce((s, r) => s + r.weightTotal, 0);

  const bodyRows = rows.map(r => `<tr>
    <td class="bold">${r.customerId}</td>
    <td>${r.customerName}</td>
    <td class="right amt">${r.totalDebit > 0 ? fmtINR(r.totalDebit) : '—'}</td>
    <td class="right green">${r.totalCredit > 0 ? fmtINR(r.totalCredit) : '—'}</td>
    <td class="right">${r.weightWF > 0 ? fmtKg(r.weightWF) : '—'}</td>
    <td class="right">${r.weightBR > 0 ? fmtKg(r.weightBR) : '—'}</td>
    <td class="right">${r.weightBS > 0 ? fmtKg(r.weightBS) : '—'}</td>
    <td class="right bold">${r.weightTotal > 0 ? fmtKg(r.weightTotal) : '—'}</td>
  </tr>`).join('');

  const body = `
    <div class="header">
      <div class="biz-name">${bizName}</div>
      <div class="report-title">Monthly Customer Report — ${monthLabel}</div>
      <div class="report-meta">Generated: ${ts}</div>
    </div>
    <table>
      <thead><tr>
        <th>Customer ID</th>
        <th>Customer Name</th>
        <th class="right">Total Debit</th>
        <th class="right">Total Credit</th>
        <th class="right">Wheat Flour (kg)</th>
        <th class="right">Bran (kg)</th>
        <th class="right">Besan (kg)</th>
        <th class="right">Total Weight</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr style="background:#f1f5f9;font-weight:700">
        <td colspan="2" class="bold">Total</td>
        <td class="right amt">${fmtINR(totDebit)}</td>
        <td class="right green">${fmtINR(totCredit)}</td>
        <td class="right">${fmtKg(totWF)}</td>
        <td class="right">${fmtKg(totBR)}</td>
        <td class="right">${fmtKg(totBS)}</td>
        <td class="right">${fmtKg(totAll)}</td>
      </tr></tfoot>
    </table>`;

  return wrapPdfHtml(body);
}

function MonthlyCustomerReport({
  selectedMonth,
  onMonthChange,
}: {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}) {
  const { customers, invoices, paymentReceipts } = useStore();

  const monthOptions = useMemo(getMonthOptions, []);

  const rows = useMemo(
    () => buildCustomerMonthData(selectedMonth, invoices, paymentReceipts, customers),
    [selectedMonth, invoices, paymentReceipts, customers],
  );

  const totals = useMemo(() => ({
    debit:  rows.reduce((s, r) => s + r.totalDebit, 0),
    credit: rows.reduce((s, r) => s + r.totalCredit, 0),
    wf:     rows.reduce((s, r) => s + r.weightWF, 0),
    br:     rows.reduce((s, r) => s + r.weightBR, 0),
    bs:     rows.reduce((s, r) => s + r.weightBS, 0),
    total:  rows.reduce((s, r) => s + r.weightTotal, 0),
  }), [rows]);

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Month:</label>
          <select
            value={selectedMonth}
            onChange={e => onMonthChange(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="text-center py-16 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No customer activity for this month</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Month:</label>
        <select
          value={selectedMonth}
          onChange={e => onMonthChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium">Customer ID</th>
                <th className="text-left px-4 py-3 font-medium">Customer Name</th>
                <th className="text-right px-4 py-3 font-medium text-indigo-600">Total Debit</th>
                <th className="text-right px-4 py-3 font-medium text-emerald-600">Total Credit</th>
                <th className="text-right px-4 py-3 font-medium">Wheat Flour</th>
                <th className="text-right px-4 py-3 font-medium">Bran</th>
                <th className="text-right px-4 py-3 font-medium">Besan</th>
                <th className="text-right px-4 py-3 font-medium">Total Weight</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.customerId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.customerId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.customerName}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600">
                    {r.totalDebit > 0 ? fmtINR(r.totalDebit) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">
                    {r.totalCredit > 0 ? fmtINR(r.totalCredit) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {r.weightWF > 0 ? fmtKg(r.weightWF) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {r.weightBR > 0 ? fmtKg(r.weightBR) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {r.weightBS > 0 ? fmtKg(r.weightBS) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {r.weightTotal > 0 ? fmtKg(r.weightTotal) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-sm">
                <td className="px-4 py-3 text-slate-500 text-xs uppercase tracking-wide" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-bold text-indigo-600">{fmtINR(totals.debit)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmtINR(totals.credit)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmtKg(totals.wf)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmtKg(totals.br)}</td>
                <td className="px-4 py-3 text-right text-slate-700">{fmtKg(totals.bs)}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{fmtKg(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Accountant Report ────────────────────────────────────────────────────────

function buildAccountantReportPdfHtml(
  bizName: string,
  monthLabel: string,
  invoices: Invoice[],
): string {
  const now = new Date();
  const ts = `${formatDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const sorted = [...invoices].sort((a, b) => toOrd(a.invoiceDate) - toOrd(b.invoiceDate));

  const grandTotal = sorted.reduce((s, i) => s + i.grandTotal, 0);
  const cashTotal  = sorted.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const creditTotal = sorted.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0);

  const bodyRows = sorted.map(inv => {
    const skuLines = inv.items
      .map(it => `<div style="white-space:nowrap">${it.variant}: <b>${fmtKg(it.quantity * it.weight)}</b></div>`)
      .join('');
    return `<tr>
    <td class="bold">${inv.invoiceNo}</td>
    <td>${inv.invoiceDate}</td>
    <td>${inv.customerSnapshot.name}</td>
    <td style="font-size:9px;color:#475569;line-height:1.6">${skuLines}</td>
    <td class="center muted">${inv.paymentMode}</td>
    <td class="right amt">${fmtINR(inv.grandTotal)}</td>
  </tr>`;
  }).join('');

  const body = `
    <div class="header">
      <div class="biz-name">${bizName}</div>
      <div class="report-title">Accountant Invoice Report — ${monthLabel}</div>
      <div class="report-meta">Generated: ${ts} &nbsp;&middot;&nbsp; ${sorted.length} invoice${sorted.length !== 1 ? 's' : ''}</div>
    </div>
    <table>
      <thead><tr>
        <th>Invoice No</th>
        <th>Date</th>
        <th>Customer Name</th>
        <th>SKU / Weight</th>
        <th class="center">Payment Mode</th>
        <th class="right">Amount</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:700">
          <td colspan="5" class="bold">Grand Total (${sorted.length} invoices)</td>
          <td class="right amt">${fmtINR(grandTotal)}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td colspan="5" class="muted" style="font-size:9px">Cash</td>
          <td class="right green" style="font-size:9px">${fmtINR(cashTotal)}</td>
        </tr>
        <tr style="background:#f8fafc">
          <td colspan="5" class="muted" style="font-size:9px">Credit</td>
          <td class="right amber" style="font-size:9px">${fmtINR(creditTotal)}</td>
        </tr>
      </tfoot>
    </table>`;

  return wrapPdfHtml(body);
}

function AccountantReport({
  selectedMonth,
  onMonthChange,
}: {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}) {
  const { invoices } = useStore();
  const monthOptions = useMemo(getMonthOptions, []);

  const [yearS, monthS] = selectedMonth.split('-');
  const year = Number(yearS);
  const month = Number(monthS);

  const filtered = useMemo(
    () =>
      invoices
        .filter(inv => {
          if (inv.cancelled) return false;
          const [, mm, yyyy] = inv.invoiceDate.split('/').map(Number);
          return yyyy === year && mm === month;
        })
        .sort((a, b) => toOrd(a.invoiceDate) - toOrd(b.invoiceDate)),
    [invoices, year, month],
  );

  const totals = useMemo(() => ({
    grand:  filtered.reduce((s, i) => s + i.grandTotal, 0),
    cash:   filtered.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0),
    credit: filtered.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0),
  }), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Month:</label>
        <select
          value={selectedMonth}
          onChange={e => onMonthChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No invoices for this month</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium">Invoice No</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Customer Name</th>
                  <th className="text-left px-4 py-3 font-medium">SKU / Weight</th>
                  <th className="text-center px-4 py-3 font-medium">Payment Mode</th>
                  <th className="text-right px-4 py-3 font-medium text-indigo-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-indigo-700">{inv.invoiceNo}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.invoiceDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{inv.customerSnapshot.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {inv.items.map((item, i) => (
                          <span key={i} className="text-xs text-slate-600 whitespace-nowrap">
                            {item.variant}: <span className="font-semibold text-slate-800">{fmtKg(item.quantity * item.weight)}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                        inv.paymentMode === 'Cash'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">{fmtINR(inv.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-4 py-3 text-xs text-slate-500 uppercase tracking-wide font-semibold" colSpan={5}>
                    Total ({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600">{fmtINR(totals.grand)}</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-2 text-xs text-slate-400" colSpan={5}>Cash</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-emerald-600">{fmtINR(totals.cash)}</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-4 py-2 text-xs text-slate-400" colSpan={5}>Credit</td>
                  <td className="px-4 py-2 text-right text-xs font-semibold text-amber-600">{fmtINR(totals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quarterly Financial Report ───────────────────────────────────────────────
// India Financial Year: Apr–Mar. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar.

interface QuarterOption {
  value: string;       // '2026-Q1'
  label: string;       // 'Q1 FY 26-27'
  rangeLabel: string;  // 'Apr – Jun 2026'
  startOrd: number;
  endOrd: number;
  endDateStr: string;
  months: PeriodDef[];
}

function fyQuarterOf(d: Date): { fyStartYear: number; quarterNum: number; qStartDate: Date } {
  const monthIdx = d.getMonth();
  const fyStartYear = monthIdx >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const monthsSinceFYStart = (monthIdx - 3 + 12) % 12;
  const quarterNum = Math.floor(monthsSinceFYStart / 3) + 1;
  const qStartOffset = (quarterNum - 1) * 3;
  const qStartMonth = (3 + qStartOffset) % 12;
  const qStartYear = fyStartYear + Math.floor((3 + qStartOffset) / 12);
  return { fyStartYear, quarterNum, qStartDate: new Date(qStartYear, qStartMonth, 1) };
}

function getQuarterOptions(count = 8): QuarterOption[] {
  const today = new Date();
  const todayOrd = toOrd(dateStr(today));
  const { qStartDate: currentQStart } = fyQuarterOf(today);

  const options: QuarterOption[] = [];
  for (let i = 0; i < count; i++) {
    const qStart = new Date(currentQStart.getFullYear(), currentQStart.getMonth() - i * 3, 1);
    const { fyStartYear, quarterNum } = fyQuarterOf(qStart);
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
    const endDate = qEnd.getTime() > today.getTime() ? today : qEnd;

    const months: PeriodDef[] = [0, 1, 2]
      .map(mi => {
        const mStart = new Date(qStart.getFullYear(), qStart.getMonth() + mi, 1);
        const mEnd = new Date(qStart.getFullYear(), qStart.getMonth() + mi + 1, 0);
        const cappedEnd = mEnd.getTime() > today.getTime() ? today : mEnd;
        return {
          label: monthName(mStart),
          sublabel: dateStr(mStart),
          startOrd: toOrd(dateStr(mStart)),
          endOrd: toOrd(dateStr(cappedEnd)),
        };
      })
      .filter(m => m.startOrd <= todayOrd);

    options.push({
      value: `${fyStartYear}-Q${quarterNum}`,
      label: `Q${quarterNum} FY ${String(fyStartYear % 100).padStart(2, '0')}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`,
      rangeLabel: `${qStart.toLocaleString('en-IN', { month: 'short' })} – ${qEnd.toLocaleString('en-IN', { month: 'short' })} ${qEnd.getFullYear()}`,
      startOrd: toOrd(dateStr(qStart)),
      endOrd: Math.min(toOrd(dateStr(qEnd)), todayOrd),
      endDateStr: dateStr(endDate),
      months,
    });
  }
  return options;
}

interface CustomerRevenueRow { customerId: string; customerName: string; revenue: number; weightKg: number; invoiceCount: number; }
interface OutstandingRow { customerId: string; customerName: string; balance: number; }
interface CategorySalesRow { category: string; qty: number; weightKg: number; revenue: number; }
interface MonthTrendRow extends PeriodDef {
  revenue: number; collections: number; expenses: number; salaryPayout: number; invoiceCount: number;
}

interface QuarterReportData {
  invoiceCount: number;
  revenue: number;
  gstCollected: number;
  cashRevenue: number;
  creditRevenue: number;
  collections: number;
  totalUnits: number;
  totalWeightKg: number;
  expensesTotal: number;
  salaryPayout: number;
  salaryAccrued: number;
  netCashSurplus: number;
  netBusinessResult: number;
  outstandingAsOfEnd: number;
  monthlyTrend: MonthTrendRow[];
  categorySales: CategorySalesRow[];
  topCustomers: CustomerRevenueRow[];
  topOutstanding: OutstandingRow[];
}

function buildQuarterReportData(
  opt: QuarterOption,
  invoices: Invoice[],
  receipts: PaymentReceipt[],
  expenses: Expense[],
  salaryRecords: SalaryRecord[],
  customers: Customer[],
): QuarterReportData {
  const filteredInvoices = invoices.filter(
    inv => !inv.cancelled && toOrd(inv.invoiceDate) >= opt.startOrd && toOrd(inv.invoiceDate) <= opt.endOrd,
  );

  const revenue = filteredInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const gstCollected = filteredInvoices.reduce((s, i) => s + i.totalGST, 0);
  const cashRevenue = filteredInvoices.filter(i => i.paymentMode === 'Cash').reduce((s, i) => s + i.grandTotal, 0);
  const creditRevenue = filteredInvoices.filter(i => i.paymentMode === 'Credit').reduce((s, i) => s + i.grandTotal, 0);

  const receiptsInRange = receipts.filter(r => toOrd(r.date) >= opt.startOrd && toOrd(r.date) <= opt.endOrd);
  const collections = cashRevenue + receiptsInRange.reduce((s, r) => s + r.amount, 0);

  let totalUnits = 0;
  let totalWeightKg = 0;
  for (const inv of filteredInvoices) {
    for (const item of inv.items) {
      totalUnits += item.quantity;
      totalWeightKg += item.quantity * item.weight;
    }
  }

  const expensesInRange = expenses.filter(e => toOrd(e.date) >= opt.startOrd && toOrd(e.date) <= opt.endOrd);
  const expensesTotal = expensesInRange.reduce((s, e) => s + e.amount, 0);

  const quarterMonthKeys = new Set(opt.months.map(m => {
    const [, mm, yyyy] = m.sublabel.split('/');
    return `${yyyy}-${mm}`;
  }));
  const salaryInRange = salaryRecords.filter(r => quarterMonthKeys.has(r.month));
  const salaryPayout = salaryInRange.reduce((s, r) => s + r.amountPaid, 0);
  const salaryAccrued = salaryInRange.reduce((s, r) => s + r.netPayable, 0);

  const netCashSurplus = collections - expensesTotal - salaryPayout;
  const netBusinessResult = revenue - expensesTotal - salaryAccrued;

  // Running customer balance (opening balance + invoices − receipts) as of quarter end
  const balanceByCustomer: Record<string, number> = {};
  for (const c of customers) balanceByCustomer[c.id] = c.openingBalance;
  for (const inv of invoices) {
    if (inv.cancelled || toOrd(inv.invoiceDate) > opt.endOrd) continue;
    balanceByCustomer[inv.customerId] = (balanceByCustomer[inv.customerId] ?? 0) + inv.grandTotal;
  }
  for (const r of receipts) {
    if (toOrd(r.date) > opt.endOrd) continue;
    balanceByCustomer[r.customerId] = (balanceByCustomer[r.customerId] ?? 0) - r.amount;
  }
  const outstandingAsOfEnd = Object.values(balanceByCustomer).reduce((s, b) => s + b, 0);

  const custNameById: Record<string, string> = {};
  for (const c of customers) custNameById[c.id] = c.name;

  const topOutstanding: OutstandingRow[] = Object.entries(balanceByCustomer)
    .filter(([, bal]) => bal > 0)
    .map(([customerId, balance]) => ({ customerId, customerName: custNameById[customerId] ?? customerId, balance }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const revByCustomer: Record<string, { name: string; revenue: number; weightKg: number; count: number }> = {};
  for (const inv of filteredInvoices) {
    const entry = revByCustomer[inv.customerId] ?? { name: inv.customerSnapshot.name, revenue: 0, weightKg: 0, count: 0 };
    entry.revenue += inv.grandTotal;
    entry.count += 1;
    for (const item of inv.items) entry.weightKg += item.quantity * item.weight;
    revByCustomer[inv.customerId] = entry;
  }
  const topCustomers: CustomerRevenueRow[] = Object.entries(revByCustomer)
    .map(([customerId, v]) => ({ customerId, customerName: v.name, revenue: v.revenue, weightKg: v.weightKg, invoiceCount: v.count }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categorySales: CategorySalesRow[] = PRODUCT_CATEGORIES
    .map(cat => {
      let qty = 0, weightKg = 0, catRevenue = 0;
      const catSkuIds = new Set(PRODUCTS.filter(p => p.product === cat).map(p => p.id));
      for (const inv of filteredInvoices) {
        for (const item of inv.items) {
          if (!catSkuIds.has(item.skuId)) continue;
          qty += item.quantity;
          weightKg += item.quantity * item.weight;
          catRevenue += item.lineTotal;
        }
      }
      return { category: cat, qty, weightKg, revenue: catRevenue };
    })
    .filter(r => r.qty > 0);

  const monthlyTrend: MonthTrendRow[] = opt.months.map(m => {
    const s = calcPeriodStats(invoices, receipts, m.startOrd, m.endOrd);
    const mExpenses = expenses
      .filter(e => toOrd(e.date) >= m.startOrd && toOrd(e.date) <= m.endOrd)
      .reduce((sum, e) => sum + e.amount, 0);
    const [, mm, yyyy] = m.sublabel.split('/');
    const mSalary = salaryRecords
      .filter(r => r.month === `${yyyy}-${mm}`)
      .reduce((sum, r) => sum + r.amountPaid, 0);
    return { ...m, revenue: s.invoiceTotal, collections: s.moneyReceived, expenses: mExpenses, salaryPayout: mSalary, invoiceCount: s.invoiceCount };
  });

  return {
    invoiceCount: filteredInvoices.length,
    revenue, gstCollected, cashRevenue, creditRevenue, collections,
    totalUnits, totalWeightKg, expensesTotal, salaryPayout, salaryAccrued,
    netCashSurplus, netBusinessResult, outstandingAsOfEnd,
    monthlyTrend, categorySales, topCustomers, topOutstanding,
  };
}

function buildQuarterlyReportPdfHtml(bizName: string, opt: QuarterOption, data: QuarterReportData): string {
  const now = new Date();
  const ts = `${formatDate(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const kpi = (label: string, value: string, sub: string, c1: string, c2: string) => `
    <div class="kpi" style="background:linear-gradient(135deg, ${c1}, ${c2})">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`;

  const kpiGrid = [
    kpi('Total Revenue', fmtINR(data.revenue), `${data.invoiceCount} invoices`, '#6366f1', '#4338ca'),
    kpi('Collections', fmtINR(data.collections), 'Cash sales + receipts', '#10b981', '#047857'),
    kpi('GST Collected', fmtINR(data.gstCollected), '', '#0ea5e9', '#0369a1'),
    kpi('Expenses', fmtINR(data.expensesTotal), '', '#f43f5e', '#be123c'),
    kpi('Salary Payout', fmtINR(data.salaryPayout), '', '#8b5cf6', '#6d28d9'),
    kpi('Weight Sold', fmtKg(data.totalWeightKg), `${data.totalUnits.toLocaleString('en-IN')} units`, '#f59e0b', '#b45309'),
    kpi('Net Cash Surplus', fmtINR(data.netCashSurplus), 'Collections − Expenses − Salary',
      data.netCashSurplus >= 0 ? '#10b981' : '#f43f5e', data.netCashSurplus >= 0 ? '#047857' : '#be123c'),
    kpi('Outstanding Receivables', fmtINR(Math.abs(data.outstandingAsOfEnd)), `As of ${opt.endDateStr}`,
      data.outstandingAsOfEnd > 0 ? '#f59e0b' : '#10b981', data.outstandingAsOfEnd > 0 ? '#b45309' : '#047857'),
  ].join('');

  const trendRows = data.monthlyTrend.map(m => `
    <tr>
      <td class="bold">${m.label}</td>
      <td class="right indigo">${fmtINR(m.revenue)}</td>
      <td class="right green">${fmtINR(m.collections)}</td>
      <td class="right rose">${fmtINR(m.expenses)}</td>
      <td class="right violet">${fmtINR(m.salaryPayout)}</td>
      <td class="right">${m.invoiceCount}</td>
    </tr>`).join('');

  const categoryRows = data.categorySales.map(c => `
    <tr>
      <td class="bold">${c.category}</td>
      <td class="right">${c.qty.toLocaleString('en-IN')}</td>
      <td class="right">${fmtKg(c.weightKg)}</td>
      <td class="right indigo bold">${fmtINR(c.revenue)}</td>
    </tr>`).join('');

  const topCustRows = data.topCustomers.length > 0
    ? data.topCustomers.map((c, i) => `
      <tr><td class="muted center">${i + 1}</td><td>${c.customerName}</td><td class="right indigo bold">${fmtINR(c.revenue)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted center" style="padding:14px">No sales this quarter</td></tr>`;

  const outstandingRows = data.topOutstanding.length > 0
    ? data.topOutstanding.map((c, i) => `
      <tr><td class="muted center">${i + 1}</td><td>${c.customerName}</td><td class="right amber bold">${fmtINR(c.balance)}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted center" style="padding:14px">No outstanding dues</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Quarterly Financial Report</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }
    .band { background: linear-gradient(120deg, #4338ca, #7c3aed); border-radius: 14px; padding: 18px 22px; color: #fff; margin-bottom: 18px; }
    .band .biz { font-size: 18px; font-weight: 800; }
    .band .title { font-size: 13px; font-weight: 600; margin-top: 2px; opacity: 0.95; }
    .band .range { font-size: 10px; margin-top: 6px; opacity: 0.85; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi { border-radius: 10px; padding: 10px 12px; color: #fff; }
    .kpi-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; }
    .kpi-value { font-size: 14px; font-weight: 800; margin-top: 4px; }
    .kpi-sub { font-size: 7.5px; opacity: 0.85; margin-top: 2px; }
    .section-heading { font-size: 12px; font-weight: 700; color: #312e81; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #e0e7ff; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; margin-bottom: 4px; }
    thead tr { background: #eef2ff; }
    th { padding: 6px 10px; font-size: 9px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 0.03em; text-align: left; }
    th.right { text-align: right; }
    td { padding: 6px 10px; font-size: 10px; border-top: 1px solid #f1f5f9; }
    td.right { text-align: right; }
    td.center { text-align: center; }
    td.bold { font-weight: 700; }
    td.muted { color: #94a3b8; }
    td.indigo { color: #4f46e5; }
    td.green { color: #059669; }
    td.rose { color: #e11d48; }
    td.violet { color: #7c3aed; }
    td.amber { color: #d97706; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .note { margin-top: 16px; font-size: 8.5px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; line-height: 1.5; }
    .footer { font-size: 8px; color: #94a3b8; text-align: right; margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
  </style></head><body>
    <div class="band">
      <div class="biz">${bizName}</div>
      <div class="title">Quarterly Financial Report &mdash; ${opt.label}</div>
      <div class="range">${opt.rangeLabel} &nbsp;&middot;&nbsp; Generated: ${ts}</div>
    </div>

    <div class="kpi-grid">${kpiGrid}</div>

    <div class="section-heading">Month-wise Trend</div>
    <table>
      <thead><tr><th>Month</th><th class="right">Revenue</th><th class="right">Collections</th><th class="right">Expenses</th><th class="right">Salary</th><th class="right">Invoices</th></tr></thead>
      <tbody>${trendRows}</tbody>
    </table>

    ${data.categorySales.length > 0 ? `
    <div class="section-heading">Category-wise Sales</div>
    <table>
      <thead><tr><th>Category</th><th class="right">Units</th><th class="right">Weight</th><th class="right">Revenue</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>` : ''}

    <div class="two-col">
      <div>
        <div class="section-heading">Top Customers by Revenue</div>
        <table><tbody>${topCustRows}</tbody></table>
      </div>
      <div>
        <div class="section-heading">Top Outstanding Receivables</div>
        <table><tbody>${outstandingRows}</tbody></table>
      </div>
    </div>

    <div class="note">Note: Net Cash Surplus and revenue figures reflect recorded sales, expenses and salary payouts. Raw-material and production costs are not tracked with pricing in this system, so the figures above are not a full profit &amp; loss statement.</div>
    <div class="footer">Millbook &nbsp;&middot;&nbsp; Generated ${ts}</div>
  </body></html>`;
}

function KpiCard({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
}) {
  const gradients: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    amber: 'from-amber-500 to-amber-700',
    rose: 'from-rose-500 to-rose-700',
    sky: 'from-sky-500 to-sky-700',
    violet: 'from-violet-500 to-violet-700',
  };
  return (
    <div className={`rounded-2xl p-4 text-white shadow-sm bg-gradient-to-br ${gradients[tone]}`}>
      <div className="flex items-center gap-2 opacity-90 mb-2">
        <Icon size={15} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs opacity-80 mt-1">{sub}</div>}
    </div>
  );
}

function QuarterlyFinancialReport({
  selectedQuarter,
  onQuarterChange,
}: {
  selectedQuarter: string;
  onQuarterChange: (value: string) => void;
}) {
  const { customers, invoices, paymentReceipts, expenses, salaryRecords } = useStore();
  const quarterOptions = useMemo(() => getQuarterOptions(), []);
  const opt = quarterOptions.find(q => q.value === selectedQuarter) ?? quarterOptions[0];

  const data = useMemo(
    () => buildQuarterReportData(opt, invoices, paymentReceipts, expenses, salaryRecords, customers),
    [opt, invoices, paymentReceipts, expenses, salaryRecords, customers],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">Quarter:</label>
        <select
          value={opt.value}
          onChange={e => onQuarterChange(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {quarterOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label} &middot; {o.rangeLabel}</option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} tone="indigo" label="Total Revenue" value={fmtINR(data.revenue)} sub={`${data.invoiceCount} invoices`} />
        <KpiCard icon={Wallet} tone="emerald" label="Collections" value={fmtINR(data.collections)} sub="Cash sales + receipts" />
        <KpiCard icon={Receipt} tone="sky" label="GST Collected" value={fmtINR(data.gstCollected)} />
        <KpiCard icon={AlertTriangle} tone="rose" label="Expenses" value={fmtINR(data.expensesTotal)} />
        <KpiCard icon={Users} tone="violet" label="Salary Payout" value={fmtINR(data.salaryPayout)} />
        <KpiCard icon={Weight} tone="amber" label="Weight Sold" value={fmtKg(data.totalWeightKg)} sub={`${data.totalUnits.toLocaleString('en-IN')} units`} />
        <KpiCard
          icon={IndianRupee}
          tone={data.netCashSurplus >= 0 ? 'emerald' : 'rose'}
          label="Net Cash Surplus"
          value={fmtINR(data.netCashSurplus)}
          sub="Collections − Expenses − Salary"
        />
        <KpiCard
          icon={AlertTriangle}
          tone={data.outstandingAsOfEnd > 0 ? 'amber' : 'emerald'}
          label="Outstanding Receivables"
          value={fmtINR(Math.abs(data.outstandingAsOfEnd))}
          sub={`As of ${opt.endDateStr}`}
        />
      </div>

      {/* Payment mode split */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="font-semibold text-slate-700 mb-3">Cash vs. Credit Sales</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${data.revenue > 0 ? (data.cashRevenue / data.revenue) * 100 : 0}%` }} />
          <div className="bg-amber-500" style={{ width: `${data.revenue > 0 ? (data.creditRevenue / data.revenue) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />Cash: {fmtINR(data.cashRevenue)}</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />Credit: {fmtINR(data.creditRevenue)}</span>
        </div>
      </div>

      {/* Month-wise trend */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">Month-wise Trend</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-2.5 font-medium">Month</th>
                <th className="text-right px-4 py-2.5 font-medium text-indigo-600">Revenue</th>
                <th className="text-right px-4 py-2.5 font-medium text-emerald-600">Collections</th>
                <th className="text-right px-4 py-2.5 font-medium text-rose-500">Expenses</th>
                <th className="text-right px-4 py-2.5 font-medium text-violet-600">Salary</th>
                <th className="text-right px-5 py-2.5 font-medium">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlyTrend.map(m => (
                <tr key={m.label} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{m.label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-indigo-600">{fmtINR(m.revenue)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmtINR(m.collections)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-500">{fmtINR(m.expenses)}</td>
                  <td className="px-4 py-2.5 text-right text-violet-600">{fmtINR(m.salaryPayout)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{m.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category-wise sales */}
      {data.categorySales.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">Category-wise Sales</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-2.5 font-medium">Category</th>
                <th className="text-right px-4 py-2.5 font-medium">Units</th>
                <th className="text-right px-4 py-2.5 font-medium">Weight</th>
                <th className="text-right px-5 py-2.5 font-medium text-indigo-600">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.categorySales.map(c => (
                <tr key={c.category} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{c.category}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{c.qty.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmtKg(c.weightKg)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold text-indigo-600">{fmtINR(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top customers + Outstanding, side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">Top Customers by Revenue</div>
          {data.topCustomers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No sales this quarter</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.topCustomers.map((c, i) => (
                  <tr key={c.customerId} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-400 w-6">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-700">{c.customerName}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-indigo-600">{fmtINR(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">Top Outstanding Receivables</div>
          {data.topOutstanding.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No outstanding dues</div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.topOutstanding.map((c, i) => (
                  <tr key={c.customerId} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2.5 text-slate-400 w-6">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-slate-700">{c.customerName}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-amber-600">{fmtINR(c.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
        Note: Net Cash Surplus and revenue figures reflect recorded sales, expenses and salary payouts. Raw-material and production costs are not tracked with pricing in this system, so figures above are not a full profit &amp; loss statement.
      </div>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

type Tab = 'overview' | 'packaging' | 'monthly' | 'accountant' | 'quarterly';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [monthlySelectedMonth, setMonthlySelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [accountantSelectedMonth, setAccountantSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedQuarter, setSelectedQuarter] = useState(() => getQuarterOptions(1)[0].value);

  const { businessProfile, invoices, readyStock, packagingStock, packagingEntries, paymentReceipts, customers, expenses, salaryRecords } = useStore();
  const bizName = businessProfile?.name ?? 'Millbook';

  const handleDownloadPdf = () => {
    let html: string;
    if (activeTab === 'overview') {
      html = buildOverviewPdfHtml(bizName, invoices, paymentReceipts, readyStock);
    } else if (activeTab === 'packaging') {
      html = buildPackagingPdfHtml(bizName, packagingStock, packagingEntries);
    } else if (activeTab === 'accountant') {
      const monthOptions = getMonthOptions();
      const monthLabel = monthOptions.find(o => o.value === accountantSelectedMonth)?.label ?? accountantSelectedMonth;
      const [yearS, monthS] = accountantSelectedMonth.split('-');
      const year = Number(yearS); const month = Number(monthS);
      const acctInvoices = invoices.filter(inv => {
        if (inv.cancelled) return false;
        const [, mm, yyyy] = inv.invoiceDate.split('/').map(Number);
        return yyyy === year && mm === month;
      });
      html = buildAccountantReportPdfHtml(bizName, monthLabel, acctInvoices);
    } else if (activeTab === 'quarterly') {
      const quarterOptions = getQuarterOptions();
      const opt = quarterOptions.find(o => o.value === selectedQuarter) ?? quarterOptions[0];
      const data = buildQuarterReportData(opt, invoices, paymentReceipts, expenses, salaryRecords, customers);
      html = buildQuarterlyReportPdfHtml(bizName, opt, data);
    } else {
      const monthOptions = getMonthOptions();
      const monthLabel = monthOptions.find(o => o.value === monthlySelectedMonth)?.label ?? monthlySelectedMonth;
      const rows = buildCustomerMonthData(monthlySelectedMonth, invoices, paymentReceipts, customers);
      html = buildMonthlyCustomerReportPdfHtml(bizName, monthLabel, rows);
    }
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
            onClick={() => setActiveTab('quarterly')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'quarterly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp size={15} />
            Quarterly Financial
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 size={15} />
            Sales & Stock
          </button>
          <button
            onClick={() => setActiveTab('packaging')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'packaging' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Box size={15} />
            Packaging Inventory
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users size={15} />
            Monthly Customer
          </button>
          <button
            onClick={() => setActiveTab('accountant')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'accountant' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={15} />
            Accountant
          </button>
        </div>

        {activeTab === 'quarterly' && (
          <QuarterlyFinancialReport
            selectedQuarter={selectedQuarter}
            onQuarterChange={setSelectedQuarter}
          />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8">

            {/* ── Sales ── */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-500" />
                Sales
              </h2>
              <SalesSummaryTable />
            </section>

            {/* ── Ready Stock ── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <PackageCheck size={16} className="text-emerald-500" />
                  Ready Stock Availability
                </h2>
                <span className="text-xs text-slate-400">as of today</span>
              </div>
              <ReadyStockSection />
            </section>

          </div>
        )}

        {activeTab === 'packaging' && <PackagingInventory />}

        {activeTab === 'monthly' && (
          <MonthlyCustomerReport
            selectedMonth={monthlySelectedMonth}
            onMonthChange={setMonthlySelectedMonth}
          />
        )}

        {activeTab === 'accountant' && (
          <AccountantReport
            selectedMonth={accountantSelectedMonth}
            onMonthChange={setAccountantSelectedMonth}
          />
        )}
      </div>
    </Layout>
  );
}
