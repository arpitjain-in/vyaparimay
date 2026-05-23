import React, { useRef, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface DeletePasswordModalProps {
  invoiceNo: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

const PASSWORD = import.meta.env.VITE_INVOICE_DELETE_PASSWORD as string;

export default function DeletePasswordModal({ invoiceNo, onConfirm, onCancel, title, description }: DeletePasswordModalProps) {
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
        onConfirm();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
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

        {/* PIN inputs */}
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
