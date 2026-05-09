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
