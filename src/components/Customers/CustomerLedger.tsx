import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, MapPin, Building2, PlusCircle, TrendingUp, TrendingDown, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR } from '../../utils/format';
import Layout from '../Layout/Layout';
import AddPaymentModal from '../common/AddPaymentModal';
import DeletePasswordModal from '../Invoices/DeletePasswordModal';
import * as db from '../../lib/db';
import type { Customer } from '../../types';

// ─── Main Ledger ─────────────────────────────────────────────────────────────
export default function CustomerLedger() {
  const { selectedCustomerId, orgId, invoices, paymentReceipts, navigate, updatePaymentReceipt } = useStore();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
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
          <button
            onClick={() => setShowAddPayment(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <PlusCircle size={15} /> Add Payment
          </button>
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
