import React, { useState } from 'react';
import { Search, FileText, XCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR } from '../../utils/format';
import Layout from '../Layout/Layout';
import DeletePasswordModal from './DeletePasswordModal';

export default function InvoiceHistory() {
  const { invoices, navigate, cancelInvoice } = useStore();
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  const pendingInvoice = pendingCancelId ? invoices.find(i => i.id === pendingCancelId) : null;

  const filtered = [...invoices]
    .filter(inv => showCancelled || !inv.cancelled)
    .filter(inv => {
      const q = search.toLowerCase();
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.customerSnapshot.name.toLowerCase().includes(q) ||
        inv.customerSnapshot.mobile.includes(q) ||
        inv.invoiceDate.includes(q)
      );
    })
    .sort((a, b) => b.invoiceNo.localeCompare(a.invoiceNo));

  const totalRevenue = invoices.filter(i => !i.cancelled).reduce((s, i) => s + i.grandTotal, 0);

  return (
    <>
    <Layout
      title="Invoice History"
      actions={
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Total Revenue:</span>
          <span className="font-bold text-gray-800">{fmtINR(totalRevenue)}</span>
        </div>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by invoice no, customer name, mobile or date..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={e => setShowCancelled(e.target.checked)}
            className="rounded"
          />
          Show cancelled
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {invoices.length === 0
              ? 'No invoices yet. Create your first order!'
              : 'No invoices match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'GST', 'Grand Total', 'Payment', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(inv => (
                <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${inv.cancelled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-indigo-500 font-semibold text-xs">{inv.invoiceNo}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {inv.invoiceDate}
                    <div className="text-xs text-slate-400">{inv.invoiceTime}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{inv.customerSnapshot.name}</div>
                    <div className="text-xs text-slate-400">{inv.customerSnapshot.mobile}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-center">{inv.items.length}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtINR(inv.subtotal)}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtINR(inv.totalGST)}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{fmtINR(inv.grandTotal)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{inv.paymentMode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.cancelled ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Cancelled</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate('invoice-view', { invoiceId: inv.id })}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors" title="View"
                      >
                        <FileText size={15} />
                      </button>
                      {!inv.cancelled && (
                        <button
                          onClick={() => setPendingCancelId(inv.id)}
                          className="text-red-400 hover:text-red-600 transition-colors" title="Cancel"
                        >
                          <XCircle size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} shown</div>
    </Layout>

    {pendingInvoice && (
      <DeletePasswordModal
        invoiceNo={pendingInvoice.invoiceNo}
        onConfirm={() => {
          cancelInvoice(pendingInvoice.id);
          setPendingCancelId(null);
        }}
        onCancel={() => setPendingCancelId(null)}
      />
    )}
    </>
  );
}
