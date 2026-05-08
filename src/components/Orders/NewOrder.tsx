import React, { useState } from 'react';
import { Search, Plus, ShoppingCart, Trash2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PACKAGING_MATERIALS, PRODUCT_CATEGORIES, getRawMaterialId } from '../../data/products';
import { calcGST, isInterState } from '../../utils/gst';
import { fmtINR } from '../../utils/format';
import { ProductSKU } from '../../types';
import Layout from '../Layout/Layout';

// ─── Packaging type badge ───────────────────────────────────────────────────
function packagingBadge(variant: string): { label: string; badgeCls: string; isPouch: boolean } {
  if (variant.includes('Handle Bag')) return { label: 'Handle Bag', badgeCls: 'bg-emerald-600 text-white',                    isPouch: false };
  if (variant.includes('Pouch'))      return { label: 'Pouch',      badgeCls: 'bg-white/30 text-white border border-white/50', isPouch: true  };
  if (variant.includes('Packet'))     return { label: 'Packet',     badgeCls: 'bg-amber-600 text-white',                      isPouch: false };
  return                                     { label: 'Bag',        badgeCls: 'bg-gray-500 text-white',                       isPouch: false };
}

// ─── Step indicator ────────────────────────────────────────────────────────
function Steps({ step }: { step: number }) {
  const labels = ['Select Customer', 'Add Products', 'Review & Confirm'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
            step === i + 1 ? 'bg-indigo-600 text-white font-semibold' :
            step > i + 1  ? 'bg-green-50 text-green-700 font-medium' :
            'bg-gray-100 text-gray-400'
          }`}>
            <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
              step === i + 1 ? 'bg-white text-indigo-600' :
              step > i + 1  ? 'bg-green-500 text-white' :
              'bg-gray-300 text-white'
            }`}>{step > i + 1 ? '✓' : i + 1}</span>
            {label}
          </div>
          {i < labels.length - 1 && <ChevronRight size={16} className="text-gray-300 mx-1" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Stock Alert check ────────────────────────────────────────────────────
interface Alert { label: string; required: number; available: number; }

function getStockAlerts(
  items: { skuId: string; quantity: number }[],
  rawStock: Record<string, number>,
  pkgStock: Record<string, number>,
): Alert[] {
  const alerts: Alert[] = [];
  // Aggregate raw material needs
  const rawNeeded: Record<string, number> = {};
  const pkgNeeded: Record<string, number> = {};

  for (const item of items) {
    const sku = PRODUCTS.find(p => p.id === item.skuId);
    if (!sku) continue;
    const rawId = getRawMaterialId(sku.productId);
    rawNeeded[rawId] = (rawNeeded[rawId] ?? 0) + sku.weight * item.quantity;
    pkgNeeded[sku.packagingId] = (pkgNeeded[sku.packagingId] ?? 0) + item.quantity;
  }

  for (const [id, needed] of Object.entries(rawNeeded)) {
    const avail = rawStock[id] ?? 0;
    if (avail < needed) {
      const names: Record<string, string> = { 'RM-WF': 'Shikharji Atta', 'RM-BS': 'Shikharji Besan', 'RM-DL': 'Shikharji Dalia' };
      alerts.push({ label: `${names[id] ?? id} (Bulk kg)`, required: needed, available: avail });
    }
  }
  for (const [id, needed] of Object.entries(pkgNeeded)) {
    const avail = pkgStock[id] ?? 0;
    if (avail < needed) {
      const pkgName = PACKAGING_MATERIALS.find(p => p.id === id)?.name ?? id;
      alerts.push({ label: pkgName, required: needed, available: avail });
    }
  }
  return alerts;
}

export default function NewOrder() {
  const {
    customers, currentOrder, businessProfile,
    setOrderCustomer, setOrderPaymentMode,
    upsertCartItem, removeCartItem, generateInvoice, setOrderGst,
    rawMaterialStock, packagingStock, priceList, navigate,
  } = useStore();

  const [step, setStep] = useState(1);
  const [custSearch, setCustSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSKU, setSelectedSKU] = useState<ProductSKU | null>(null);
  const [qty, setQty] = useState(1);
  const [rate, setRate] = useState(0);
  const [perKgRate, setPerKgRate] = useState(0);
  const [addedSku, setAddedSku] = useState<string | null>(null);
  // saleDate stored as YYYY-MM-DD internally; displayed/entered as DD/MM/YYYY
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saleDateDisplay, setSaleDateDisplay] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  });
  const [saleDateError, setSaleDateError] = useState('');
  // true only after onBlur fully passes all validation checks
  const [saleDateValid, setSaleDateValid] = useState(true);

  const activeCustomers = customers.filter(c => c.active);
  const filteredCustomers = activeCustomers.filter(c => {
    const q = custSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.firmName ?? '').toLowerCase().includes(q) ||
      c.mobile.includes(q);
  });

  const selectedCustomer = customers.find(c => c.id === currentOrder?.customerId);

  // Step 2 product helpers
  const skusInCategory = category
    ? PRODUCTS.filter(p => p.product === category)
    : PRODUCTS;

  const handleSelectSKU = (sku: ProductSKU) => {
    setSelectedSKU(sku);
    setQty(1);
    const bagRate = priceList[sku.id] ?? 0;
    setRate(bagRate);
    setPerKgRate(sku.weight > 0 ? parseFloat((bagRate / sku.weight).toFixed(2)) : 0);
  };

  const handleAddToCart = () => {
    if (!selectedSKU || qty <= 0 || rate <= 0) return;
    upsertCartItem(selectedSKU.id, qty, rate);
    setAddedSku(selectedSKU.id);
    setTimeout(() => setAddedSku(null), 1500);
    setSelectedSKU(null);
    setQty(1);
    setPerKgRate(0);
  };

  // Step 3 calculations
  const gstEnabled = currentOrder?.gstEnabled ?? (businessProfile?.gstEnabled ?? false);
  const inter = gstEnabled && businessProfile && selectedCustomer
    ? isInterState(businessProfile.state, selectedCustomer.state)
    : false;

  const cartWithCalc = (currentOrder?.items ?? []).map(item => {
    const sku = PRODUCTS.find(p => p.id === item.skuId)!;
    const tv = item.quantity * item.rate;
    const { cgst, sgst, igst } = gstEnabled ? calcGST(tv, sku.gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
    return { ...item, sku, taxableValue: tv, cgst, sgst, igst, lineTotal: tv + cgst + sgst + igst };
  });

  const subtotal  = cartWithCalc.reduce((a, i) => a + i.taxableValue, 0);
  const cgstTotal = cartWithCalc.reduce((a, i) => a + i.cgst, 0);
  const sgstTotal = cartWithCalc.reduce((a, i) => a + i.sgst, 0);
  const igstTotal = cartWithCalc.reduce((a, i) => a + i.igst, 0);
  const grandTotal = Math.round(subtotal + cgstTotal + sgstTotal + igstTotal);

  const stockAlerts = getStockAlerts(currentOrder?.items ?? [], rawMaterialStock, packagingStock);

  const handleGenerateInvoice = () => {
    const inv = generateInvoice(saleDate);
    if (!inv) alert('Failed to generate invoice. Please check order.');
  };

  return (
    <Layout title="New Order">
      <Steps step={step} />

      {/* ─── Step 1: Select Customer ─── */}
      {step === 1 && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Select Customer</h2>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                placeholder="Search by name, business name or phone..."
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {/* Current selection */}
            {selectedCustomer && (
              <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-indigo-800">{selectedCustomer.firmName ?? selectedCustomer.name}</div>
                  {selectedCustomer.firmName && <div className="text-xs text-indigo-700">{selectedCustomer.name}</div>}
                  <div className="text-xs text-indigo-600">{selectedCustomer.mobile} · {selectedCustomer.city}</div>
                  {selectedCustomer.openingBalance > 0 && (
                    <div className="text-xs text-amber-600 mt-0.5">
                      ⚠ Outstanding: {fmtINR(selectedCustomer.openingBalance)}
                    </div>
                  )}
                </div>
                <CheckCircle2 size={20} className="text-indigo-500" />
              </div>
            )}

            {/* Customer list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {filteredCustomers.length === 0 ? (
                <div className="py-4 text-center text-sm text-gray-400">No customers found</div>
              ) : (
                filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setOrderCustomer(c.id); setCustSearch(''); }}
                    className={`w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${currentOrder?.customerId === c.id ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{c.firmName ?? c.name}</div>
                        {c.firmName && <div className="text-xs text-gray-600">{c.name}</div>}
                        <div className="text-xs text-gray-400">{c.mobile} · {c.city}</div>
                      </div>
                      <span className="text-xs text-gray-400">{c.paymentTerms}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => navigate('customer-form')}
                className="text-indigo-600 text-sm hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add New Customer
              </button>
              <button
                disabled={!currentOrder?.customerId}
                onClick={() => setStep(2)}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                Next: Add Products →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 2: Add Products ─── */}
      {step === 2 && (
        <div className="grid grid-cols-5 gap-6">
          {/* Left: Product Selector */}
          <div className="col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Add Products</h2>

            {/* Category filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {['', ...PRODUCT_CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat || 'All'}
                </button>
              ))}
            </div>

            {/* SKU grid */}
            {(() => {
              const skuCard = (sku: ProductSKU) => {
                const badge = packagingBadge(sku.variant);
                // Split weight into number + unit, e.g. "500 gm" or "26 kg"
                const parts = sku.variant.split(' ');
                const weightNum  = parts[0];  // "26", "5", "500"
                const weightUnit = parts[1];  // "kg", "gm"
                const isSelected = selectedSKU?.id === sku.id;

                const cardCls = badge.isPouch
                  ? `p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-purple-400 ring-2 ring-purple-300 bg-gradient-to-br from-purple-600 to-indigo-600'
                        : 'border-purple-300 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600'
                    }`
                  : `p-3 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }`;

                return (
                  <button
                    key={sku.id}
                    onClick={() => handleSelectSKU(sku)}
                    className={cardCls}
                  >
                    {/* Big weight number */}
                    <div className="flex items-end gap-1 leading-none mb-2">
                      <span className={`text-3xl font-extrabold leading-none ${ badge.isPouch ? 'text-white' : 'text-gray-800' }`}>{weightNum}</span>
                      <span className={`text-base font-semibold mb-0.5 ${ badge.isPouch ? 'text-white/80' : 'text-gray-500' }`}>{weightUnit}</span>
                    </div>
                    {/* Packaging type — larger text */}
                    <div className={`text-sm font-bold mt-1 ${ badge.isPouch ? 'text-white' : 'text-gray-700' }`}>
                      {badge.label}
                    </div>
                    {/* Subtle badge dot for pouches */}
                    {badge.isPouch && (
                      <div className="text-[10px] font-semibold text-purple-200 mt-0.5 uppercase tracking-wide">Premium</div>
                    )}
                    {/* Price */}
                    <div className={`text-xs mt-2 font-semibold ${ badge.isPouch ? 'text-white/90' : 'text-indigo-600' }`}>
                      {fmtINR(priceList[sku.id] ?? 0)} / {sku.unit}
                    </div>
                    {addedSku === sku.id && (
                      <div className={`text-xs font-medium mt-0.5 ${ badge.isPouch ? 'text-green-200' : 'text-green-600' }`}>✓ Added!</div>
                    )}
                  </button>
                );
              };

              const bags    = skusInCategory.filter(s => s.variant.includes('Bag'));
              const pouches = skusInCategory.filter(s => s.variant.includes('Pouch'));
              const others  = skusInCategory.filter(s => !s.variant.includes('Bag') && !s.variant.includes('Pouch'));
              const hasGroups = bags.length > 0 && pouches.length > 0;

              if (!hasGroups) {
                return (
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {skusInCategory.map(skuCard)}
                  </div>
                );
              }

              return (
                <div className="mb-5 space-y-4">
                  {bags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bags</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">{bags.map(skuCard)}</div>
                    </div>
                  )}
                  {pouches.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pouches</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">{pouches.map(skuCard)}</div>
                    </div>
                  )}
                  {others.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Other</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">{others.map(skuCard)}</div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Add form */}
            {selectedSKU && (
              <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4">
                <div className="text-sm font-semibold text-indigo-800 mb-3">
                  {selectedSKU.product} – {selectedSKU.variant}
                </div>
                <div className="grid grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="text-xs text-gray-600 font-medium">Quantity</label>
                    <input
                      type="number" min="1"
                      value={qty}
                      onChange={e => setQty(Number(e.target.value))}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">₹ per kg</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={perKgRate || ''}
                      placeholder="0.00"
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setPerKgRate(v);
                        setRate(parseFloat((v * (selectedSKU?.weight ?? 1)).toFixed(2)));
                      }}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 font-medium">₹ per {selectedSKU.unit.toLowerCase()}</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={rate || ''}
                      placeholder="0.00"
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0;
                        setRate(v);
                        setPerKgRate(selectedSKU.weight > 0 ? parseFloat((v / selectedSKU.weight).toFixed(2)) : 0);
                      }}
                      className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">Amount</div>
                    <div className="text-indigo-700 font-bold">{fmtINR(qty * rate)}</div>
                  </div>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={qty <= 0 || rate <= 0}
                  className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Add to Cart
                </button>
              </div>
            )}
          </div>

          {/* Right: Cart */}
          <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <ShoppingCart size={16} /> Cart
              {currentOrder && currentOrder.items.length > 0 && (
                <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">
                  {currentOrder.items.length}
                </span>
              )}
            </h2>

            {(!currentOrder || currentOrder.items.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">Cart is empty</div>
            ) : (
              <div className="space-y-2 mb-4">
                {currentOrder.items.map(item => {
                  const sku = PRODUCTS.find(p => p.id === item.skuId)!;
                  return (
                    <div key={item.skuId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{sku.product}</div>
                        <div className="text-xs text-gray-500">{sku.variant} × {item.quantity}</div>
                        <div className="text-xs text-indigo-600 font-semibold">{fmtINR(item.quantity * item.rate)}</div>
                      </div>
                      <button
                        onClick={() => removeCartItem(item.skuId)}
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t pt-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (approx)</span>
                <span>{fmtINR(subtotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800">
                <span>Est. Total</span>
                <span>{fmtINR(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                ← Back
              </button>
              <button
                disabled={!currentOrder || currentOrder.items.length === 0}
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium"
              >
                Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 3: Review & Confirm ─── */}
      {step === 3 && selectedCustomer && (
        <div className="max-w-2xl space-y-4">
          {/* Customer summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase font-medium">Customer</div>
                <div className="font-bold text-gray-800">{selectedCustomer.name}</div>
                <div className="text-sm text-gray-500">{selectedCustomer.mobile} · {selectedCustomer.city}, {selectedCustomer.state}</div>
              </div>
              {gstEnabled && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">GST Type</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${inter ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {inter ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}
                  </span>
                </div>
              )}
              {!gstEnabled && (
                <div className="text-right">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">GST Disabled</span>
                </div>
              )}
            </div>
            {/* Per-order GST toggle */}
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">Apply GST on this order</div>
                <div className="text-xs text-gray-400">Override the default GST setting for this order only</div>
              </div>
              <button
                type="button"
                onClick={() => setOrderGst(!gstEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gstEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${gstEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Product', 'Variant', 'Qty', 'Rate', ...(gstEnabled ? ['Taxable', 'GST'] : []), 'Total'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cartWithCalc.map(item => (
                  <tr key={item.skuId}>
                    <td className="px-4 py-3 font-medium">{item.sku.product}</td>
                    <td className="px-4 py-3 text-gray-500">{item.sku.variant}</td>
                    <td className="px-4 py-3">{item.quantity} {item.sku.unit}</td>
                    <td className="px-4 py-3">{fmtINR(item.rate)}</td>
                    {gstEnabled && <td className="px-4 py-3">{fmtINR(item.taxableValue)}</td>}
                    {gstEnabled && <td className="px-4 py-3 text-gray-500">{fmtINR(item.cgst + item.sgst + item.igst)}</td>}
                    <td className="px-4 py-3 font-semibold">{fmtINR(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t px-4 py-4 space-y-1 text-sm">
              {gstEnabled && (
                <div className="flex justify-end gap-8 text-gray-600">
                  <span>Subtotal</span><span>{fmtINR(subtotal)}</span>
                </div>
              )}
              {gstEnabled && inter && (
                <div className="flex justify-end gap-8 text-gray-600">
                  <span>IGST (5%)</span><span>{fmtINR(igstTotal)}</span>
                </div>
              )}
              {gstEnabled && !inter && (
                <>
                  <div className="flex justify-end gap-8 text-gray-600">
                    <span>CGST (2.5%)</span><span>{fmtINR(cgstTotal)}</span>
                  </div>
                  <div className="flex justify-end gap-8 text-gray-600">
                    <span>SGST (2.5%)</span><span>{fmtINR(sgstTotal)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-end gap-8 font-bold text-gray-800 border-t pt-2 text-base">
                <span>Grand Total</span><span>{fmtINR(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Stock alerts */}
          {stockAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="font-semibold text-amber-700 text-sm">Stock Warnings</span>
              </div>
              {stockAlerts.map((a, i) => (
                <div key={i} className="text-sm text-amber-800 ml-6">
                  ⚠ {a.label} – Available: {a.available}, Required: {a.required}
                </div>
              ))}
            </div>
          )}

          {/* Payment mode */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sale Date <span className="text-xs text-gray-400">(= Invoice Date)</span></label>
              <input
                type="text"
                value={saleDateDisplay}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                onChange={e => {
                  // Auto-insert '/' after DD and MM as user types; clear error + validity while editing
                  let raw = e.target.value.replace(/[^\d/]/g, '');
                  if (/^\d{2}$/.test(raw) && !saleDateDisplay.endsWith('/')) raw += '/';
                  else if (/^\d{2}\/\d{2}$/.test(raw) && !saleDateDisplay.endsWith('/')) raw += '/';
                  setSaleDateDisplay(raw);
                  setSaleDateError('');
                  setSaleDateValid(false);
                }}
                onBlur={() => {
                  const raw = saleDateDisplay;
                  if (!raw) return;
                  const DD_MM_YYYY = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(\d{4})$/;
                  const match = raw.match(DD_MM_YYYY);
                  if (match) {
                    const [, dd, mm, yyyy] = match;
                    const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    // Guard against invalid dates like 31/02/2026
                    if (
                      parsed.getFullYear() !== Number(yyyy) ||
                      parsed.getMonth() + 1 !== Number(mm) ||
                      parsed.getDate() !== Number(dd)
                    ) {
                      setSaleDateError('Invalid date');
                    } else {
                      const today = new Date(); today.setHours(0, 0, 0, 0);
                      if (parsed > today) {
                        setSaleDateError('Date cannot be in the future');
                      } else {
                        setSaleDateError('');
                        setSaleDateValid(true);
                        setSaleDate(`${yyyy}-${mm}-${dd}`);
                      }
                    }
                  } else {
                    setSaleDateError('Enter a valid date as DD/MM/YYYY');
                  }
                }}
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36 ${
                  saleDateError ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {saleDateError && <p className="text-xs text-red-500 mt-1">{saleDateError}</p>}
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
            <div className="flex gap-4">
              {(['Cash', 'Credit'] as const).map(mode => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMode"
                    checked={(currentOrder?.paymentMode ?? 'Cash') === mode}
                    onChange={() => setOrderPaymentMode(mode)}
                    className="text-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{mode}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50">
              ← Edit Items
            </button>
            <button
              onClick={handleGenerateInvoice}
              disabled={!saleDateValid || !!saleDateError}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} /> Generate Invoice
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
