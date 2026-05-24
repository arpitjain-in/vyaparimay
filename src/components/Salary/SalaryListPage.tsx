import React, { useState } from 'react';
import { Plus, UserCheck, IndianRupee, Calendar, ChevronRight, UserX } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate, isValidDDMMYYYY } from '../../utils/format';
import Layout from '../Layout/Layout';
import Modal from '../common/Modal';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SalaryListPage() {
  const { employees, employeeAdvances, salaryRecords, addEmployee, navigate } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: '',
    monthlySalary: '',
    employmentStartDate: formatDate(new Date()),
  });
  const [errors, setErrors] = useState({ name: '', role: '', monthlySalary: '', employmentStartDate: '' });

  const activeEmployees = employees.filter(e => e.isActive);
  const currentMonth = getCurrentMonth();

  function getPendingAdvance(employeeId: string): number {
    const totalGiven = employeeAdvances
      .filter(a => a.employeeId === employeeId)
      .reduce((sum, a) => sum + a.amount, 0);
    const totalDeducted = salaryRecords
      .filter(r => r.employeeId === employeeId)
      .reduce((sum, r) => sum + r.advanceDeducted, 0);
    return Math.max(0, totalGiven - totalDeducted);
  }

  function getMonthStatus(employeeId: string): 'unpaid' | 'partial' | 'paid' {
    const record = salaryRecords.find(r => r.employeeId === employeeId && r.month === currentMonth);
    if (!record) return 'unpaid';
    if (record.amountPaid >= record.netPayable) return 'paid';
    if (record.amountPaid > 0) return 'partial';
    return 'unpaid';
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const salary = parseFloat(form.monthlySalary);
    const newErrors = { name: '', role: '', monthlySalary: '', employmentStartDate: '' };

    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!isValidDDMMYYYY(form.employmentStartDate))
      newErrors.employmentStartDate = 'Enter a valid date in DD/MM/YYYY format';
    if (!form.monthlySalary || isNaN(salary) || salary <= 0)
      newErrors.monthlySalary = 'Enter a valid salary greater than 0';

    if (Object.values(newErrors).some(Boolean)) { setErrors(newErrors); return; }

    addEmployee({
      name: form.name.trim(),
      role: form.role.trim(),
      monthlySalary: salary,
      employmentStartDate: form.employmentStartDate,
      isActive: true,
      createdBy: '',
    });
    setForm({ name: '', role: '', monthlySalary: '', employmentStartDate: formatDate(new Date()) });
    setErrors({ name: '', role: '', monthlySalary: '', employmentStartDate: '' });
    setShowForm(false);
  };

  const statusBadge = (status: 'unpaid' | 'partial' | 'paid') => {
    if (status === 'paid') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Paid</span>;
    if (status === 'partial') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Partial</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Pending</span>;
  };

  return (
    <Layout title="Salary Management" subtitle="Employee salaries, leaves & advances">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      {activeEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <UserCheck size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-600 font-medium">No employees added yet</p>
          <p className="text-sm text-slate-500 mt-1">Add your first employee to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {activeEmployees.map(emp => {
            const pending = getPendingAdvance(emp.id);
            const status = getMonthStatus(emp.id);
            return (
              <button
                key={emp.id}
                onClick={() => navigate('salary-detail', { employeeId: emp.id })}
                className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4 hover:shadow-lg hover:border-indigo-100 border border-transparent transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-indigo-700 font-bold text-sm">
                    {emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{emp.name}</span>
                    {emp.role && <span className="text-xs text-slate-500">{emp.role}</span>}
                    {statusBadge(status)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                      <IndianRupee size={13} />
                      {emp.monthlySalary.toLocaleString('en-IN')}/mo
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Calendar size={12} />
                      Since {emp.employmentStartDate}
                    </span>
                    {pending > 0 && (
                      <span className="text-xs text-amber-600 font-medium">
                        Advance pending: ₹{pending.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Inactive employees */}
      {employees.filter(e => !e.isActive).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <UserX size={14} /> Inactive
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {employees.filter(e => !e.isActive).map(emp => (
              <button
                key={emp.id}
                onClick={() => navigate('salary-detail', { employeeId: emp.id })}
                className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 hover:shadow-md border border-slate-100 transition-all text-left opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-slate-400 font-bold text-xs">
                    {emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-600 text-sm">{emp.name}</span>
                  {emp.role && <span className="text-xs text-slate-400 ml-2">{emp.role}</span>}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal open={showForm} title="Add Employee" onClose={() => { setShowForm(false); setErrors({ name: '', role: '', monthlySalary: '', employmentStartDate: '' }); }}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Employee name"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role / Designation</label>
            <input
              type="text"
              placeholder="e.g. Machine Operator"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary (₹) <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="12000"
                value={form.monthlySalary}
                onChange={e => { setForm(f => ({ ...f, monthlySalary: e.target.value })); setErrors(er => ({ ...er, monthlySalary: '' })); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${errors.monthlySalary ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              />
              {errors.monthlySalary && <p className="mt-1 text-xs text-red-600">{errors.monthlySalary}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date <span className="text-red-500">*</span></label>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={form.employmentStartDate}
                onChange={e => { setForm(f => ({ ...f, employmentStartDate: e.target.value })); setErrors(er => ({ ...er, employmentStartDate: '' })); }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${errors.employmentStartDate ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              />
              {errors.employmentStartDate && <p className="mt-1 text-xs text-red-600">{errors.employmentStartDate}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setErrors({ name: '', role: '', monthlySalary: '', employmentStartDate: '' }); }}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
            >
              Add Employee
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
