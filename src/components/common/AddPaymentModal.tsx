import React, { useState } from 'react';
import { Wallet, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate, isValidDDMMYYYY } from '../../utils/format';
import { PaymentMode, PaymentReceipt } from '../../types';

const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Return Credit', 'Exchange of Wheat'];

// Non-cash modes: settle a customer's dues without any actual cash/bank inflow.
const AMOUNT_LABELS: Partial<Record<PaymentMode, string>> = {
  'Return Credit': 'Return Credit Amount (₹)',
  'Exchange of Wheat': 'Exchange Value (₹)',
};

interface Props {
  customerId: string;
  customerName?: string;
  onClose: () => void;
  // When set, the modal edits this existing receipt instead of creating a new one.
  receipt?: PaymentReceipt;
}

export default function AddPaymentModal({ customerId, customerName, onClose, receipt }: Props) {
  const { addPaymentReceipt, updatePaymentReceipt } = useStore();
  const today = formatDate(new Date());
  const isEdit = !!receipt;

  const [amount, setAmount] = useState(receipt ? String(receipt.amount) : '');
  const [mode, setMode] = useState<PaymentMode>(receipt?.mode ?? 'Cash');
  const [date, setDate] = useState(receipt?.date ?? today);
  const [refNo, setRefNo] = useState(receipt?.referenceNo ?? '');
  const [notes, setNotes] = useState(receipt?.notes ?? '');
  const [error, setError] = useState('');

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (!isValidDDMMYYYY(date)) { setError('Enter date in DD/MM/YYYY format'); return; }
    if (isEdit) {
      updatePaymentReceipt(receipt.id, { date, amount: amt, mode, referenceNo: refNo || undefined, notes: notes || undefined });
    } else {
      addPaymentReceipt({ customerId, date, amount: amt, mode, referenceNo: refNo || undefined, notes: notes || undefined });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Wallet size={18} className="text-green-600" /> {isEdit ? `Edit Payment · ${receipt.id}` : 'Record Payment'}
          </h2>
          {customerName && <span className="text-sm text-gray-500">{customerName}</span>}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {AMOUNT_LABELS[mode] ?? 'Amount Received (₹)'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="1" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={date}
                onChange={e => { setDate(e.target.value); setError(''); }}
                placeholder="DD/MM/YYYY"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as PaymentMode)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {(mode === 'Cheque' || mode === 'Bank Transfer' || mode === 'UPI') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'Cheque' ? 'Cheque No' : mode === 'UPI' ? 'UPI Reference' : 'UTR / Reference No'}
              </label>
              <input
                type="text" value={refNo}
                onChange={e => setRefNo(e.target.value)}
                placeholder="Optional reference number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold"
          >
            {isEdit ? 'Save Changes' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
