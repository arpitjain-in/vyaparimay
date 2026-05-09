import React, { useMemo, useState } from 'react';
import { BarChart3, PackageCheck, Box, Calendar, FileDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES, PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import { fmtINR, formatDate } from '../../utils/format';
import type { Invoice, ReadyStockTransaction, PackagingEntry } from '../../types';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Convert DD/MM/YYYY → YYYYMMDD number for comparisons */
function toOrd(ddmmyyyy: string): number {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return Number(yyyy) * 10000 + Number(mm) * 100 + Number(dd);
}

function todayStr(): string {
  return formatDate(new Date());
}

function dateStr(d: Date): string {
  return formatDate(d);
}

function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return dateStr(d);
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return dateStr(d);
}

function startOfFinYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return dateStr(new Date(year, 3, 1)); // April 1
}

type Preset = 'today' | 'week' | 'month' | 'fy' | 'custom';

interface DateRange {
  preset: Preset;
  start: string; // DD/MM/YYYY
  end: string;   // DD/MM/YYYY
}

function presetToRange(preset: Preset, customStart: string, customEnd: string): DateRange {
  const today = todayStr();
  switch (preset) {
    case 'today':  return { preset, start: today,           end: today };
    case 'week':   return { preset, start: startOfWeek(),   end: today };
    case 'month':  return { preset, start: startOfMonth(),  end: today };
    case 'fy':     return { preset, start: startOfFinYear(), end: today };
    case 'custom': return { preset, start: customStart,     end: customEnd };
  }
}

function toHtmlDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function fromHtmlDate(yyyymmdd: string): string {
  const [yyyy, mm, dd] = yyyymmdd.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Date range picker ────────────────────────────────────────────────────────

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [customStart, setCustomStart] = useState(toHtmlDate(range.start));
  const [customEnd, setCustomEnd] = useState(toHtmlDate(range.end));

  const setPreset = (preset: Preset) => {
    if (preset === 'custom') {
      onChange(presetToRange('custom', fromHtmlDate(customStart), fromHtmlDate(customEnd)));
    } else {
      onChange(presetToRange(preset, '', ''));
    }
  };

  const presets: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'fy',    label: 'This FY' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              range.preset === p.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {range.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd}
            onChange={e => {
              setCustomStart(e.target.value);
              onChange(presetToRange('custom', fromHtmlDate(e.target.value), fromHtmlDate(customEnd)));
            }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            min={customStart}
            onChange={e => {
              setCustomEnd(e.target.value);
              onChange(presetToRange('custom', fromHtmlDate(customStart), fromHtmlDate(e.target.value)));
            }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white"
          />
        </div>
      )}

      {range.preset !== 'custom' && (
        <span className="text-xs text-slate-400">
          {range.start === range.end ? range.start : `${range.start} – ${range.end}`}
        </span>
      )}
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
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

function pdfHeader(bizName: string, title: string, subtitle: string): string {
  const now = new Date();
  const ts = `${formatDate(now)} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  return `<div class="header"><div class="biz-name">${bizName}</div><div class="report-title">${title}</div><div class="report-meta">${subtitle} &nbsp;&middot;&nbsp; Generated: ${ts}</div></div>`;
}

function buildSalesPdfHtml(
  bizName: string,
  range: DateRange,
  invoices: Invoice[],
): string {
  const startOrd = toOrd(range.start);
  const endOrd = toOrd(range.end);
  const filtered = invoices.filter(inv => {
    if (inv.cancelled) return false;
    const ord = toOrd(inv.invoiceDate);
    return ord >= startOrd && ord <= endOrd;
  });

  const skuTotals: Record<string, { qty: number; amount: number }> = {};
  for (const inv of filtered) {
    for (const item of inv.items) {
      if (!skuTotals[item.skuId]) skuTotals[item.skuId] = { qty: 0, amount: 0 };
      skuTotals[item.skuId].qty += item.quantity;
      skuTotals[item.skuId].amount += item.lineTotal;
    }
  }

  const totalRevenue = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const totalInvoices = filtered.length;
  const periodLabel = range.start === range.end ? range.start : `${range.start} – ${range.end}`;

  let body = pdfHeader(bizName, 'Sales Report', `Period: ${periodLabel}`);

  if (totalInvoices === 0) {
    body += '<p style="color:#94a3b8;text-align:center;padding:30px">No sales in this period.</p>';
  } else {
    body += `<div class="summary-grid">
      <div class="summary-card indigo"><div class="summary-label">Total Revenue</div><div class="summary-value">${fmtINR(totalRevenue)}</div></div>
      <div class="summary-card emerald"><div class="summary-label">Invoices</div><div class="summary-value">${totalInvoices}</div></div>
      <div class="summary-card amber"><div class="summary-label">Avg Invoice Value</div><div class="summary-value">${fmtINR(totalRevenue / totalInvoices)}</div></div>
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
  return wrapPdfHtml(body);
}

function buildReadyStockPdfHtml(
  bizName: string,
  range: DateRange,
  readyStock: Record<string, number>,
  txns: ReadyStockTransaction[],
): string {
  const startOrd = toOrd(range.start);
  const endOrd   = toOrd(range.end);
  const periodLabel = range.start === range.end ? range.start : `${range.start} – ${range.end}`;

  const activeSku = new Set([
    ...txns.map(t => t.skuId),
    ...Object.entries(readyStock).filter(([, v]) => v > 0).map(([k]) => k),
  ]);

  const skuData = PRODUCTS.filter(p => activeSku.has(p.id)).map(p => {
    const current = readyStock[p.id] ?? 0;
    const fromStart = txns.filter(t => t.skuId === p.id && toOrd(t.date) >= startOrd);
    const afterEnd  = txns.filter(t => t.skuId === p.id && toOrd(t.date) > endOrd);
    const inPeriod  = txns.filter(t => t.skuId === p.id && toOrd(t.date) >= startOrd && toOrd(t.date) <= endOrd);
    const deltaFromStart = fromStart.reduce((s, t) => s + (t.newStock - t.previousStock), 0);
    const deltaAfterEnd  = afterEnd.reduce((s, t) => s + (t.newStock - t.previousStock), 0);
    return {
      sku: p,
      opening:  current - deltaFromStart - deltaAfterEnd,
      added:    inPeriod.filter(t => t.type === 'ADD').reduce((s, t) => s + t.quantity, 0),
      deducted: inPeriod.filter(t => t.type === 'DEDUCT').reduce((s, t) => s + t.quantity, 0),
      closing:  current - deltaAfterEnd,
    };
  });

  let body = pdfHeader(bizName, 'Ready Stock Report', `Period: ${periodLabel}`);

  let hasContent = false;
  for (const cat of PRODUCT_CATEGORIES) {
    const rows = skuData.filter(d => d.sku.product === cat);
    if (rows.length === 0) continue;
    hasContent = true;
    const tableRows = rows.map(({ sku, opening, added, deducted, closing }) =>
      `<tr><td class="bold">${sku.variant}</td><td class="center">${sku.unit}</td><td class="right">${opening}</td><td class="right green">${added > 0 ? `+${added}` : '—'}</td><td class="right red">${deducted > 0 ? `−${deducted}` : '—'}</td><td class="right bold">${closing}</td></tr>`
    ).join('');
    body += `<div class="section">
      <div class="cat-header"><span class="cat-name">${cat}</span></div>
      <table><thead><tr><th>Variant</th><th class="center">Unit</th><th class="right">Opening</th><th class="right" style="color:#059669">+ Added</th><th class="right" style="color:#e11d48">− Sold</th><th class="right">Closing</th></tr></thead><tbody>${tableRows}</tbody></table>
    </div>`;
  }
  if (!hasContent) body += '<p style="color:#94a3b8;text-align:center;padding:30px">No ready stock data available.</p>';

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
  let body = pdfHeader(bizName, 'Packaging Inventory', 'Current stock snapshot');

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

// ─── Sales Report Tab ─────────────────────────────────────────────────────────

function SalesReport({ range }: { range: DateRange }) {
  const { invoices } = useStore();
  const startOrd = toOrd(range.start);
  const endOrd = toOrd(range.end);

  const filtered = useMemo(
    () => invoices.filter(inv => {
      if (inv.cancelled) return false;
      const ord = toOrd(inv.invoiceDate);
      return ord >= startOrd && ord <= endOrd;
    }),
    [invoices, startOrd, endOrd],
  );

  // Aggregate quantities and amounts per SKU
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
  const totalInvoices = filtered.length;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No sales in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-indigo-50 rounded-xl p-4">
          <div className="text-xs text-indigo-500 font-medium mb-1">Total Revenue</div>
          <div className="text-xl font-bold text-indigo-700">{fmtINR(totalRevenue)}</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="text-xs text-emerald-600 font-medium mb-1">Invoices</div>
          <div className="text-xl font-bold text-emerald-700">{totalInvoices}</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-xs text-amber-600 font-medium mb-1">Avg Invoice Value</div>
          <div className="text-xl font-bold text-amber-700">
            {fmtINR(totalRevenue / totalInvoices)}
          </div>
        </div>
      </div>

      {/* Per-category breakdown */}
      {PRODUCT_CATEGORIES.map(cat => {
        const skus = PRODUCTS.filter(p => p.product === cat);
        const catSkus = skus.filter(p => skuTotals[p.id]);
        if (catSkus.length === 0) return null;

        const catTotal = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.amount ?? 0), 0);
        const catQty   = catSkus.reduce((s, p) => s + (skuTotals[p.id]?.qty ?? 0), 0);

        // Group by unit
        const byUnit: Record<string, { qty: number; amount: number }> = {};
        for (const sku of catSkus) {
          const t = skuTotals[sku.id];
          if (!t) continue;
          if (!byUnit[sku.unit]) byUnit[sku.unit] = { qty: 0, amount: 0 };
          byUnit[sku.unit].qty += t.qty;
          byUnit[sku.unit].amount += t.amount;
        }

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Category header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="font-semibold text-slate-700">{cat}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">{catQty} units</span>
                <span className="text-sm font-bold text-indigo-600">{fmtINR(catTotal)}</span>
              </div>
            </div>

            {/* Unit summary pills */}
            <div className="px-5 py-2.5 flex flex-wrap gap-2 border-b border-slate-50">
              {Object.entries(byUnit).map(([unit, { qty }]) => (
                <span key={unit} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">
                  {qty} {unit}{qty !== 1 ? 's' : ''}
                </span>
              ))}
            </div>

            {/* SKU rows */}
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

// ─── Ready Stock Report Tab ───────────────────────────────────────────────────

function ReadyStockReport({ range }: { range: DateRange }) {
  const { readyStock, readyStockTransactions } = useStore();

  const startOrd = toOrd(range.start);
  const endOrd = toOrd(range.end);

  // Compute opening & closing balances from transactions
  // current readyStock[skuId] = closing balance as of today
  // opening balance = current - sum(delta for txns with date >= startDate)
  // closing balance = current - sum(delta for txns with date > endDate)

  const skuData = useMemo(() => {
    // Only include SKUs that have any transactions or current stock
    const activeSku = new Set([
      ...readyStockTransactions.map(t => t.skuId),
      ...Object.entries(readyStock).filter(([, v]) => v > 0).map(([k]) => k),
    ]);

    return PRODUCTS
      .filter(p => activeSku.has(p.id))
      .map(p => {
        const current = readyStock[p.id] ?? 0;

        // Delta = newStock - previousStock for each transaction
        const txnsInPeriod = readyStockTransactions.filter(t => {
          if (t.skuId !== p.id) return false;
          const ord = toOrd(t.date);
          return ord >= startOrd && ord <= endOrd;
        });

        const txnsAfterEnd = readyStockTransactions.filter(t => {
          if (t.skuId !== p.id) return false;
          return toOrd(t.date) > endOrd;
        });

        const txnsFromStart = readyStockTransactions.filter(t => {
          if (t.skuId !== p.id) return false;
          return toOrd(t.date) >= startOrd;
        });

        const deltaFromStart = txnsFromStart.reduce((s, t) => s + (t.newStock - t.previousStock), 0);
        const deltaAfterEnd  = txnsAfterEnd.reduce((s, t) => s + (t.newStock - t.previousStock), 0);

        const closing = current - deltaAfterEnd;
        const opening = current - deltaFromStart - deltaAfterEnd;

        const added    = txnsInPeriod.filter(t => t.type === 'ADD').reduce((s, t) => s + t.quantity, 0);
        const deducted = txnsInPeriod.filter(t => t.type === 'DEDUCT').reduce((s, t) => s + t.quantity, 0);

        return { sku: p, opening, added, deducted, closing };
      });
  }, [readyStock, readyStockTransactions, startOrd, endOrd]);

  if (skuData.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <PackageCheck size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No ready stock data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PRODUCT_CATEGORIES.map(cat => {
        const rows = skuData.filter(d => d.sku.product === cat);
        if (rows.length === 0) return null;

        return (
          <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <span className="font-semibold text-slate-700">{cat}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-2.5 font-medium">Variant</th>
                  <th className="text-center px-3 py-2.5 font-medium">Unit</th>
                  <th className="text-right px-4 py-2.5 font-medium">Opening</th>
                  <th className="text-right px-4 py-2.5 font-medium text-emerald-600">+ Added</th>
                  <th className="text-right px-4 py-2.5 font-medium text-rose-500">− Sold</th>
                  <th className="text-right px-5 py-2.5 font-medium">Closing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ sku, opening, added, deducted, closing }) => (
                  <tr key={sku.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-2.5 text-slate-700 font-medium">{sku.variant}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sku.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{opening}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                      {added > 0 ? `+${added}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-rose-500">
                      {deducted > 0 ? `−${deducted}` : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`font-bold text-base ${closing > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                        {closing}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ─── Packaging Inventory Tab ──────────────────────────────────────────────────

function PackagingInventory() {
  const { packagingStock, packagingEntries } = useStore();

  // Compute totals per material: purchased, used, damaged
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

type Tab = 'sales' | 'ready-stock' | 'packaging';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [range, setRange] = useState<DateRange>(() => presetToRange('month', '', ''));

  const {
    businessProfile, invoices,
    readyStock, readyStockTransactions,
    packagingStock, packagingEntries,
  } = useStore();

  const bizName = businessProfile?.name ?? 'Vyaparimay';
  const needsDateRange = activeTab !== 'packaging';

  const handleDownloadPdf = () => {
    let html = '';
    if (activeTab === 'sales') {
      html = buildSalesPdfHtml(bizName, range, invoices);
    } else if (activeTab === 'ready-stock') {
      html = buildReadyStockPdfHtml(bizName, range, readyStock, readyStockTransactions);
    } else {
      html = buildPackagingPdfHtml(bizName, packagingStock, packagingEntries);
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
          <TabButton
            active={activeTab === 'sales'}
            onClick={() => setActiveTab('sales')}
            icon={<BarChart3 size={15} />}
            label="Sales"
          />
          <TabButton
            active={activeTab === 'ready-stock'}
            onClick={() => setActiveTab('ready-stock')}
            icon={<PackageCheck size={15} />}
            label="Ready Stock"
          />
          <TabButton
            active={activeTab === 'packaging'}
            onClick={() => setActiveTab('packaging')}
            icon={<Box size={15} />}
            label="Packaging Inventory"
          />
        </div>

        {/* Date range (not shown for packaging) */}
        {needsDateRange && (
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <DateRangePicker range={range} onChange={setRange} />
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'sales'       && <SalesReport range={range} />}
        {activeTab === 'ready-stock' && <ReadyStockReport range={range} />}
        {activeTab === 'packaging'   && <PackagingInventory />}
      </div>
    </Layout>
  );
}
