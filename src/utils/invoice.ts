import { Invoice } from '../types';
import { BusinessProfile } from '../types';

const W = 38;
const LINE  = '-'.repeat(W);
const DLINE = '='.repeat(W);

function centre(text: string): string {
  const pad = Math.max(0, Math.floor((W - text.length) / 2));
  return ' '.repeat(pad) + text;
}

/** Right-align value in a full 48-char line */
function lr(left: string, right: string): string {
  const spaces = W - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
}

/** Truncate string to max n chars */
function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '.' : s;
}

const STATE_ABBR: Record<string, string> = {
  'andhra pradesh': 'AP', 'arunachal pradesh': 'AR', 'assam': 'AS', 'bihar': 'BR',
  'chhattisgarh': 'CG', 'goa': 'GA', 'gujarat': 'GJ', 'haryana': 'HR',
  'himachal pradesh': 'HP', 'jharkhand': 'JH', 'karnataka': 'KA', 'kerala': 'KL',
  'madhya pradesh': 'MP', 'maharashtra': 'MH', 'manipur': 'MN', 'meghalaya': 'ML',
  'mizoram': 'MZ', 'nagaland': 'NL', 'odisha': 'OD', 'punjab': 'PB',
  'rajasthan': 'RJ', 'sikkim': 'SK', 'tamil nadu': 'TN', 'telangana': 'TG',
  'tripura': 'TR', 'uttar pradesh': 'UP', 'uttarakhand': 'UK', 'west bengal': 'WB',
  'delhi': 'DL', 'jammu & kashmir': 'JK', 'jammu and kashmir': 'JK',
  'ladakh': 'LA', 'chandigarh': 'CH', 'puducherry': 'PY', 'pondicherry': 'PY',
};

function abbrevState(state: string): string {
  return STATE_ABBR[state.toLowerCase()] ?? state;
}

