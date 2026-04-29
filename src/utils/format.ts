/** Format a Date as DD/MM/YYYY */
export function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format a Date as HH:MM */
export function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Current financial year as 4-digit code e.g. '2627' for FY 2026-27 */
export function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0=Jan … 3=Apr
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}${String(endYear).padStart(2, '0')}`;
}

/** Format number in Indian currency style with ₹ symbol */
export function fmtINR(amount: number, showPaise = false): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const [intPart, decPart] = abs.toFixed(2).split('.');

  // Indian grouping: last 3 digits, then groups of 2
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

  const paiseStr = showPaise || decPart !== '00' ? '.' + decPart : '';
  return (negative ? '-' : '') + '₹' + result + paiseStr;
}

/** Pad / truncate a string to exactly n characters */
export function pad(str: string, n: number, align: 'left' | 'right' = 'left'): string {
  const s = str.slice(0, n);
  return align === 'right' ? s.padStart(n) : s.padEnd(n);
}
