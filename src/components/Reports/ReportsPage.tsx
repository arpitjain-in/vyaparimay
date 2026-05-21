import React, { useMemo } from 'react';
import { BarChart3, PackageCheck, Box, FileDown, Weight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES, PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import { fmtINR, formatDate } from '../../utils/format';
import type { Invoice, PackagingEntry, PaymentReceipt } from '../../types';
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Report</title><style>${PDF_STYLES}</style></head><body>${body}<div class="footer">Vyaparimay &nbsp;&middot;&nbsp; Generated ${generated}</div></body></html>`;
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
  const { invoices, paymentReceipts } = useStore();

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
            {rows.map(({ label, sublabel, stats: s }) => {
              const empty = s.invoiceCount === 0;
              return (
                <tr key={label} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
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
                    {empty ? <span className="text-slate-300">—</span> : <span className="font-bold text-emerald-600">{fmtINR(s.moneyReceived)}</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {empty ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-700">{s.totalUnits.toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {empty ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-600">{fmtKg(s.totalWeightKg)}</span>}
                  </td>
                </tr>
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

// ─── Main Reports Page ────────────────────────────────────────────────────────

type Tab = 'overview' | 'packaging';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { businessProfile, invoices, readyStock, packagingStock, packagingEntries, paymentReceipts } = useStore();
  const bizName = businessProfile?.name ?? 'Vyaparimay';

  const handleDownloadPdf = () => {
    const html = activeTab === 'overview'
      ? buildOverviewPdfHtml(bizName, invoices, paymentReceipts, readyStock)
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
        </div>

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
      </div>
    </Layout>
  );
}