export function buildThermalText(invoice: Invoice, bp: BusinessProfile): string {
  const lines: string[] = [];
  const c = invoice.customerSnapshot;

  lines.push(DLINE);
  lines.push(centre(bp.name.toUpperCase()));
  lines.push(centre(trunc(bp.address1, W - 2)));
  lines.push(centre(`${bp.city} - ${bp.pinCode}`));
  lines.push(centre(`GSTIN: ${bp.gstin}`));
  lines.push(centre(`Ph: ${bp.mobile}`));
  lines.push(DLINE);

  lines.push(lr('INVOICE NO :', invoice.invoiceNo));
  lines.push(lr(`DATE       : ${invoice.invoiceDate}`, `TIME: ${invoice.invoiceTime}`));
  lines.push(DLINE);

  lines.push(lr('CUSTOMER   :', trunc(c.name, 24)));
  if (c.firmName) lines.push(lr('FIRM       :', trunc(c.firmName, 24)));
  lines.push(lr('ADDRESS    :', trunc(`${c.city}, ${abbrevState(c.state)}`, 24)));
  lines.push(lr('MOBILE     :', c.mobile));
  if (c.gstin) lines.push(lr('GSTIN      :', c.gstin));
  lines.push(DLINE);

  lines.push(centre('I T E M S'));
  lines.push(DLINE);

  invoice.items.forEach((item, idx) => {
    if (idx > 0) lines.push('');

    const itemKg  = item.weight * item.quantity;
    const perKg   = item.weight > 0 ? item.rate / item.weight : 0;
    const wt      = itemKg % 1 === 0 ? itemKg.toFixed(0) : itemKg.toFixed(1);
    const perKgStr  = `Rs.${perKg % 1 === 0 ? perKg.toFixed(0) : perKg.toFixed(2)}/kg`;
    const bagRateStr = `Rs.${item.rate.toFixed(0)}/${item.unit.toLowerCase()}`;
    const unitPlural  = item.quantity === 1 ? item.unit : item.unit + 's';

    // Line 1: index + product name (left) + line total (right)
    lines.push(lr(`${idx + 1}. ${trunc(item.product, 22)}`, `Rs.${item.lineTotal.toFixed(0)}`));
    // Line 2: variant × qty
    lines.push(`   ${item.variant}  x  ${item.quantity} ${unitPlural}`);
    // Line 3: per-kg rate | per-bag rate | total weight
    lines.push(`   ${perKgStr} | ${bagRateStr} | ${wt} kg`);
  });

  const totalWeightKg = invoice.items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  lines.push(DLINE);
  lines.push(lr('TOTAL WEIGHT', `${totalWeightKg % 1 === 0 ? totalWeightKg.toFixed(0) : totalWeightKg.toFixed(1)} kg`));
  lines.push('');
  lines.push(lr('SUBTOTAL', `Rs.${invoice.subtotal.toFixed(2)}`));

  if (invoice.isInterState) {
    lines.push(lr('IGST  (5%)', `Rs.${invoice.igstTotal.toFixed(2)}`));
  } else {
    lines.push(lr('CGST  (2.5%)', `Rs.${invoice.cgstTotal.toFixed(2)}`));
    lines.push(lr('SGST  (2.5%)', `Rs.${invoice.sgstTotal.toFixed(2)}`));
  }

  if (invoice.discountAmount && invoice.discountAmount > 0) {
    const dscLabel = invoice.discountType === 'percent'
      ? `DISCOUNT (${invoice.discountValue}%)`
      : 'DISCOUNT';
    lines.push(lr(dscLabel, `-Rs.${invoice.discountAmount.toFixed(2)}`));
  }

  if (invoice.roundOff !== 0) {
    const sign = invoice.roundOff > 0 ? '+' : '';
    lines.push(lr('ROUND OFF', `${sign}${invoice.roundOff.toFixed(2)}`));
  }

  lines.push(DLINE);
  lines.push(centre(`** TOTAL  Rs.${invoice.grandTotal.toFixed(0)} **`));
  lines.push(DLINE);

  // Word-wrap amountInWords to fit within W chars (prefix "AMT: " = 5 chars)
  const amtPrefix = 'AMT: ';
  const amtWords = invoice.amountInWords.split(' ');
  let amtLine = amtPrefix;
  for (const word of amtWords) {
    if (amtLine.length + word.length + 1 > W) {
      lines.push(amtLine.trimEnd());
      amtLine = '     ' + word + ' ';
    } else {
      amtLine += word + ' ';
    }
  }
  if (amtLine.trim()) lines.push(amtLine.trimEnd());
  lines.push('');
  lines.push(lr('PAYMENT:', invoice.paymentMode));

  if (bp.upiId)     lines.push(lr('UPI:', bp.upiId));
  if (bp.bankName)  lines.push(lr('BANK:', trunc(bp.bankName, 28)));
  if (bp.accountNo) lines.push(lr('A/C:', bp.accountNo));
  if (bp.ifscCode)  lines.push(lr('IFSC:', bp.ifscCode));

  lines.push('');
  lines.push('THANK YOU FOR YOUR BUSINESS!');
  if (bp.tagline) lines.push(centre(bp.tagline));
  lines.push(DLINE);
  lines.push(centre('** AUTHORISED SIGNATORY **'));
  lines.push(DLINE);
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

export function buildCustomerCopyText(invoice: Invoice, bp: BusinessProfile): string {
  return '** CUSTOMER COPY **\n\n' + buildThermalText(invoice, bp);
}

// ─── A4 Invoice HTML ───────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtRupees(n: number): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const [intPart, dec] = abs.toFixed(2).split('.');
  let result = '';
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(-3);
    let rem = intPart.slice(0, -3);
    while (rem.length > 0) {
      const chunk = rem.length >= 2 ? rem.slice(-2) : rem;
      result = chunk + ',' + result;
      rem = rem.slice(0, -chunk.length);
    }
  }
  return (neg ? '-' : '') + '\u20B9' + result + '.' + dec;
}

