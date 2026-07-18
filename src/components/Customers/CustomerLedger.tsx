import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MapPin, Building2, PlusCircle, TrendingUp, TrendingDown, Loader2, AlertCircle, Pencil, Check, X, Printer } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR } from '../../utils/format';
import Layout from '../Layout/Layout';
import AddPaymentModal from '../common/AddPaymentModal';
import DeletePasswordModal from '../Invoices/DeletePasswordModal';
import * as db from '../../lib/db';
import type { Customer } from '../../types';

// ─── Main Ledger ─────────────────────────────────────────────────────────────
export default function CustomerLedger() {
  const { selectedCustomerId, orgId, invoices, paymentReceipts, navigate, updatePaymentReceipt, businessProfile } = useStore();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [pendingAddPayment, setPendingAddPayment] = useState(false);
  const [pendingEditReceiptId, setPendingEditReceiptId] = useState<string | null>(null);
  const [pendingEditAmount, setPendingEditAmount] = useState(0);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState('');

  function startEditReceipt(receiptId: string, currentAmount: number) {
    setPendingEditReceiptId(receiptId);
    setPendingEditAmount(currentAmount);
  }

  function saveEditReceipt() {
    const amt = parseFloat(editingAmount);
    if (!isNaN(amt) && amt > 0 && editingReceiptId) {
      updatePaymentReceipt(editingReceiptId, amt);
    }
    setEditingReceiptId(null);
  }

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

  if (loading) {
    return (
      <Layout title="Customer Ledger">
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </Layout>
    );
  }

  if (error || !customer) {
    return (
      <Layout title="Customer Ledger">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error ?? 'Customer not found.'}
        </div>
      </Layout>
    );
  }

  // Build ledger entries: opening balance + invoices + payments, sorted by date then time
  type LedgerRow =
    | { kind: 'opening'; date: string; time: string; debit: number; credit: number }
    | { kind: 'invoice'; date: string; time: string; invoiceNo: string; invoiceId: string; debit: number; credit: number }
    | { kind: 'payment'; date: string; time: string; receiptId: string; mode: string; refNo?: string; notes?: string; debit: number; credit: number };

  const rows: LedgerRow[] = [];

  if (customer.openingBalance > 0) {
    rows.push({ kind: 'opening', date: customer.createdOn, time: '00:00', debit: customer.openingBalance, credit: 0 });
  }

  invoices
    .filter(inv => inv.customerId === customer.id && !inv.cancelled)
    .forEach(inv => rows.push({
      kind: 'invoice',
      date: inv.invoiceDate,
      time: inv.invoiceTime,
      invoiceNo: inv.invoiceNo,
      invoiceId: inv.id,
      debit: inv.grandTotal,
      credit: 0,
    }));

  paymentReceipts
    .filter(r => r.customerId === customer.id)
    .forEach(r => rows.push({
      kind: 'payment',
      date: r.date,
      time: r.time,
      receiptId: r.id,
      mode: r.mode,
      refNo: r.referenceNo,
      notes: r.notes,
      debit: 0,
      credit: r.amount,
    }));

  // Sort by date (DD/MM/YYYY) then time
  rows.sort((a, b) => {
    const toTs = (d: string, t: string) => {
      const [dd, mm, yyyy] = d.split('/');
      return new Date(`${yyyy}-${mm}-${dd}T${t}`).getTime();
    };
    return toTs(a.date, a.time) - toTs(b.date, b.time);
  });

  // Running balance
  let balance = 0;
  const ledger = rows.map(row => {
    balance += row.debit - row.credit;
    return { ...row, balance };
  });

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const outstanding = totalDebit - totalCredit;

  const handlePrint = () => {
    const biz = businessProfile;
    const bizHeader = biz
      ? `<div style="text-align:center;margin-bottom:12px;">
          <div style="font-size:18px;font-weight:700;">${biz.name}</div>
          ${biz.address1 ? `<div style="font-size:12px;color:#555;">${biz.address1}${biz.address2 ? ', ' + biz.address2 : ''}, ${biz.city} – ${biz.state}</div>` : ''}
          ${biz.mobile ? `<div style="font-size:12px;color:#555;">Ph: ${biz.mobile}</div>` : ''}
          ${biz.gstin ? `<div style="font-size:12px;color:#555;">GSTIN: ${biz.gstin}</div>` : ''}
        </div>`
      : '';

    const rowsHtml = ledger.map(row => {
      let desc = '';
      if (row.kind === 'opening') desc = '<span style="color:#b45309;font-weight:600;">Opening Balance</span>';
      else if (row.kind === 'invoice') desc = `Invoice <span style="font-family:monospace;">${(row as { invoiceNo: string }).invoiceNo}</span>`;
      else {
        const r = row as { mode: string; refNo?: string; notes?: string };
        desc = `<span style="color:#15803d;font-weight:600;">Payment Received · ${r.mode}${r.refNo ? ` (${r.refNo})` : ''}${r.notes ? ` · ${r.notes}` : ''}</span>`;
      }
      const balColor = row.balance > 0 ? '#92400e' : row.balance < 0 ? '#15803d' : '#6b7280';
      const balSuffix = row.balance > 0 ? ' Dr' : row.balance < 0 ? ' Cr' : ' Nil';
      return `<tr>
        <td style="padding:6px 8px;white-space:nowrap;color:#6b7280;">${row.date}</td>
        <td style="padding:6px 8px;">${desc}</td>
        <td style="padding:6px 8px;text-align:right;color:#dc2626;">${row.debit > 0 ? fmtINR(row.debit) : '—'}</td>
        <td style="padding:6px 8px;text-align:right;color:#16a34a;">${row.credit > 0 ? fmtINR(row.credit) : '—'}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:${balColor};">${fmtINR(Math.abs(row.balance))}${balSuffix}</td>
      </tr>`;
    }).join('');

    const outstandingColor = outstanding > 0 ? '#92400e' : '#15803d';
    const outstandingLabel = outstanding > 0 ? 'Dr' : outstanding < 0 ? 'Cr' : '';

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Customer Ledger – ${customer.name}</title>
      <style>
        @page { size: A4; margin: 15mm 12mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; margin: 0; padding: 0; }
        h2 { text-align:center; font-size:15px; margin:8px 0 4px; color:#1e3a5f; }
        .divider { border:none; border-top:1.5px solid #1e3a5f; margin:8px 0; }
        .customer-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:10px; display:flex; justify-content:space-between; }
        .stats { display:flex; gap:12px; margin-bottom:10px; }
        .stat { flex:1; border:1px solid #e2e8f0; border-radius:6px; padding:8px; text-align:center; }
        .stat .val { font-size:15px; font-weight:700; }
        .stat .lbl { font-size:10px; color:#6b7280; margin-top:2px; }
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
      <hr class="divider"/>
      <div class="customer-box">
        <div>
          <div style="font-weight:700;font-size:14px;">${customer.name}</div>
          ${customer.firmName ? `<div style="color:#555;font-size:12px;">${customer.firmName}</div>` : ''}
          <div style="color:#555;font-size:12px;">Ph: ${customer.mobile}${customer.alternateMobile ? ' / ' + customer.alternateMobile : ''}</div>
          <div style="color:#555;font-size:12px;">${customer.address1}, ${customer.city} – ${customer.state}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#9ca3af;">CUST ID</div>
          <div style="font-family:monospace;font-weight:700;color:#4338ca;">${customer.id}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Terms</div>
          <div style="font-size:12px;font-weight:600;">${customer.paymentTerms}</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat">
          <div class="val">${invoices.filter(i => i.customerId === customer.id && !i.cancelled).length}</div>
          <div class="lbl">Total Orders</div>
        </div>
        <div class="stat">
          <div class="val" style="color:#dc2626;">${fmtINR(totalDebit)}</div>
          <div class="lbl">Total Dues</div>
        </div>
        <div class="stat">
          <div class="val" style="color:#16a34a;">${fmtINR(totalCredit)}</div>
          <div class="lbl">Total Received</div>
        </div>
        <div class="stat" style="background:${outstanding > 0 ? '#fffbeb' : '#f0fdf4'};border-color:${outstanding > 0 ? '#fcd34d' : '#86efac'};">
          <div class="val" style="color:${outstandingColor};">${fmtINR(Math.abs(outstanding))}</div>
          <div class="lbl">${outstanding > 0 ? 'Outstanding' : outstanding < 0 ? 'Advance' : 'Settled'}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Date</th><th>Description</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td colspan="2">Totals</td>
          <td style="color:#dc2626;">${fmtINR(totalDebit)}</td>
          <td style="color:#16a34a;">${fmtINR(totalCredit)}</td>
          <td style="color:${outstandingColor};">${fmtINR(Math.abs(outstanding))} ${outstandingLabel}</td>
        </tr></tfoot>
      </table>
      <div class="footer">Printed on ${new Date().toLocaleString('en-IN')}</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = () => {
      w.print();
      w.onafterprint = () => w.close();
    };
  };

  return (
    <Layout
      title="Customer Ledger"
      actions={
        <button
          onClick={() => navigate('customer-list')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
      }
    >
      {showAddPayment && (
        <AddPaymentModal customerId={customer.id} onClose={() => setShowAddPayment(false)} />
      )}

      {pendingAddPayment && (
        <DeletePasswordModal
          invoiceNo={customer.id}
          title="Add Payment"
          description={`You are about to record a payment received from ${customer.name}. Enter the 4-digit password to continue.`}
          skipConfirmStep
          onConfirm={() => {
            setShowAddPayment(true);
            setPendingAddPayment(false);
          }}
          onCancel={() => setPendingAddPayment(false)}
        />
      )}

      {pendingEditReceiptId && (
        <DeletePasswordModal
          invoiceNo={pendingEditReceiptId}
          title="Edit Payment Amount"
          description={`You are about to edit payment ${pendingEditReceiptId} (current: ${fmtINR(pendingEditAmount)}). Enter the 4-digit password to continue.`}
          onConfirm={() => {
            setEditingReceiptId(pendingEditReceiptId);
            setEditingAmount(String(pendingEditAmount));
            setPendingEditReceiptId(null);
          }}
          onCancel={() => setPendingEditReceiptId(null)}
        />
      )}

      {/* Customer Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-5">
        <div className="flex items-start justify-between">
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
            <div className="text-xs text-gray-400 uppercase font-medium">CUST ID</div>
            <div className="font-mono text-indigo-600 font-bold">{customer.id}</div>
            <div className="mt-2 text-xs text-gray-400 uppercase font-medium">Terms</div>
            <div className="text-sm font-medium">{customer.paymentTerms}</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">{invoices.filter(i => i.customerId === customer.id && !i.cancelled).length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Orders</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
            <TrendingUp size={18} />{fmtINR(totalDebit)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total Dues</div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
            <TrendingDown size={18} />{fmtINR(totalCredit)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Total Received</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 text-center ${outstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`text-2xl font-bold ${outstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {fmtINR(Math.abs(outstanding))}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {outstanding > 0 ? 'Outstanding' : outstanding < 0 ? 'Advance' : 'Settled ✓'}
          </div>
        </div>
      </div>

      {/* Add Payment button + Ledger Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Account Statement</h2>
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

        {ledger.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions yet.</div>
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
              {ledger.map((row, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${row.kind === 'payment' ? 'bg-green-50/40' : ''}`}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-3">
                    {row.kind === 'opening' && (
                      <span className="text-amber-700 font-medium">Opening Balance</span>
                    )}
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
                        Payment Received · {row.mode}
                        {row.refNo && <span className="text-xs text-gray-400 ml-1">({row.refNo})</span>}
                        {row.notes && <span className="text-xs text-gray-400 ml-1">· {row.notes}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-red-600 font-medium">
                    {row.debit > 0 ? fmtINR(row.debit) : '—'}
                  </td>
                  <td className="px-4 py-3 text-green-600 font-medium">
                    {row.kind === 'payment' ? (
                      editingReceiptId === row.receiptId ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">₹</span>
                          <input
                            type="number"
                            min={1}
                            value={editingAmount}
                            onChange={e => setEditingAmount(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEditReceipt();
                              if (e.key === 'Escape') setEditingReceiptId(null);
                            }}
                            className="w-28 border border-green-400 rounded-lg px-2 py-0.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-500"
                            autoFocus
                          />
                          <button onClick={saveEditReceipt} className="text-green-600 hover:text-green-800" title="Save"><Check size={14} /></button>
                          <button onClick={() => setEditingReceiptId(null)} className="text-gray-400 hover:text-gray-600" title="Cancel"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {fmtINR(row.credit)}
                          <button
                            onClick={() => startEditReceipt(row.receiptId, row.credit)}
                            className="text-gray-300 hover:text-green-600 transition-colors"
                            title="Edit amount"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )
                    ) : (
                      row.credit > 0 ? fmtINR(row.credit) : '—'
                    )}
                  </td>
                  <td className={`px-4 py-3 font-bold ${row.balance > 0 ? 'text-amber-700' : row.balance < 0 ? 'text-green-700' : 'text-gray-500'}`}>
                    {fmtINR(Math.abs(row.balance))}
                    {row.balance > 0 && <span className="text-xs font-normal text-gray-400 ml-1">Dr</span>}
                    {row.balance < 0 && <span className="text-xs font-normal text-gray-400 ml-1">Cr</span>}
                    {row.balance === 0 && <span className="text-xs font-normal text-gray-400 ml-1">Nil</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Totals</td>
                <td />
                <td className="px-4 py-3 font-bold text-red-600">{fmtINR(totalDebit)}</td>
                <td className="px-4 py-3 font-bold text-green-600">{fmtINR(totalCredit)}</td>
                <td className={`px-4 py-3 font-bold ${outstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {fmtINR(Math.abs(outstanding))} {outstanding > 0 ? 'Dr' : outstanding < 0 ? 'Cr' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </Layout>
  );
}
