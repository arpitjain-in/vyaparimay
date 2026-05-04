import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Package } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import { formatDate } from '../../utils/format';

function StatusBadge({ status }: { status: 'adequate' | 'low' | 'out' }) {
  if (status === 'out') return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out</span>;
  if (status === 'low') return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low</span>;
  return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">OK</span>;
}

export default function PackagingStockPage() {
  const {
    packagingStock, packagingEntries, reorderLevels,
    addPackagingEntry, getStockStatus,
  } = useStore();

  const [panelMaterialId, setPanelMaterialId] = useState<string | null>(null);

  // Entry form state
  const [entryQty, setEntryQty]   = useState(0);
  const [entryNotes, setEntryNotes] = useState('');
  const [entryError, setEntryError] = useState('');

  const openPanel = (materialId: string) => {
    setPanelMaterialId(materialId);
    setEntryQty(0);
    setEntryNotes('');
    setEntryError('');
  };

  const handleSaveEntry = () => {
    if (entryQty <= 0) { setEntryError('Enter a valid quantity'); return; }
    setEntryError('');
    const mat = PACKAGING_MATERIALS.find(m => m.id === panelMaterialId);
    addPackagingEntry({
      date: formatDate(new Date()),
      materialId: panelMaterialId!,
      materialName: mat?.name ?? panelMaterialId!,
      entryType: 'purchase',
      quantity: entryQty,
      notes: entryNotes.trim() || undefined,
    });
    setEntryQty(0);
    setEntryNotes('');
  };

  const panelMaterial   = PACKAGING_MATERIALS.find(m => m.id === panelMaterialId);
  const panelStock      = panelMaterialId ? (packagingStock[panelMaterialId] ?? 0) : 0;
  const panelStatus     = panelMaterialId ? getStockStatus('packaging', panelMaterialId) : ('adequate' as const);
  const panelEntries    = panelMaterialId
    ? [...packagingEntries].filter(e => e.materialId === panelMaterialId).sort((a, b) => b.id.localeCompare(a.id))
    : [];

  return (
    <Layout title="Packaging Materials">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {PACKAGING_MATERIALS.map(pm => {
          const stock  = packagingStock[pm.id] ?? 0;
          const status = getStockStatus('packaging', pm.id);
          const reorder = reorderLevels.packaging[pm.id] ?? 0;
          const borderColor = status === 'out'
            ? 'border-red-300 hover:border-red-400'
            : status === 'low'
            ? 'border-amber-300 hover:border-amber-400'
            : 'border-indigo-100 hover:border-indigo-300';
          const entries    = packagingEntries.filter(e => e.materialId === pm.id);
          const purchased  = entries.filter(e => e.entryType === 'purchase').reduce((s, e) => s + e.quantity, 0);
          const used       = entries.filter(e => e.entryType === 'used').reduce((s, e) => s + e.quantity, 0);
          return (
            <button
              key={pm.id}
              onClick={() => openPanel(pm.id)}
              className={`text-left bg-white border-2 ${borderColor} rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
            >
              <div className="flex items-center gap-1.5 mb-3">
                <Package size={13} className="text-indigo-300 shrink-0" />
                <div className="font-semibold text-slate-700 text-sm leading-tight truncate">{pm.name}</div>
              </div>
              <div className={`text-3xl font-bold tabular-nums leading-none mb-1 ${
                stock === 0 ? 'text-red-500'
                : (reorder > 0 && stock <= reorder) ? 'text-amber-600'
                : 'text-slate-800'
              }`}>{stock}</div>
              <div className="text-[11px] text-slate-400 mb-2">units in hand</div>
              <StatusBadge status={status} />
              {(purchased > 0 || used > 0) && (
                <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                  <span>+{purchased}</span>
                  <span>−{used}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Slide-over panel */}
      <div className={`fixed inset-0 z-50 ${panelMaterialId ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${panelMaterialId ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setPanelMaterialId(null)}
        />
        <div className={`absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${panelMaterialId ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Packaging</div>
              <div className="font-bold text-slate-800 text-lg leading-tight">{panelMaterial?.name ?? '—'}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-2xl font-bold text-slate-800 tabular-nums">{panelStock}</span>
                <span className="text-xs text-slate-400">units in hand</span>
                <StatusBadge status={panelStatus} />
              </div>
            </div>
            <button onClick={() => setPanelMaterialId(null)} className="text-slate-400 hover:text-slate-600 mt-1 shrink-0">
              <X size={20} />
            </button>
          </div>

          {/* Add Entry form */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Add Entry</div>

            <div className="space-y-2">
              <input
                type="number" min="1" value={entryQty || ''} onChange={e => { setEntryQty(Number(e.target.value)); setEntryError(''); }}
                placeholder="Qty"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${entryError ? 'border-red-400' : 'border-slate-200'}`}
              />
              {entryError && <p className="text-xs text-red-500">{entryError}</p>}

              <input
                value={entryNotes} onChange={e => setEntryNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />

              <button
                onClick={handleSaveEntry}
                disabled={entryQty <= 0}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 transition-colors"
              >
                Save Entry
              </button>
            </div>
          </div>

          {/* Entry history */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Entry History</div>
            {panelEntries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No entries yet.</div>
            ) : (
              <div>
                {panelEntries.map((e, i) => {
                  const isPurchase = e.entryType === 'purchase';
                  const dotColor = isPurchase ? 'bg-emerald-100 text-emerald-700' : e.entryType === 'used' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';
                  return (
                    <div key={e.id} className={`flex items-start gap-3 py-3 ${i < panelEntries.length - 1 ? 'border-b border-slate-50' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${dotColor}`}>
                        {isPurchase ? '+' : '−'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-700 text-sm capitalize">
                            {isPurchase ? '+' : '−'}{e.quantity} — {e.entryType}
                          </span>
                          <span className="text-xs text-slate-400 shrink-0">{e.date}</span>
                        </div>
                        {e.totalAmount && (
                          <div className="text-xs text-slate-500 mt-0.5">₹{e.totalAmount.toLocaleString('en-IN')}</div>
                        )}
                        {(e.supplier || e.notes) && (
                          <div className="text-xs text-slate-400 truncate mt-0.5">
                            {[e.supplier, e.notes].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

