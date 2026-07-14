import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, Trash2, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle, Edit2, UserX, UserCheck,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate, isValidDDMMYYYY } from '../../utils/format';
import Layout from '../Layout/Layout';
import Modal from '../common/Modal';
import { PageLoadingState, PageErrorState } from '../common/PageLoadingState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Check if a DD/MM/YYYY date falls within a given YYYY-MM month
function inMonth(date: string, ym: string): boolean {
  const [dd, mm, yyyy] = date.split('/');
  return `${yyyy}-${mm}` === ym;
}

// ─── Reusable row ─────────────────────────────────────────────────────────────

function CalcRow({ label, value, highlight, deduction, indent }: {
  label: string; value: string; highlight?: boolean; deduction?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-slate-900 text-base' : deduction ? 'text-red-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalaryDetailPage() {
  const {
    employees, employeeLeaves, employeeAdvances, salaryRecords,
    selectedEmployeeId, navigate,
    addEmployeeLeave, deleteEmployeeLeave,
    addEmployeeAdvance, deleteEmployeeAdvance,
    upsertSalaryRecord, updateEmployee,
    loadSalaryDataForPage,
  } = useStore();

  const employee = employees.find(e => e.id === selectedEmployeeId);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    loadSalaryDataForPage()
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load salary data'))
      .finally(() => setLoading(false));
  }, []);

  const [month, setMonth] = useState(currentYM());
  const [successMsg, setSuccessMsg] = useState('');

  // ── Leave form state ──
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ date: formatDate(new Date()), isHalfDay: false, notes: '' });
  const [leaveErrors, setLeaveErrors] = useState({ date: '' });

  // ── Advance form state ──
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advForm, setAdvForm] = useState({ amount: '', date: formatDate(new Date()), notes: '' });
  const [advErrors, setAdvErrors] = useState({ amount: '', date: '' });

  // ── Delete confirm modals ──
  const [deleteLeaveId, setDeleteLeaveId] = useState<string | null>(null);
  const [deleteAdvId, setDeleteAdvId] = useState<string | null>(null);

  // ── Salary section state ──
  const [advDeductInput, setAdvDeductInput] = useState('');
  const [bonusInput, setBonusInput] = useState('');
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [salaryNotes, setSalaryNotes] = useState('');
  const [editSalary, setEditSalary] = useState(false);

  // ── Edit employee ──
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: '', monthlySalary: '' });

  if (loading) {
    return (
      <Layout title="Salary Detail" subtitle="">
        <PageLoadingState />
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout title="Salary Detail" subtitle="">
        <PageErrorState message={loadError} />
      </Layout>
    );
  }

  if (!employee) {
    return (
      <Layout title="Salary Detail" subtitle="">
        <div className="text-center py-16">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Employee not found.</p>
          <button onClick={() => navigate('salary-list')} className="mt-4 text-indigo-600 text-sm hover:underline">← Back to Salary</button>
        </div>
      </Layout>
    );
  }

  // emp is guaranteed non-undefined after the guard above; used in inner function closures
  // where TypeScript control-flow narrowing doesn't propagate.
  const emp = employee;

  // ── Derived data ──
  const [ymYear, ymMonth] = month.split('-').map(Number);
  const daysInMonth = getDaysInMonth(ymYear, ymMonth);
  const perDaySalary = employee.monthlySalary / daysInMonth;

  // Pro-rata: if employee joined this month, pay only for days from join date onwards.
  const [startDd, startMm, startYyyy] = employee.employmentStartDate.split('/').map(Number);
  const startYM = `${startYyyy}-${String(startMm).padStart(2, '0')}`;
  let workedDays = daysInMonth;
  let grossSalary = employee.monthlySalary;
  let isProRata = false;
  if (startYM === month) {
    workedDays = daysInMonth - startDd + 1;
    grossSalary = Math.round((employee.monthlySalary * workedDays / daysInMonth) * 100) / 100;
    isProRata = true;
  } else if (startYM > month) {
    // Employee hadn't joined yet
    workedDays = 0;
    grossSalary = 0;
    isProRata = true;
  }

  const monthLeaves = employeeLeaves.filter(l => l.employeeId === employee.id && inMonth(l.date, month));
  const allAdvances = employeeAdvances.filter(a => a.employeeId === employee.id)
    .sort((a, b) => new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime());

  const totalAdvancesGiven = employeeAdvances.filter(a => a.employeeId === employee.id).reduce((s, a) => s + a.amount, 0);
  const totalAdvancesDeducted = salaryRecords.filter(r => r.employeeId === employee.id).reduce((s, r) => s + r.advanceDeducted, 0);
  const pendingAdvanceBalance = Math.max(0, totalAdvancesGiven - totalAdvancesDeducted);

  const leaveDays = monthLeaves.reduce((s, l) => s + (l.isHalfDay ? 0.5 : 1), 0);
  const leaveDeduction = leaveDays * perDaySalary;

  const existingRecord = salaryRecords.find(r => r.employeeId === employee.id && r.month === month);

  // Compute display values
  const displayAdvDeduct = editSalary
    ? (parseFloat(advDeductInput) || 0)
    : (existingRecord?.advanceDeducted ?? 0);
  const displayBonus = editSalary
    ? (parseFloat(bonusInput) || 0)
    : (existingRecord?.bonusAmount ?? 0);
  const displayAmtPaid = editSalary
    ? (parseFloat(amountPaidInput) || 0)
    : (existingRecord?.amountPaid ?? 0);
  const netPayable = grossSalary - leaveDeduction - displayAdvDeduct + displayBonus;
  const remaining = netPayable - displayAmtPaid;

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  function openEditSalary() {
    setAdvDeductInput(String(existingRecord?.advanceDeducted ?? Math.min(pendingAdvanceBalance, 0)));
    setBonusInput(String(existingRecord?.bonusAmount ?? 0));
    setAmountPaidInput(String(existingRecord?.amountPaid ?? 0));
    setSalaryNotes(existingRecord?.notes ?? '');
    setEditSalary(true);
  }

  function handleSaveSalary() {
    const advDeduct = Math.max(0, Math.min(parseFloat(advDeductInput) || 0, pendingAdvanceBalance + (existingRecord?.advanceDeducted ?? 0)));
    const bonus = Math.max(0, parseFloat(bonusInput) || 0);
    const amtPaid = Math.max(0, parseFloat(amountPaidInput) || 0);
    const net = grossSalary - leaveDeduction - advDeduct + bonus;

    upsertSalaryRecord({
      employeeId: emp.id,
      month,
      grossSalary,
      workingDays: workedDays,
      leaveDays,
      leaveDeduction,
      advanceDeducted: advDeduct,
      bonusAmount: bonus,
      netPayable: net,
      amountPaid: amtPaid,
      notes: salaryNotes,
    });
    setEditSalary(false);
    flash('Salary record saved');
  }

  function handleAddLeave(e: React.FormEvent) {
    e.preventDefault();
    const err = { date: '' };
    if (!isValidDDMMYYYY(leaveForm.date)) err.date = 'Enter a valid date in DD/MM/YYYY format';
    if (err.date) { setLeaveErrors(err); return; }
    addEmployeeLeave(emp.id, leaveForm.date, leaveForm.isHalfDay, leaveForm.notes.trim());
    setLeaveForm({ date: formatDate(new Date()), isHalfDay: false, notes: '' });
    setLeaveErrors({ date: '' });
    setShowLeaveForm(false);
    flash('Leave marked');
  }

  function handleAddAdvance(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(advForm.amount);
    const err = { amount: '', date: '' };
    if (!advForm.amount || isNaN(amount) || amount <= 0) err.amount = 'Enter a valid amount';
    if (!isValidDDMMYYYY(advForm.date)) err.date = 'Enter a valid date in DD/MM/YYYY format';
    if (err.amount || err.date) { setAdvErrors(err); return; }
    addEmployeeAdvance(emp.id, amount, advForm.date, advForm.notes.trim());
    setAdvForm({ amount: '', date: formatDate(new Date()), notes: '' });
    setAdvErrors({ amount: '', date: '' });
    setShowAdvanceForm(false);
    flash('Advance recorded');
  }

  function openEditEmployee() {
    setEditForm({ name: emp.name, role: emp.role, monthlySalary: String(emp.monthlySalary) });
    setShowEditEmployee(true);
  }

  function handleEditEmployee(e: React.FormEvent) {
    e.preventDefault();
    const salary = parseFloat(editForm.monthlySalary);
    if (!editForm.name.trim() || isNaN(salary) || salary <= 0) return;
    updateEmployee(emp.id, { name: editForm.name.trim(), role: editForm.role.trim(), monthlySalary: salary });
    setShowEditEmployee(false);
    flash('Employee updated');
  }

  return (
    <Layout title={employee.name} subtitle={employee.role || 'Employee'}>
      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {/* Back + Employee header */}
      <div className="flex items-start gap-3 mb-5">
        <button onClick={() => navigate('salary-list')} className="mt-0.5 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{employee.name}</h2>
            {employee.role && <span className="text-sm text-slate-500">{employee.role}</span>}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${employee.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {employee.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
            <span>₹{employee.monthlySalary.toLocaleString('en-IN')}/month</span>
            <span>Since {employee.employmentStartDate}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openEditEmployee}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title="Edit employee"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={() => { updateEmployee(employee.id, { isActive: !employee.isActive }); flash(employee.isActive ? 'Employee deactivated' : 'Employee reactivated'); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            title={employee.isActive ? 'Deactivate' : 'Reactivate'}
          >
            {employee.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-3 mb-5">
        <button onClick={() => setMonth(prevMonth(month))} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold text-slate-800 text-base">{monthLabel(month)}</span>
        <button
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= currentYM()}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── LEFT COLUMN: Leave + Advances ── */}
        <div className="space-y-5">
          {/* Leave Tracker */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">Leave Tracker</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {leaveDays === 0 ? 'No leaves this month' : `${leaveDays} day${leaveDays !== 1 ? 's' : ''} (–₹${fmt(leaveDeduction)})`}
                </p>
              </div>
              <button
                onClick={() => setShowLeaveForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <Plus size={15} /> Mark Leave
              </button>
            </div>

            {showLeaveForm && (
              <form onSubmit={handleAddLeave} noValidate className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={leaveForm.date}
                      onChange={e => { setLeaveForm(f => ({ ...f, date: e.target.value })); setLeaveErrors({ date: '' }); }}
                      className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${leaveErrors.date ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                    />
                    {leaveErrors.date && <p className="mt-0.5 text-xs text-red-600">{leaveErrors.date}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setLeaveForm(f => ({ ...f, isHalfDay: false }))}
                        className={`flex-1 py-1.5 text-center transition-colors ${!leaveForm.isHalfDay ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaveForm(f => ({ ...f, isHalfDay: true }))}
                        className={`flex-1 py-1.5 text-center transition-colors ${leaveForm.isHalfDay ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        Half
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Optional reason"
                    value={leaveForm.notes}
                    onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">Save</button>
                  <button type="button" onClick={() => { setShowLeaveForm(false); setLeaveErrors({ date: '' }); }} className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              </form>
            )}

            {monthLeaves.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No leaves marked for {monthLabel(month)}</p>
            ) : (
              <div className="space-y-2">
                {monthLeaves.sort((a, b) => a.date.split('/').reverse().join('').localeCompare(b.date.split('/').reverse().join(''))).map(leave => (
                  <div key={leave.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                    <div>
                      <span className="text-sm font-medium text-slate-800">{leave.date}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${leave.isHalfDay ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {leave.isHalfDay ? 'Half Day' : 'Full Day'}
                      </span>
                      {leave.notes && <span className="ml-2 text-xs text-slate-500">{leave.notes}</span>}
                    </div>
                    <button
                      onClick={() => setDeleteLeaveId(leave.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advances */}
          <div className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-900">Advances</h3>
              <button
                onClick={() => setShowAdvanceForm(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
              >
                <Plus size={15} /> Add Advance
              </button>
            </div>
            <div className="mb-4">
              <span className="text-xs text-slate-500">Pending balance: </span>
              <span className={`text-sm font-semibold ${pendingAdvanceBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                ₹{fmt(pendingAdvanceBalance)}
              </span>
            </div>

            {showAdvanceForm && (
              <form onSubmit={handleAddAdvance} noValidate className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="5000"
                      value={advForm.amount}
                      onChange={e => { setAdvForm(f => ({ ...f, amount: e.target.value })); setAdvErrors(er => ({ ...er, amount: '' })); }}
                      className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${advErrors.amount ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                    />
                    {advErrors.amount && <p className="mt-0.5 text-xs text-red-600">{advErrors.amount}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={advForm.date}
                      onChange={e => { setAdvForm(f => ({ ...f, date: e.target.value })); setAdvErrors(er => ({ ...er, date: '' })); }}
                      className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${advErrors.date ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                    />
                    {advErrors.date && <p className="mt-0.5 text-xs text-red-600">{advErrors.date}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="Reason for advance"
                    value={advForm.notes}
                    onChange={e => setAdvForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">Save</button>
                  <button type="button" onClick={() => { setShowAdvanceForm(false); setAdvErrors({ amount: '', date: '' }); }} className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              </form>
            )}

            {allAdvances.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No advances recorded</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {allAdvances.map(adv => (
                  <div key={adv.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                    <div>
                      <span className="text-sm font-semibold text-amber-700">₹{fmt(adv.amount)}</span>
                      <span className="ml-2 text-xs text-slate-500">{adv.date}</span>
                      {adv.notes && <span className="ml-2 text-xs text-slate-500">— {adv.notes}</span>}
                    </div>
                    <button
                      onClick={() => setDeleteAdvId(adv.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Salary Calculation ── */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Monthly Salary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {monthLabel(month)} · {isProRata && workedDays > 0 ? `${workedDays}/${daysInMonth} days (pro-rata)` : `${daysInMonth} days`}
              </p>
            </div>
            {!editSalary && (
              <button
                onClick={openEditSalary}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <Edit2 size={14} /> {existingRecord ? 'Edit' : 'Process'}
              </button>
            )}
          </div>

          {/* Pro-rata notice */}
          {isProRata && workedDays > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
              <span className="font-semibold">Pro-rata month</span>
              <span>·</span>
              <span>Joined {employee.employmentStartDate} · {workedDays} of {daysInMonth} days worked</span>
            </div>
          )}
          {isProRata && workedDays === 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              Employee had not joined by {monthLabel(month)} — no salary applicable.
            </div>
          )}

          {/* Calculation breakdown */}
          <div className="divide-y divide-slate-100 mb-4">
            <CalcRow
              label={isProRata && workedDays > 0 ? `Gross Salary (pro-rata ${workedDays}/${daysInMonth} days)` : 'Gross Salary'}
              value={isProRata && workedDays > 0 ? `₹${fmt(grossSalary)}` : `₹${fmt(employee.monthlySalary)}`}
            />
            {isProRata && workedDays > 0 && (
              <CalcRow label={`Full Monthly Salary`} value={`₹${fmt(employee.monthlySalary)}`} indent />
            )}
            <CalcRow label={`Per Day Rate (÷${daysInMonth})`} value={`₹${fmt(perDaySalary)}`} indent />
            <CalcRow
              label={`Leave Deduction (${leaveDays} day${leaveDays !== 1 ? 's' : ''})`}
              value={leaveDays > 0 ? `–₹${fmt(leaveDeduction)}` : '₹0.00'}
              deduction={leaveDays > 0}
            />
            {editSalary ? (
              <div className="py-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Advance Deduction (pending: ₹{fmt(pendingAdvanceBalance + (existingRecord?.advanceDeducted ?? 0))})
                </label>
                <input
                  type="number"
                  min="0"
                  max={pendingAdvanceBalance + (existingRecord?.advanceDeducted ?? 0)}
                  step="1"
                  value={advDeductInput}
                  onChange={e => setAdvDeductInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
            ) : (
              <CalcRow
                label="Advance Deducted"
                value={displayAdvDeduct > 0 ? `–₹${fmt(displayAdvDeduct)}` : '₹0.00'}
                deduction={displayAdvDeduct > 0}
              />
            )}
            {editSalary ? (
              <div className="py-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Bonus / Extra Amount</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bonusInput}
                  onChange={e => setBonusInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
            ) : displayBonus > 0 ? (
              <CalcRow label="Bonus / Extra" value={`+₹${fmt(displayBonus)}`} />
            ) : null}
          </div>

          {/* Net payable */}
          <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-900">Net Payable</span>
              <span className="text-xl font-bold text-indigo-700">₹{fmt(netPayable)}</span>
            </div>
          </div>

          {/* Payment */}
          {editSalary ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amountPaidInput}
                  onChange={e => setAmountPaidInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={salaryNotes}
                  onChange={e => setSalaryNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveSalary} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                  Save Record
                </button>
                <button onClick={() => setEditSalary(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {existingRecord ? (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">Amount Paid</span>
                    <span className="text-sm font-semibold text-green-700">₹{fmt(existingRecord.amountPaid)}</span>
                  </div>
                  <div className={`flex items-center justify-between py-2 px-3 rounded-xl ${remaining > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <span className={`text-sm font-semibold ${remaining > 0 ? 'text-red-800' : 'text-green-800'}`}>
                      {remaining > 0 ? 'Remaining to Pay' : 'Fully Paid'}
                    </span>
                    <span className={`text-lg font-bold ${remaining > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {remaining > 0 ? `₹${fmt(remaining)}` : '₹0.00'}
                    </span>
                  </div>
                  {existingRecord.notes && (
                    <p className="text-xs text-slate-500 mt-1">{existingRecord.notes}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  Click <strong>Process</strong> to record salary payment for {monthLabel(month)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Leave Modal ── */}
      <Modal open={!!deleteLeaveId} title="Delete Leave" onClose={() => setDeleteLeaveId(null)}>
        <p className="text-slate-600">Remove this leave record? This will affect the salary calculation.</p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setDeleteLeaveId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { deleteEmployeeLeave(deleteLeaveId!); setDeleteLeaveId(null); flash('Leave deleted'); }} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </Modal>

      {/* ── Delete Advance Modal ── */}
      <Modal open={!!deleteAdvId} title="Delete Advance" onClose={() => setDeleteAdvId(null)}>
        <p className="text-slate-600">Remove this advance record? This will update the pending balance.</p>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setDeleteAdvId(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => { deleteEmployeeAdvance(deleteAdvId!); setDeleteAdvId(null); flash('Advance deleted'); }} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">Delete</button>
        </div>
      </Modal>

      {/* ── Edit Employee Modal ── */}
      <Modal open={showEditEmployee} title="Edit Employee" onClose={() => setShowEditEmployee(false)}>
        <form onSubmit={handleEditEmployee} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <input type="text" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary (₹)</label>
            <input type="number" min="0" value={editForm.monthlySalary} onChange={e => setEditForm(f => ({ ...f, monthlySalary: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowEditEmployee(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">Save</button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
