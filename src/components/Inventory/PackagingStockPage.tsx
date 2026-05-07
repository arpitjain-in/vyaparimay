import React, { useState, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Package, Upload, ShieldAlert, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PACKAGING_MATERIALS, PRODUCTS } from '../../data/products';
import Layout from '../Layout/Layout';
import { formatDate, parseDDMMYYYY } from '../../utils/format';

function StatusBadge({ status }: { status: 'adequate' | 'low' | 'out' }) {
  if (status === 'out') return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out</span>;
  if (status === 'low') return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low</span>;
  return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">OK</span>;
}

export default function PackagingStockPage() {
  const {
    packagingStock, packagingEntries, reorderLevels,
    addPackagingEntry, getStockStatus, syncPackagingFromReadyStock, revertLastPackagingSync,
    readyStockTransactions, clearAllPackagingData,
  } = useStore();

  const SYNC_NOTE = 'One-time sync: deducted for existing Ready Stock';
  const hasSyncEntries = packagingEntries.some(e => e.notes === SYNC_NOTE && e.entryType === 'used');

  const [panelMaterialId, setPanelMaterialId] = useState<string | null>(null);

  // Sync modal state
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [syncPreview, setSyncPreview] = useState<{ materialId: string; materialName: string; qty: number }[]>([]);
  const [syncDone, setSyncDone] = useState(false);

  const openSyncModal = () => {
    // Sum all ADD transactions per packaging material (not current balance,
    // because sales deduct from ready stock but NOT from packaging)
    const totals: Record<string, number> = {};
    for (const txn of readyStockTransactions) {
      if (txn.type !== 'ADD') continue;
      const sku = PRODUCTS.find(p => p.id === txn.skuId);
      if (!sku?.packagingId) continue;
      totals[sku.packagingId] = (totals[sku.packagingId] ?? 0) + txn.quantity;
    }
    const preview = Object.entries(totals)
      .filter(([, q]) => q > 0)
      .map(([materialId, qty]) => ({
        materialId,
        materialName: PACKAGING_MATERIALS.find(m => m.id === materialId)?.name ?? materialId,
        qty,
      }));
    setSyncPreview(preview);
    setSyncDone(false);
    setShowSyncConfirm(true);
  };

  const handleSyncConfirm = () => {
    syncPackagingFromReadyStock();
    setSyncDone(true);
  };

  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoDone, setUndoDone] = useState(false);

  const handleUndoSync = () => {
    revertLastPackagingSync();
    setUndoDone(true);
  };

  // Clear all packaging state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearDone, setClearDone] = useState(false);

  const handleClearAll = () => {
    clearAllPackagingData();
    setClearDone(true);
  };

  // Entry form state
  const [entryQty, setEntryQty]   = useState(0);
  const [entryNotes, setEntryNotes] = useState('');
  const [entryError, setEntryError] = useState('');

  // Bulk entry state
  const [showPinModal, setShowPinModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkQtys, setBulkQtys] = useState<Record<string, string>>({});
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkDate, setBulkDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  // PIN gate state
  const PIN = import.meta.env.VITE_INVOICE_DELETE_PASSWORD as string;
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const pinRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const openBulkModal = () => {
    setPinDigits(['', '', '', '']);
    setPinError('');
    setShowPinModal(true);
  };

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...pinDigits];
    next[index] = value;
    setPinDigits(next);
    setPinError('');
    if (value && index < 3) pinRefs[index + 1].current?.focus();
    if (next.every(d => d !== '') && value) {
      if (next.join('') === PIN) {
        setShowPinModal(false);
        setBulkQtys({});
        setBulkNotes('');
        setBulkError('');
        const d = new Date();
        setBulkDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
        setShowBulkModal(true);
      } else {
        setPinError('Incorrect PIN. Try again.');
        setPinDigits(['', '', '', '']);
        setTimeout(() => pinRefs[0].current?.focus(), 50);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) pinRefs[index - 1].current?.focus();
  };

  const handleBulkSave = () => {
    const entries = PACKAGING_MATERIALS.filter(m => Number(bulkQtys[m.id]) > 0);
    if (entries.length === 0) {
      setBulkError('Enter at least one quantity.');
      return;
    }
    // Convert YYYY-MM-DD → DD/MM/YYYY
    const [yr, mo, dy] = bulkDate.split('-');
    const dateStr = `${dy}/${mo}/${yr}`;
    entries.forEach(mat => {
      addPackagingEntry({
        date: dateStr,
        materialId: mat.id,
        materialName: mat.name,
        entryType: 'purchase',
        quantity: Number(bulkQtys[mat.id]),
        notes: bulkNotes.trim() || undefined,
      });
    });
    setShowBulkModal(false);
  };

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
    ? [...packagingEntries].filter(e => e.materialId === panelMaterialId).sort((a, b) => parseDDMMYYYY(b.date, b.time) - parseDDMMYYYY(a.date, a.time))
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

      {/* Sync from Ready Stock Confirmation Modal */}
      {showSyncConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 text-amber-600">
                <RefreshCw size={18} />
                <span className="font-bold text-base text-slate-800">Sync from Ready Stock</span>
              </div>
              <button onClick={() => setShowSyncConfirm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {syncDone ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 gap-3">
                <CheckCircle size={40} className="text-emerald-500" />
                <p className="font-semibold text-slate-700 text-center">Packaging inventory synced successfully!</p>
                <button
                  onClick={() => setShowSyncConfirm(false)}
                  className="mt-2 px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : syncPreview.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 gap-3">
                <AlertTriangle size={36} className="text-amber-400" />
                <p className="text-slate-500 text-center text-sm">No ready stock found to deduct. Add ready stock first.</p>
                <button
                  onClick={() => setShowSyncConfirm(false)}
                  className="mt-2 px-6 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
                  <p className="text-xs text-amber-700">
                    This will deduct the <strong>current ready stock quantities</strong> from packaging inventory as a one-time sync. Use only once to reconcile historical data.
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                  {syncPreview.map(item => (
                    <div key={item.materialId} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-700">{item.materialName}</span>
                      <span className="text-sm font-bold text-red-600">−{item.qty}</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex gap-2">
                  <button
                    onClick={() => setShowSyncConfirm(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSyncConfirm}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold"
                  >
                    Confirm Deduction
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Clear All Packaging Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-700">
                <Trash2 size={18} />
                <span className="font-bold text-base text-slate-800">Clear All Packaging Data</span>
              </div>
              {!clearDone && (
                <button onClick={() => setShowClearConfirm(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              )}
            </div>
            {clearDone ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={36} className="text-emerald-500" />
                <p className="font-semibold text-slate-700 text-center">All packaging entries cleared!</p>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="mt-1 px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-2">
                  This will <strong className="text-red-600">permanently delete all packaging entries</strong> and reset all packaging stock to zero.
                </p>
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-5">
                  This cannot be undone. Use this only to start fresh.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
                  >
                    Delete All
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Undo Last Sync Modal */}
      {showUndoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <X size={18} />
                <span className="font-bold text-base text-slate-800">Undo Last Sync</span>
              </div>
              <button onClick={() => setShowUndoConfirm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {undoDone ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle size={36} className="text-emerald-500" />
                <p className="font-semibold text-slate-700 text-center">Sync reversed successfully!</p>
                <button
                  onClick={() => setShowUndoConfirm(false)}
                  className="mt-1 px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-5">
                  This will add back all quantities that were deducted in the last sync, restoring packaging inventory to its state before the sync.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowUndoConfirm(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUndoSync}
                    className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold"
                  >
                    Undo Sync
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PIN Gate Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-indigo-700">
                <ShieldAlert size={20} />
                <span className="font-semibold text-base">Bulk Entry</span>
              </div>
              <button onClick={() => setShowPinModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">Enter the 4-digit PIN to continue.</p>
            <div className="flex justify-center gap-3 mb-4">
              {pinDigits.map((d, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  className="w-12 h-12 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {pinError && <p className="text-xs text-red-500 text-center">{pinError}</p>}
          </div>
        </div>
      )}

      {/* Bulk Entry Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBulkModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="font-bold text-slate-800 text-lg">Bulk Packaging Entry</div>
                <div className="text-xs text-slate-400 mt-0.5">Enter quantities for multiple materials at once</div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* Materials list */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {PACKAGING_MATERIALS.map(mat => {
                const currentStock = packagingStock[mat.id] ?? 0;
                const status = getStockStatus('packaging', mat.id);
                return (
                  <div key={mat.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{mat.name}</div>
                      <div className="text-xs text-slate-400">In hand: {currentStock}</div>
                    </div>
                    <StatusBadge status={status} />
                    <input
                      type="number"
                      min="0"
                      value={bulkQtys[mat.id] ?? ''}
                      onChange={e => {
                        setBulkQtys(prev => ({ ...prev, [mat.id]: e.target.value }));
                        setBulkError('');
                      }}
                      placeholder="Qty"
                      className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 shrink-0"
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <input
                value={bulkNotes}
                onChange={e => setBulkNotes(e.target.value)}
                placeholder="Notes (optional, applies to all)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
              <button
                onClick={handleBulkSave}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
              >
                Save All Entries
              </button>
            </div>
          </div>
        </div>
      )}

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

