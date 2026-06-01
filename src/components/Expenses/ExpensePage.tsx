import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
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
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    date: formatDate(new Date()),
    notes: '',
  });

  // Inline validation errors
  const [errors, setErrors] = useState({ amount: '', date: '', notes: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

  const handlePasswordConfirm = () => setPasswordVerified(true);
  const handlePasswordCancel = () => useStore.getState().navigate('dashboard');

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    const newErrors = { amount: '', date: '', notes: '' };

    if (!formData.amount || isNaN(amount) || amount <= 0)
      newErrors.amount = 'Enter a valid amount greater than 0';

    if (!isValidDDMMYYYY(formData.date))
      newErrors.date = 'Enter a valid date in DD/MM/YYYY format';

    if (!formData.notes.trim())
      newErrors.notes = 'Description is required';

    if (newErrors.amount || newErrors.date || newErrors.notes) {
      setErrors(newErrors);
      return;
    }

    if (!userId) {
      setErrors({ ...newErrors, amount: 'Session expired — please refresh and try again' });
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    addExpense(amount, formData.date, time, formData.notes.trim(), userId);

    setFormData({ amount: '', date: formatDate(new Date()), notes: '' });
    setErrors({ amount: '', date: '', notes: '' });
    setShowForm(false);
    setSuccessMsg('Expense saved successfully');
    setTimeout(() => setSuccessMsg(''), 3000);
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
      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Add Expense Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New Expense</h2>
          <form onSubmit={handleAddExpense} noValidate className="space-y-4">
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
                  onChange={e => {
                    setFormData({ ...formData, amount: e.target.value });
                    if (errors.amount) setErrors({ ...errors, amount: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${errors.amount ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
                {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="DD/MM/YYYY"
                  value={formData.date}
                  onChange={e => {
                    setFormData({ ...formData, date: e.target.value });
                    if (errors.date) setErrors({ ...errors, date: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${errors.date ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
                {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date}</p>}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Describe this expense"
                  value={formData.notes}
                  onChange={e => {
                    setFormData({ ...formData, notes: e.target.value });
                    if (errors.notes) setErrors({ ...errors, notes: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none ${errors.notes ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                />
                {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes}</p>}
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
                onClick={() => { setShowForm(false); setErrors({ amount: '', date: '', notes: '' }); }}
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
          <>
            {/* Summary strip */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-indigo-700 font-medium">Total spent</span>
              <span className="text-lg font-bold text-indigo-700">
                ₹{sortedExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedExpenses.map(expense => (
                <div key={expense.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 flex flex-col hover:shadow-md transition-shadow relative group">
                  <button
                    onClick={() => handleDeleteClick(expense.id)}
                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete expense"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="text-xl font-extrabold text-indigo-600 leading-tight pr-6">
                    ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  {expense.notes && (
                    <div className="text-sm font-semibold text-slate-800 mt-1 line-clamp-2 leading-snug">{expense.notes}</div>
                  )}

                  <div className="text-xs text-slate-400 mt-auto pt-2">
                    {expense.date}
                    <span className="ml-1">{expense.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
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
