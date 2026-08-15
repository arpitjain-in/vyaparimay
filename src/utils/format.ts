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

/** Financial year as 4-digit code e.g. '2627' for FY 2026-27, from a given Date */
export function getFYFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = d.getMonth(); // 0=Jan … 3=Apr
  const startYear = month >= 3 ? year : year - 1;
  const startYY = startYear % 100;
  const endYY = (startYear + 1) % 100;
  return `${String(startYY).padStart(2, '0')}${String(endYY).padStart(2, '0')}`;
}

/** Current financial year as 4-digit code e.g. '2627' for FY 2026-27 */
export function getCurrentFY(): string {
  return getFYFromDate(new Date());
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

/** Returns true if the string is a valid DD/MM/YYYY date */
export function isValidDDMMYYYY(value: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [dd, mm, yyyy] = value.split('/').map(Number);
  if (mm < 1 || mm > 12 || dd < 1 || yyyy < 1900) return false;
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  return dd <= daysInMonth;
}

/**
 * Parse a DD/MM/YYYY date (and optional HH:MM time) into a sortable timestamp (ms).
 * Use for descending sort: parseDDMMYYYY(b.date, b.time) - parseDDMMYYYY(a.date, a.time)
 */
export function parseDDMMYYYY(date: string, time = '00:00'): number {
  const [dd, mm, yyyy] = date.split('/');
  return new Date(`${yyyy}-${mm}-${dd}T${time}`).getTime();
}

/** Pad / truncate a string to exactly n characters */
export function pad(str: string, n: number, align: 'left' | 'right' = 'left'): string {
  const s = str.slice(0, n);
  return align === 'right' ? s.padStart(n) : s.padEnd(n);
}

/** Format a weight in kg as Ton when >= 1000kg, else as Kg */
export function fmtWeight(kg: number): string {
  const fmt = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
  if (kg >= 1000) return `${fmt(kg / 1000)} Ton`;
  return `${fmt(kg)} Kg`;
}
