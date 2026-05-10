import { describe, it, expect } from 'vitest';
import { numberToWords } from '../../utils/numberToWords';

describe('numberToWords', () => {
  it('converts 0 correctly', () => {
    expect(numberToWords(0)).toBe('Zero Rupees Only');
  });

  it('converts single-digit amounts', () => {
    expect(numberToWords(1)).toBe('One Rupees Only');
    expect(numberToWords(9)).toBe('Nine Rupees Only');
  });

  it('converts teens', () => {
    expect(numberToWords(11)).toBe('Eleven Rupees Only');
    expect(numberToWords(15)).toBe('Fifteen Rupees Only');
    expect(numberToWords(19)).toBe('Nineteen Rupees Only');
  });

  it('converts tens', () => {
    expect(numberToWords(20)).toBe('Twenty Rupees Only');
    expect(numberToWords(30)).toBe('Thirty Rupees Only');
    expect(numberToWords(99)).toBe('Ninety Nine Rupees Only');
  });

  it('converts hundreds', () => {
    expect(numberToWords(100)).toBe('One Hundred Rupees Only');
    expect(numberToWords(780)).toBe('Seven Hundred Eighty Rupees Only');
  });

  it('converts thousands', () => {
    expect(numberToWords(1000)).toBe('One Thousand Rupees Only');
    expect(numberToWords(3323)).toBe('Three Thousand Three Hundred Twenty Three Rupees Only');
  });

  it('converts lakhs (Indian numbering)', () => {
    expect(numberToWords(100000)).toBe('One Lakh Rupees Only');
    expect(numberToWords(250000)).toBe('Two Lakh Fifty Thousand Rupees Only');
  });

  it('converts crores', () => {
    expect(numberToWords(10000000)).toBe('One Crore Rupees Only');
  });

  it('includes Paise when there is a fractional part', () => {
    expect(numberToWords(780.5)).toContain('Fifty Paise');
    expect(numberToWords(100.25)).toContain('Twenty Five Paise');
  });

  it('real invoice total ₹3,323 converts correctly', () => {
    expect(numberToWords(3323)).toBe('Three Thousand Three Hundred Twenty Three Rupees Only');
  });

  it('₹2,457 converts correctly', () => {
    expect(numberToWords(2457)).toBe('Two Thousand Four Hundred Fifty Seven Rupees Only');
  });
});
