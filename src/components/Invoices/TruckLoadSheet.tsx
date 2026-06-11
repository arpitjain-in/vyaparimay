import React, { useMemo } from 'react';
import { X, Printer, Truck } from 'lucide-react';
import { Invoice } from '../../types';

// Pouches per outer bag, keyed by skuId
const OUTER_BAG_RATIO: Record<string, number> = {
  'WF-5P':  6,
  'WF-10P': 3,
};

interface Props {
  invoices: Invoice[];
  onClose: () => void;
}

interface SKUSummary {
  skuId: string;
  product: string;
  variant: string;
  unit: string;
  totalQty: number;
  totalWeight: number;
}

export default function TruckLoadSheet({ invoices, onClose }: Props) {
  const rows = useMemo(() => {
    const map = new Map<string, SKUSummary>();
    for (const inv of invoices) {
      for (const item of inv.items) {
        const r = map.get(item.skuId);
        if (r) {
          r.totalQty += item.quantity;
          r.totalWeight += item.quantity * item.weight;
        } else {
          map.set(item.skuId, {
            skuId: item.skuId,
            product: item.product,
            variant: item.variant,
            unit: item.unit,
            totalQty: item.quantity,
            totalWeight: item.quantity * item.weight,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [invoices]);

  const grouped = useMemo(() => {
    const g = new Map<string, SKUSummary[]>();
    for (const r of rows) {
      const arr = g.get(r.product) ?? [];
      arr.push(r);
      g.set(r.product, arr);
    }
    return g;
  }, [rows]);

  const grandTotalQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const grandTotalWeight = rows.reduce((s, r) => s + r.totalWeight, 0);

  const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

  const qtyLabel = (skuId: string, qty: number) => {
    const ratio = OUTER_BAG_RATIO[skuId];
    if (!ratio) return String(qty);
    return `${qty} (${Math.ceil(qty / ratio)})`;
  };

  const handlePrint = () => {
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const invoiceLines = invoices
      .map(inv => `<div>${inv.invoiceNo} &ndash; ${inv.customerSnapshot.name}</div>`)
      .join('');

    const bodyRows = Array.from(grouped.entries()).map(([product, skus]) => {
      const header = `<tr><td colspan="3" class="product-header">${product}</td></tr>`;
      const skuRows = skus.map(sku =>
        `<tr>
          <td>${sku.variant}</td>
          <td class="center">${qtyLabel(sku.skuId, sku.totalQty)}</td>
          <td class="right">${fmt(sku.totalWeight)} kg</td>
        </tr>`
      ).join('');
      return header + skuRows;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Truck Load Sheet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 72mm;
      padding: 3mm 2mm;
    }
    h1 { font-size: 14px; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
    .meta { font-size: 10px; text-align: center; margin-bottom: 4px; }
    .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .invoices { font-size: 10px; margin-bottom: 4px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; border-bottom: 1px solid #000; padding: 2px 2px; text-align: left; }
    td { font-size: 11px; padding: 2px 2px; vertical-align: top; }
    .product-header { font-weight: bold; font-size: 11px; padding-top: 6px; text-transform: uppercase; }
    .center { text-align: center; }
    .right { text-align: right; }
    tfoot td { border-top: 1px solid #000; font-weight: bold; padding-top: 4px; }
    @page { size: 80mm auto; margin: 0; }
  </style>
</head>
<body>
  <h1>TRUCK LOAD SHEET</h1>
  <div class="meta">${date} &nbsp;|&nbsp; ${invoices.length} Invoice${invoices.length !== 1 ? 's' : ''}</div>
  <hr class="dash" />
  <div class="invoices">${invoiceLines}</div>
  <hr class="dash" />
  <table>
    <thead>
      <tr>
        <th>Variant</th>
        <th class="center">Qty</th>
        <th class="right">Weight</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td>TOTAL</td>
        <td class="center">${grandTotalQty}</td>
        <td class="right">${fmt(grandTotalWeight)} kg</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=320,height=600');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.addEventListener('afterprint', () => w.close());
  };

  return (
    <div id="truck-load-sheet" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-indigo-500" />
            <h2 className="font-bold text-slate-800 text-lg">Truck Load Sheet</h2>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="no-print flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
            >
              <Printer size={14} />
              Print
            </button>
            <button onClick={onClose} className="no-print text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Invoice chips */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-1.5">
          {invoices.map(inv => (
            <span key={inv.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-mono">
              {inv.invoiceNo} · {inv.customerSnapshot.name}
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No items in selected invoices.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Product / Variant</th>
                  <th className="pb-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">Unit</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Qty</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Weight (kg)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(grouped.entries()).map(([product, skus]) => (
                  <React.Fragment key={product}>
                    <tr>
                      <td colSpan={4} className="pt-4 pb-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {product}
                      </td>
                    </tr>
                    {skus.map(sku => (
                      <tr key={sku.skuId} className="border-b border-slate-50">
                        <td className="py-2 pl-4 text-slate-700">{sku.variant}</td>
                        <td className="py-2 text-center text-slate-500">{sku.unit}</td>
                        <td className="py-2 text-right font-bold text-slate-800">
                          {sku.totalQty}
                          {OUTER_BAG_RATIO[sku.skuId] && (
                            <span className="font-normal text-slate-400 ml-1">
                              ({Math.ceil(sku.totalQty / OUTER_BAG_RATIO[sku.skuId])})
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-slate-600">{fmt(sku.totalWeight)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={2} className="py-3 pl-4 font-bold text-slate-700">Grand Total</td>
                  <td className="py-3 text-right font-bold text-indigo-600 text-base">{grandTotalQty}</td>
                  <td className="py-3 text-right font-bold text-slate-700">{fmt(grandTotalWeight)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
