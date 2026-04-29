import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Customer, CustomerType, PaymentTerms } from '../../types';
import { INDIAN_STATES } from '../../data/products';
import Layout from '../Layout/Layout';

type FormData = Omit<Customer, 'id' | 'createdOn' | 'active'>;

const EMPTY: FormData = {
  name: '', firmName: '', mobile: '', alternateMobile: '',
  address1: '', address2: '', city: '', state: '', pinCode: '',
  gstin: '', fssai: '', customerType: 'Retailer',
  creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0, notes: '',
};

const CUSTOMER_TYPES: CustomerType[] = ['Retailer', 'Wholesaler', 'Distributor', 'Direct Consumer'];
const PAYMENT_TERMS: PaymentTerms[] = ['Cash', '7 Days', '15 Days', '30 Days'];

// Defined outside the parent so React doesn't remount the input on every keystroke
function F({
  label, k, required = false, type = 'text', placeholder = '',
  form, errors, onChange,
}: {
  label: string;
  k: keyof FormData;
  required?: boolean;
  type?: string;
  placeholder?: string;
  form: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  onChange: (k: keyof FormData) => React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={String(form[k] ?? '')}
        onChange={onChange(k)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[k] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {errors[k] && <p className="text-xs text-red-500 mt-0.5">{errors[k]}</p>}
    </div>
  );
}

export default function CustomerForm() {
  const { editCustomerId, customers, addCustomer, updateCustomer, navigate } = useStore();
  const existing = customers.find(c => c.id === editCustomerId);

  const [form, setForm] = useState<FormData>(existing
    ? { name: existing.name, firmName: existing.firmName ?? '', mobile: existing.mobile,
        alternateMobile: existing.alternateMobile ?? '', address1: existing.address1,
        address2: existing.address2 ?? '', city: existing.city, state: existing.state,
        pinCode: existing.pinCode ?? '', gstin: existing.gstin ?? '', fssai: existing.fssai ?? '',
        customerType: existing.customerType, creditLimit: existing.creditLimit,
        paymentTerms: existing.paymentTerms, openingBalance: existing.openingBalance,
        notes: existing.notes ?? '' }
    : EMPTY
  );
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(false); }, [editCustomerId]);

  const set = (k: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validate = () => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim())     errs.name     = 'Required';
    if (!form.mobile.trim())   errs.mobile   = 'Required';
    if (!form.address1.trim()) errs.address1 = 'Required';
    if (!form.city.trim())     errs.city     = 'Required';
    if (!form.state)           errs.state    = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (existing) {
      updateCustomer(existing.id, form);
      setSaved(true);
    } else {
      addCustomer(form);
      navigate('customer-list');
    }
  };

  return (
    <Layout
      title={existing ? 'Edit Customer' : 'Add Customer'}
      actions={
        <button
          onClick={() => navigate('customer-list')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
      }
    >
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="Customer Name" k="name" required placeholder="Full name" form={form} errors={errors} onChange={set} />
              <F label="Business / Firm Name" k="firmName" placeholder="Firm (optional)" form={form} errors={errors} onChange={set} />
              <F label="Mobile Number" k="mobile" required placeholder="10-digit mobile" form={form} errors={errors} onChange={set} />
              <F label="Alternate Mobile" k="alternateMobile" placeholder="Optional" form={form} errors={errors} onChange={set} />
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><F label="Address Line 1" k="address1" required placeholder="Street / Area" form={form} errors={errors} onChange={set} /></div>
              <F label="Address Line 2" k="address2" placeholder="Landmark (optional)" form={form} errors={errors} onChange={set} />
              <F label="City" k="city" required form={form} errors={errors} onChange={set} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <select
                  value={form.state}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.state ? 'border-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.state && <p className="text-xs text-red-500 mt-0.5">{errors.state}</p>}
              </div>
              <F label="PIN Code" k="pinCode" placeholder="6-digit PIN" form={form} errors={errors} onChange={set} />
            </div>
          </div>

          {/* Tax / Legal */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Tax & Legal</h3>
            <div className="grid grid-cols-2 gap-4">
              <F label="GSTIN" k="gstin" placeholder="15-char GSTIN (if B2B)" form={form} errors={errors} onChange={set} />
              <F label="FSSAI Number" k="fssai" placeholder="If food business" form={form} errors={errors} onChange={set} />
            </div>
          </div>

          {/* Business Terms */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-4">Business Terms</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Type</label>
                <select
                  value={form.customerType}
                  onChange={e => setForm(p => ({ ...p, customerType: e.target.value as CustomerType }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={form.paymentTerms}
                  onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value as PaymentTerms }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                <input
                  type="number" min="0"
                  value={form.creditLimit}
                  onChange={e => setForm(p => ({ ...p, creditLimit: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                <input
                  type="number" min="0"
                  value={form.openingBalance}
                  onChange={e => setForm(p => ({ ...p, openingBalance: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <p className="text-xs text-gray-400 mt-0.5">Outstanding from before if any</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-700 mb-3">Notes</h3>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="Optional remarks..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2"
            >
              <Save size={16} /> {existing ? 'Save Changes' : 'Add Customer'}
            </button>
            <button
              type="button"
              onClick={() => navigate('customer-list')}
              className="text-gray-600 border border-gray-300 hover:bg-gray-50 px-5 py-2.5 rounded-lg text-sm"
            >
              Cancel
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">✓ Saved!</span>}
          </div>
        </form>
      </div>
    </Layout>
  );
}
