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

  const categories = ['Wheat Flour', 'Besan', 'Daliya'];

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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Note:</strong> These are default prices. You can override the rate when creating an order.
          All prices are per unit (per bag / pouch / packet).
        </div>

        {categories.map(cat => {
          const catSkus = PRODUCTS.filter(p => p.product === cat);
          return (
            <div key={cat} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-700">{cat}</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    {['SKU ID', 'Variant', 'Weight', 'HSN', 'GST%', 'Price (₹ / unit)', 'Effective Price incl. GST'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {catSkus.map(sku => {
                    const price = localPrices[sku.id] ?? 0;
                    const inclGST = price * (1 + sku.gstRate / 100);
                    return (
                      <tr key={sku.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-600">{sku.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{sku.variant}</td>
                        <td className="px-4 py-3 text-gray-500">{sku.weight >= 1 ? `${sku.weight} kg` : `${sku.weight * 1000} gm`}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{sku.hsnCode}</td>
                        <td className="px-4 py-3 text-gray-500">{sku.gstRate}%</td>
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={price || ''}
                              onChange={e => setLocalPrices(p => ({ ...p, [sku.id]: Number(e.target.value) }))}
                              placeholder="0"
                              className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 font-medium"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-medium">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-700 mb-3">GST Rate Reference</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>• <strong>Wheat Flour (HSN 1101):</strong> 5% GST (for branded/packaged)</div>
            <div>• <strong>Besan (HSN 1106):</strong> 5% GST (for branded/packaged)</div>
            <div>• <strong>Daliya / Broken Wheat (HSN 1104):</strong> 5% GST (for branded/packaged)</div>
            <div className="mt-2 text-gray-400 text-xs">Intra-state: CGST 2.5% + SGST 2.5% | Inter-state: IGST 5%</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
