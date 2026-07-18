import React, { useRef, useState } from 'react';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { fmtINR } from '../../utils/format';

interface DeletePasswordModalProps {
  invoiceNo: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  customerName?: string;
  invoiceDate?: string;
  grandTotal?: number;
  paymentMode?: string;
  skipConfirmStep?: boolean;
}

const PASSWORD = import.meta.env.VITE_INVOICE_DELETE_PASSWORD as string;

export default function DeletePasswordModal({
  invoiceNo,
  onConfirm,
  onCancel,
  title,
  description,
  customerName,
  invoiceDate,
  grandTotal,
  paymentMode,
  skipConfirmStep,
}: DeletePasswordModalProps) {
  const [step, setStep] = useState<'password' | 'confirm'>('password');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (next.every(d => d !== '') && value) {
      const entered = next.join('');
      if (entered === PASSWORD) {
        if (skipConfirmStep) {
          onConfirm();
        } else {
          setStep('confirm');
        }
      } else {
        setError('Incorrect password. Try again.');
        setDigits(['', '', '', '']);
        setTimeout(() => inputRefs[0].current?.focus(), 50);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              <span className="font-semibold text-base">Confirm {title ?? 'Cancel Invoice'}</span>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            {description
              ? description
              : <>Are you sure you want to cancel this invoice? This action cannot be undone.</>
            }
          </p>

          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Invoice No</span>
              <span className="font-semibold text-indigo-600 font-mono">{invoiceNo}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-slate-400">Customer</span>
                <span className="font-medium text-slate-700">{customerName}</span>
              </div>
            )}
            {invoiceDate && (
              <div className="flex justify-between">
                <span className="text-slate-400">Date</span>
                <span className="text-slate-600">{invoiceDate}</span>
              </div>
            )}
            {grandTotal !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span>
                <span className="font-bold text-slate-800">{fmtINR(grandTotal)}</span>
              </div>
            )}
            {paymentMode && (
              <div className="flex justify-between">
                <span className="text-slate-400">Payment</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>{paymentMode}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('password'); setDigits(['', '', '', '']); }}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              Confirm Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldAlert size={20} />
            <span className="font-semibold text-base">{title ?? 'Cancel Invoice'}</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-6">
          {description ?? (
            <>
              You are about to cancel invoice{' '}
              <span className="font-semibold text-slate-700">{invoiceNo}</span>.{' '}
              Enter the 4-digit password to confirm.
            </>
          )}
        </p>

        <div className="flex justify-center gap-3 mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              autoFocus={i === 0}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors ${
                error
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200 focus:border-indigo-500 bg-slate-50'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-xs text-red-500 mb-4">{error}</p>
        )}

        <button
          onClick={onCancel}
          className="w-full mt-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
