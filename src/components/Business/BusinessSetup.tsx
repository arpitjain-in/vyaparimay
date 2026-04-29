import React, { useState } from 'react';
import { Store } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { BusinessProfile } from '../../types';
import { INDIAN_STATES } from '../../data/products';

const EMPTY: BusinessProfile = {
  name: '', address1: '', address2: '', city: '', state: '',
  pinCode: '', gstin: '', fssai: '', mobile: '',
  email: '', tagline: '', bankName: '', accountNo: '', ifscCode: '', upiId: '',
  gstEnabled: false,
};

// Defined outside the component so React doesn't treat it as a new type on each render
function Field({
  label, field, required, placeholder, hint, form, errors, onChange,
}: {
  label: string;
  field: keyof BusinessProfile;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  form: BusinessProfile;
  errors: Record<string, string>;
  onChange: (k: keyof BusinessProfile) => React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        value={(form[field] as string) ?? ''}
        onChange={onChange(field)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors[field] ? 'border-red-400' : 'border-gray-300'}`}
      />
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {errors[field] && <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p>}
    </div>
  );
}

export default function BusinessSetup() {
  const { businessProfile, setBusinessProfile } = useStore();
  const [form, setForm] = useState<BusinessProfile>(businessProfile ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim())    errs.name    = 'Business name is required';
    if (!form.address1.trim())errs.address1= 'Address is required';
    if (!form.city.trim())    errs.city    = 'City is required';
    if (!form.state)          errs.state   = 'State is required';
    if (!form.pinCode.trim()) errs.pinCode = 'PIN code is required';
    if (!form.gstin.trim())   errs.gstin   = 'GSTIN is required';
    if (!form.fssai.trim())   errs.fssai   = 'FSSAI number is required';
    if (!form.mobile.trim())  errs.mobile  = 'Mobile number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setBusinessProfile(form);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="bg-indigo-600 rounded-t-2xl px-8 py-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <Store size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">Business Setup</h1>
            <p className="text-indigo-200 text-sm">Configure your flour mill details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Business Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Field label="Business / Mill Name" field="name" required placeholder="e.g. Shree Ram Flour Mill" form={form} errors={errors} onChange={set} /></div>
              <div className="col-span-2"><Field label="Address Line 1" field="address1" required placeholder="Street / Area" form={form} errors={errors} onChange={set} /></div>
              <Field label="Address Line 2" field="address2" placeholder="Landmark (optional)" form={form} errors={errors} onChange={set} />
              <Field label="City" field="city" required placeholder="City" form={form} errors={errors} onChange={set} />
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
              <Field label="PIN Code" field="pinCode" required placeholder="6-digit PIN" form={form} errors={errors} onChange={set} />
            </div>
          </section>

          {/* Legal / Tax */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Legal & Tax</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GSTIN" field="gstin" required placeholder="27ABCDE1234F1Z5" hint="15-character GST Identification Number" form={form} errors={errors} onChange={set} />
              <Field label="FSSAI Number" field="fssai" required placeholder="14-digit FSSAI license" form={form} errors={errors} onChange={set} />
              <div className="col-span-2 flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-medium text-gray-700">Enable GST on Invoices</div>
                  <div className="text-xs text-gray-400">When disabled, invoices will not include GST / tax calculations</div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, gstEnabled: !p.gstEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.gstEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.gstEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <Field label="Mobile Number" field="mobile" required placeholder="10-digit mobile" form={form} errors={errors} onChange={set} />
              <Field label="Email" field="email" placeholder="Optional" form={form} errors={errors} onChange={set} />
            </div>
          </section>

          {/* Bank */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Details (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name" field="bankName" placeholder="e.g. SBI" form={form} errors={errors} onChange={set} />
              <Field label="Account Number" field="accountNo" placeholder="Account number" form={form} errors={errors} onChange={set} />
              <Field label="IFSC Code" field="ifscCode" placeholder="SBIN0001234" form={form} errors={errors} onChange={set} />
              <Field label="UPI ID" field="upiId" placeholder="mill@upi" form={form} errors={errors} onChange={set} />
            </div>
          </section>

          {/* Tagline */}
          <Field label="Business Tagline" field="tagline" placeholder="e.g. Quality Flour for Every Home" form={form} errors={errors} onChange={set} />

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {businessProfile ? 'Update Settings' : 'Save & Get Started →'}
          </button>
        </form>
      </div>
    </div>
  );
}
