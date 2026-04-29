import React, { useRef } from 'react';
import { ArrowLeft, Printer, Copy } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtINR } from '../../utils/format';
import { buildThermalText, buildCustomerCopyText } from '../../utils/invoice';
import Layout from '../Layout/Layout';

export default function InvoiceView() {
  const { selectedInvoiceId, invoices, businessProfile, navigate } = useStore();
  const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
  const preRef = useRef<HTMLPreElement>(null);

  if (!invoice || !businessProfile) {
    return (
      <Layout title="Invoice">
        <div className="text-center py-12 text-gray-400">Invoice not found.</div>
      </Layout>
    );
  }

  const thermalText = buildThermalText(invoice, businessProfile);
  const customerCopyText = buildCustomerCopyText(invoice, businessProfile);

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
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          width: 80mm;
          max-width: 80mm;
          margin: 0;
          padding: 3mm 3mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 9px;
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
        }
      </style>
    </head><body><pre>${escaped}</pre></body></html>`);
    w.document.close();
    w.focus();
    w.onload = () => {
      w.print();
      w.onafterprint = () => w.close();
    };
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(thermalText).then(() => alert('Invoice text copied!'));
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
            <Printer size={14} /> Print Original
          </button>
          <button
            onClick={() => handlePrint(customerCopyText, invoice.invoiceNo + ' – Customer Copy')}
            className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            <Printer size={14} /> Customer Copy
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
                  {['#', 'Product', 'HSN', 'Qty', 'Rate', 'Taxable', 'GST%', 'GST Amt', 'Total'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item, i) => {
                  const gstAmt = item.cgst + item.sgst + item.igst;
                  return (
                    <tr key={item.skuId}>
                      <td className="px-3 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{item.product}</div>
                        <div className="text-xs text-gray-400">{item.variant}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-500">{item.hsnCode}</td>
                      <td className="px-3 py-3">{item.quantity} {item.unit}</td>
                      <td className="px-3 py-3">{fmtINR(item.rate)}</td>
                      <td className="px-3 py-3">{fmtINR(item.taxableValue)}</td>
                      <td className="px-3 py-3 text-gray-500">{item.gstRate}%</td>
                      <td className="px-3 py-3 text-gray-500">{fmtINR(gstAmt)}</td>
                      <td className="px-3 py-3 font-semibold">{fmtINR(item.lineTotal)}</td>
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
