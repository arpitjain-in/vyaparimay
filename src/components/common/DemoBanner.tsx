import React, { useState } from 'react';
import { AlertTriangle, X, RotateCcw } from 'lucide-react';
import { resetDemoData } from '../../lib/db.demo';

export default function DemoBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 hover:bg-amber-600"
        title="Show Demo Mode banner"
      >
        <AlertTriangle size={12} />
        DEMO
      </button>
    );
  }

  const handleReset = () => {
    if (
      window.confirm(
        'This will clear ALL demo data and reload with the original seed data.\n\nContinue?',
      )
    ) {
      resetDemoData();
      window.location.reload();
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white flex items-center justify-between px-4 py-2 shadow-md">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle size={16} />
        DEMO MODE — All data is stored locally in your browser. Nothing is saved to production.
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded font-medium transition-colors"
          title="Reset all demo data to seed values"
        >
          <RotateCcw size={12} />
          Reset Demo Data
        </button>
        <button
          onClick={() => setVisible(false)}
          className="flex items-center gap-1 text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded font-medium transition-colors"
          title="Hide banner"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
