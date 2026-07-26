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

  if (invoice.docType === 'proforma') {
    lines.push(centre('PROFORMA INVOICE'));
    lines.push(centre('(Not a Tax Invoice)'));
    lines.push(DLINE);
  }

  lines.push(lr(invoice.docType === 'proforma' ? 'PROFORMA NO :' : 'INVOICE NO :', invoice.invoiceNo));
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

  if (invoice.transportCharges && invoice.transportCharges > 0) {
    lines.push(lr('TRANSPORT', `+Rs.${invoice.transportCharges.toFixed(2)}`));
  }
  if (invoice.loadingCharges && invoice.loadingCharges > 0) {
    lines.push(lr('LOADING/UNLOADING', `+Rs.${invoice.loadingCharges.toFixed(2)}`));
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

function bizNameHtml(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  if (!first) return '';
  const restStr = rest.join(' ');
  return `<span class="biz-name-first">${esc(first)}</span>${restStr ? ' <span class="biz-name-rest">' + esc(restStr) + '</span>' : ''}`;
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

export function buildA4HalfHtml(invoice: Invoice, bp: BusinessProfile, logoUrl?: string): string {
  const c = invoice.customerSnapshot;
  const hasGST = invoice.totalGST > 0;

  const totalWeightKg = invoice.items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  const totalWeightStr = totalWeightKg % 1 === 0 ? totalWeightKg.toFixed(0) : totalWeightKg.toFixed(1);

  const itemRows = invoice.items.map((item, idx) => {
    const totalKg = item.weight * item.quantity;
    const totalKgStr = totalKg % 1 === 0 ? totalKg.toFixed(0) : totalKg.toFixed(1);
    const weightStr = item.weight % 1 === 0 ? item.weight.toFixed(0) : item.weight.toFixed(2);
    const perKg = item.weight > 0 ? item.rate / item.weight : 0;
    const perKgStr = perKg % 1 === 0 ? perKg.toFixed(0) : perKg.toFixed(2);
    const unitPlural = item.quantity === 1 ? item.unit : item.unit + 's';
    return `<tr>
      <td class="c">${idx + 1}</td>
      <td><div class="pn">${esc(item.product)}</div><div class="vr">${esc(item.variant)}</div></td>
      <td class="c mono">${esc(item.hsnCode)}</td>
      <td class="c">${item.quantity}&nbsp;${esc(unitPlural)}</td>
      <td class="c">${weightStr}&nbsp;kg${item.quantity > 1 ? `<br/><span class="s">${totalKgStr}&nbsp;kg</span>` : ''}</td>
      <td class="r">&#8377;${perKgStr}</td>
      <td class="r">${fmtRupees(item.rate)}</td>
      <td class="r b">${fmtRupees(item.lineTotal)}</td>
    </tr>`;
  }).join('');

  const gstSummary = invoice.isInterState
    ? `<tr><td>IGST @ 5%</td><td class="r">${fmtRupees(invoice.igstTotal)}</td></tr>`
    : `<tr><td>CGST @ 2.5%</td><td class="r">${fmtRupees(invoice.cgstTotal)}</td></tr>
       <tr><td>SGST @ 2.5%</td><td class="r">${fmtRupees(invoice.sgstTotal)}</td></tr>`;

  const extraSummary = [
    invoice.discountAmount && invoice.discountAmount > 0
      ? `<tr class="disc"><td>${invoice.discountType === 'percent' ? `Discount @ ${invoice.discountValue}%` : 'Discount'}</td><td class="r">&minus;&nbsp;${fmtRupees(invoice.discountAmount)}</td></tr>`
      : '',
    invoice.transportCharges && invoice.transportCharges > 0
      ? `<tr class="xtra"><td>Transport</td><td class="r">+&nbsp;${fmtRupees(invoice.transportCharges)}</td></tr>`
      : '',
    invoice.loadingCharges && invoice.loadingCharges > 0
      ? `<tr class="xtra"><td>Loading / Unloading</td><td class="r">+&nbsp;${fmtRupees(invoice.loadingCharges)}</td></tr>`
      : '',
    invoice.roundOff !== 0
      ? `<tr><td>Round Off</td><td class="r">${invoice.roundOff > 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}</td></tr>`
      : '',
  ].join('');

  const gstTypeTag = invoice.isInterState
    ? `<span class="tag inter">IGST &ndash; Inter-State</span>`
    : `<span class="tag intra">CGST+SGST &ndash; Intra-State</span>`;

  const bankParts = [
    bp.upiId ? `UPI:&nbsp;<b>${esc(bp.upiId)}</b>` : '',
    bp.bankName ? `Bank:&nbsp;<b>${esc(bp.bankName)}</b>${bp.accountNo ? '&nbsp;A/C:&nbsp;' + esc(bp.accountNo) : ''}${bp.ifscCode ? '&nbsp;IFSC:&nbsp;' + esc(bp.ifscCode) : ''}` : '',
  ].filter(Boolean).join('&emsp;');

  const cancelledBanner = invoice.cancelled
    ? `<div class="cancelled">CANCELLED</div>`
    : '';

  // Shared invoice block — rendered twice with different copy labels
  function buildHalf(copyLabel: string): string {
    return `<div class="half">
  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      ${logoUrl ? `<img class="hlogo" src="${logoUrl}" alt=""/>` : ''}
      <div>
        <div class="biz-name">${bizNameHtml(bp.name)}</div>
        <div class="biz-meta">
          <div class="biz-address">${esc(bp.address1)}, ${esc(bp.city)} &ndash; ${esc(bp.pinCode)}</div>
          <div class="biz-reg">GSTIN: <b>${esc(bp.gstin)}</b>&emsp;FSSAI: <b>${esc(bp.fssai)}</b>&emsp;Ph: ${esc(bp.mobile)}</div>
        </div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="copy-label">${esc(copyLabel)}</div>
      <div class="inv-label">${invoice.docType === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE'}</div>
      <div class="inv-no">${esc(invoice.invoiceNo)}</div>
      <div class="inv-meta">
        <div class="inv-datetime">Date: ${esc(invoice.invoiceDate)}&emsp;Time: ${esc(invoice.invoiceTime)}</div>
        <div class="inv-payment">Payment: ${esc(invoice.paymentMode)}</div>
      </div>
    </div>
  </div>
  ${cancelledBanner}
  <!-- Customer strip -->
  <div class="cust-strip">
    <div>
      <div class="cust-name">${esc(c.name)}${c.firmName ? ' &ndash; ' + esc(c.firmName) : ''}</div>
      <div class="cust-detail">
        ${esc(c.address1)}, ${esc(c.city)}, ${esc(c.state)}${c.pinCode ? ' &ndash; ' + esc(c.pinCode) : ''}&emsp;
        Mob: ${esc(c.mobile)}${c.gstin ? '&emsp;GSTIN: ' + esc(c.gstin) : ''}
      </div>
    </div>
    <div style="padding-top:2px">${gstTypeTag}</div>
  </div>
  <!-- Items table -->
  <table class="itbl">
    <thead><tr>
      <th style="width:16px">#</th>
      <th>Product / Variant</th>
      <th class="c" style="width:38px">HSN</th>
      <th class="c" style="width:34px">Qty</th>
      <th class="c" style="width:46px">Weight</th>
      <th class="r" style="width:50px">Rate/Kg</th>
      <th class="r" style="width:54px">Bag Rate</th>
      <th class="r" style="width:60px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <!-- Totals -->
  <div class="totals">
    <div>
      <div class="amt-box"><b>Amount:</b> ${esc(invoice.amountInWords)}</div>
      ${bankParts ? `<div class="bank-box">${bankParts}</div>` : ''}
    </div>
    <div>
      <table class="stbl">
        ${hasGST ? `<tr><td>Taxable Amount</td><td class="r">${fmtRupees(invoice.subtotal)}</td></tr>${gstSummary}` : ''}
        ${extraSummary}
        <tr class="wt"><td><b>Total Weight</b></td><td class="r"><b>${totalWeightStr}&nbsp;kg</b></td></tr>
        <tr class="grand"><td>Grand Total</td><td class="r">${fmtRupees(invoice.grandTotal)}</td></tr>
      </table>
    </div>
  </div>
  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      We declare that this invoice shows the actual price of the goods described and all particulars are true and correct.${bp.tagline ? '<br/><em>' + esc(bp.tagline) + '</em>' : ''}
    </div>
    <div class="sig-block">
      <div>For <b>${esc(bp.name)}</b></div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>
</div>`;
  }

  // A4 usable height with 8mm top+bottom margins = 281mm.
  // Each half = 138mm, separator = 5mm. Total = 281mm.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Invoice ${esc(invoice.invoiceNo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&family=Roboto:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 8mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
    font-size: 8pt;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Each half is exactly 138mm — overflow hidden keeps it strictly within bounds */
  .half {
    height: 138mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  /* Dashed cut line between the two halves */
  .cut-line {
    height: 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 7pt;
    color: #555;
    border-top: 1px dashed #888;
    border-bottom: 1px dashed #888;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }

  /* ── Copy label badge ── */
  .copy-label {
    display: inline-block;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 1px;
    color: #fff;
    background: #1a3a6b;
    border-radius: 2px;
    padding: 1px 6px;
    margin-bottom: 3px;
    text-transform: uppercase;
  }

  /* ── Header ── */
  .hdr {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 8px;
    border-bottom: 2px solid #1a3a6b;
    padding-bottom: 4px;
    flex-shrink: 0;
  }
  .hdr-left { display: flex; align-items: flex-start; gap: 7px; }
  .hlogo { width: 48px; height: 48px; object-fit: contain; flex-shrink: 0; }
  .biz-name { font-family: 'Baloo 2', 'Segoe UI', Arial, sans-serif; font-size: calc(12.5pt + 2px); color: #1a3a6b; line-height: 1.2; }
  .biz-name-first { font-weight: 800; }
  .biz-name-rest { font-weight: 500; }
  .biz-meta { color: #000; line-height: 1.35; margin-top: 2px; }
  .biz-address { font-size: 10.5pt; }
  .biz-reg { font-size: 8.5pt; margin-top: 2px; }
  .hdr-right { text-align: right; }
  .inv-label { font-size: 8pt; font-weight: 700; color: #1a3a6b; letter-spacing: 0.5px; }
  .inv-no { font-size: 10pt; font-weight: 800; color: #b91c1c; line-height: 1.2; }
  .inv-meta { color: #000; line-height: 1.4; margin-top: 1px; }
  .inv-datetime { font-size: 8.5pt; font-weight: 700; }
  .inv-payment { font-size: 6.5pt; margin-top: 1px; }

  /* ── Customer strip ── */
  .cust-strip {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 8px;
    background: #f4f6fb;
    border: 1px solid #a8b3c9;
    border-left: 3px solid #1a3a6b;
    border-radius: 3px;
    padding: 3px 7px 3px 6px;
    flex-shrink: 0;
  }
  .cust-name { font-size: 10pt; font-weight: 700; line-height: 1.25; }
  .cust-detail { font-size: 7.5pt; color: #000; line-height: 1.3; margin-top: 1px; }
  .tag { display: inline-block; font-size: 7pt; font-weight: 700; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
  .intra { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
  .inter { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }

  /* ── Cancelled ── */
  .cancelled { text-align: center; font-size: 14pt; font-weight: 900; color: #c00; border: 3px solid #c00; padding: 1px 12px; letter-spacing: 3px; flex-shrink: 0; }

  /* ── Items table ── */
  .itbl { width: 100%; border-collapse: collapse; font-size: 7.5pt; flex-shrink: 1; min-height: 0; }
  .itbl thead tr { background: #1a3a6b; color: #fff; }
  .itbl th { padding: 2px 4px; font-size: 7pt; font-weight: 600; text-align: left; }
  .itbl th.c { text-align: center; }
  .itbl th.r { text-align: right; }
  .itbl tbody tr { border-bottom: 1px solid #c3cad6; }
  .itbl tbody tr:nth-child(even) { background: #f8f9fc; }
  .itbl td { padding: 2px 4px; vertical-align: middle; }
  .itbl td.c { text-align: center; }
  .itbl td.r { text-align: right; }
  .itbl td.b { font-weight: 700; }
  .itbl td.mono { font-family: monospace; font-size: 7pt; text-align: center; }
  .pn { font-weight: 600; color: #000; font-size: 8.5pt; }
  .vr { font-size: 7pt; color: #3730a3; margin-top: 1px; }
  .s { font-size: 7pt; color: #333; }

  /* ── Totals section ── */
  .totals { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; flex-shrink: 0; margin-top: auto; }
  .amt-box { background: #f0f4ff; border: 1px solid #9aa8f0; border-radius: 3px; padding: 3px 6px; font-size: 9pt; color: #3730a3; font-style: italic; margin-bottom: 3px; line-height: 1.3; }
  .amt-box b { font-style: normal; color: #000; }
  .bank-box { font-size: 7.5pt; color: #000; line-height: 1.4; }
  .stbl { width: 100%; border-collapse: collapse; font-size: 7pt; white-space: nowrap; }
  .stbl td { padding: 1px 4px; }
  .stbl td.r { text-align: right; }
  .stbl .disc td { color: #15803d; }
  .stbl .xtra td { color: #c2410c; }
  .stbl .wt td { color: #000; font-size: 9.5pt; border-top: 1px solid #c3cad6; }
  .stbl .grand td { font-size: 10.5pt; font-weight: 800; color: #fff; background: #1a3a6b; padding: 4px 6px; }

  /* ── Footer ── */
  .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #a8b3c9; padding-top: 3px; flex-shrink: 0; }
  .footer-left { font-size: 7pt; color: #222; max-width: 65%; line-height: 1.3; }
  .sig-block { text-align: right; }
  .sig-line { width: 110px; border-top: 1px solid #333; margin-left: auto; margin-top: 12px; font-size: 7pt; font-weight: 600; color: #1a3a6b; padding-top: 2px; text-align: center; }
</style>
</head>
<body>
${buildHalf('Original')}
<div class="cut-line">&#9988;&ensp;Cut Here&ensp;&#9988;</div>
${buildHalf('Customer Copy')}
</body>
</html>`;
}

export function buildA4Html(invoice: Invoice, bp: BusinessProfile, copyLabel?: string, logoUrl?: string): string {
  const c = invoice.customerSnapshot;
  const hasGST = invoice.items.some(i => i.gstRate > 0);

  const totalWeightKg = invoice.items.reduce((sum, i) => sum + i.weight * i.quantity, 0);
  const totalWeightStr = totalWeightKg % 1 === 0 ? totalWeightKg.toFixed(0) : totalWeightKg.toFixed(1);

  const itemRows = invoice.items.map((item, idx) => {
    const totalKg = item.weight * item.quantity;
    const totalKgStr = totalKg % 1 === 0 ? totalKg.toFixed(0) : totalKg.toFixed(1);
    const weightStr = item.weight % 1 === 0 ? item.weight.toFixed(0) : item.weight.toFixed(2);
    const perKg = item.weight > 0 ? item.rate / item.weight : 0;
    const perKgStr = perKg % 1 === 0 ? perKg.toFixed(0) : perKg.toFixed(2);
    const unitPlural = item.quantity === 1 ? item.unit : item.unit + 's';
    return `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>
          <span class="product-name">${esc(item.product)}</span><br/>
          <span class="variant">${esc(item.variant)}</span>
        </td>
        <td class="center mono">${esc(item.hsnCode)}</td>
        <td class="center">${item.quantity} ${esc(unitPlural)}</td>
        <td class="center">${weightStr} kg${item.quantity > 1 ? `<br/><span class="sub">${totalKgStr} kg</span>` : ''}</td>
        <td class="right">\u20B9${perKgStr}</td>
        <td class="right">${fmtRupees(item.rate)}</td>
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

  const transportRow = invoice.transportCharges && invoice.transportCharges > 0
    ? `<tr style="color:#c2410c"><td>Transport Charges</td><td class="right">+ ${fmtRupees(invoice.transportCharges)}</td></tr>`
    : '';

  const loadingRow = invoice.loadingCharges && invoice.loadingCharges > 0
    ? `<tr style="color:#c2410c"><td>Loading / Unloading</td><td class="right">+ ${fmtRupees(invoice.loadingCharges)}</td></tr>`
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

  const proformaBanner = invoice.docType === 'proforma'
    ? `<div class="proforma-stamp">PROFORMA INVOICE<small>NOT A TAX INVOICE / FOR REFERENCE ONLY</small></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Invoice ${esc(invoice.invoiceNo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&family=Roboto:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait;
    margin: 12mm 14mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Roboto', 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    display: flex;
    flex-direction: column;
    min-height: 273mm;
  }

  /* ── Copy banner ── */
  .copy-banner {
    text-align: center;
    font-size: 9.5pt;
    font-weight: bold;
    letter-spacing: 2px;
    color: #000;
    border-bottom: 1px dashed #888;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }

  /* ── Letterhead accent bar ── */
  .letterhead-bar {
    height: 4px;
    background: #1a3a6b;
    margin-bottom: 10px;
    border-radius: 2px;
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
    font-family: 'Baloo 2', 'Segoe UI', Arial, sans-serif;
    font-size: calc(16pt + 2px);
    color: #1a3a6b;
    letter-spacing: 0.5px;
  }
  .biz-name-first { font-weight: 800; }
  .biz-name-rest { font-weight: 500; }
  .biz-meta { font-size: 9pt; font-weight: 700; color: #000; line-height: 1.6; margin-top: 3px; }
  .inv-box {
    text-align: right;
  }
  .inv-title {
    font-size: 10.5pt;
    font-weight: 700;
    color: #1a3a6b;
    letter-spacing: 1px;
  }
  .inv-no {
    font-size: 11pt;
    font-weight: 800;
    color: #b91c1c;
    margin-top: 2px;
  }
  .inv-meta { font-size: 9pt; color: #000; line-height: 1.7; margin-top: 4px; }

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

  /* ── Proforma ── */
  .proforma-stamp {
    text-align: center;
    font-size: 14pt;
    font-weight: 900;
    color: #b45309;
    border: 2px solid #b45309;
    padding: 4px 20px;
    display: inline-block;
    letter-spacing: 3px;
    margin: 4px auto 8px;
    width: 100%;
  }
  .proforma-stamp small {
    display: block;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 1px;
    margin-top: 2px;
  }

  /* ── Party Section ── */
  .party-section {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
  }
  .party-box {
    flex: 1;
    border: 1px solid #a8b3c9;
    border-left: 3px solid #1a3a6b;
    border-radius: 4px;
    padding: 7px 10px 7px 9px;
  }
  .party-box-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #a8b3c9;
    padding-bottom: 3px;
    margin-bottom: 5px;
  }
  .party-name { font-size: 10.5pt; font-weight: 700; }
  .party-firm { font-size: 9pt; color: #000; margin-top: 1px; }
  .party-detail { font-size: 9pt; color: #000; line-height: 1.6; margin-top: 2px; }
  .gstin-tag {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    background: #eef2ff;
    color: #3730a3;
    border: 1px solid #9aa8f0;
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
    font-size: 10pt;
  }
  .items-table thead tr {
    background: #1a3a6b;
    color: #fff;
  }
  .items-table thead th {
    padding: 6px 6px;
    text-align: left;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .items-table thead th.center { text-align: center; }
  .items-table thead th.right { text-align: right; }
  .items-table tbody tr { border-bottom: 1px solid #c3cad6; }
  .items-table tbody tr:nth-child(even) { background: #f8f9fc; }
  .items-table td { padding: 7px 6px; vertical-align: middle; }
  .items-table td.center { text-align: center; }
  .items-table td.right { text-align: right; }
  .items-table td.bold { font-weight: 700; }
  .items-table td.mono { font-family: monospace; font-size: 8.5pt; }
  .product-name { font-weight: 600; color: #000; font-size: 10.5pt; }
  .variant { font-size: 8.5pt; color: #3730a3; }
  .sub { font-size: 9pt; color: #000; }

  /* ── Totals Row ── */
  .totals-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: auto;
    padding-top: 4px;
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
    color: #fff;
    background: #1a3a6b;
    padding: 6px 8px;
  }
  .summary-table tr.weight-row td { color: #000; font-size: 9pt; }
  .summary-table tr.subtotal-row td { border-top: 1px solid #c3cad6; }

  /* ── Amount in words ── */
  .amt-words {
    margin-top: 6px;
    background: #f0f4ff;
    border: 1px solid #9aa8f0;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 10.5pt;
    color: #3730a3;
    font-style: italic;
  }
  .amt-words strong { font-style: normal; color: #000; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ── Bank & Payment ── */
  .bank-section {
    margin-top: 8px;
    border: 1px solid #a8b3c9;
    border-left: 3px solid #1a3a6b;
    border-radius: 4px;
    padding: 7px 10px 7px 9px;
    font-size: 9pt;
    line-height: 1.8;
    color: #000;
  }
  .bank-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 4px;
  }

  /* ── Thank-you note ── */
  .thanks {
    margin-top: 10px;
    font-size: 9.5pt;
    font-weight: 700;
    color: #1a3a6b;
    text-align: center;
  }

  /* ── Footer ── */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #a8b3c9;
    font-size: 9pt;
    color: #000;
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
    font-size: 9pt;
    color: #000;
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

<div class="letterhead-bar"></div>

<!-- Header -->
<div class="header">
  <div class="header-biz">
    ${logoUrl ? `<img class="header-logo" src="${logoUrl}" alt="logo"/>` : ''}
    <div>
    <div class="biz-name">${bizNameHtml(bp.name)}</div>
    <div class="biz-meta">
      ${esc(bp.address1)}${bp.address2 ? ', ' + esc(bp.address2) : ''}<br/>
      ${esc(bp.city)}, ${esc(bp.state)} – ${esc(bp.pinCode)}<br/>
      GSTIN: ${esc(bp.gstin)} &nbsp;|&nbsp; FSSAI: ${esc(bp.fssai)}<br/>
      Mobile: ${esc(bp.mobile)}${bp.email ? ' &nbsp;|&nbsp; ' + esc(bp.email) : ''}
    </div>
    </div>
  </div>
  <div class="inv-box">
    <div class="inv-title">${invoice.docType === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE'}</div>
    <div class="inv-no">${esc(invoice.invoiceNo)}</div>
    <div class="inv-meta">
      <b>Date: ${esc(invoice.invoiceDate)}</b><br/>
      <b>Time: ${esc(invoice.invoiceTime)}</b><br/>
      Payment: ${esc(invoice.paymentMode)}
    </div>
  </div>
</div>

${proformaBanner}
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
    <div class="party-detail" style="margin-top: 10px; color: #000;">
      Customer Type: ${esc(c.customerType)}
    </div>
  </div>
</div>

<!-- Items Table -->
<table class="items-table">
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th>Product / Description</th>
      <th class="center" style="width:50px">HSN</th>
      <th class="center" style="width:52px">Qty</th>
      <th class="center" style="width:62px">Weight</th>
      <th class="right" style="width:70px">Rate/Kg</th>
      <th class="right" style="width:74px">Bag Rate</th>
      <th class="right" style="width:80px">Amount</th>
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
      ${hasGST ? `<tr class="subtotal-row"><td>Taxable Amount</td><td class="right">${fmtRupees(invoice.subtotal)}</td></tr>${gstRows}` : ''}
      ${discountRow}
      ${transportRow}
      ${loadingRow}
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

<div class="thanks">Thank you for your business!</div>

<!-- Footer -->
<div class="footer">
  <div class="declaration">
    <strong>Declaration:</strong><br/>
    We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
    ${bp.tagline ? `<br/><b><em>${esc(bp.tagline)}</em></b>` : ''}
  </div>
  <div class="signatory">
    <div>For <strong>${esc(bp.name)}</strong></div>
    <div class="sig-line">Authorised Signatory</div>
  </div>
</div>

</body>
</html>`;
}
