import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Phone, MapPin, Building2, PlusCircle, Loader2, AlertCircle,
  Pencil, Printer, Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR, formatDate, parseDDMMYYYY } from '../../utils/format';
import Layout from '../Layout/Layout';
import AddPaymentModal from '../common/AddPaymentModal';
import DeletePasswordModal from '../Invoices/DeletePasswordModal';
import type { Customer, Invoice, PaymentReceipt } from '../../types';
import * as realDb from '../../lib/db';
import * as demoDb from '../../lib/db.demo';

const db = import.meta.env.VITE_DEMO_MODE === 'true' ? demoDb : realDb;

// Non-cash payment modes settle a customer's dues without money changing hands,
// so they're labelled by name rather than "Payment Received · <mode>".
const NON_CASH_MODES = new Set(['Return Credit', 'Exchange of Wheat']);

// ─── Filtering ──────────────────────────────────────────────────────────────
// Bank-statement style: pick a bounded window instead of loading the whole
// history at once. "count" and "days" are the two defaults the user lands
// on; "custom" and "all" are opt-in.
type FilterMode =
  | { kind: 'count'; count: number }
  | { kind: 'days'; days: number }
  | { kind: 'custom'; from: string; to: string } // DD/MM/YYYY, inclusive
  | { kind: 'all' };

const QUICK_FILTERS: { label: string; mode: FilterMode }[] = [
  { label: 'Last 20 entries', mode: { kind: 'count', count: 20 } },
  { label: '7 Days', mode: { kind: 'days', days: 7 } },
  { label: '15 Days', mode: { kind: 'days', days: 15 } },
  { label: '30 Days', mode: { kind: 'days', days: 30 } },
  { label: '90 Days', mode: { kind: 'days', days: 90 } },
  { label: 'All Time', mode: { kind: 'all' } },
];

const DEFAULT_FILTER: FilterMode = { kind: 'days', days: 15 };

function sameFilter(a: FilterMode, b: FilterMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'count' && b.kind === 'count') return a.count === b.count;
  if (a.kind === 'days' && b.kind === 'days') return a.days === b.days;
  return a.kind === 'all' || a.kind === 'custom'; // 'custom' never matches a quick chip
}

