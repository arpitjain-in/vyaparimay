import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate, isValidDDMMYYYY } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import Layout from '../Layout/Layout';
import ExpensePasswordModal from './ExpensePasswordModal';
import Modal from '../common/Modal';

export default function ExpensePage() {
  const { expenses, addExpense, deleteExpense, orgId } = useStore();
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    date: formatDate(new Date()),
    notes: '',
  });

  useEffect(() => {
    // Get current user ID from auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
      }
    });
  }, []);

  const handlePasswordConfirm = () => {
    setPasswordVerified(true);
  };

  const handlePasswordCancel = () => {
    // Navigate back to dashboard
    useStore.getState().navigate('dashboard');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid expense amount');
      return;
    }

    if (!isValidDDMMYYYY(formData.date)) {
      alert('Please enter a valid date in DD/MM/YYYY format');
      return;
    }

    if (!formData.notes.trim()) {
      alert('Please enter a description for this expense');
      return;
    }

    if (!userId) {
      alert('Unable to determine current user. Please refresh and try again.');
      return;
    }

    // Format time as HH:MM
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    addExpense(amount, formData.date, time, formData.notes.trim(), userId);

    // Reset form
    setFormData({
      amount: '',
      date: formatDate(new Date()),
      notes: '',
    });
    setShowForm(false);

    alert('Expense added successfully!');
  };

  const handleDeleteClick = (id: string) => {
    setSelectedExpenseId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (selectedExpenseId) {
      deleteExpense(selectedExpenseId);
      setShowDeleteConfirm(false);
      setSelectedExpenseId(null);
    }
  };

  if (!passwordVerified) {
    return <ExpensePasswordModal onConfirm={handlePasswordConfirm} onCancel={handlePasswordCancel} />;
  }

  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = new Date(a.date.split('/').reverse().join('-'));
    const dateB = new Date(b.date.split('/').reverse().join('-'));
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <Layout title="Expense Log" subtitle="Password Protected">
      {/* Add Expense Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Expense Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  pattern="\d{2}/\d{2}/\d{4}"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Describe this expense"
                  required
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                Save Expense
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add button in header */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Add Expense
        </button>
      </div>

      {/* Expenses List */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Expenses
          {expenses.length > 0 && (
            <span className="text-slate-500 font-normal text-sm ml-2">({expenses.length})</span>
          )}
        </h2>

        {expenses.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <AlertCircle size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-600 font-medium">No expenses recorded yet</p>
            <p className="text-sm text-slate-500 mt-1">Add your first expense to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sortedExpenses.map(expense => (
              <div key={expense.id} className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between hover:shadow-lg transition-shadow">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold text-indigo-600">
                        ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-slate-500">
                        {expense.date} at {expense.time}
                      </div>
                      {expense.notes && (
                        <div className="text-sm text-slate-700 mt-1">{expense.notes}</div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClick(expense.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-4"
                  title="Delete expense"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        title="Delete Expense"
        onClose={() => setShowDeleteConfirm(false)}
      >
        <p className="text-slate-600">Are you sure you want to delete this expense? This action cannot be undone.</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
