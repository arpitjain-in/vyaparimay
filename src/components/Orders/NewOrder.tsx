import React, { useMemo, useState } from 'react';
import { Search, Plus, ShoppingCart, Trash2, AlertTriangle, CheckCircle2, ChevronRight, Eye, X, Minus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTS, PACKAGING_MATERIALS, PRODUCT_CATEGORIES, getRawMaterialId, applyTwinPackSplit, getReadyStockNeeds } from '../../data/products';
import { calcGST, isInterState } from '../../utils/gst';
import { fmtINR, formatDate, formatTime, getFYFromDate } from '../../utils/format';
import { numberToWords } from '../../utils/numberToWords';
import { buildThermalText, buildA4Html } from '../../utils/invoice';
import { ProductSKU, OrderItem } from '../../types';
import Layout from '../Layout/Layout';
import logoUrl from '../../assets/company-logo-v1.png';

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
      const names: Record<string, string> = { 'RM-WF': 'Shikharji Atta', 'RM-BS': 'Shikharji Besan', 'RM-DL': 'Shikharji Dalia', 'RM-BR': 'Shikharji Bran' };
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

interface NewOrderProps {
  // 'order' builds a real, stock-checked invoice; 'proforma' builds a
  // non-binding quote. The two modes keep entirely separate draft carts
  // (currentOrder vs currentProforma in the store) so building one never
  // touches the other. Proforma mode also never restricts adding items
  // based on ready stock (see selectedInsufficient below), since a proforma
  // has no stock effect either way.
  mode?: 'order' | 'proforma';
}

