import React, { useState } from 'react';
import {
  Plus, Edit2, History, CheckCircle, AlertTriangle,
  XCircle, FlaskConical, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { RAW_MATERIALS, PACKAGING_MATERIALS } from '../../data/products';
import Layout from '../Layout/Layout';
import Modal from '../common/Modal';
import { PackagingEntry } from '../../types';

function StatusBadge({ status }: { status: 'adequate' | 'low' | 'out' }) {
  if (status === 'out') return (
    <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
      <XCircle size={13} /> Out of Stock
    </span>
  );
  if (status === 'low') return (
    <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
      <AlertTriangle size={13} /> Low Stock
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
      <CheckCircle size={13} /> Adequate
    </span>
  );
}

function EntryTypeBadge({ type }: { type: PackagingEntry['entryType'] }) {
  if (type === 'purchase') return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Purchase</span>
  );
  if (type === 'used') return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Used</span>
  );
  return (
    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Damaged</span>
  );
}

export default function StockDashboard() {
  const {
    rawMaterialStock, packagingStock, packagingEntries, reorderLevels,
    stockTransactions, adjustStock, setReorderLevel, navigate,
    getStockStatus,
  } = useStore();

  const [adjustModal, setAdjustModal] = useState(false);
  const [reorderModal, setReorderModal] = useState(false);
  const [adjType, setAdjType] = useState<'raw' | 'packaging'>('raw');
  const [adjId, setAdjId] = useState('');
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');
  const [reorderType, setReorderType] = useState<'raw' | 'packaging'>('raw');
  const [reorderId, setReorderId] = useState('');
  const [reorderQty, setReorderQty] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

  const handleAdjust = () => {
    if (!adjId || adjQty === 0 || !adjReason.trim()) return;
    adjustStock(adjType, adjId, adjQty, adjReason);
    setAdjustModal(false);
    setAdjQty(0); setAdjReason(''); setAdjId('');
  };

  const handleSetReorder = () => {
    if (!reorderId) return;
    setReorderLevel(reorderType, reorderId, reorderQty);
    setReorderModal(false);
  };

  const openAdjust = (type: 'raw' | 'packaging', id: string) => {
    setAdjType(type); setAdjId(id); setAdjQty(0); setAdjReason('');
    setAdjustModal(true);
  };

  const openReorder = (type: 'raw' | 'packaging', id: string) => {
    setReorderType(type); setReorderId(id);
    setReorderQty(type === 'raw'
      ? (reorderLevels.raw[id] ?? 0)
      : (reorderLevels.packaging[id] ?? 0));
    setReorderModal(true);
  };

  const recentTxns = [...stockTransactions]
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 20);

  const pkgSummary = (materialId: string) => {
    const entries = packagingEntries.filter(e => e.materialId === materialId);
    const purchased = entries.filter(e => e.entryType === 'purchase').reduce((s, e) => s + e.quantity, 0);
    const used      = entries.filter(e => e.entryType === 'used').reduce((s, e) => s + e.quantity, 0);
    const damaged   = entries.filter(e => e.entryType === 'damaged').reduce((s, e) => s + e.quantity, 0);
    const totalSpend = entries
      .filter(e => e.entryType === 'purchase' && e.totalAmount)
      .reduce((s, e) => s + (e.totalAmount ?? 0), 0);
    return { purchased, used, damaged, totalSpend };
  };

  return (
    <Layout
      title="Inventory"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <History size={15} /> {showHistory ? 'Hide' : 'Show'} History
          </button>
          <button
            onClick={() => navigate('production-entry')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <FlaskConical size={15} /> Production Log
          </button>
          <button
            onClick={() => navigate('add-stock')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus size={15} /> Packaging Entry
          </button>
        </div>
      }
    >
      {/* Bulk Flour Stock */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical size={16} className="text-amber-600" />
          <h2 className="font-semibold text-gray-700">Bulk Flour Stock (kg)</h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-100">
              <tr>
                {['Material', 'Current Stock', 'Unit', 'Reorder Level', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {RAW_MATERIALS.map(rm => {
                const stock = rawMaterialStock[rm.id] ?? 0;
                const reorder = reorderLevels.raw[rm.id] ?? 0;
                const status = getStockStatus('raw', rm.id);
                return (
                  <tr key={rm.id} className={status === 'out' ? 'bg-red-50' : status === 'low' ? 'bg-amber-50' : ''}>
                    <td className="px-5 py-3 font-medium text-gray-800">{rm.name}</td>
                    <td className="px-5 py-3 text-2xl font-bold text-gray-800">{stock.toFixed(1)}</td>
                    <td className="px-5 py-3 text-gray-500">kg</td>
                    <td className="px-5 py-3 text-gray-500">{reorder > 0 ? `${reorder} kg` : '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openAdjust('raw', rm.id)}
                          className="text-indigo-500 hover:text-indigo-700 text-xs flex items-center gap-1">
                          <Edit2 size={12} /> Adjust
                        </button>
                        <button onClick={() => openReorder('raw', rm.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs">
                          Set Reorder
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packaging Materials with expandable ledger */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Packaging Materials</h2>
          <span className="text-xs text-gray-400">Click a row to see entry history</span>
        </div>

        <div className="space-y-3">
          {PACKAGING_MATERIALS.map(pm => {
            const stock = packagingStock[pm.id] ?? 0;
            const status = getStockStatus('packaging', pm.id);
            const summary = pkgSummary(pm.id);
            const isExpanded = expandedPkg === pm.id;
            const materialEntries = packagingEntries
              .filter(e => e.materialId === pm.id)
              .sort((a, b) => b.id.localeCompare(a.id));

            return (
              <div key={pm.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Summary row */}
                <div
                  className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    status === 'out' ? 'bg-red-50' : status === 'low' ? 'bg-amber-50' : ''
                  }`}
                  onClick={() => setExpandedPkg(isExpanded ? null : pm.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">{pm.name}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>Purchased: <strong className="text-gray-700">{summary.purchased}</strong></span>
                      <span>Used: <strong className="text-blue-700">{summary.used}</strong></span>
                      <span>Damaged: <strong className="text-red-600">{summary.damaged}</strong></span>
                      {summary.totalSpend > 0 && (
                        <span>Total Spend: <strong className="text-gray-700">&#8377;{summary.totalSpend.toLocaleString('en-IN')}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-800">{stock}</div>
                    <div className="text-xs text-gray-400">units in hand</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openAdjust('packaging', pm.id)}
                      className="text-indigo-500 hover:text-indigo-700 text-xs flex items-center gap-1">
                      <Edit2 size={12} /> Adjust
                    </button>
                    <button onClick={() => openReorder('packaging', pm.id)}
                      className="text-gray-400 hover:text-gray-600 text-xs">
                      Reorder
                    </button>
                  </div>
                  <div className="text-gray-400 shrink-0">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Entry ledger */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {materialEntries.length === 0 ? (
                      <div className="text-center py-5 text-gray-400 text-sm">
                        No entries yet.{' '}
                        <button onClick={() => navigate('add-stock')} className="text-indigo-500 underline">
                          Add first entry
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            {['Date', 'Type', 'Qty', 'Price/Unit', 'Total Amount', 'Supplier / Notes'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {materialEntries.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-xs text-gray-500">{e.date} {e.time}</td>
                              <td className="px-4 py-2.5"><EntryTypeBadge type={e.entryType} /></td>
                              <td className="px-4 py-2.5 font-semibold text-gray-800">
                                {e.entryType === 'purchase' ? `+${e.quantity}` : `-${e.quantity}`}
                                {' '}{e.priceUnit === 'kg' ? 'kg' : 'pcs'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">
                                {e.pricePerUnit ? `\u20B9${e.pricePerUnit}/${e.priceUnit ?? 'pc'}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 text-xs font-medium">
                                {e.totalAmount ? `\u20B9${e.totalAmount.toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate">
                                {[e.supplier, e.notes].filter(Boolean).join(' · ') || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bulk flour transaction history */}
      {showHistory && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Bulk Flour Stock Adjustments</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {recentTxns.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No transactions yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date', 'Type', 'Item', 'Qty', 'Before', 'After', 'Reason'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTxns.map(txn => (
                    <tr key={txn.id}>
                      <td className="px-4 py-3 text-gray-500 text-xs">{txn.date} {txn.time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          txn.type === 'ADD' ? 'bg-green-100 text-green-700' :
                          txn.type === 'DEDUCT' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{txn.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 text-xs">{txn.itemName}</td>
                      <td className="px-4 py-3 font-semibold">{txn.quantity}</td>
                      <td className="px-4 py-3 text-gray-500">{txn.previousStock.toFixed(1)}</td>
                      <td className="px-4 py-3 font-medium">{txn.newStock.toFixed(1)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{txn.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Adjust Stock">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Change</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdjQty(q => -(Math.abs(q)))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${adjQty < 0 ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600'}`}
              >
                Remove (-)
              </button>
              <button
                onClick={() => setAdjQty(q => Math.abs(q))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${adjQty >= 0 ? 'bg-green-100 border-green-300 text-green-700' : 'border-gray-300 text-gray-600'}`}
              >
                Add (+)
              </button>
            </div>
            <input
              type="number" min="0"
              value={Math.abs(adjQty)}
              onChange={e => setAdjQty(adjQty < 0 ? -Number(e.target.value) : Number(e.target.value))}
              placeholder="Quantity"
              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <input
              value={adjReason}
              onChange={e => setAdjReason(e.target.value)}
              placeholder="e.g. Correction, Spillage..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={handleAdjust}
            disabled={!adjReason.trim() || adjQty === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium"
          >
            Apply Adjustment
          </button>
        </div>
      </Modal>

      {/* Reorder Level Modal */}
      <Modal open={reorderModal} onClose={() => setReorderModal(false)} title="Set Reorder Level">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set the minimum stock quantity. You will see a low-stock alert when stock falls below this level.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
            <input
              type="number" min="0"
              value={reorderQty}
              onChange={e => setReorderQty(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <p className="text-xs text-gray-400 mt-1">Set to 0 to disable low-stock alerts for this item.</p>
          </div>
          <button
            onClick={handleSetReorder}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium"
          >
            Save Reorder Level
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
