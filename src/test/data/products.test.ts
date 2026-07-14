/**
 * data/products — applyTwinPackSplit (Twin25 billing-combo rule)
 * 2 × WF-25K bags in a cart line are re-billed as 1 × Twin25 (50kg, GST-exempt);
 * a leftover odd bag stays billed as a normal WF-25K line.
 */
import { describe, it, expect } from 'vitest';
import { applyTwinPackSplit, PRODUCTS, TWIN_PACK_RULES } from '../../data/products';

describe('applyTwinPackSplit', () => {
  it('leaves a lone bag (qty 1) unsplit', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: 1, rate: 750 }]);
    expect(result).toEqual([{ skuId: 'WF-25K', quantity: 1, rate: 750 }]);
  });

  it('splits an odd quantity (3) into 1 Twin25 + 1 remainder WF-25K', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: 3, rate: 750 }]);
    expect(result).toEqual([
      { skuId: 'Twin25', quantity: 1, rate: 1500 },
      { skuId: 'WF-25K', quantity: 1, rate: 750 },
    ]);
  });

  it('splits an even quantity (4) into pure Twin25, no remainder line', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: 4, rate: 750 }]);
    expect(result).toEqual([{ skuId: 'Twin25', quantity: 2, rate: 1500 }]);
  });

  it('splits exactly 2 bags into 1 Twin25', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: 2, rate: 750 }]);
    expect(result).toEqual([{ skuId: 'Twin25', quantity: 1, rate: 1500 }]);
  });

  it('handles a large odd quantity (11)', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: 11, rate: 750 }]);
    expect(result).toEqual([
      { skuId: 'Twin25', quantity: 5, rate: 1500 },
      { skuId: 'WF-25K', quantity: 1, rate: 750 },
    ]);
  });

  it('preserves the taxable value (sum of quantity*rate) across the split', () => {
    for (const qty of [1, 2, 3, 4, 5, 7, 10, 11]) {
      const original = qty * 750;
      const split = applyTwinPackSplit([{ skuId: 'WF-25K', quantity: qty, rate: 750 }]);
      const total = split.reduce((s, i) => s + i.quantity * i.rate, 0);
      expect(total).toBe(original);
    }
  });

  it('does not touch SKUs with no twin-pack rule (e.g. WF-26K)', () => {
    const result = applyTwinPackSplit([{ skuId: 'WF-26K', quantity: 4, rate: 780 }]);
    expect(result).toEqual([{ skuId: 'WF-26K', quantity: 4, rate: 780 }]);
  });

  it('splits only the matching line in a mixed cart, preserving order and other lines', () => {
    const result = applyTwinPackSplit([
      { skuId: 'WF-26K', quantity: 2, rate: 780 },
      { skuId: 'WF-25K', quantity: 3, rate: 750 },
      { skuId: 'WF-5P', quantity: 5, rate: 165 },
    ]);
    expect(result).toEqual([
      { skuId: 'WF-26K', quantity: 2, rate: 780 },
      { skuId: 'Twin25', quantity: 1, rate: 1500 },
      { skuId: 'WF-25K', quantity: 1, rate: 750 },
      { skuId: 'WF-5P', quantity: 5, rate: 165 },
    ]);
  });

  it('returns an empty array for an empty cart', () => {
    expect(applyTwinPackSplit([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [{ skuId: 'WF-25K', quantity: 3, rate: 750 }];
    const inputCopy = JSON.parse(JSON.stringify(input));
    applyTwinPackSplit(input);
    expect(input).toEqual(inputCopy);
  });
});

describe('Twin25 product definition', () => {
  const twin25 = PRODUCTS.find(p => p.id === 'Twin25')!;

  it('exists and is wired to WF-25K as its inner SKU', () => {
    expect(twin25).toBeDefined();
    expect(twin25.innerSkuId).toBe('WF-25K');
    expect(twin25.innerSkuQty).toBe(2);
  });

  it('is weighted at 50kg so the existing >25kg GST exemption applies', () => {
    expect(twin25.weight).toBe(50);
  });

  it('is marked to skip its own outer-packaging deduction (same physical bags as WF-25K)', () => {
    expect(twin25.skipOuterPackaging).toBe(true);
  });

  it('is hidden from manual product pickers', () => {
    expect(twin25.hidden).toBe(true);
  });

  it('TWIN_PACK_RULES points WF-25K at the Twin25 combo with pairSize 2', () => {
    expect(TWIN_PACK_RULES['WF-25K']).toEqual({ comboSkuId: 'Twin25', pairSize: 2 });
  });
});
