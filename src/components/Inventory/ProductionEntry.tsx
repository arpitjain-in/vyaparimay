import React, { useState } from 'react';
import { ArrowLeft, FlaskConical, Save, ChevronDown } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCT_CATEGORIES } from '../../data/products';
import { formatDate } from '../../utils/format';
import Layout from '../Layout/Layout';

export default function ProductionEntry() {
  const { navigate, productionLogs, addProductionLog } = useStore();

  const [productName, setProductName] = useState('');
  const [quantityProduced, setQuantityProduced] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!productName)         errs.productName = 'Select a product';
    if (quantityProduced <= 0) errs.qty        = 'Enter quantity produced';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    addProductionLog({ date, productName, quantityProduced, notes: notes.trim() || undefined });
    setSaved(true);
    setProductName('');
    setQuantityProduced(0);
    setNotes('');
    setTimeout(() => setSaved(false), 3000);
  };

  const recentLogs = [...productionLogs]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 20);

  // Group totals per product for summary
  const totals: Record<string, number> = {};
  productionLogs.forEach(l => {
    totals[l.productName] = (totals[l.productName] ?? 0) + l.quantityProduced;
  });

  return (
    <Layout
      title="Production Log"
      actions={
        <button
          onClick={() => navigate('stock-dashboard')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={16} /> Back to Inventory
        </button>
      }
    >
      <div className="max-w-xl">
        {/* Lifetime totals */}
        {Object.keys(totals).length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3">
            {PRODUCT_CATEGORIES.map(cat => (
              <div key={cat} className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                <div className="text-xs text-amber-600 font-medium">{cat}</div>
                <div className="text-2xl font-bold text-amber-800 mt-1">{(totals[cat] ?? 0).toFixed(1)}</div>
                <div className="text-xs text-amber-500">kg total</div>
              </div>
            ))}
          </div>
        )}

        {/* Entry form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-amber-700 border-b border-amber-100 pb-4">
            <FlaskConical size={20} />
            <span className="font-semibold">Record Production</span>
            <span className="text-xs text-gray-400 font-normal">— for tracking only, not linked to stock</span>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {/* Product */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none ${errors.productName ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">— Select product —</option>
                {PRODUCT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {errors.productName && <p className="text-xs text-red-500 mt-0.5">{errors.productName}</p>}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity Produced <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(kg)</span>
            </label>
            <input
              type="number" min="0" step="0.5"
              value={quantityProduced || ''}
              onChange={e => setQuantityProduced(Number(e.target.value))}
              placeholder="e.g. 200"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${errors.qty ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.qty && <p className="text-xs text-red-500 mt-0.5">{errors.qty}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Morning shift, extra fine grind..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
            >
              <Save size={16} /> Save Production Entry
            </button>
            <button
              onClick={() => navigate('stock-dashboard')}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm font-medium text-center">
              Production entry saved!
            </div>
          )}
        </div>

        {/* Recent log */}
        {recentLogs.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 text-sm font-medium text-amber-800">
              Recent Entries
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Date', 'Product', 'Qty (kg)', 'Notes'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentLogs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.date}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 text-xs">{l.productName}</td>
                    <td className="px-4 py-3 font-bold text-amber-700">{l.quantityProduced}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
