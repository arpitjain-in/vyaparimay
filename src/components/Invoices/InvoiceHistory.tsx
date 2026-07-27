import React, { useState, useEffect } from 'react';
import { Search, FileText, XCircle, ArrowLeftRight, ChevronLeft, ChevronRight, Truck, Lock, EyeOff } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR, parseDDMMYYYY } from '../../utils/format';
import Layout from '../Layout/Layout';
import DeletePasswordModal from './DeletePasswordModal';
import TruckLoadSheet from './TruckLoadSheet';

const PAGE_SIZE = 25;

export default function InvoiceHistory() {
  const { invoices, proformaInvoices, navigate, cancelInvoice, updateInvoicePaymentMode } = useStore();
  const [docTab, setDocTab] = useState<'invoice' | 'proforma'>('invoice');
  const [search, setSearch] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Cash' | 'Credit'>('All');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingPaymentModeId, setPendingPaymentModeId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [truckMode, setTruckMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showLoadSheet, setShowLoadSheet] = useState(false);
  const [revenueVisible, setRevenueVisible] = useState(false);
  const [showRevenuePasswordModal, setShowRevenuePasswordModal] = useState(false);

  const isProformaTab = docTab === 'proforma';
  const sourceList = isProformaTab ? proformaInvoices : invoices;

  useEffect(() => { setPage(1); }, [search, showCancelled, paymentFilter, docTab]);

  const pendingInvoice = pendingCancelId ? invoices.find(i => i.id === pendingCancelId) : null;
  const pendingPaymentModeInvoice = pendingPaymentModeId ? invoices.find(i => i.id === pendingPaymentModeId) : null;

  const filtered = [...sourceList]
    .filter(inv => isProformaTab ? true : (showCancelled ? inv.cancelled : !inv.cancelled))
    .filter(inv => paymentFilter === 'All' || inv.paymentMode === paymentFilter)
    .filter(inv => {
      const q = search.toLowerCase();
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.customerSnapshot.name.toLowerCase().includes(q) ||
        inv.customerSnapshot.mobile.includes(q) ||
        inv.invoiceDate.includes(q)
      );
    })
    .sort((a, b) => {
      const d = parseDDMMYYYY(b.invoiceDate) - parseDDMMYYYY(a.invoiceDate);
      return d !== 0 ? d : b.invoiceNo.localeCompare(a.invoiceNo);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedInvoices = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalRevenue = invoices.filter(i => !i.cancelled).reduce((s, i) => s + i.grandTotal, 0);

  const handleDocTabChange = (tab: 'invoice' | 'proforma') => {
    setDocTab(tab);
    setTruckMode(false);
    setSelectedIds(new Set());
    setShowLoadSheet(false);
  };

  const handleTruckModeToggle = () => {
    if (truckMode) {
      setSelectedIds(new Set());
      setShowLoadSheet(false);
    }
    setTruckMode(m => !m);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id));

  return (
    <>
    <Layout
      title={isProformaTab ? 'Proforma Invoices' : 'Invoice History'}
      actions={
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
            {(['invoice', 'proforma'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => handleDocTabChange(tab)}
                className={`px-3 py-2 whitespace-nowrap transition-colors ${
                  docTab === tab
                    ? 'bg-indigo-500 text-white font-medium'
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab === 'invoice' ? 'Tax Invoices' : 'Proforma'}
              </button>
            ))}
          </div>
          {!isProformaTab && (
            <button
              onClick={handleTruckModeToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                truckMode
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Truck size={15} />
              Truck Load
            </button>
          )}
          {!isProformaTab && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Total Revenue:</span>
              {revenueVisible ? (
                <>
                  <span className="font-bold text-gray-800">{fmtINR(totalRevenue)}</span>
                  <button
                    onClick={() => setRevenueVisible(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Hide total revenue"
                  >
                    <EyeOff size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowRevenuePasswordModal(true)}
                  className="flex items-center gap-1.5 font-bold text-gray-400 hover:text-gray-600 transition-colors"
                  title="Show total revenue"
                >
                  <span className="tracking-widest">••••••</span>
                  <Lock size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      {truckMode && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700">
          <Truck size={14} />
          <span>
            Select invoices to generate a load sheet.{' '}
            {selectedIds.size > 0
              ? <><strong>{selectedIds.size}</strong> invoice{selectedIds.size !== 1 ? 's' : ''} selected.</>
              : 'None selected yet.'}
          </span>
        </div>
      )}

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
        <div className="flex rounded-xl border border-slate-200 overflow-hidden text-sm">
          {(['All', 'Cash', 'Credit'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setPaymentFilter(mode)}
              className={`px-3 py-2 whitespace-nowrap transition-colors ${
                paymentFilter === mode
                  ? 'bg-indigo-500 text-white font-medium'
                  : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {!isProformaTab && (
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={e => setShowCancelled(e.target.checked)}
              className="rounded"
            />
            Show cancelled
          </label>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            {sourceList.length === 0
              ? isProformaTab ? 'No proforma invoices yet.' : 'No invoices yet. Create your first order!'
              : isProformaTab ? 'No proforma invoices match your search.' : 'No invoices match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {truckMode && <th className="px-4 py-3" />}
                {[
                  isProformaTab ? 'Proforma No' : 'Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'GST', 'Grand Total', 'Payment',
                  ...(isProformaTab ? [] : ['Status']),
                  '',
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedInvoices.map(inv => (
                <tr
                  key={inv.id}
                  className={`hover:bg-slate-50 transition-colors ${inv.cancelled ? 'opacity-50' : ''} ${truckMode && selectedIds.has(inv.id) ? 'bg-indigo-50 hover:bg-indigo-50' : ''}`}
                >
                  {truckMode && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        disabled={inv.cancelled}
                        className="rounded accent-indigo-500 disabled:opacity-30"
                      />
                    </td>
                  )}
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
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        inv.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>{inv.paymentMode}</span>
                      {!isProformaTab && !inv.cancelled && (
                        <button
                          onClick={() => setPendingPaymentModeId(inv.id)}
                          className="text-slate-300 hover:text-slate-500 transition-colors"
                          title={`Switch to ${inv.paymentMode === 'Cash' ? 'Credit' : 'Cash'}`}
                        >
                          <ArrowLeftRight size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                  {!isProformaTab && (
                    <td className="px-4 py-3">
                      {inv.cancelled ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">Cancelled</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate('invoice-view', { invoiceId: inv.id })}
                        className="text-indigo-400 hover:text-indigo-600 transition-colors" title="View"
                      >
                        <FileText size={15} />
                      </button>
                      {!isProformaTab && !inv.cancelled && (
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
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {filtered.length} {isProformaTab ? 'proforma invoice' : 'invoice'}{filtered.length !== 1 ? 's' : ''} found
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-slate-500 px-1">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom padding so the fixed bar doesn't cover the last row */}
      {truckMode && selectedIds.size > 0 && <div className="h-16" />}
    </Layout>

    {/* Sticky truck load action bar */}
    {truckMode && selectedIds.size > 0 && (
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-3 bg-indigo-600 text-white shadow-2xl">
        <span className="text-sm font-medium">
          {selectedIds.size} invoice{selectedIds.size !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={() => setShowLoadSheet(true)}
          className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors"
        >
          <Truck size={15} />
          View Load Sheet
        </button>
      </div>
    )}

    {showLoadSheet && (
      <TruckLoadSheet
        invoices={selectedInvoices}
        onClose={() => setShowLoadSheet(false)}
      />
    )}

    {pendingInvoice && (
      <DeletePasswordModal
        invoiceNo={pendingInvoice.invoiceNo}
        customerName={pendingInvoice.customerSnapshot.name}
        invoiceDate={pendingInvoice.invoiceDate}
        grandTotal={pendingInvoice.grandTotal}
        paymentMode={pendingInvoice.paymentMode}
        onConfirm={() => {
          cancelInvoice(pendingInvoice.id);
          setPendingCancelId(null);
        }}
        onCancel={() => setPendingCancelId(null)}
      />
    )}

    {showRevenuePasswordModal && (
      <DeletePasswordModal
        invoiceNo=""
        title="View Total Revenue"
        description="Enter the 4-digit password to view total revenue."
        skipConfirmStep
        onConfirm={() => {
          setRevenueVisible(true);
          setShowRevenuePasswordModal(false);
        }}
        onCancel={() => setShowRevenuePasswordModal(false)}
      />
    )}

    {pendingPaymentModeInvoice && (
      <DeletePasswordModal
        invoiceNo={pendingPaymentModeInvoice.invoiceNo}
        title="Change Payment Mode"
        description={
          `Switch invoice ${pendingPaymentModeInvoice.invoiceNo} from ${pendingPaymentModeInvoice.paymentMode} to ${pendingPaymentModeInvoice.paymentMode === 'Cash' ? 'Credit' : 'Cash'}. Enter the 4-digit password to confirm.`
        }
        onConfirm={() => {
          updateInvoicePaymentMode(pendingPaymentModeInvoice.id, pendingPaymentModeInvoice.paymentMode === 'Cash' ? 'Credit' : 'Cash');
          setPendingPaymentModeId(null);
        }}
        onCancel={() => setPendingPaymentModeId(null)}
      />
    )}
    </>
  );
}