export default function NewOrder({ mode = 'order' }: NewOrderProps) {
  const {
    customers, currentOrder: currentOrderDraft, currentProforma, businessProfile,
    orderStep, proformaStep,
    setOrderStep, setProformaStep,
    setOrderCustomer, setProformaCustomer,
    upsertCartItem, upsertProformaCartItem,
    removeCartItem, removeProformaCartItem,
    generateInvoice, generateProformaInvoice,
    setOrderGst, setProformaGst,
    setOrderDiscount, setProformaDiscount,
    setOrderCharges, setProformaCharges,
    rawMaterialStock, packagingStock, readyStock, getReadyStockStatus, priceList, navigate,
  } = useStore();

  const isProforma = mode === 'proforma';
  // Everything below reads/writes through these mode-picked aliases so the
  // rest of the component doesn't need to know which draft it's touching.
  const currentOrder = isProforma ? currentProforma : currentOrderDraft;
  const step        = isProforma ? proformaStep      : orderStep;
  const setStep      = isProforma ? setProformaStep      : setOrderStep;
  const setOrderCustomerFn = isProforma ? setProformaCustomer : setOrderCustomer;
  const upsertItem   = isProforma ? upsertProformaCartItem : upsertCartItem;
  const removeItem   = isProforma ? removeProformaCartItem : removeCartItem;
  const setGstEnabled = isProforma ? setProformaGst      : setOrderGst;
  const setDiscount  = isProforma ? setProformaDiscount  : setOrderDiscount;
  const setCharges   = isProforma ? setProformaCharges   : setOrderCharges;

  const [transportInput, setTransportInput] = useState('');
  const [loadingInput, setLoadingInput] = useState('');
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
    ? PRODUCTS.filter(p => p.product === category && !p.hidden)
    : PRODUCTS.filter(p => !p.hidden);

  // Ready stock already committed to the cart (netted against total stock below),
  // so the "available to add" figure reflects what's left after existing cart lines.
  const cartReadyNeeds = useMemo(
    () => getReadyStockNeeds(currentOrder?.items ?? []),
    [currentOrder?.items],
  );

  // A SKU's ready stock lives on itself, or (for bundle SKUs like AT30 outer
  // bags) on its inner SKU — e.g. an AT30-HB3 bag needs 3 units of WF-10H.
  const readyStockUnitFor = (sku: ProductSKU) =>
    sku.innerSkuId && sku.innerSkuQty
      ? { id: sku.innerSkuId, qtyPerUnit: sku.innerSkuQty }
      : { id: sku.id, qtyPerUnit: 1 };

  // How many more of this SKU can be added to the cart right now, given
  // current ready stock minus what's already reserved by the cart.
  const availableToAdd = (sku: ProductSKU) => {
    const { id, qtyPerUnit } = readyStockUnitFor(sku);
    const remaining = (readyStock[id] ?? 0) - (cartReadyNeeds[id] ?? 0);
    return qtyPerUnit > 0 ? Math.floor(remaining / qtyPerUnit) : 0;
  };

  const handleSelectSKU = (sku: ProductSKU) => {
    setSelectedSKU(sku);
    setQty(1);
    const bagRate = priceList[sku.id] ?? 0;
    setRate(bagRate);
    setPerKgRate(sku.weight > 0 ? parseFloat((bagRate / sku.weight).toFixed(2)) : 0);
  };

  const selectedAvailable = selectedSKU ? availableToAdd(selectedSKU) : 0;
  // A proforma is a non-binding quote — it never reserves or deducts stock,
  // so unlike a real order it's never blocked by what's on hand.
  const selectedInsufficient = mode === 'order' && !!selectedSKU && qty > selectedAvailable;

  const handleAddToCart = () => {
    if (!selectedSKU || qty <= 0 || rate <= 0 || selectedInsufficient) return;
    upsertItem(selectedSKU.id, qty, rate);
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

  const cartWithCalc = applyTwinPackSplit(currentOrder?.items ?? []).map(item => {
    const sku = PRODUCTS.find(p => p.id === item.skuId)!;
    const tv = item.quantity * item.rate;
    const gstRate = sku.weight > 25 ? 0 : sku.gstRate;
    const { cgst, sgst, igst } = gstEnabled ? calcGST(tv, gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
    return { ...item, sku, taxableValue: tv, cgst, sgst, igst, lineTotal: tv + cgst + sgst + igst };
  });

  const subtotal  = cartWithCalc.reduce((a, i) => a + i.taxableValue, 0);
  const cgstTotal = cartWithCalc.reduce((a, i) => a + i.cgst, 0);
  const sgstTotal = cartWithCalc.reduce((a, i) => a + i.sgst, 0);
  const igstTotal = cartWithCalc.reduce((a, i) => a + i.igst, 0);
  const preDiscount = subtotal + cgstTotal + sgstTotal + igstTotal;
  const discountType  = currentOrder?.discountType;
  const discountValue = currentOrder?.discountValue ?? 0;
  const discountAmount = discountType && discountValue > 0
    ? (discountType === 'percent' ? parseFloat((preDiscount * discountValue / 100).toFixed(2)) : discountValue)
    : 0;
  const transportCharges = currentOrder?.transportCharges ?? 0;
  const loadingCharges   = currentOrder?.loadingCharges   ?? 0;
  const grandTotal = Math.round(preDiscount - discountAmount + transportCharges + loadingCharges);

  const stockAlerts = useMemo(
    () => getStockAlerts(currentOrder?.items ?? [], rawMaterialStock, packagingStock),
    [currentOrder?.items, rawMaterialStock, packagingStock],
  );

  const handleGenerateInvoice = () => {
    generateInvoice(saleDate);
  };

  // Proforma invoices are a non-binding preliminary quote: generating one does
  // not touch stock or the real invoice sequence, and the cart stays intact
  // afterward so the user can still finalize a real invoice from here.
  const handleGenerateProforma = () => {
    const proforma = generateProformaInvoice(saleDate);
    if (!proforma || !businessProfile) return;
    const html = buildA4Html(proforma, businessProfile, undefined, logoUrl)
      .replace('</body>', `<script>
        window.onafterprint=function(){window.close()};
        var __printed=false;
        function __doPrint(){ if(__printed) return; __printed=true; window.print(); }
        var __imgs=document.images, __pending=0;
        for (var i=0;i<__imgs.length;i++) {
          if (!__imgs[i].complete) {
            __pending++;
            __imgs[i].addEventListener('load', function(){ if(--__pending<=0) __doPrint(); });
            __imgs[i].addEventListener('error', function(){ if(--__pending<=0) __doPrint(); });
          }
        }
        if (__pending===0) __doPrint();
        setTimeout(__doPrint, 3000);
      <\/script></body>`);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handlePrintPreview = () => {
    if (!currentOrder || !businessProfile || !selectedCustomer) return;
    const invoiceDateObj = saleDate
      ? (() => { const [y, m, d] = saleDate.split('-').map(Number); return new Date(y, m - 1, d); })()
      : new Date();
    const fy = getFYFromDate(invoiceDateObj);
    const now = new Date();
    const items: OrderItem[] = applyTwinPackSplit(currentOrder.items).map(cartItem => {
      const sku = PRODUCTS.find(p => p.id === cartItem.skuId)!;
      const taxableValue = cartItem.quantity * cartItem.rate;
      const gstRate = sku.weight > 25 ? 0 : sku.gstRate;
      const raw = gstEnabled ? calcGST(taxableValue, gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
      const { cgst, sgst, igst } = raw;
      return { ...cartItem, product: sku.product, variant: (sku.innerSkuId || sku.useIdAsLabel) ? sku.id : sku.variant, weight: sku.weight,
        hsnCode: sku.hsnCode, gstRate, unit: sku.unit,
        taxableValue, cgst, sgst, igst, lineTotal: taxableValue + cgst + sgst + igst };
    });
    const sub  = items.reduce((a, i) => a + i.taxableValue, 0);
    const cgst = items.reduce((a, i) => a + i.cgst, 0);
    const sgst = items.reduce((a, i) => a + i.sgst, 0);
    const igst = items.reduce((a, i) => a + i.igst, 0);
    const preDsc = sub + cgst + sgst + igst;
    const dscType  = currentOrder.discountType;
    const dscVal   = currentOrder.discountValue ?? 0;
    const dscAmt   = dscType && dscVal > 0
      ? (dscType === 'percent' ? parseFloat((preDsc * dscVal / 100).toFixed(2)) : dscVal)
      : 0;
    const tCharge = currentOrder.transportCharges ?? 0;
    const lCharge = currentOrder.loadingCharges   ?? 0;
    const gTotal = Math.round(preDsc - dscAmt + tCharge + lCharge);
    const dummy = {
      id: 'preview',
      invoiceNo: `PREVIEW-${fy}`,
      invoiceDate: formatDate(invoiceDateObj),
      invoiceTime: formatTime(now),
      customerId: selectedCustomer.id,
      customerSnapshot: { ...selectedCustomer },
      items,
      subtotal: sub,
      cgstTotal: cgst,
      sgstTotal: sgst,
      igstTotal: igst,
      totalGST: cgst + sgst + igst,
      discountType:     dscType ?? undefined,
      discountValue:    dscVal > 0 ? dscVal : undefined,
      discountAmount:   dscAmt > 0 ? dscAmt : undefined,
      transportCharges: tCharge > 0 ? tCharge : undefined,
      loadingCharges:   lCharge > 0 ? lCharge : undefined,
      roundOff: parseFloat((gTotal - (preDsc - dscAmt + tCharge + lCharge)).toFixed(2)),
      grandTotal: gTotal,
      isInterState: inter,
      paymentMode: currentOrder.paymentMode,
      amountInWords: numberToWords(gTotal),
      financialYear: fy,
      cancelled: false,
    };
    const text = buildThermalText(dummy, businessProfile);
    const w = window.open('', '_blank', 'width=302,height=600');
    if (!w) return;
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8" /><title>Preview – ${dummy.invoiceNo}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm 3mm; }
        * { box-sizing: border-box; }
        html, body { width: 80mm; max-width: 80mm; margin: 0; padding: 0;
          font-family: 'Courier New', Courier, monospace; font-size: 12px;
          font-weight: bold; line-height: 1.35; color: #000; background: #fff; }
        pre { white-space: pre; margin: 0; width: 100%; font-weight: bold; }
      </style>
    </head><body><pre>${escaped}</pre><script>window.onafterprint=function(){window.close()};window.print();<\/script></body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <Layout title={mode === 'proforma' ? 'Proforma Invoice' : 'New Order'}>
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
                    onClick={() => { setOrderCustomerFn(c.id); setCustSearch(''); }}
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
        <>
        {mode === 'proforma' && (
          <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <Eye size={16} className="text-amber-600 shrink-0" />
            <span className="text-sm text-amber-800">
              Building a <span className="font-semibold">Proforma Invoice</span> — a non-binding quote. Ready stock figures are shown for reference only and won't stop you from adding items.
            </span>
          </div>
        )}
        {selectedCustomer && (
          <div className="mb-4 flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2">
            <CheckCircle2 size={16} className="text-indigo-500 shrink-0" />
            <span className="text-sm text-indigo-800">
              Customer: <span className="font-semibold">{selectedCustomer.firmName ?? selectedCustomer.name}</span>
              {selectedCustomer.firmName && <span className="text-indigo-600"> ({selectedCustomer.name})</span>}
            </span>
          </div>
        )}
        <div className={`grid grid-cols-5 gap-6 transition-all ${selectedSKU ? 'pb-28' : ''}`}>
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
                const isSelected = selectedSKU?.id === sku.id;
                const isBundle = !!(sku.innerSkuId && sku.innerSkuQty);

                // Ready-stock badge: how many of this exact SKU can still be added.
                const { id: stockUnitId } = readyStockUnitFor(sku);
                const stockLeft = availableToAdd(sku);
                const stockStatus = getReadyStockStatus(stockUnitId);
                const stockLabel = stockStatus === 'out' ? 'Out of stock' : `${stockLeft} in stock`;
                const stockClsOn = (light: string) => // for solid/gradient (pouch) card backgrounds
                  stockStatus === 'out' ? 'text-red-200' : stockStatus === 'low' ? 'text-amber-200' : light;
                const stockClsOff = (normal: string) => // for plain white/gray card backgrounds
                  stockStatus === 'out' ? 'text-red-500' : stockStatus === 'low' ? 'text-amber-600' : normal;

                // ── Bundle card (AT30 outer bags) ──────────────────────────
                if (isBundle) {
                  const innerSku = PRODUCTS.find(p => p.id === sku.innerSkuId);
                  const innerWeight = innerSku?.weight ?? 0;
                  const innerType = sku.variant.includes('Pouch') ? 'Pouch' : 'Handle Bag';
                  const isInnerPouch = innerType === 'Pouch';
                  const bundleCls = isInnerPouch
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
                  const tc = (normal: string, pouch: string) => isInnerPouch ? pouch : normal;
                  return (
                    <button key={sku.id} onClick={() => handleSelectSKU(sku)} className={bundleCls}>
                      {/* SKU ID */}
                      <div className={`text-xs font-mono font-bold tracking-wide mb-1 ${tc('text-indigo-500', 'text-purple-200')}`}>
                        {sku.id}
                      </div>
                      {/* Inner breakdown: e.g. 3 × 10 kg */}
                      <div className="flex items-end gap-0.5 leading-none mb-1">
                        <span className={`text-xl font-extrabold leading-none ${tc('text-gray-800', 'text-white')}`}>
                          {sku.innerSkuQty} × {innerWeight}
                        </span>
                        <span className={`text-sm font-semibold mb-0.5 ${tc('text-gray-500', 'text-white/80')}`}>kg</span>
                      </div>
                      {/* Inner type */}
                      <div className={`text-sm font-bold ${tc('text-gray-700', 'text-white')}`}>{innerType}</div>
                      {/* Outer bag total */}
                      <div className={`text-[10px] mt-0.5 ${tc('text-gray-400', 'text-purple-200')}`}>{sku.weight} kg outer bag</div>
                      {/* Price */}
                      <div className={`text-xs mt-2 font-semibold ${tc('text-indigo-600', 'text-white/90')}`}>
                        {fmtINR(priceList[sku.id] ?? 0)} / {sku.unit}
                      </div>
                      {/* Ready stock */}
                      <div className={`text-[10px] font-semibold mt-1 ${tc(stockClsOff('text-gray-400'), stockClsOn('text-purple-200'))}`}>
                        {stockLabel}
                      </div>
                      {addedSku === sku.id && (
                        <div className={`text-xs font-medium mt-0.5 ${tc('text-green-600', 'text-green-200')}`}>✓ Added!</div>
                      )}
                    </button>
                  );
                }

                // ── Standard card ──────────────────────────────────────────
                // Split weight into number + unit, e.g. "500 gm" or "26 kg"
                const parts = sku.variant.split(' ');
                const weightNum  = parts[0];
                const weightUnit = parts[1];
                // Extra weight badge, e.g. "+ 100 gm" in "25 kg + 100 gm Bag"
                const extraMatch = sku.variant.match(/\+\s*(\d+(?:\.\d+)?)\s*(gm|kg)/);
                const extraLabel = extraMatch ? `+${extraMatch[1]} ${extraMatch[2]}` : null;

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
                    <div className="flex items-end gap-1 leading-none mb-2 flex-wrap">
                      <span className={`text-3xl font-extrabold leading-none ${ badge.isPouch ? 'text-white' : 'text-gray-800' }`}>{weightNum}</span>
                      <span className={`text-base font-semibold mb-0.5 ${ badge.isPouch ? 'text-white/80' : 'text-gray-500' }`}>{weightUnit}</span>
                      {extraLabel && (
                        <span className="text-xs font-bold text-orange-500 mb-0.5 bg-orange-50 border border-orange-200 rounded px-1">{extraLabel}</span>
                      )}
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
                    {/* Ready stock */}
                    <div className={`text-[10px] font-semibold mt-1 ${ badge.isPouch ? stockClsOn('text-white/70') : stockClsOff('text-gray-400') }`}>
                      {stockLabel}
                    </div>
                    {addedSku === sku.id && (
                      <div className={`text-xs font-medium mt-0.5 ${ badge.isPouch ? 'text-green-200' : 'text-green-600' }`}>✓ Added!</div>
                    )}
                  </button>
                );
              };

              const pouches = skusInCategory.filter(s => s.variant.includes('Pouch'));
              const bags    = skusInCategory.filter(s => s.variant.includes('Bag') && !s.variant.includes('Pouch'));
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
                  const { id: stockUnitId } = readyStockUnitFor(sku);
                  const shortage = (cartReadyNeeds[stockUnitId] ?? 0) - (readyStock[stockUnitId] ?? 0);
                  return (
                    <div key={item.skuId} className={`flex items-center justify-between p-3 rounded-lg ${shortage > 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{sku.product}</div>
                        <div className="text-xs text-gray-500">{sku.variant} × {item.quantity} &nbsp;·&nbsp; {(sku.weight * item.quantity) % 1 === 0 ? (sku.weight * item.quantity).toFixed(0) : (sku.weight * item.quantity).toFixed(1)} kg</div>
                        <div className="text-xs text-indigo-600 font-semibold">{fmtINR(item.quantity * item.rate)}</div>
                        {shortage > 0 && (
                          <div className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1">
                            <AlertTriangle size={11} /> Short by {shortage} in ready stock
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.skuId)}
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

        {/* ─── Sticky add bar ─── */}
        {selectedSKU && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-indigo-300 shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
            <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">

              {/* SKU label */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Selected</div>
                <div className="text-sm font-bold text-gray-800 truncate">
                  {selectedSKU.product} &mdash; {(selectedSKU.innerSkuId || selectedSKU.useIdAsLabel) ? selectedSKU.id : selectedSKU.variant}
                </div>
                <div className={`text-xs font-medium mt-0.5 ${mode === 'order' && selectedAvailable <= 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  Ready stock: {selectedAvailable} {selectedSKU.unit.toLowerCase()}{selectedAvailable === 1 ? '' : 's'} available
                  {mode === 'proforma' && ' (not reserved for a proforma)'}
                </div>
              </div>

              {/* Qty stepper */}
              <div className="flex items-center gap-2">
                <div>
                  <span className="text-xs text-gray-500 font-medium">Qty</span>
                  <div className={`flex items-center border rounded-lg overflow-hidden ${selectedInsufficient ? 'border-red-400' : 'border-gray-300'}`}>
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="px-2.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"
                    ><Minus size={14} /></button>
                    <input
                      type="number" min="1"
                      value={qty}
                      onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 px-2 py-2 text-center text-sm border-x border-gray-300 focus:outline-none focus:bg-indigo-50"
                    />
                    <button
                      onClick={() => setQty(q => q + 1)}
                      className="px-2.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600"
                    ><Plus size={14} /></button>
                  </div>
                  {selectedInsufficient && (
                    <div className="text-[11px] text-red-600 font-medium mt-0.5 whitespace-nowrap">
                      Only {Math.max(selectedAvailable, 0)} available
                    </div>
                  )}
                </div>
              </div>

              {/* Rate per kg */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">₹ / kg</span>
                <input
                  type="number" min="0" step="0.01"
                  value={perKgRate || ''}
                  placeholder="0.00"
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setPerKgRate(v);
                    setRate(parseFloat((v * (selectedSKU.weight ?? 1)).toFixed(2)));
                  }}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Rate per unit */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">₹ / {selectedSKU.unit.toLowerCase()}</span>
                <input
                  type="number" min="0" step="0.01"
                  value={rate || ''}
                  placeholder="0.00"
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    setRate(v);
                    setPerKgRate(selectedSKU.weight > 0 ? parseFloat((v / selectedSKU.weight).toFixed(2)) : 0);
                  }}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Amount */}
              <div className="text-right min-w-[90px]">
                <div className="text-xs text-gray-400">Amount</div>
                <div className="text-base font-bold text-indigo-700">{fmtINR(qty * rate)}</div>
              </div>

              {/* Add button */}
              <button
                onClick={handleAddToCart}
                disabled={qty <= 0 || rate <= 0 || selectedInsufficient}
                title={selectedInsufficient ? 'Not enough ready stock for this quantity' : undefined}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Plus size={15} /> Add to Cart
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setSelectedSKU(null)}
                className="text-gray-400 hover:text-gray-600 p-1 shrink-0"
              ><X size={18} /></button>

            </div>
          </div>
        )}
        </>
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
                onClick={() => setGstEnabled(!gstEnabled)}
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
                  {['Product', 'Variant', 'Qty', 'Wt (kg)', 'Rate', ...(gstEnabled ? ['Taxable', 'GST'] : []), 'Total'].map(h => (
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
                    <td className="px-4 py-3 text-gray-600">{(item.sku.weight * item.quantity) % 1 === 0 ? (item.sku.weight * item.quantity).toFixed(0) : (item.sku.weight * item.quantity).toFixed(1)} kg</td>
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
              {discountAmount > 0 && (
                <div className="flex justify-end gap-8 text-green-600">
                  <span>Discount {discountType === 'percent' ? `(${discountValue}%)` : '(Flat)'}</span>
                  <span>– {fmtINR(discountAmount)}</span>
                </div>
              )}
              {transportCharges > 0 && (
                <div className="flex justify-end gap-8 text-orange-700">
                  <span>Transport</span><span>+ {fmtINR(transportCharges)}</span>
                </div>
              )}
              {loadingCharges > 0 && (
                <div className="flex justify-end gap-8 text-orange-700">
                  <span>Loading / Unloading</span><span>+ {fmtINR(loadingCharges)}</span>
                </div>
              )}
              <div className="flex justify-end gap-8 font-bold text-gray-800 border-t pt-2 text-base">
                <span>Grand Total</span><span>{fmtINR(grandTotal)}</span>
              </div>
              <div className="flex justify-end gap-8 text-gray-500 text-sm pt-1">
                <span>Total Weight</span>
                <span>{(() => { const kg = (currentOrder?.items ?? []).reduce((s, ci) => { const sk = PRODUCTS.find(p => p.id === ci.skuId); return s + (sk?.weight ?? 0) * ci.quantity; }, 0); return kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1); })()} kg</span>
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
            {/* Discount */}
            <div className="mb-5 pb-5 border-b">
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount <span className="text-xs text-gray-400">(optional)</span></label>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  {(['flat', 'percent'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDiscount(t, discountValue)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        (discountType ?? 'flat') === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t === 'flat' ? '₹ Flat' : '% Percent'}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  step={discountType === 'percent' ? '0.01' : '1'}
                  max={discountType === 'percent' ? 100 : undefined}
                  placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 500'}
                  value={discountValue || ''}
                  onChange={e => setDiscount(discountType ?? 'flat', parseFloat(e.target.value) || 0)}
                  className="w-32 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                {discountValue > 0 && (
                  <div className="text-sm text-green-700 font-semibold">
                    – {fmtINR(discountAmount)}
                  </div>
                )}
                {discountValue > 0 && (
                  <button
                    type="button"
                    onClick={() => setDiscount(null, 0)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >Clear</button>
                )}
              </div>
            </div>
            {/* Additional Charges */}
            <div className="mb-5 pb-5 border-b">
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Charges <span className="text-xs text-gray-400">(optional)</span></label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Transport</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number" min="0" step="1"
                      placeholder="0"
                      value={transportInput}
                      onChange={e => {
                        setTransportInput(e.target.value);
                        const v = parseFloat(e.target.value) || 0;
                        setCharges(v, loadingCharges);
                      }}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Loading / Unloading</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number" min="0" step="1"
                      placeholder="0"
                      value={loadingInput}
                      onChange={e => {
                        setLoadingInput(e.target.value);
                        const v = parseFloat(e.target.value) || 0;
                        setCharges(transportCharges, v);
                      }}
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                </div>
              </div>
            </div>

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
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50">
              ← Edit Items
            </button>
            {mode === 'proforma' ? (
              <button
                onClick={handleGenerateProforma}
                disabled={!saleDateValid || !!saleDateError}
                className="flex items-center justify-center gap-2 border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-lg text-sm font-medium"
                title="Generate a non-binding proforma invoice — no stock deducted"
              >
                <Eye size={16} /> Generate Proforma
              </button>
            ) : (
              <button
                onClick={handleGenerateInvoice}
                disabled={!saleDateValid || !!saleDateError}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Generate Invoice
              </button>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
