import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS } from '../../data/products';
import { fmtINR } from '../../utils/format';
import Layout from '../Layout/Layout';

export default function PriceList() {
  const { priceList, updatePrice } = useStore();
  const [localPrices, setLocalPrices] = useState<Record<string, number>>(priceList);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocalPrices(priceList); }, [priceList]);

  const handleSave = () => {
    Object.entries(localPrices).forEach(([skuId, rate]) => updatePrice(skuId, rate));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocalPrices({ ...priceList });
  };

  const categories = ['Shikharji Atta', 'Shikharji Besan', 'Shikharji Dalia'];

  return (
    <Layout
      title="Price List"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Save size={14} /> Save All Prices
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Saved!</span>}
        </div>
      }
    >
      <div className="max-w-2xl space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          <strong>Note:</strong> These are default prices. You can override the rate when creating an order.
          All prices are per unit (per bag / pouch / packet).
        </div>

        {categories.map(cat => {
          const catSkus = PRODUCTS.filter(p => p.product === cat && !p.hidden);
          return (
            <div key={cat} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                <h2 className="font-semibold text-slate-700">{cat}</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100">
                  <tr>
                    {['SKU ID', 'Variant', 'Weight', 'HSN', 'GST%', 'Price (₹ / unit)', 'Effective Price incl. GST'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {catSkus.map(sku => {
                    const price = localPrices[sku.id] ?? 0;
                    const inclGST = price * (1 + sku.gstRate / 100);
                    return (
                      <tr key={sku.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-500 font-semibold">{sku.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{sku.variant}</td>
                        <td className="px-4 py-3 text-slate-500">{sku.weight >= 1 ? `${sku.weight} kg` : `${sku.weight * 1000} gm`}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{sku.hsnCode}</td>
                        <td className="px-4 py-3 text-slate-500">{sku.gstRate}%</td>
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={price || ''}
                              onChange={e => setLocalPrices(p => ({ ...p, [sku.id]: Number(e.target.value) }))}
                              placeholder="0"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {price > 0 ? fmtINR(inclGST, true) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-3">GST Rate Reference</h3>
          <div className="text-sm text-slate-600 space-y-1">
            <div>• <strong>Shikharji Atta (HSN 1101):</strong> 5% GST (for branded/packaged)</div>
            <div>• <strong>Shikharji Besan (HSN 1106):</strong> 5% GST (for branded/packaged)</div>
            <div>• <strong>Shikharji Dalia / Broken Wheat (HSN 1104):</strong> 5% GST (for branded/packaged)</div>
            <div className="mt-2 text-slate-400 text-xs">Intra-state: CGST 2.5% + SGST 2.5% | Inter-state: IGST 5%</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