export function buildA4Html(invoice: Invoice, bp: BusinessProfile, copyLabel?: string, logoUrl?: string): string {
  const c = invoice.customerSnapshot;

  const totalWeightKg = invoice.items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  const totalWeightStr = totalWeightKg % 1 === 0 ? totalWeightKg.toFixed(0) : totalWeightKg.toFixed(1);

  const itemRows = invoice.items.map((item, idx) => {
    const totalKg = item.weight * item.quantity;
    const totalKgStr = totalKg % 1 === 0 ? totalKg.toFixed(0) : totalKg.toFixed(1);
    const perKg = item.weight > 0 ? item.rate / item.weight : 0;
    const perKgStr = perKg % 1 === 0 ? perKg.toFixed(0) : perKg.toFixed(2);
    const gstAmt = item.cgst + item.sgst + item.igst;
    const unitPlural = item.quantity === 1 ? item.unit : item.unit + 's';

    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>
          <span class="product-name">${esc(item.product)}</span><br/>
          <span class="variant">${esc(item.variant)}</span>
        </td>
        <td class="center mono">${esc(item.hsnCode)}</td>
        <td class="center">${item.quantity} ${esc(unitPlural)}<br/><span class="sub">${totalKgStr} kg</span></td>
        <td class="right">${fmtRupees(item.rate)}<br/><span class="sub">\u20B9${perKgStr}/kg</span></td>
        <td class="right">${fmtRupees(item.taxableValue)}</td>
        <td class="center">${item.gstRate}%</td>
        <td class="right">${fmtRupees(gstAmt)}</td>
        <td class="right bold">${fmtRupees(item.lineTotal)}</td>
      </tr>`;
  }).join('');

  const gstRows = invoice.isInterState
    ? `<tr><td>IGST @ 5%</td><td class="right">${fmtRupees(invoice.igstTotal)}</td></tr>`
    : `<tr><td>CGST @ 2.5%</td><td class="right">${fmtRupees(invoice.cgstTotal)}</td></tr>
       <tr><td>SGST @ 2.5%</td><td class="right">${fmtRupees(invoice.sgstTotal)}</td></tr>`;

  const roundOffRow = invoice.roundOff !== 0
    ? `<tr><td>Round Off</td><td class="right">${invoice.roundOff > 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}</td></tr>`
    : '';

  const discountRow = invoice.discountAmount && invoice.discountAmount > 0
    ? `<tr style="color:#15803d"><td>${
        invoice.discountType === 'percent'
          ? `Discount @ ${invoice.discountValue}%`
          : 'Discount (Flat)'
      }</td><td class="right">&minus; ${fmtRupees(invoice.discountAmount)}</td></tr>`
    : '';

  const bankSection = (bp.bankName || bp.upiId) ? `
    <div class="bank-section">
      <div class="bank-title">Bank / Payment Details</div>
      ${bp.upiId ? `<div>UPI: <strong>${esc(bp.upiId)}</strong></div>` : ''}
      ${bp.bankName ? `<div>Bank: <strong>${esc(bp.bankName)}</strong></div>` : ''}
      ${bp.accountNo ? `<div>A/C No: <strong>${esc(bp.accountNo)}</strong></div>` : ''}
      ${bp.ifscCode ? `<div>IFSC: <strong>${esc(bp.ifscCode)}</strong></div>` : ''}
    </div>` : '';

  const copyBanner = copyLabel
    ? `<div class="copy-banner">${esc(copyLabel)}</div>`
    : '';

  const cancelledBanner = invoice.cancelled
    ? `<div class="cancelled-stamp">CANCELLED</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Invoice ${esc(invoice.invoiceNo)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 12mm 14mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Copy banner ── */
  .copy-banner {
    text-align: center;
    font-size: 9pt;
    font-weight: bold;
    letter-spacing: 2px;
    color: #555;
    border-bottom: 1px dashed #aaa;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 8px;
    border-bottom: 2.5px solid #1a3a6b;
    margin-bottom: 10px;
  }
  .biz-name {
    font-size: 16pt;
    font-weight: 800;
    color: #1a3a6b;
    letter-spacing: 0.5px;
  }
  .biz-meta { font-size: 8.5pt; color: #444; line-height: 1.6; margin-top: 3px; }
  .inv-box {
    text-align: right;
  }
  .inv-title {
    font-size: 13pt;
    font-weight: 700;
    color: #1a3a6b;
    letter-spacing: 1px;
  }
  .inv-no {
    font-size: 11pt;
    font-weight: 800;
    color: #d14;
    margin-top: 2px;
  }
  .inv-meta { font-size: 8.5pt; color: #555; line-height: 1.7; margin-top: 4px; }

  /* ── Cancelled ── */
  .cancelled-stamp {
    text-align: center;
    font-size: 18pt;
    font-weight: 900;
    color: #c00;
    border: 3px solid #c00;
    padding: 2px 20px;
    display: inline-block;
    transform: rotate(-3deg);
    letter-spacing: 4px;
    margin: 4px auto 8px;
    width: 100%;
  }

  /* ── Party Section ── */
  .party-section {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
  }
  .party-box {
    flex: 1;
    border: 1px solid #d0d8e8;
    border-radius: 4px;
    padding: 7px 10px;
  }
  .party-box-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #d0d8e8;
    padding-bottom: 3px;
    margin-bottom: 5px;
  }
  .party-name { font-size: 10.5pt; font-weight: 700; }
  .party-firm { font-size: 9pt; color: #333; margin-top: 1px; }
  .party-detail { font-size: 8.5pt; color: #555; line-height: 1.6; margin-top: 2px; }
  .gstin-tag {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    background: #eef2ff;
    color: #3730a3;
    border: 1px solid #c7d2fe;
    border-radius: 3px;
    padding: 0px 5px;
    margin-top: 4px;
    font-family: monospace;
    letter-spacing: 0.5px;
  }
  .gst-type-tag {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
    margin-top: 3px;
  }
  .intra { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .inter { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }

  /* ── Items Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    font-size: 9pt;
  }
  .items-table thead tr {
    background: #1a3a6b;
    color: #fff;
  }
  .items-table thead th {
    padding: 5px 6px;
    text-align: left;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .items-table thead th.center { text-align: center; }
  .items-table thead th.right { text-align: right; }
  .items-table tbody tr { border-bottom: 1px solid #e5e7eb; }
  .items-table tbody tr:nth-child(even) { background: #f8f9fc; }
  .items-table td { padding: 5px 6px; vertical-align: top; }
  .items-table td.center { text-align: center; }
  .items-table td.right { text-align: right; }
  .items-table td.bold { font-weight: 700; }
  .items-table td.mono { font-family: monospace; font-size: 8pt; }
  .product-name { font-weight: 600; color: #111; }
  .variant { font-size: 8pt; color: #5b6ee1; }
  .sub { font-size: 7.5pt; color: #888; }

  /* ── Totals Row ── */
  .totals-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 4px;
    gap: 16px;
  }
  .totals-left { flex: 1; }
  .totals-right { width: 220px; }

  .summary-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .summary-table td { padding: 3px 6px; }
  .summary-table td.right { text-align: right; }
  .summary-table tr.grand-total td {
    font-size: 11pt;
    font-weight: 800;
    color: #1a3a6b;
    border-top: 2px solid #1a3a6b;
    border-bottom: 2px solid #1a3a6b;
    padding: 5px 6px;
  }
  .summary-table tr.weight-row td { color: #555; font-size: 8.5pt; }
  .summary-table tr.subtotal-row td { border-top: 1px solid #e5e7eb; }

  /* ── Amount in words ── */
  .amt-words {
    margin-top: 6px;
    background: #f0f4ff;
    border: 1px solid #c7d2fe;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 8.5pt;
    color: #3730a3;
    font-style: italic;
  }
  .amt-words strong { font-style: normal; color: #111; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ── Bank & Payment ── */
  .bank-section {
    margin-top: 8px;
    border: 1px solid #d0d8e8;
    border-radius: 4px;
    padding: 7px 10px;
    font-size: 8.5pt;
    line-height: 1.8;
    color: #333;
  }
  .bank-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 4px;
  }

  /* ── Footer ── */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #d0d8e8;
    font-size: 8.5pt;
    color: #555;
  }
  .declaration { max-width: 60%; line-height: 1.6; }
  .signatory { text-align: right; }
  .sig-line {
    width: 130px;
    border-top: 1px solid #333;
    margin-left: auto;
    margin-top: 30px;
    font-size: 8pt;
    font-weight: 600;
    color: #1a3a6b;
    padding-top: 3px;
    text-align: center;
  }
  .payment-mode-row {
    margin-top: 6px;
    font-size: 8.5pt;
    color: #333;
  }

  /* ── Watermark ── */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 420px;
    height: 420px;
    opacity: 0.07;
    z-index: 0;
    pointer-events: none;
    object-fit: contain;
  }
  body > *:not(.watermark) { position: relative; z-index: 1; }

  /* ── Logo in header ── */
  .header-logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    flex-shrink: 0;
    margin-right: 10px;
  }
  .header-biz { display: flex; align-items: flex-start; gap: 0; }
</style>
</head>
<body>

${logoUrl ? `<img class="watermark" src="${logoUrl}" alt="" aria-hidden="true"/>` : ''}

${copyBanner}

<!-- Header -->
<div class="header">
  <div class="header-biz">
    ${logoUrl ? `<img class="header-logo" src="${logoUrl}" alt="logo"/>` : ''}
    <div>
    <div class="biz-name">${esc(bp.name)}</div>
    <div class="biz-meta">
      ${esc(bp.address1)}${bp.address2 ? ', ' + esc(bp.address2) : ''}<br/>
      ${esc(bp.city)}, ${esc(bp.state)} – ${esc(bp.pinCode)}<br/>
      GSTIN: ${esc(bp.gstin)} &nbsp;|&nbsp; FSSAI: ${esc(bp.fssai)}<br/>
      Mobile: ${esc(bp.mobile)}${bp.email ? ' &nbsp;|&nbsp; ' + esc(bp.email) : ''}
    </div>
    </div>
  </div>
  <div class="inv-box">
    <div class="inv-title">TAX INVOICE</div>
    <div class="inv-no">${esc(invoice.invoiceNo)}</div>
    <div class="inv-meta">
      Date: ${esc(invoice.invoiceDate)}<br/>
      Time: ${esc(invoice.invoiceTime)}<br/>
      Payment: ${esc(invoice.paymentMode)}
    </div>
  </div>
</div>

${cancelledBanner}

<!-- Party Section -->
<div class="party-section">
  <div class="party-box">
    <div class="party-box-title">Bill To</div>
    <div class="party-name">${esc(c.name)}</div>
    ${c.firmName ? `<div class="party-firm">${esc(c.firmName)}</div>` : ''}
    <div class="party-detail">
      ${esc(c.address1)}${c.address2 ? ', ' + esc(c.address2) : ''}<br/>
      ${esc(c.city)}, ${esc(c.state)}${c.pinCode ? ' – ' + esc(c.pinCode) : ''}<br/>
      Mobile: ${esc(c.mobile)}
    </div>
    ${c.gstin ? `<div class="gstin-tag">GSTIN: ${esc(c.gstin)}</div>` : ''}
    ${c.fssai ? `<div class="gstin-tag" style="margin-left:4px">FSSAI: ${esc(c.fssai)}</div>` : ''}
  </div>
  <div class="party-box" style="flex: 0 0 200px; text-align: right;">
    <div class="party-box-title">GST Type</div>
    <div style="margin-top:8px">
      <span class="gst-type-tag ${invoice.isInterState ? 'inter' : 'intra'}">
        ${invoice.isInterState ? 'IGST &ndash; Inter-State' : 'CGST + SGST &ndash; Intra-State'}
      </span>
    </div>
    <div class="party-detail" style="margin-top: 10px; color: #666;">
      Customer Type: ${esc(c.customerType)}<br/>
      Payment Terms: ${esc(c.paymentTerms)}
    </div>
  </div>
</div>

<!-- Items Table -->
<table class="items-table">
  <thead>
    <tr>
      <th style="width:28px">#</th>
      <th>Product / Description</th>
      <th class="center" style="width:60px">HSN</th>
      <th class="center" style="width:80px">Qty / Weight</th>
      <th class="right" style="width:90px">Rate</th>
      <th class="right" style="width:80px">Taxable</th>
      <th class="center" style="width:40px">GST%</th>
      <th class="right" style="width:72px">GST Amt</th>
      <th class="right" style="width:80px">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<!-- Totals -->
<div class="totals-section">
  <div class="totals-left">
    <!-- Amount in words -->
    <div class="amt-words">
      <strong>Amount in Words:</strong><br/>
      ${esc(invoice.amountInWords)}
    </div>
    <div class="payment-mode-row">
      <strong>Mode of Payment:</strong> ${esc(invoice.paymentMode)}
    </div>
    ${bankSection}
  </div>
  <div class="totals-right">
    <table class="summary-table">
      <tr class="subtotal-row">
        <td>Taxable Amount</td>
        <td class="right">${fmtRupees(invoice.subtotal)}</td>
      </tr>
      ${gstRows}
      ${discountRow}
      ${roundOffRow}
      <tr class="weight-row">
        <td>Total Weight</td>
        <td class="right">${totalWeightStr} kg</td>
      </tr>
      <tr class="grand-total">
        <td>Grand Total</td>
        <td class="right">${fmtRupees(invoice.grandTotal)}</td>
      </tr>
    </table>
  </div>
</div>

<!-- Footer -->
<div class="footer">
  <div class="declaration">
    <strong>Declaration:</strong><br/>
    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
    ${bp.tagline ? `<br/><em>${esc(bp.tagline)}</em>` : ''}
  </div>
  <div class="signatory">
    <div>For <strong>${esc(bp.name)}</strong></div>
    <div class="sig-line">Authorised Signatory</div>
  </div>
</div>

</body>
</html>`;
}
