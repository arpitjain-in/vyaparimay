import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, PackageCheck } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PRODUCT_CATEGORIES } from '../../data/products';
import Layout from '../Layout/Layout';
import { formatDate } from '../../utils/format';

function StatusBadge({ status }: { status: 'adequate' | 'low' | 'out' }) {
  if (status === 'out') return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Out</span>;
  if (status === 'low') return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low</span>;
  return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">OK</span>;
}

const CATEGORY_STYLE: Record<string, { border: string; header: string; badge: string; icon: string }> = {
  'Shikharji Atta': { border: 'border-amber-200 hover:border-amber-400',   header: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',  icon: 'text-amber-500' },
  'Shikharji Besan':       { border: 'border-yellow-200 hover:border-yellow-400', header: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', icon: 'text-yellow-500' },
  'Shikharji Dalia':      { border: 'border-orange-200 hover:border-orange-400', header: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
  'Shikharji Bran':        { border: 'border-stone-200 hover:border-stone-400',   header: 'bg-stone-50',  badge: 'bg-stone-100 text-stone-600',   icon: 'text-stone-400' },
};

export default function ReadyStockPage() {
  const {
    readyStock, readyStockTransactions, reorderLevels,
    adjustReadyStock, getReadyStockStatus,
  } = useStore();

  const [panelSkuId, setPanelSkuId] = useState<string | null>(null);
  const [modifyMode, setModifyMode] = useState<'add' | 'remove'>('add');
  const [modifyQty, setModifyQty] = useState(0);
  const [modifyReason, setModifyReason] = useState('');
  const [modifyDate, setModifyDate] = useState(formatDate(new Date()));

  const openPanel = (skuId: string) => {
    setPanelSkuId(skuId);
    setModifyMode('add');
    setModifyQty(0);
    setModifyReason('');
    setModifyDate(formatDate(new Date()));
  };

  const handleModify = () => {
    if (!panelSkuId || modifyQty <= 0 || !modifyReason.trim()) return;
    adjustReadyStock(panelSkuId, modifyMode === 'add' ? modifyQty : -modifyQty, modifyReason.trim(), modifyDate);
    setModifyQty(0);
    setModifyReason('');
  };

  const groupedProducts = PRODUCT_CATEGORIES.map(cat => ({
    category: cat,
    skus: PRODUCTS.filter(p => p.product === cat),
    style: CATEGORY_STYLE[cat] ?? { border: 'border-slate-200 hover:border-slate-400', header: 'bg-slate-50', badge: 'bg-slate-100 text-slate-600', icon: 'text-slate-400' },
  }));

  const panelSku      = PRODUCTS.find(p => p.id === panelSkuId);
  const panelStock    = panelSkuId ? (readyStock[panelSkuId] ?? 0) : 0;
  const panelStatus   = panelSkuId ? getReadyStockStatus(panelSkuId) : ('adequate' as const);
  const panelReorder  = panelSkuId ? (reorderLevels.ready[panelSkuId] ?? 0) : 0;
  const panelTxns     = panelSkuId
    ? [...readyStockTransactions].filter(t => t.skuId === panelSkuId).sort((a, b) => b.id.localeCompare(a.id))
    : [];

  return (
    <Layout title="Ready Stock">
      <div className="space-y-8">
        {groupedProducts.map(({ category, skus, style }) => {
          const totalUnits = skus.reduce((s, sku) => s + (readyStock[sku.id] ?? 0), 0);
          return (
            <div key={category}>
              <div className={`flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg ${style.header} border border-transparent`}>
                <PackageCheck size={14} className={style.icon} />
                <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">{category}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>{totalUnits} units</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {skus.map(sku => {
                  const count  = readyStock[sku.id] ?? 0;
                  const status = getReadyStockStatus(sku.id);
                  const reorder = reorderLevels.ready[sku.id] ?? 0;
                  const borderColor = status === 'out'
                    ? 'border-red-300 hover:border-red-400'
                    : status === 'low'
                    ? 'border-amber-300 hover:border-amber-400'
                    : style.border;
                  return (
                    <button
                      key={sku.id}
                      onClick={() => openPanel(sku.id)}
                      className={`text-left bg-white border-2 ${borderColor} rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
                    >
                      <div className="font-semibold text-slate-700 text-sm leading-tight mb-3 truncate">{sku.variant}</div>
                      <div className={`text-3xl font-bold tabular-nums leading-none mb-1 ${
                        count === 0 ? 'text-red-500'
                        : (reorder > 0 && count <= reorder) ? 'text-amber-600'
                        : 'text-slate-800'
                      }`}>{count}</div>
                      <div className="text-[11px] text-slate-400 mb-2">{sku.unit}</div>
                      <StatusBadge status={status} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over panel */}
      <div className={`fixed inset-0 z-50 ${panelSkuId ? '' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${panelSkuId ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setPanelSkuId(null)}
        />
        <div className={`absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col transition-transform duration-300 ${panelSkuId ? 'translate-x-0' : 'translate-x-full'}`}>

          {/* Panel header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div>
              {panelSku && (
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{panelSku.product}</div>
              )}
              <div className="font-bold text-slate-800 text-lg leading-tight">{panelSku?.variant ?? '—'}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-2xl font-bold text-slate-800 tabular-nums">{panelStock}</span>
                <span className="text-xs text-slate-400">{panelSku?.unit}</span>
                <StatusBadge status={panelStatus} />
              </div>
              {panelReorder > 0 && (
                <div className="text-xs text-slate-400 mt-1">Reorder alert at {panelReorder} units</div>
              )}
            </div>
            <button onClick={() => setPanelSkuId(null)} className="text-slate-400 hover:text-slate-600 mt-1 shrink-0">
              <X size={20} />
            </button>
          </div>

          {/* Modify form */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Modify Stock</div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold mb-3">
              <button
                onClick={() => setModifyMode('add')}
                className={`flex-1 py-2 transition-colors ${modifyMode === 'add' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                + Add
              </button>
              <button
                onClick={() => setModifyMode('remove')}
                className={`flex-1 py-2 border-l border-slate-200 transition-colors ${modifyMode === 'remove' ? 'bg-red-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >
                − Remove
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="number" min="1" value={modifyQty || ''} onChange={e => setModifyQty(Number(e.target.value))}
                placeholder="Quantity"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <input
                value={modifyReason} onChange={e => setModifyReason(e.target.value)}
                placeholder="Reason (required)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text" value={modifyDate} onChange={e => setModifyDate(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {modifyQty > 0 && (
                  <span className="text-xs text-slate-400 shrink-0">
                    → <strong className={modifyMode === 'add' ? 'text-emerald-700' : 'text-red-600'}>
                      {modifyMode === 'add' ? panelStock + modifyQty : Math.max(0, panelStock - modifyQty)}
                    </strong>
                  </span>
                )}
              </div>
              <button
                onClick={handleModify}
                disabled={!modifyReason.trim() || modifyQty <= 0}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors ${modifyMode === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {modifyMode === 'add' ? `Add ${modifyQty || ''} units` : `Remove ${modifyQty || ''} units`}
              </button>
            </div>
          </div>

          {/* Transaction history */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Transaction History</div>
            {panelTxns.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No transactions yet.</div>
            ) : (
              <div>
                {panelTxns.map((t, i) => (
                  <div key={t.id} className={`flex items-start gap-3 py-3 ${i < panelTxns.length - 1 ? 'border-b border-slate-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${t.type === 'ADD' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'ADD' ? '+' : '−'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 text-sm">
                          {t.type === 'ADD' ? '+' : '−'}{t.quantity} units
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">{t.date}</span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {t.invoiceNo ? <span className="text-indigo-500 font-medium">{t.invoiceNo}</span> : t.reason}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        Balance: <span className="text-slate-500 font-medium">{t.newStock}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

