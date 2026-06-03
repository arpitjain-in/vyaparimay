import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type Variant = 'error' | 'warning' | 'info' | 'success';

interface Props {
  open: boolean;
  title: string;
  message: string | string[];
  variant?: Variant;
  onClose: () => void;
  onRetry?: () => void;
}

const VARIANT_CONFIG: Record<Variant, { icon: React.ReactNode; iconColor: string; btnColor: string }> = {
  error:   { icon: <AlertCircle size={20} />,   iconColor: 'text-red-600',    btnColor: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: <AlertTriangle size={20} />, iconColor: 'text-amber-500',  btnColor: 'bg-amber-500 hover:bg-amber-600' },
  info:    { icon: <Info size={20} />,           iconColor: 'text-indigo-600', btnColor: 'bg-indigo-600 hover:bg-indigo-700' },
  success: { icon: <CheckCircle size={20} />,   iconColor: 'text-green-600',  btnColor: 'bg-green-600 hover:bg-green-700' },
};

export default function AlertDialog({ open, title, message, variant = 'info', onClose, onRetry }: Props) {
  if (!open) return null;

  const { icon, iconColor, btnColor } = VARIANT_CONFIG[variant];
  const lines = Array.isArray(message) ? message : [message];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className={`flex items-center gap-2 ${iconColor}`}>
            {icon}
            <span className="font-semibold text-base text-slate-800">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors ml-2 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message */}
        <div className="text-sm text-slate-600 space-y-1.5 mb-6">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {/* Buttons */}
        <div className={`flex gap-2 ${onRetry ? 'flex-row' : ''}`}>
          {onRetry && (
            <button
              onClick={() => { onClose(); onRetry(); }}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${btnColor}`}
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onRetry ? 'flex-1' : 'w-full'} py-2.5 rounded-xl text-sm font-medium transition-colors ${onRetry ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : `text-white ${btnColor}`}`}
          >
            {onRetry ? 'Dismiss' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
