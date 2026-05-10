import { describe, it, expect } from 'vitest';
import { isInterState, calcGST } from '../../utils/gst';

describe('isInterState', () => {
  it('returns false when both states are the same (case-insensitive)', () => {
    expect(isInterState('Rajasthan', 'Rajasthan')).toBe(false);
    expect(isInterState('rajasthan', 'RAJASTHAN')).toBe(false);
    expect(isInterState('  Rajasthan  ', 'Rajasthan')).toBe(false);
  });

  it('returns true when states differ', () => {
    expect(isInterState('Rajasthan', 'Delhi')).toBe(true);
    expect(isInterState('Maharashtra', 'Gujarat')).toBe(true);
  });
});

describe('calcGST — intra-state (CGST + SGST)', () => {
  it('splits GST evenly into CGST and SGST', () => {
    const result = calcGST(1000, 5, false);
    expect(result.cgst).toBeCloseTo(25);
    expect(result.sgst).toBeCloseTo(25);
    expect(result.igst).toBe(0);
  });

  it('calculates 5% GST on ₹780 correctly', () => {
    const result = calcGST(780, 5, false);
    expect(result.cgst).toBeCloseTo(19.5);
    expect(result.sgst).toBeCloseTo(19.5);
    expect(result.igst).toBe(0);
  });

  it('zero taxable value gives zero tax', () => {
    const result = calcGST(0, 5, false);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(0);
  });
});

describe('calcGST — inter-state (IGST)', () => {
  it('puts entire GST into IGST, CGST and SGST are 0', () => {
    const result = calcGST(1000, 5, true);
    expect(result.igst).toBeCloseTo(50);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  it('calculates 5% IGST on ₹780', () => {
    const result = calcGST(780, 5, true);
    expect(result.igst).toBeCloseTo(39);
  });
});

describe('calcGST — edge cases', () => {
  it('handles fractional taxable values without NaN', () => {
    const result = calcGST(165.5, 5, false);
    expect(Number.isNaN(result.cgst)).toBe(false);
    expect(Number.isNaN(result.sgst)).toBe(false);
  });

  it('handles 18% GST rate correctly', () => {
    const result = calcGST(1000, 18, false);
    expect(result.cgst).toBeCloseTo(90);
    expect(result.sgst).toBeCloseTo(90);
  });
});
