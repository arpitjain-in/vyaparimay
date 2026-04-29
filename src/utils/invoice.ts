import { Invoice } from '../types';
import { BusinessProfile } from '../types';

const W = 48;
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

export function buildThermalText(invoice: Invoice, bp: BusinessProfile): string {
  const lines: string[] = [];
  const c = invoice.customerSnapshot;

  lines.push(DLINE);
  lines.push(centre(bp.name.toUpperCase()));
  lines.push(centre(trunc(`${bp.address1}, ${bp.city} - ${bp.pinCode}`, W - 2)));
  lines.push(centre(`GSTIN: ${bp.gstin}`));
  lines.push(centre(`FSSAI: ${bp.fssai}`));
  lines.push(centre(`Ph: ${bp.mobile}`));
  lines.push(DLINE);

  lines.push(lr('INVOICE NO :', invoice.invoiceNo));
  lines.push(lr(`DATE       : ${invoice.invoiceDate}`, `TIME: ${invoice.invoiceTime}`));
  lines.push(DLINE);

  lines.push(lr('CUSTOMER   :', trunc(c.name, 24)));
  lines.push(lr('ADDRESS    :', trunc(`${c.city}, ${c.state}`, 24)));
  lines.push(lr('MOBILE     :', c.mobile));
  if (c.gstin) lines.push(lr('GSTIN      :', c.gstin));
  lines.push(DLINE);

  // Items header: ITEM(16) QTY(4) UNIT(5) RATE(6) AMT(7) = 16+1+4+1+5+1+6+1+7 = 42 ≠ 48
  // Adjusted: ITEM(14) QTY(5) UNIT(5) RATE(7) AMT(8) + spaces
  lines.push('ITEM           QTY   UNIT   RATE     AMT');
  lines.push(LINE);

  for (const item of invoice.items) {
    const name  = trunc(`${item.product} ${item.variant.split(' ')[0]}`, 13).padEnd(13);
    const qty   = String(item.quantity).padStart(4);
    const unit  = item.unit.slice(0, 5).padEnd(5);
    const rate  = `${item.rate.toFixed(0)}`.padStart(6);
    const amt   = `${item.lineTotal.toFixed(0)}`.padStart(7);
    lines.push(`${name}  ${qty}  ${unit}  ${rate}  ${amt}`);
  }

  lines.push(LINE);
  lines.push(lr('SUBTOTAL', `Rs.${invoice.subtotal.toFixed(2)}`));

  if (invoice.isInterState) {
    lines.push(lr('IGST  (5%)', `Rs.${invoice.igstTotal.toFixed(2)}`));
  } else {
    lines.push(lr('CGST  (2.5%)', `Rs.${invoice.cgstTotal.toFixed(2)}`));
    lines.push(lr('SGST  (2.5%)', `Rs.${invoice.sgstTotal.toFixed(2)}`));
  }

  if (invoice.roundOff !== 0) {
    const sign = invoice.roundOff > 0 ? '+' : '';
    lines.push(lr('ROUND OFF', `${sign}${invoice.roundOff.toFixed(2)}`));
  }

  lines.push(DLINE);
  lines.push(centre(`** TOTAL  Rs.${invoice.grandTotal.toFixed(0)} **`));
  lines.push(DLINE);

  lines.push(`AMT: ${invoice.amountInWords}`);
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
