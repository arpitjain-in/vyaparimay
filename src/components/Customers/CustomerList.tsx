import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit2, UserX, BookOpen, Wallet, Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, TrendingUp, IndianRupee } from 'lucide-react';
import { useStore } from '../../store/useStore';
import Layout from '../Layout/Layout';
import AddPaymentModal from '../common/AddPaymentModal';
import DeletePasswordModal from '../Invoices/DeletePasswordModal';
import * as db from '../../lib/db';
import { FIXED_ORG_ID } from '../../lib/db';
import { fmtINR } from '../../utils/format';
import type { Customer } from '../../types';

const PAGE_SIZE = 25;

export default function CustomerList() {
  const { orgId, navigate, showDialog, invoices, paymentReceipts, customers: allCustomers } = useStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);
  const [pendingPaymentCustomerId, setPendingPaymentCustomerId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadPage = useCallback(async (pageNum: number) => {
    const activeOrgId = orgId ?? FIXED_ORG_ID;
    setLoading(true);
    setError(null);
    try {
      const { customers: data, totalCount: count } = await db.loadCustomersPaginated(
        activeOrgId, pageNum, PAGE_SIZE, debouncedSearch, showInactive,
      );
      setCustomers(data);
      setTotalCount(count);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [orgId, debouncedSearch, showInactive]);

  useEffect(() => { loadPage(1); }, [loadPage]);

  const handleDeactivate = async (customer: Customer) => {
    if (!confirm(`Deactivate ${customer.name}?`)) return;
    setDeactivating(customer.id);
    try {
      await db.updateCustomerInDb(orgId ?? FIXED_ORG_ID, customer.id, { active: false });
      await loadPage(page);
    } catch (err) {
      showDialog({ title: 'Deactivation Failed', variant: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeactivating(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const totalDues = allCustomers.reduce((sum, c) => sum + c.openingBalance, 0)
    + invoices.filter(i => !i.cancelled).reduce((sum, i) => sum + i.grandTotal, 0);
  const totalReceived = paymentReceipts.reduce((sum, r) => sum + r.amount, 0);
  const totalOutstanding = totalDues - totalReceived;

  return (
    <Layout
      title="Customers"
      actions={
        <button
          onClick={() => navigate('customer-form')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm shadow-indigo-200"
        >
          <Plus size={16} /> Add Customer
        </button>
      }
    >
      {paymentCustomerId && (
        <AddPaymentModal
          customerId={paymentCustomerId}
          customerName={customers.find(c => c.id === paymentCustomerId)?.name}
          onClose={() => { setPaymentCustomerId(null); loadPage(page); }}
        />
      )}

      {pendingPaymentCustomerId && (
        <DeletePasswordModal
          invoiceNo={pendingPaymentCustomerId}
          title="Add Payment"
          description={`You are about to record a payment received from ${customers.find(c => c.id === pendingPaymentCustomerId)?.name ?? pendingPaymentCustomerId}. Enter the 4-digit password to continue.`}
          skipConfirmStep
          onConfirm={() => {
            setPaymentCustomerId(pendingPaymentCustomerId);
            setPendingPaymentCustomerId(null);
          }}
          onCancel={() => setPendingPaymentCustomerId(null)}
        />
      )}

      {/* Summary Totals */}
      {/* <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Dues (Selling)</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{fmtINR(totalDues)}</div>
          <div className="text-xs text-slate-400 mt-1">Opening balance + all invoices</div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-green-500 mb-1">
            <IndianRupee size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Received</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{fmtINR(totalReceived)}</div>
          <div className="text-xs text-slate-400 mt-1">All payments collected</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${totalOutstanding > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className={`flex items-center gap-2 mb-1 ${totalOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            <IndianRupee size={16} />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Outstanding</span>
          </div>
          <div className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {fmtINR(Math.abs(totalOutstanding))}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {totalOutstanding > 0 ? 'Balance due from all customers' : totalOutstanding < 0 ? 'Net advance received' : 'All settled'}
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, firm name, mobile, city or Customer ID..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
        <button
          onClick={() => loadPage(page)}
          disabled={loading}
          className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading customers…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
          <button onClick={() => loadPage(page)} className="ml-auto underline text-red-600 hover:text-red-800">Retry</button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {customers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              {totalCount === 0
                ? 'No customers yet. Add your first customer!'
                : 'No customers match your search.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['ID', 'Name / Firm', 'Mobile', 'City', 'Type', 'Terms', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-indigo-500 font-semibold">{c.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.name}</div>
                      {c.firmName && <div className="text-xs text-slate-400">{c.firmName}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">{c.city}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 font-medium">{c.customerType}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.paymentTerms}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate('customer-ledger', { customerId: c.id })}
                          className="text-indigo-400 hover:text-indigo-600 transition-colors" title="Ledger"
                        >
                          <BookOpen size={15} />
                        </button>
                        <button
                          onClick={() => setPendingPaymentCustomerId(c.id)}
                          className="text-emerald-500 hover:text-emerald-700 transition-colors" title="Receive Payment"
                        >
                          <Wallet size={15} />
                        </button>
                        <button
                          onClick={() => navigate('customer-form', { editCustomerId: c.id })}
                          className="text-slate-400 hover:text-slate-600 transition-colors" title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        {c.active && (
                          <button
                            onClick={() => handleDeactivate(c)}
                            disabled={deactivating === c.id}
                            className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50" title="Deactivate"
                          >
                            {deactivating === c.id
                              ? <Loader2 size={15} className="animate-spin" />
                              : <UserX size={15} />}
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
      )}

      {!loading && !error && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {totalCount} customer{totalCount !== 1 ? 's' : ''} total
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-500 px-1">Page {page} of {totalPages}</span>
              <button
                onClick={() => loadPage(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