function isoToDdmmyyyy(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
function ddmmyyyyToIso(d: string): string {
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

// ─── Ledger row model ───────────────────────────────────────────────────────
type LedgerRow =
  | { kind: 'opening'; date: string; time: string; debit: number; credit: number }
  | { kind: 'invoice'; date: string; time: string; invoiceNo: string; invoiceId: string; debit: number; credit: number }
  | { kind: 'payment'; date: string; time: string; receiptId: string; mode: string; refNo?: string; notes?: string; debit: number; credit: number };

type LedgerRowWithBalance = LedgerRow & { balance: number };

// ─── Main Ledger (v2) ───────────────────────────────────────────────────────
export default function CustomerLedgerV2() {
  const { selectedCustomerId, orgId, navigate, businessProfile } = useStore();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [customerPayments, setCustomerPayments] = useState<PaymentReceipt[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>(DEFAULT_FILTER);
  const [customFrom, setCustomFrom] = useState(ddmmyyyyToIso(formatDate(new Date())));
  const [customTo, setCustomTo] = useState(ddmmyyyyToIso(formatDate(new Date())));
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [pendingAddPayment, setPendingAddPayment] = useState(false);
  const [pendingEditReceiptId, setPendingEditReceiptId] = useState<string | null>(null);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);

  const pendingEditReceipt = pendingEditReceiptId ? customerPayments.find(r => r.id === pendingEditReceiptId) ?? null : null;
  const editingReceipt = editingReceiptId ? customerPayments.find(r => r.id === editingReceiptId) ?? null : null;

  useEffect(() => {
    if (!selectedCustomerId || !orgId) return;
    setLoading(true);
    setError(null);
    db.loadCustomers(orgId)
      .then(({ customers }) => {
        const found = customers.find(c => c.id === selectedCustomerId) ?? null;
        setCustomer(found);
        if (!found) setError('Customer not found.');
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load customer'))
      .finally(() => setLoading(false));
  }, [selectedCustomerId, orgId]);

  // Invoices AND payments are both fetched scoped to this one customer —
  // bounded by (org_id, customer_id) and paginated internally (db.ts) so
  // neither is ever subject to Supabase's "Max Rows" truncation, no matter
  // how large the org's totals grow or what Max Rows is set to. The opening
  // balance is derived from these, so it stays exact every time the ledger
  // opens — never a partial/truncated view of the customer's history.
  const reloadPayments = useCallback(() => {
    if (!selectedCustomerId || !orgId) return Promise.resolve();
    setPaymentsLoading(true);
    return db.loadPaymentReceiptsForCustomer(orgId, selectedCustomerId)
      .then(p => setCustomerPayments(p))
      .finally(() => setPaymentsLoading(false));
  }, [selectedCustomerId, orgId]);

  useEffect(() => {
    if (!selectedCustomerId || !orgId) return;
    let cancelled = false;
    setInvoicesLoading(true);
    db.loadInvoicesForCustomer(orgId, selectedCustomerId)
      .then(inv => { if (!cancelled) setCustomerInvoices(inv); })
      .finally(() => { if (!cancelled) setInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCustomerId, orgId]);

  useEffect(() => { reloadPayments(); }, [reloadPayments]);

  // Full timeline, oldest → newest, with a running balance — computed once
  // per data load. All filter windows are derived from this in memory
  // rather than re-fetched, since a single customer's history is small.
  const timeline: LedgerRowWithBalance[] = useMemo(() => {
    if (!customer) return [];
    const rows: LedgerRow[] = [];

    if (customer.openingBalance > 0) {
      rows.push({ kind: 'opening', date: customer.createdOn, time: '00:00', debit: customer.openingBalance, credit: 0 });
    }
    customerInvoices
      .filter(inv => !inv.cancelled)
      .forEach(inv => rows.push({
        kind: 'invoice', date: inv.invoiceDate, time: inv.invoiceTime,
        invoiceNo: inv.invoiceNo, invoiceId: inv.id, debit: inv.grandTotal, credit: 0,
      }));
    customerPayments
      .forEach(r => rows.push({
        kind: 'payment', date: r.date, time: r.time, receiptId: r.id,
        mode: r.mode, refNo: r.referenceNo, notes: r.notes, debit: 0, credit: r.amount,
      }));

    rows.sort((a, b) => parseDDMMYYYY(a.date, a.time) - parseDDMMYYYY(b.date, b.time));

    let balance = 0;
    return rows.map(row => {
      balance += row.debit - row.credit;
      return { ...row, balance };
    });
  }, [customer, customerInvoices, customerPayments]);

  // ── Apply the selected window to the full timeline ──────────────────────
  const { windowRows, openingBalanceForWindow, closingBalance, rangeLabel } = useMemo(() => {
    if (filterMode.kind === 'count') {
      const rows = timeline.slice(-filterMode.count);
      const startIdx = timeline.length - rows.length;
      const opening = startIdx > 0 ? timeline[startIdx - 1].balance : 0;
      const closing = rows.length > 0 ? rows[rows.length - 1].balance : opening;
      return { windowRows: rows, openingBalanceForWindow: opening, closingBalance: closing, rangeLabel: `Last ${filterMode.count} entries` };
    }

    let fromTs = -Infinity;
    let toTs = Infinity;
    let label = 'All Time';
    if (filterMode.kind === 'days') {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - (filterMode.days - 1));
      fromTs = parseDDMMYYYY(formatDate(from), '00:00');
      toTs = parseDDMMYYYY(formatDate(to), '23:59');
      label = `Last ${filterMode.days} days (${formatDate(from)} – ${formatDate(to)})`;
    } else if (filterMode.kind === 'custom') {
      fromTs = parseDDMMYYYY(filterMode.from, '00:00');
      toTs = parseDDMMYYYY(filterMode.to, '23:59');
      label = `${filterMode.from} – ${filterMode.to}`;
    }

    let opening = 0;
    for (const row of timeline) {
      if (parseDDMMYYYY(row.date, row.time) < fromTs) opening = row.balance;
      else break;
    }
    const rows = timeline.filter(row => {
      const ts = parseDDMMYYYY(row.date, row.time);
      return ts >= fromTs && ts <= toTs;
    });
    const closing = rows.length > 0 ? rows[rows.length - 1].balance : opening;
    return { windowRows: rows, openingBalanceForWindow: opening, closingBalance: closing, rangeLabel: label };
  }, [timeline, filterMode]);

  const windowRowsDescending = useMemo(() => [...windowRows].reverse(), [windowRows]);
  const periodDebit  = useMemo(() => windowRows.reduce((s, r) => s + r.debit, 0), [windowRows]);
  const periodCredit = useMemo(() => windowRows.reduce((s, r) => s + r.credit, 0), [windowRows]);
  const currentOutstanding = timeline.length > 0 ? timeline[timeline.length - 1].balance : 0;

  if (loading || invoicesLoading || paymentsLoading) {
    return (
      <Layout title="Account Statement">
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </Layout>
    );
  }

  if (error || !customer) {
    return (
      <Layout title="Account Statement">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error ?? 'Customer not found.'}
        </div>
      </Layout>
    );
  }

  const balColor = (b: number) => b > 0 ? 'text-amber-700' : b < 0 ? 'text-green-700' : 'text-gray-500';
  const balSuffix = (b: number) => b > 0 ? 'Dr' : b < 0 ? 'Cr' : 'Nil';

  const handlePrint = () => {
    const biz = businessProfile;
    const bizHeader = biz
      ? `<div style="text-align:center;margin-bottom:12px;">
          <div style="font-size:18px;font-weight:700;">${biz.name}</div>
          ${biz.address1 ? `<div style="font-size:12px;color:#555;">${biz.address1}${biz.address2 ? ', ' + biz.address2 : ''}, ${biz.city} – ${biz.state}</div>` : ''}
          ${biz.mobile ? `<div style="font-size:12px;color:#555;">Ph: ${biz.mobile}</div>` : ''}
        </div>`
      : '';

    const rowsHtml = windowRowsDescending.map(row => {
      let desc = '';
      if (row.kind === 'opening') desc = '<span style="color:#b45309;font-weight:600;">Opening Balance</span>';
      else if (row.kind === 'invoice') desc = `Invoice <span style="font-family:monospace;">${row.invoiceNo}</span>`;
      else {
        const label = NON_CASH_MODES.has(row.mode) ? row.mode : `Payment Received · ${row.mode}`;
        desc = `<span style="color:#15803d;font-weight:600;">${label}${row.refNo ? ` (${row.refNo})` : ''}${row.notes ? ` · ${row.notes}` : ''}</span>`;
      }
      const c = row.balance > 0 ? '#92400e' : row.balance < 0 ? '#15803d' : '#6b7280';
      const suffix = row.balance > 0 ? ' Dr' : row.balance < 0 ? ' Cr' : ' Nil';
      return `<tr>
        <td style="padding:6px 8px;white-space:nowrap;color:#6b7280;">${row.date}</td>
        <td style="padding:6px 8px;">${desc}</td>
        <td style="padding:6px 8px;text-align:right;color:#dc2626;">${row.debit > 0 ? fmtINR(row.debit) : '—'}</td>
        <td style="padding:6px 8px;text-align:right;color:#16a34a;">${row.credit > 0 ? fmtINR(row.credit) : '—'}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:${c};">${fmtINR(Math.abs(row.balance))}${suffix}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Account Statement – ${customer.name}</title>
      <style>
        @page { size: A4; margin: 15mm 12mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; margin: 0; padding: 0; }
        h2 { text-align:center; font-size:15px; margin:8px 0 4px; color:#1e3a5f; }
        .sub { text-align:center; font-size:11px; color:#6b7280; margin-bottom:8px; }
        .divider { border:none; border-top:1.5px solid #1e3a5f; margin:8px 0; }
        .customer-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:10px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        thead th { background:#1e3a5f; color:#fff; padding:7px 8px; text-align:left; font-size:11px; text-transform:uppercase; }
        thead th:nth-child(n+3) { text-align:right; }
        tbody tr:nth-child(even) { background:#f9fafb; }
        tfoot td { padding:7px 8px; font-weight:700; border-top:2px solid #1e3a5f; }
        tfoot td:nth-child(n+3) { text-align:right; }
        .footer { margin-top:20px; font-size:10px; color:#9ca3af; text-align:center; }
      </style>
    </head><body>
      ${bizHeader}
      <h2>Account Statement</h2>
      <div class="sub">${rangeLabel}</div>
      <hr class="divider"/>
      <div class="customer-box">
        <div style="font-weight:700;font-size:14px;">${customer.name}</div>
        <div style="color:#555;font-size:12px;">Ph: ${customer.mobile}</div>
        <div style="color:#555;font-size:12px;">${customer.address1}, ${customer.city} – ${customer.state}</div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead>
        <tbody>
          <tr><td colspan="4" style="font-weight:700;">Opening Balance</td><td style="text-align:right;font-weight:700;">${fmtINR(Math.abs(openingBalanceForWindow))} ${balSuffix(openingBalanceForWindow)}</td></tr>
          ${rowsHtml}
        </tbody>
        <tfoot><tr>
          <td colspan="2">Totals</td>
          <td style="color:#dc2626;">${fmtINR(periodDebit)}</td>
          <td style="color:#16a34a;">${fmtINR(periodCredit)}</td>
          <td style="color:${closingBalance > 0 ? '#92400e' : '#15803d'};">${fmtINR(Math.abs(closingBalance))} ${balSuffix(closingBalance)}</td>
        </tr></tfoot>
      </table>
      <div class="footer">Printed on ${new Date().toLocaleString('en-IN')}</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = () => { w.print(); w.onafterprint = () => w.close(); };
  };

  return (
    <Layout
      title="Account Statement"
      actions={
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('customer-ledger', { customerId: customer.id })}
            className="text-gray-400 hover:text-gray-600 text-xs underline"
          >
            Switch to classic ledger
          </button>
          <button
            onClick={() => navigate('customer-list')}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      }
    >
      {showAddPayment && (
        <AddPaymentModal customerId={customer.id} onClose={() => { setShowAddPayment(false); reloadPayments(); }} />
      )}
      {editingReceipt && (
        <AddPaymentModal customerId={customer.id} receipt={editingReceipt} onClose={() => { setEditingReceiptId(null); reloadPayments(); }} />
      )}
      {pendingAddPayment && (
        <DeletePasswordModal
          invoiceNo={customer.id}
          title="Add Payment"
          description={`You are about to record a payment received from ${customer.name}. Enter the 4-digit password to continue.`}
          skipConfirmStep
          onConfirm={() => { setShowAddPayment(true); setPendingAddPayment(false); }}
          onCancel={() => setPendingAddPayment(false)}
        />
      )}
      {pendingEditReceipt && (
        <DeletePasswordModal
          invoiceNo={pendingEditReceipt.id}
          title="Edit Payment"
          description={`You are about to edit payment ${pendingEditReceipt.id} (current: ${fmtINR(pendingEditReceipt.amount)}). Enter the 4-digit password to continue.`}
          onConfirm={() => { setEditingReceiptId(pendingEditReceipt.id); setPendingEditReceiptId(null); }}
          onCancel={() => setPendingEditReceiptId(null)}
        />
      )}

      <div className="flex items-center gap-2 mb-4 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 w-fit">
        <Sparkles size={13} /> New statement view — beta. The old ledger is still available.
      </div>

      {/* Customer Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-xl">
              {customer.name[0].toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">{customer.name}</div>
              {customer.firmName && (
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                  <Building2 size={13} /> {customer.firmName}
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                <Phone size={13} /> {customer.mobile}
                {customer.alternateMobile && ` / ${customer.alternateMobile}`}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                <MapPin size={13} /> {customer.address1}, {customer.city} – {customer.state}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase font-medium">Current Outstanding</div>
            <div className={`text-xl font-bold ${balColor(currentOutstanding)}`}>
              {fmtINR(Math.abs(currentOutstanding))}
              <span className="text-xs font-normal text-gray-400 ml-1">{balSuffix(currentOutstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setFilterMode(f.mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                sameFilter(filterMode, f.mode)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
            />
            <button
              onClick={() => setFilterMode({ kind: 'custom', from: isoToDdmmyyyy(customFrom), to: isoToDdmmyyyy(customTo) })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterMode.kind === 'custom'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats (for the selected window) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <div className={`text-lg font-bold ${balColor(openingBalanceForWindow)}`}>
            {fmtINR(Math.abs(openingBalanceForWindow))} <span className="text-xs font-normal text-gray-400">{balSuffix(openingBalanceForWindow)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Opening Balance</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 text-center">
          <div className="text-lg font-bold text-red-600">{fmtINR(periodDebit)}</div>
          <div className="text-xs text-gray-500 mt-1">Debit (Period)</div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4 text-center">
          <div className="text-lg font-bold text-green-600">{fmtINR(periodCredit)}</div>
          <div className="text-xs text-gray-500 mt-1">Credit (Period)</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 text-center ${closingBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`text-lg font-bold ${balColor(closingBalance)}`}>
            {fmtINR(Math.abs(closingBalance))} <span className="text-xs font-normal text-gray-400">{balSuffix(closingBalance)}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Closing Balance</div>
        </div>
      </div>

      {/* Statement table — latest entry first, like a bank statement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-gray-700">Transactions</h2>
            <div className="text-xs text-gray-400 mt-0.5">{rangeLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Printer size={15} /> Print
            </button>
            <button
              onClick={() => setPendingAddPayment(true)}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <PlusCircle size={15} /> Add Payment
            </button>
          </div>
        </div>

        {windowRowsDescending.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions in this period.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Description', 'Debit (Dr)', 'Credit (Cr)', 'Balance'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {windowRowsDescending.map((row, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${row.kind === 'payment' ? 'bg-green-50/40' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-3">
                    {row.kind === 'opening' && <span className="text-amber-700 font-medium">Opening Balance</span>}
                    {row.kind === 'invoice' && (
                      <span>
                        Invoice{' '}
                        <button
                          onClick={() => navigate('invoice-view', { invoiceId: row.invoiceId })}
                          className="text-indigo-600 font-mono hover:underline"
                        >
                          {row.invoiceNo}
                        </button>
                      </span>
                    )}
                    {row.kind === 'payment' && (
                      <span className="text-green-700 font-medium">
                        {NON_CASH_MODES.has(row.mode) ? row.mode : `Payment Received · ${row.mode}`}
                        {row.refNo && <span className="text-xs text-gray-400 ml-1">({row.refNo})</span>}
                        {row.notes && <span className="text-xs text-gray-400 ml-1">· {row.notes}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-red-600 font-medium">{row.debit > 0 ? fmtINR(row.debit) : '—'}</td>
                  <td className="px-4 py-3 text-green-600 font-medium">
                    {row.kind === 'payment' ? (
                      <div className="flex items-center gap-1">
                        {fmtINR(row.credit)}
                        <button
                          onClick={() => setPendingEditReceiptId(row.receiptId)}
                          className="text-gray-300 hover:text-green-600 transition-colors"
                          title="Edit payment"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    ) : (row.credit > 0 ? fmtINR(row.credit) : '—')}
                  </td>
                  <td className={`px-4 py-3 font-bold ${balColor(row.balance)}`}>
                    {fmtINR(Math.abs(row.balance))}
                    <span className="text-xs font-normal text-gray-400 ml-1">{balSuffix(row.balance)}</span>
                  </td>
                </tr>
              ))}
              {/* Opening balance for the window shown as the oldest (bottom) row */}
              <tr className="bg-amber-50/50">
                <td className="px-4 py-3 text-gray-400 text-xs" colSpan={4}>Opening Balance (before this period)</td>
                <td className={`px-4 py-3 font-bold text-xs ${balColor(openingBalanceForWindow)}`}>
                  {fmtINR(Math.abs(openingBalanceForWindow))}
                  <span className="text-xs font-normal text-gray-400 ml-1">{balSuffix(openingBalanceForWindow)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
