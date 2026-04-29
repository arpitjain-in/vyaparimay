import React, { useState } from 'react';
import { Search, Plus, Edit2, UserX, BookOpen, Wallet } from 'lucide-react';
import { useStore } from '../../store/useStore';
import Layout from '../Layout/Layout';
import AddPaymentModal from '../common/AddPaymentModal';

export default function CustomerList() {
  const { customers, navigate, deactivateCustomer } = useStore();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | null>(null);

  const filtered = customers.filter(c => {
    if (!showInactive && !c.active) return false;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      (c.firmName?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <Layout
      title="Customers"
      actions={
        <button
          onClick={() => navigate('customer-form')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} /> Add Customer
        </button>
      }
    >
      {paymentCustomerId && (
        <AddPaymentModal
          customerId={paymentCustomerId}
          customerName={customers.find(c => c.id === paymentCustomerId)?.name}
          onClose={() => setPaymentCustomerId(null)}
        />
      )}
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, mobile, city or Customer ID..."
            className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {customers.length === 0
              ? 'No customers yet. Add your first customer!'
              : 'No customers match your search.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['ID', 'Name / Firm', 'Mobile', 'City', 'Type', 'Terms', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600">{c.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{c.name}</div>
                    {c.firmName && <div className="text-xs text-gray-400">{c.firmName}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.mobile}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">{c.customerType}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.paymentTerms}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate('customer-ledger', { customerId: c.id })}
                        className="text-indigo-500 hover:text-indigo-700" title="Ledger"
                      >
                        <BookOpen size={15} />
                      </button>
                      <button
                        onClick={() => setPaymentCustomerId(c.id)}
                        className="text-green-600 hover:text-green-800" title="Receive Payment"
                      >
                        <Wallet size={15} />
                      </button>
                      <button
                        onClick={() => navigate('customer-form', { editCustomerId: c.id })}
                        className="text-gray-500 hover:text-gray-700" title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      {c.active && (
                        <button
                          onClick={() => {
                            if (confirm(`Deactivate ${c.name}?`)) deactivateCustomer(c.id);
                          }}
                          className="text-red-400 hover:text-red-600" title="Deactivate"
                        >
                          <UserX size={15} />
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
      <div className="mt-2 text-xs text-gray-400">{filtered.length} customer(s) shown</div>
    </Layout>
  );
}
