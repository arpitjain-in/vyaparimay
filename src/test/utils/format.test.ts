import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  getFYFromDate,
  getCurrentFY,
  fmtINR,
  isValidDDMMYYYY,
  parseDDMMYYYY,
  pad,
} from '../../utils/format';

describe('formatDate', () => {
  it('formats a date as DD/MM/YYYY', () => {
    expect(formatDate(new Date(2026, 4, 9))).toBe('09/05/2026'); // May 9 2026
  });

  it('pads single-digit day and month', () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe('01/01/2026'); // Jan 1
  });

  it('handles end-of-year correctly', () => {
    expect(formatDate(new Date(2025, 11, 31))).toBe('31/12/2025');
  });
});

describe('formatTime', () => {
  it('formats time as HH:MM', () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(d)).toBe('09:05');
  });

  it('handles midnight correctly', () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTime(d)).toBe('00:00');
  });
});

describe('getFYFromDate', () => {
  it('returns 2526 for any date in April 2025 – March 2026', () => {
    expect(getFYFromDate(new Date(2025, 3, 1))).toBe('2526'); // Apr 2025
    expect(getFYFromDate(new Date(2026, 2, 31))).toBe('2526'); // Mar 2026
  });

  it('returns 2627 for April 2026', () => {
    expect(getFYFromDate(new Date(2026, 3, 1))).toBe('2627');
  });

  it('returns 2627 for May 2026 (current month in session)', () => {
    expect(getFYFromDate(new Date(2026, 4, 9))).toBe('2627');
  });

  it('January (month < 3) belongs to previous FY start year', () => {
    expect(getFYFromDate(new Date(2027, 0, 15))).toBe('2627'); // Jan 2027 is FY 2026-27
  });
});

describe('fmtINR', () => {
  it('formats thousands correctly', () => {
    expect(fmtINR(1000)).toBe('₹1,000');
  });

  it('formats Indian lakh grouping: 1,00,000', () => {
    expect(fmtINR(100000)).toBe('₹1,00,000');
  });

  it('formats 3323 with no paise', () => {
    expect(fmtINR(3323)).toBe('₹3,323');
  });

  it('shows paise when non-zero', () => {
    expect(fmtINR(780.5)).toBe('₹780.50');
  });

  it('zero returns ₹0', () => {
    expect(fmtINR(0)).toBe('₹0');
  });

  it('handles negative amounts', () => {
    expect(fmtINR(-500)).toBe('-₹500');
  });

  it('forces paise display when showPaise=true', () => {
    expect(fmtINR(100, true)).toBe('₹100.00');
  });
});

describe('isValidDDMMYYYY', () => {
  it('accepts a valid date', () => {
    expect(isValidDDMMYYYY('09/05/2026')).toBe(true);
  });

  it('rejects wrong format', () => {
    expect(isValidDDMMYYYY('2026-05-09')).toBe(false);
    expect(isValidDDMMYYYY('9/5/2026')).toBe(false);
  });

  it('rejects invalid month', () => {
    expect(isValidDDMMYYYY('01/13/2026')).toBe(false);
  });

  it('rejects day > days in month (Feb 30)', () => {
    expect(isValidDDMMYYYY('30/02/2026')).toBe(false);
  });

  it('accepts Feb 29 on a leap year', () => {
    expect(isValidDDMMYYYY('29/02/2024')).toBe(true);
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(isValidDDMMYYYY('29/02/2025')).toBe(false);
  });
});

describe('parseDDMMYYYY', () => {
  it('parses a known date into a timestamp', () => {
    const ts = parseDDMMYYYY('09/05/2026');
    expect(ts).toBe(new Date('2026-05-09T00:00').getTime());
  });

  it('later date has larger timestamp (for descending sort)', () => {
    const earlier = parseDDMMYYYY('01/01/2026');
    const later = parseDDMMYYYY('31/12/2026');
    expect(later).toBeGreaterThan(earlier);
  });

  it('uses supplied time when sorting same-day entries', () => {
    const morning = parseDDMMYYYY('09/05/2026', '09:00');
    const evening = parseDDMMYYYY('09/05/2026', '18:30');
    expect(evening).toBeGreaterThan(morning);
  });
});

describe('pad', () => {
  it('pads left (default) to n chars', () => {
    expect(pad('hi', 5)).toBe('hi   ');
  });

  it('pads right-aligned', () => {
    expect(pad('hi', 5, 'right')).toBe('   hi');
  });

  it('truncates strings longer than n', () => {
    expect(pad('hello world', 5)).toBe('hello');
  });
});
