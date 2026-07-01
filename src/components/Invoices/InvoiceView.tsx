import React, { useMemo, useRef } from 'react';
import { ArrowLeft, Printer, Copy } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR } from '../../utils/format';
import { buildThermalText, buildCustomerCopyText, buildA4Html, buildA4HalfHtml } from '../../utils/invoice';
import Layout from '../Layout/Layout';
import logoUrl from '../../assets/company-logo-v1.png';

export default function InvoiceView() {
  const { selectedInvoiceId, invoices, businessProfile, navigate, showDialog } = useStore();
  const preRef = useRef<HTMLPreElement>(null);

  const invoice = useMemo(
    () => invoices.find(inv => inv.id === selectedInvoiceId),
    [invoices, selectedInvoiceId],
  );

  const thermalText = useMemo(
    () => invoice && businessProfile ? buildThermalText(invoice, businessProfile) : '',
    [invoice, businessProfile],
  );
  const customerCopyText = useMemo(
    () => invoice && businessProfile ? buildCustomerCopyText(invoice, businessProfile) : '',
    [invoice, businessProfile],
  );

  if (!invoice || !businessProfile) {
    return (
      <Layout title="Invoice">
        <div className="text-center py-12 text-gray-400">Invoice not found.</div>
      </Layout>
    );
  }

  const PRINT_SCRIPT = `<script>window.onafterprint=function(){window.close()};window.print();<\/script>`;

  const handlePrint = (text: string, title: string) => {
    const w = window.open('', '_blank', 'width=302,height=600');
    if (!w) return;
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 3mm 3mm;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          width: 80mm;
          max-width: 80mm;
          margin: 0;
          padding: 0;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          font-weight: bold;
          line-height: 1.35;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        pre {
          white-space: pre;
          word-wrap: break-word;
          overflow-wrap: break-word;
          margin: 0;
          width: 100%;
          font-weight: bold;
        }
      </style>
    </head><body><pre>${escaped}</pre>${PRINT_SCRIPT}</body></html>`);
    w.document.close();
    w.focus();
  };

  const handleA4Print = (copyLabel?: string) => {
    const html = buildA4Html(invoice, businessProfile, copyLabel, logoUrl)
      .replace('</body>', `${PRINT_SCRIPT}</body>`);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleA4HalfPrint = () => {
    const html = buildA4HalfHtml(invoice, businessProfile, logoUrl)
      .replace('</body>', `${PRINT_SCRIPT}</body>`);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(thermalText).then(() =>
      showDialog({ title: 'Copied', variant: 'success', message: 'Invoice text copied to clipboard.' })
    );
  };

  const ci = invoice.customerSnapshot;

  return (
    <Layout
      title={`Invoice – ${invoice.invoiceNo}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('invoice-history')}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm border border-gray-300 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft size={15} /> Back
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 border border-gray-300 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Copy size={14} /> Copy Text
          </button>
          <button
            onClick={() => handlePrint(thermalText, invoice.invoiceNo)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> 80mm Original
          </button>
          <button
            onClick={() => handlePrint(customerCopyText, invoice.invoiceNo + ' – Customer Copy')}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> 80mm Copy
          </button>
          <button
            onClick={() => handleA4Print()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> A4 Original
          </button>
          <button
            onClick={() => handleA4Print('CUSTOMER COPY')}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> A4 Copy
          </button>
          <button
            onClick={handleA4HalfPrint}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> A4 Half (2-up)
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-5 gap-6">
        {/* Left: Details */}
        <div className="col-span-3 space-y-4">
          {/* Header info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-400 font-medium uppercase mb-2">Bill To</div>
                <div className="font-bold text-gray-800">{ci.name}</div>
                {ci.firmName && <div className="text-gray-600">{ci.firmName}</div>}
                <div className="text-gray-500">{ci.address1}</div>
                <div className="text-gray-500">{ci.city} – {ci.state}</div>
                <div className="text-gray-500">{ci.mobile}</div>
                {ci.gstin && <div className="text-gray-500">GSTIN: {ci.gstin}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400 font-medium uppercase mb-2">Invoice Details</div>
                <div className="font-mono text-indigo-600 font-bold text-lg">{invoice.invoiceNo}</div>
                <div className="text-gray-600">{invoice.invoiceDate} {invoice.invoiceTime}</div>
                <div className="mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    invoice.isInterState ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {invoice.isInterState ? 'IGST (Inter-State)' : 'CGST+SGST (Intra)'}
                  </span>
                </div>
                {invoice.cancelled && (
                  <div className="mt-1">
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-600">CANCELLED</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['#', 'Product', 'HSN', 'Qty / Weight', 'Rate', 'Taxable', 'GST Amt', 'Total'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-red-500 bg-red-50">
                      ⚠️ No items found for this invoice. The item data may not have been saved to the database correctly. Please check with support or re-create this invoice.
                    </td>
                  </tr>
                ) : invoice.items.map((item, i) => {
                  const gstAmt = item.cgst + item.sgst + item.igst;
                  const totalKg = item.weight * item.quantity;
                  const totalKgStr = totalKg % 1 === 0 ? totalKg.toFixed(0) : totalKg.toFixed(1);
                  const perKg = item.weight > 0 ? item.rate / item.weight : 0;
                  const perKgStr = perKg % 1 === 0 ? perKg.toFixed(0) : perKg.toFixed(2);
                  const unitPlural = item.quantity === 1 ? item.unit : item.unit + 's';
                  return (
                    <tr key={item.skuId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-gray-400 text-center">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-gray-800">{item.product}</div>
                        <div className="text-xs text-indigo-500 font-medium mt-0.5">{item.variant}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-400">{item.hsnCode}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800">{item.quantity} {unitPlural}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{totalKgStr} kg total</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800">{fmtINR(item.rate)}<span className="text-xs text-gray-400 font-normal">/{item.unit.toLowerCase()}</span></div>
                        <div className="text-xs text-gray-400 mt-0.5">₹{perKgStr}/kg</div>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{fmtINR(item.taxableValue)}</td>
                      <td className="px-3 py-3 text-gray-500">{fmtINR(gstAmt)}<span className="text-xs text-gray-400 ml-1">@{item.gstRate}%</span></td>
                      <td className="px-3 py-3 font-bold text-gray-800">{fmtINR(item.lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* GST Breakup */}
            <div className="border-t bg-gray-50 px-4 py-4">
              <div className="max-w-xs ml-auto space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal (Taxable)</span>
                  <span>{fmtINR(invoice.subtotal)}</span>
                </div>
                {invoice.isInterState ? (
                  <div className="flex justify-between text-gray-600">
                    <span>IGST @5%</span><span>{fmtINR(invoice.igstTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>CGST @2.5%</span><span>{fmtINR(invoice.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST @2.5%</span><span>{fmtINR(invoice.sgstTotal)}</span>
                    </div>
                  </>
                )}
                {invoice.discountAmount != null && invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-green-700 font-medium">
                    <span>
                      Discount{invoice.discountType === 'percent'
                        ? ` @ ${invoice.discountValue}%`
                        : ' (Flat)'}
                    </span>
                    <span>– {fmtINR(invoice.discountAmount)}</span>
                  </div>
                )}
                {invoice.transportCharges != null && invoice.transportCharges > 0 && (
                  <div className="flex justify-between text-orange-700 font-medium">
                    <span>Transport</span>
                    <span>+ {fmtINR(invoice.transportCharges)}</span>
                  </div>
                )}
                {invoice.loadingCharges != null && invoice.loadingCharges > 0 && (
                  <div className="flex justify-between text-orange-700 font-medium">
                    <span>Loading / Unloading</span>
                    <span>+ {fmtINR(invoice.loadingCharges)}</span>
                  </div>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Round Off</span>
                    <span>{invoice.roundOff > 0 ? '+' : ''}{invoice.roundOff.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-800 text-base border-t pt-2">
                  <span>Grand Total</span>
                  <span>{fmtINR(invoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-sm pt-1">
                  <span>Total Weight</span>
                  <span>{(() => { const kg = invoice.items.reduce((s, i) => s + i.weight * i.quantity, 0); return kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1); })()} kg</span>
                </div>
                <div className="text-xs text-gray-500 italic pt-1">{invoice.amountInWords}</div>
              </div>
            </div>
          </div>

          {/* Payment / Bank */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-sm text-gray-600">
            <div className="font-medium text-gray-700 mb-2">Payment Information</div>
            <div>Mode: <span className="font-semibold">{invoice.paymentMode}</span></div>
            {businessProfile.upiId && <div>UPI: {businessProfile.upiId}</div>}
            {businessProfile.bankName && (
              <div>
                {businessProfile.bankName}
                {businessProfile.accountNo && ` – A/C: ${businessProfile.accountNo}`}
                {businessProfile.ifscCode && ` – IFSC: ${businessProfile.ifscCode}`}
              </div>
            )}
          </div>
        </div>

        {/* Right: Thermal Preview */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-4">
            <div className="text-xs text-gray-400 uppercase font-medium mb-2">Thermal Preview (80mm)</div>
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg overflow-x-auto">
              <pre
                ref={preRef}
                className="font-mono text-xs text-gray-700 leading-tight p-3"
                style={{ fontSize: '10px', whiteSpace: 'pre', fontFamily: 'Courier New, monospace' }}
              >
                {thermalText}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
