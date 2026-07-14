import React, { useState } from 'react';
import {
  Plus, Edit2, History, CheckCircle, AlertTriangle,
  XCircle, FlaskConical, ChevronDown, ChevronUp, Package,
  PackageCheck,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PACKAGING_MATERIALS, PRODUCTS, PRODUCT_CATEGORIES } from '../../data/products';
import Layout from '../Layout/Layout';
import Modal from '../common/Modal';
import { PackagingEntry } from '../../types';
import { isValidDDMMYYYY, parseDDMMYYYY } from '../../utils/format';

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

const CATEGORY_STYLE: Record<string, { header: string; badge: string; icon: string }> = {
  'Shikharji Atta': { header: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', icon: 'text-amber-600' },
  'Shikharji Besan':       { header: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', icon: 'text-yellow-600' },
  'Shikharji Dalia':      { header: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-800', icon: 'text-orange-600' },
  'Shikharji Bran':        { header: 'bg-stone-50 border-stone-200', badge: 'bg-stone-100 text-stone-700', icon: 'text-stone-500' },
};

export default function StockDashboard() {
  const {
    packagingStock, packagingEntries, reorderLevels,
    readyStock, readyStockTransactions,
    adjustStock, setReorderLevel, navigate,
    getStockStatus, adjustReadyStock, setReadyStockReorderLevel,
    getReadyStockStatus, addReadyStockEntry,
  } = useStore();

  const [addModal, setAddModal] = useState(false);
  const [addDateError, setAddDateError] = useState('');
  const [addSkuId, setAddSkuId] = useState('');
  const [addQty, setAddQty] = useState(0);
  const [addReason, setAddReason] = useState('');
  const [addDate, setAddDate] = useState(() => {
    const d = new Date();
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  });

  const [adjModal, setAdjModal] = useState(false);
  const [adjSkuId, setAdjSkuId] = useState('');
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState('');

  const [reorderModal, setReorderModal] = useState(false);
  const [reorderSkuId, setReorderSkuId] = useState('');
  const [reorderQty, setReorderQty] = useState(0);

  const [pkgAdjModal, setPkgAdjModal] = useState(false);
  const [pkgAdjId, setPkgAdjId] = useState('');
  const [pkgAdjQty, setPkgAdjQty] = useState(0);
  const [pkgAdjReason, setPkgAdjReason] = useState('');
  const [pkgReorderModal, setPkgReorderModal] = useState(false);
  const [pkgReorderId, setPkgReorderId] = useState('');
  const [pkgReorderQty, setPkgReorderQty] = useState(0);

  const [showHistory, setShowHistory] = useState(false);
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const openAdd = (skuId: string) => {
    setAddSkuId(skuId); setAddQty(0); setAddReason('');
    const d = new Date();
    setAddDate(String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear());
    setAddModal(true);
  };
  const handleAdd = () => {
    if (!addSkuId || addQty <= 0 || !addReason.trim()) return;
    if (!isValidDDMMYYYY(addDate)) { setAddDateError('Enter date in DD/MM/YYYY format'); return; }
    setAddDateError('');
    addReadyStockEntry(addSkuId, addQty, addReason.trim(), addDate);
    setAddModal(false);
  };

  const openAdj = (skuId: string) => { setAdjSkuId(skuId); setAdjQty(0); setAdjReason(''); setAdjModal(true); };
  const handleAdj = () => {
    if (!adjSkuId || adjQty === 0 || !adjReason.trim()) return;
    adjustReadyStock(adjSkuId, adjQty, adjReason.trim());
    setAdjModal(false);
  };

  const openReorder = (skuId: string) => {
    setReorderSkuId(skuId);
    setReorderQty(reorderLevels.ready[skuId] ?? 0);
    setReorderModal(true);
  };
  const handleReorder = () => { setReadyStockReorderLevel(reorderSkuId, reorderQty); setReorderModal(false); };

  const openPkgAdj = (id: string) => { setPkgAdjId(id); setPkgAdjQty(0); setPkgAdjReason(''); setPkgAdjModal(true); };
  const handlePkgAdj = () => {
    if (!pkgAdjId || pkgAdjQty === 0 || !pkgAdjReason.trim()) return;
    adjustStock('packaging', pkgAdjId, pkgAdjQty, pkgAdjReason.trim());
    setPkgAdjModal(false);
  };
  const openPkgReorder = (id: string) => { setPkgReorderId(id); setPkgReorderQty(reorderLevels.packaging[id] ?? 0); setPkgReorderModal(true); };
  const handlePkgReorder = () => { setReorderLevel('packaging', pkgReorderId, pkgReorderQty); setPkgReorderModal(false); };

  const pkgSummary = (materialId: string) => {
    const entries = packagingEntries.filter(e => e.materialId === materialId);
    const purchased = entries.filter(e => e.entryType === 'purchase').reduce((s, e) => s + e.quantity, 0);
    const used      = entries.filter(e => e.entryType === 'used').reduce((s, e) => s + e.quantity, 0);
    const damaged   = entries.filter(e => e.entryType === 'damaged').reduce((s, e) => s + e.quantity, 0);
    const totalSpend = entries.filter(e => e.entryType === 'purchase' && e.totalAmount).reduce((s, e) => s + (e.totalAmount ?? 0), 0);
    return { purchased, used, damaged, totalSpend };
  };

  const groupedProducts = PRODUCT_CATEGORIES.map(cat => ({
    category: cat,
    skus: PRODUCTS.filter(p => p.product === cat && !p.hidden),
    style: CATEGORY_STYLE[cat] ?? { header: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-700', icon: 'text-gray-500' },
  }));

  const recentRSTxns = [...readyStockTransactions].sort((a, b) => parseDDMMYYYY(b.date, b.time) - parseDDMMYYYY(a.date, a.time)).slice(0, 30);

  return (
    <Layout
      title="Inventory"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <History size={15} /> {showHistory ? 'Hide' : 'Show'} History
          </button>
          <button onClick={() => navigate('production-entry')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
            <FlaskConical size={15} /> Production Log
          </button>
          <button onClick={() => navigate('add-stock')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
            <PackageCheck size={15} /> Add Ready Stock
          </button>
        </div>
      }
    >

      {/* Ready Stock */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <PackageCheck size={17} className="text-green-600" />
          <h2 className="font-semibold text-gray-800 text-base">Ready Stock</h2>
          <span className="text-xs text-gray-400 ml-1">— packed units available for sale</span>
        </div>
        <div className="space-y-4">
          {groupedProducts.map(({ category, skus, style }) => {
            const totalUnits = skus.reduce((sum, sku) => sum + (readyStock[sku.id] ?? 0), 0);
            return (
              <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className={`flex items-center justify-between px-5 py-2.5 border-b ${style.header}`}>
                  <div className="flex items-center gap-2">
                    <Package size={14} className={style.icon} />
                    <span className="font-semibold text-sm text-gray-700">{category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                      {totalUnits} units total
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {skus.map(sku => {
                    const count = readyStock[sku.id] ?? 0;
                    const status = getReadyStockStatus(sku.id);
                    const reorder = reorderLevels.ready[sku.id] ?? 0;
                    const isExpanded = expandedSku === sku.id;
                    const skuTxns = readyStockTransactions
                      .filter(t => t.skuId === sku.id)
                      .sort((a, b) => parseDDMMYYYY(b.date, b.time) - parseDDMMYYYY(a.date, a.time))
                      .slice(0, 20);
                    return (
                      <div key={sku.id}>
                        <div
                          className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${status === 'out' ? 'bg-red-50/60' : status === 'low' ? 'bg-amber-50/60' : ''}`}
                          onClick={() => setExpandedSku(isExpanded ? null : sku.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-800 text-sm">{sku.variant}</span>
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{sku.unit}</span>
                              <StatusBadge status={status} />
                            </div>
                            {reorder > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">Reorder alert at: {reorder} units</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-2xl font-bold ${count === 0 ? 'text-red-500' : (reorder > 0 && count <= reorder) ? 'text-amber-600' : 'text-gray-800'}`}>
                              {count}
                            </div>
                            <div className="text-xs text-gray-400">units ready</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openAdd(sku.id)}
                              className="text-green-600 hover:text-green-800 text-xs flex items-center gap-1 font-medium border border-green-200 px-2 py-1 rounded-md hover:bg-green-50">
                              <Plus size={11} /> Add
                            </button>
                            <button onClick={() => openAdj(sku.id)}
                              className="text-indigo-500 hover:text-indigo-700 text-xs flex items-center gap-1">
                              <Edit2 size={11} /> Adjust
                            </button>
                            <button onClick={() => openReorder(sku.id)}
                              className="text-gray-400 hover:text-gray-600 text-xs">
                              Reorder
                            </button>
                          </div>
                          <div className="text-gray-400 shrink-0">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50/40">
                            {skuTxns.length === 0 ? (
                              <div className="text-center py-5 text-gray-400 text-sm">
                                No transactions yet.{' '}
                                <button onClick={() => openAdd(sku.id)} className="text-green-600 underline">Add first entry</button>
                              </div>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100 border-b border-gray-200">
                                  <tr>
                                    {['Date', 'Type', 'Change', 'Before', 'After', 'Reason'].map(h => (
                                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {skuTxns.map(t => (
                                    <tr key={t.id} className="hover:bg-white">
                                      <td className="px-4 py-2 text-xs text-gray-500">{t.date} {t.time}</td>
                                      <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'ADD' ? 'bg-green-100 text-green-700' : t.type === 'DEDUCT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{t.type}</span>
                                      </td>
                                      <td className="px-4 py-2 font-semibold text-gray-800 text-xs">
                                        {t.type === 'ADD' ? '+' : t.type === 'DEDUCT' ? '-' : '+'}{t.quantity}
                                      </td>
                                      <td className="px-4 py-2 text-gray-500 text-xs">{t.previousStock}</td>
                                      <td className="px-4 py-2 font-medium text-gray-800 text-xs">{t.newStock}</td>
                                      <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate">{t.reason}</td>
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
            );
          })}
        </div>
      </div>

      {/* Packaging Materials */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-800 text-base">Packaging Materials</h2>
          </div>
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
              .sort((a, b) => parseDDMMYYYY(b.date, b.time) - parseDDMMYYYY(a.date, a.time));
            return (
              <div key={pm.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  className={`flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${status === 'out' ? 'bg-red-50' : status === 'low' ? 'bg-amber-50' : ''}`}
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
                    <button onClick={() => openPkgAdj(pm.id)}
                      className="text-indigo-500 hover:text-indigo-700 text-xs flex items-center gap-1">
                      <Edit2 size={12} /> Adjust
                    </button>
                    <button onClick={() => openPkgReorder(pm.id)}
                      className="text-gray-400 hover:text-gray-600 text-xs">
                      Reorder
                    </button>
                  </div>
                  <div className="text-gray-400 shrink-0">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {materialEntries.length === 0 ? (
                      <div className="text-center py-5 text-gray-400 text-sm">No entries yet.</div>
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
                                {e.entryType === 'purchase' ? '+' : '-'}{e.quantity} {e.priceUnit === 'kg' ? 'kg' : 'pcs'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 text-xs">
                                {e.pricePerUnit ? `\u20B9${e.pricePerUnit}/${e.priceUnit ?? 'pc'}` : '\u2014'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 text-xs font-medium">
                                {e.totalAmount ? `\u20B9${e.totalAmount.toLocaleString('en-IN')}` : '\u2014'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[200px] truncate">
                                {[e.supplier, e.notes].filter(Boolean).join(' \u00b7 ') || '\u2014'}
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

      {/* History */}
      {showHistory && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} className="text-gray-500" />
            <h2 className="font-semibold text-gray-700">Ready Stock \u2013 Recent Changes</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {recentRSTxns.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No transactions yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Date', 'Type', 'SKU', 'Change', 'Before', 'After', 'Reason'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentRSTxns.map(txn => (
                    <tr key={txn.id}>
                      <td className="px-4 py-3 text-gray-500 text-xs">{txn.date} {txn.time}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${txn.type === 'ADD' ? 'bg-green-100 text-green-700' : txn.type === 'DEDUCT' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{txn.type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 text-xs">{txn.skuName}</td>
                      <td className="px-4 py-3 font-semibold text-xs">
                        {txn.type === 'ADD' ? '+' : '-'}{txn.quantity}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{txn.previousStock}</td>
                      <td className="px-4 py-3 font-medium text-xs">{txn.newStock}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{txn.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Ready Stock */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Ready Stock">
        <div className="space-y-4">
          {addSkuId && (() => {
            const sku = PRODUCTS.find(p => p.id === addSkuId);
            const current = readyStock[addSkuId] ?? 0;
            return sku ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="font-semibold text-green-800 text-sm">{sku.product} \u2013 {sku.variant}</div>
                <div className="text-xs text-green-700 mt-0.5">Current stock: <strong>{current} units</strong></div>
              </div>
            ) : null;
          })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="text" value={addDate}
              onChange={e => { setAddDate(e.target.value); setAddDateError(''); }}
              placeholder="DD/MM/YYYY"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${addDateError ? 'border-red-400' : 'border-gray-300'}`} />
            {addDateError && <p className="text-xs text-red-500 mt-0.5">{addDateError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Add <span className="text-red-500">*</span>
              <span className="text-gray-400 font-normal ml-1">(packed units)</span>
            </label>
            <input type="number" min="1" value={addQty || ''} onChange={e => setAddQty(Number(e.target.value))} placeholder="e.g. 50"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            {addQty > 0 && addSkuId && (
              <p className="text-xs text-green-600 mt-1">After adding: <strong>{(readyStock[addSkuId] ?? 0) + addQty} units</strong></p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <input value={addReason} onChange={e => setAddReason(e.target.value)}
              placeholder="e.g. Morning packing batch"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <button onClick={handleAdd} disabled={!addReason.trim() || addQty <= 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium">
            Add to Ready Stock
          </button>
        </div>
      </Modal>

      {/* Modal: Adjust Ready Stock */}
      <Modal open={adjModal} onClose={() => setAdjModal(false)} title="Adjust Ready Stock">
        <div className="space-y-4">
          {adjSkuId && (() => {
            const sku = PRODUCTS.find(p => p.id === adjSkuId);
            const current = readyStock[adjSkuId] ?? 0;
            return sku ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                <div className="font-semibold text-indigo-800 text-sm">{sku.product} \u2013 {sku.variant}</div>
                <div className="text-xs text-indigo-700 mt-0.5">Current stock: <strong>{current} units</strong></div>
              </div>
            ) : null;
          })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment</label>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setAdjQty(q => -(Math.abs(q)))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${adjQty < 0 ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600'}`}>
                Remove
              </button>
              <button onClick={() => setAdjQty(q => Math.abs(q))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${adjQty >= 0 ? 'bg-green-100 border-green-300 text-green-700' : 'border-gray-300 text-gray-600'}`}>
                Add
              </button>
            </div>
            <input type="number" min="0" value={Math.abs(adjQty)}
              onChange={e => setAdjQty(adjQty < 0 ? -Number(e.target.value) : Number(e.target.value))}
              placeholder="Quantity"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <input value={adjReason} onChange={e => setAdjReason(e.target.value)}
              placeholder="e.g. Correction, Damage..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <button onClick={handleAdj} disabled={!adjReason.trim() || adjQty === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium">
            Apply Adjustment
          </button>
        </div>
      </Modal>

      {/* Modal: Reorder Level */}
      <Modal open={reorderModal} onClose={() => setReorderModal(false)} title="Set Reorder Level">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">You will see a low-stock alert when ready stock falls at or below this number.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum units</label>
            <input type="number" min="0" value={reorderQty} onChange={e => setReorderQty(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <p className="text-xs text-gray-400 mt-1">Set to 0 to disable alerts.</p>
          </div>
          <button onClick={handleReorder}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium">
            Save Reorder Level
          </button>
        </div>
      </Modal>

      {/* Modal: Packaging Adjust */}
      <Modal open={pkgAdjModal} onClose={() => setPkgAdjModal(false)} title="Adjust Packaging Stock">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment</label>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setPkgAdjQty(q => -(Math.abs(q)))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${pkgAdjQty < 0 ? 'bg-red-100 border-red-300 text-red-700' : 'border-gray-300 text-gray-600'}`}>
                Remove
              </button>
              <button onClick={() => setPkgAdjQty(q => Math.abs(q))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${pkgAdjQty >= 0 ? 'bg-green-100 border-green-300 text-green-700' : 'border-gray-300 text-gray-600'}`}>
                Add
              </button>
            </div>
            <input type="number" min="0" value={Math.abs(pkgAdjQty)}
              onChange={e => setPkgAdjQty(pkgAdjQty < 0 ? -Number(e.target.value) : Number(e.target.value))}
              placeholder="Quantity"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <input value={pkgAdjReason} onChange={e => setPkgAdjReason(e.target.value)}
              placeholder="e.g. Correction, Damaged..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <button onClick={handlePkgAdj} disabled={!pkgAdjReason.trim() || pkgAdjQty === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium">
            Apply Adjustment
          </button>
        </div>
      </Modal>

      {/* Modal: Packaging Reorder Level */}
      <Modal open={pkgReorderModal} onClose={() => setPkgReorderModal(false)} title="Set Reorder Level">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Set the minimum stock quantity for low-stock alerts.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
            <input type="number" min="0" value={pkgReorderQty} onChange={e => setPkgReorderQty(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <p className="text-xs text-gray-400 mt-1">Set to 0 to disable low-stock alerts.</p>
          </div>
          <button onClick={handlePkgReorder}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium">
            Save Reorder Level
          </button>
        </div>
      </Modal>

    </Layout>
  );
}
