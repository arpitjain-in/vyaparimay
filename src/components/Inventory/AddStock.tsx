import React, { useState } from 'react';
import { ArrowLeft, Save, PackageCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES } from '../../data/products';
import { formatDate, isValidDDMMYYYY } from '../../utils/format';
import Layout from '../Layout/Layout';

export default function AddStock() {
  const { addReadyStockEntry, navigate, readyStock } = useStore();

  const [skuId, setSkuId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedSku = PRODUCTS.find(p => p.id === skuId);
  const currentStock = readyStock[skuId] ?? 0;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isValidDDMMYYYY(date)) errs.date     = 'Enter date in DD/MM/YYYY format';
    if (!skuId)        errs.skuId    = 'Select a product variant';
    if (quantity <= 0) errs.quantity = 'Enter a valid positive quantity';
    if (!reason.trim()) errs.reason  = 'Enter a reason / batch description';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    addReadyStockEntry(skuId, quantity, reason.trim(), date);
    setSaved(true);
    setSkuId('');
    setQuantity(0);
    setReason('');
    setTimeout(() => setSaved(false), 3000);
  };

  // Group SKUs by category for the select dropdown
  const grouped = PRODUCT_CATEGORIES.map(cat => ({
    category: cat,
    skus: PRODUCTS.filter(p => p.product === cat),
  }));

  return (
    <Layout
      title="Add Ready Stock"
      actions={
        <button onClick={() => navigate('stock-dashboard')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
          <ArrowLeft size={16} /> Back to Inventory
        </button>
      }
    >
      <div className="max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-700 border-b border-gray-100 pb-4">
            <PackageCheck size={18} className="text-green-600" />
            <span className="font-semibold">Add Packed Units to Ready Stock</span>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={date}
              onChange={e => { setDate(e.target.value); setErrors(prev => ({ ...prev, date: '' })); }}
              placeholder="DD/MM/YYYY"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${errors.date ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
          </div>

          {/* Product SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Variant <span className="text-red-500">*</span>
            </label>
            <select
              value={skuId}
              onChange={e => { setSkuId(e.target.value); setErrors({}); }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${errors.skuId ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">— Select product —</option>
              {grouped.map(({ category, skus }) => (
                <optgroup key={category} label={category}>
                  {skus.map(sku => (
                    <option key={sku.id} value={sku.id}>{sku.variant}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.skuId && <p className="text-xs text-red-500 mt-0.5">{errors.skuId}</p>}
            {selectedSku && (
              <p className="text-xs text-blue-600 mt-1">
                Current ready stock: <strong>{currentStock} units</strong>
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Packed Units <span className="text-red-500">*</span>
              {selectedSku && (
                <span className="text-gray-400 font-normal ml-1">({selectedSku.unit}s)</span>
              )}
            </label>
            <input
              type="number" min="1" step="1"
              value={quantity || ''}
              onChange={e => setQuantity(Number(e.target.value))}
              placeholder="e.g. 50"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${errors.quantity ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
            {skuId && quantity > 0 && (
              <p className="text-xs text-green-600 mt-1">
                After this entry: <strong>{currentStock + quantity} units</strong> ready for sale
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch / Reason <span className="text-red-500">*</span>
            </label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Morning packing batch, Production – 01/05/2026"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${errors.reason ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.reason && <p className="text-xs text-red-500 mt-0.5">{errors.reason}</p>}
          </div>

          {/* Summary card */}
          {selectedSku && quantity > 0 && reason.trim() && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <div className="font-semibold text-green-800">{selectedSku.product} – {selectedSku.variant}</div>
              <div className="text-green-700 mt-1">
                Adding <strong>{quantity} {selectedSku.unit}{quantity > 1 ? 's' : ''}</strong> →
                New total: <strong>{currentStock + quantity} units</strong>
              </div>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <Save size={16} /> Entry saved successfully!
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={handleSave}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
              <Save size={16} /> Save Entry
            </button>
            <button onClick={() => navigate('stock-dashboard')}
              className="px-5 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2.5 rounded-lg font-medium">
              Done
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
