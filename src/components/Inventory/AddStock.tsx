import React, { useState } from 'react';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PACKAGING_MATERIALS } from '../../data/products';
import { formatDate } from '../../utils/format';
import Layout from '../Layout/Layout';
import { PackagingEntryType } from '../../types';

const ENTRY_TYPES: { value: PackagingEntryType; label: string; hint: string }[] = [
  { value: 'purchase', label: 'Purchase (Incoming)', hint: 'Bags/pouches received from supplier'          },
  { value: 'damaged',  label: 'Damaged / Wasted',   hint: 'Torn, spoiled or unusable items — write off' },
];

export default function AddStock() {
  const { addPackagingEntry, navigate, packagingStock } = useStore();

  const [materialId, setMaterialId] = useState('');
  const [entryType, setEntryType] = useState<PackagingEntryType>('purchase');
  const [quantity, setQuantity] = useState<number>(0);
  // Purchase-only
  const [priceUnit, setPriceUnit] = useState<'piece' | 'kg'>('piece');
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedMaterial = PACKAGING_MATERIALS.find(p => p.id === materialId);
  const currentStock = packagingStock[materialId] ?? 0;
  const totalAmount = pricePerUnit > 0 && quantity > 0 ? +(pricePerUnit * quantity).toFixed(2) : 0;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!materialId)  errs.materialId = 'Select a packaging material';
    if (quantity <= 0) errs.quantity  = 'Enter a valid positive quantity';
    if (entryType !== 'purchase' && quantity > currentStock)
      errs.quantity = `Only ${currentStock} units currently in stock`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const materialName = PACKAGING_MATERIALS.find(p => p.id === materialId)?.name ?? materialId;
    addPackagingEntry({
      date,
      materialId,
      materialName,
      entryType,
      quantity,
      ...(entryType === 'purchase' && {
        priceUnit,
        pricePerUnit: pricePerUnit > 0 ? pricePerUnit : undefined,
        totalAmount:  totalAmount  > 0 ? totalAmount  : undefined,
        supplier:     supplier.trim()  || undefined,
      }),
      notes: notes.trim() || undefined,
    });
    setSaved(true);
    setMaterialId('');
    setQuantity(0);
    setPricePerUnit(0);
    setSupplier('');
    setNotes('');
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Layout
      title="Packaging Entry"
      actions={
        <button
          onClick={() => navigate('stock-dashboard')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={16} /> Back to Inventory
        </button>
      }
    >
      <div className="max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-2 text-gray-700 border-b border-gray-100 pb-4">
            <Package size={18} />
            <span className="font-semibold">Add Packaging Material Entry</span>
          </div>

          {/* Entry type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
            <div className="space-y-2">
              {ENTRY_TYPES.map(t => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    entryType === t.value
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="entryType"
                    value={t.value}
                    checked={entryType === t.value}
                    onChange={() => setEntryType(t.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Packaging Material <span className="text-red-500">*</span>
            </label>
            <select
              value={materialId}
              onChange={e => setMaterialId(e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.materialId ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">— Select material —</option>
              {PACKAGING_MATERIALS.map(pm => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
            {errors.materialId && <p className="text-xs text-red-500 mt-0.5">{errors.materialId}</p>}
            {selectedMaterial && (
              <p className="text-xs text-blue-600 mt-1">Current stock: <strong>{currentStock} units</strong></p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity <span className="text-red-500">*</span>
              {entryType === 'purchase' && priceUnit === 'kg'
                ? <span className="text-gray-400 font-normal ml-1">(kg)</span>
                : <span className="text-gray-400 font-normal ml-1">(pieces)</span>
              }
            </label>
            <input
              type="number" min="0" step="1"
              value={quantity || ''}
              onChange={e => setQuantity(Number(e.target.value))}
              placeholder="e.g. 100"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.quantity ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
            {materialId && quantity > 0 && entryType === 'purchase' && (
              <p className="text-xs text-green-600 mt-1">
                After this purchase: {currentStock + quantity} units
              </p>
            )}
          </div>

          {/* Purchase-only fields */}
          {entryType === 'purchase' && (
            <>
              {/* Price unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price is quoted per</label>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                  {(['piece', 'kg'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setPriceUnit(u)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        priceUnit === u ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      Per {u === 'piece' ? 'Piece' : 'Kg'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price per unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price per {priceUnit === 'piece' ? 'piece' : 'kg'} (&#8377;) <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={pricePerUnit || ''}
                  onChange={e => setPricePerUnit(Number(e.target.value))}
                  placeholder="e.g. 12.50"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {totalAmount > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Total amount: <strong>&#8377;{totalAmount.toLocaleString('en-IN')}</strong>
                  </p>
                )}
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name (optional)</label>
                <input
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  placeholder="Name of supplier"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={entryType === 'damaged' ? 'e.g. Torn during storage' : 'Any remarks'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
            >
              <Save size={16} /> Save Entry
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
              Entry saved! Stock balance updated.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
