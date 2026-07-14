import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export function PageLoadingState() {
  return (
    <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
      <Loader2 size={20} className="animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

export function PageErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
      <AlertCircle size={16} className="shrink-0" />
      {message}
    </div>
  );
}
