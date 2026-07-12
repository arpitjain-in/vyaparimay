/**
 * Store — Invoice generation tests (most critical business logic)
 * Tests: generateInvoice (invoice number, GST calc, ready stock deduction,
 *        discount, inter-state, cancellation)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/db.demo', () => ({ FIXED_ORG_ID: 'test-org-id' }));

const RAJASTHAN_CUSTOMER = {
  id: 'CUST-001', name: 'Ramesh Kumar', firmName: 'Ramesh Store',
  mobile: '9876543210', address1: '5 Gandhi Mkt', city: 'Jaipur',
  state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer' as const,
  creditLimit: 50000, paymentTerms: '30 Days', openingBalance: 0,
  createdOn: '01/01/2026', active: true,
};

const DELHI_CUSTOMER = {
  ...RAJASTHAN_CUSTOMER,
  id: 'CUST-002', state: 'Delhi',
};

function baseState() {
  useStore.setState({
    orgId: 'test-org-id',
    isInitialized: true,
    customers: [RAJASTHAN_CUSTOMER, DELHI_CUSTOMER],
    currentOrder: null,
    invoices: [],
    invoiceCounters: {},
    readyStock: {
      'WF-26K': 25, 'WF-5P': 60, 'WF-25K': 10,
      'WF-10P': 30, 'WF-5H': 20, 'WF-10H': 15,
      'BS-40K': 8, 'BS-500G': 200, 'DL-500G': 150, 'BR-40K': 12,
    },
    packagingStock: {
      'PKG-WF-26K': 100, 'PKG-WF-5P': 100, 'PKG-WF-10P': 100,
      'PKG-WF-5H': 100, 'PKG-WF-10H': 100, 'PKG-BS-40K': 100,
      'PKG-BS-500G': 100, 'PKG-DL-500G': 100, 'PKG-BR-40K': 100,
    },
    packagingEntries: [],
    readyStockTransactions: [],
    businessProfile: {
      name: 'Shikharji Foods', address1: '1 Test St', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '302001', gstin: '08AAAAA0000A1Z5',
      fssai: '', mobile: '9999999999', gstEnabled: true,
    },
  });
}

function placeOrder(customerId: string, items: { skuId: string; qty: number; rate: number }[], gstEnabled = true) {
  useStore.getState().startNewOrder();
  useStore.getState().setOrderCustomer(customerId);
  useStore.getState().setOrderGst(gstEnabled);
  for (const { skuId, qty, rate } of items) {
    useStore.getState().upsertCartItem(skuId, qty, rate);
  }
}

beforeEach(baseState);

// ─── Invoice numbering ────────────────────────────────────────────────────────

describe('generateInvoice — invoice numbering', () => {
  it('generates invoice number INV/FY/MM/01 for first invoice of month', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09');
    expect(inv).not.toBeNull();
    // May 2026 is FY 2026-27 → FY code = '2627', month = '05'
    expect(inv!.invoiceNo).toBe('INV/2627/05/01');
  });

  it('increments sequence for subsequent invoices in same month', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-09');
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 2, rate: 165 }]);
    const inv2 = useStore.getState().generateInvoice('2026-05-15');
    expect(inv2!.invoiceNo).toBe('INV/2627/05/02');
  });

  it('resets sequence on the 1st of a new month', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-31'); // last day of May
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    const inv2 = useStore.getState().generateInvoice('2026-06-01'); // June 1st
    expect(inv2!.invoiceNo).toBe('INV/2627/06/01');
  });

  it('resets sequence for a new financial year', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-09'); // FY 2627
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    const inv2 = useStore.getState().generateInvoice('2027-04-01'); // FY 2728
    expect(inv2!.invoiceNo).toBe('INV/2728/04/01');
  });

  it('returns null when no current order', () => {
    const inv = useStore.getState().generateInvoice();
    expect(inv).toBeNull();
  });
});

// ─── GST calculation — intra-state ───────────────────────────────────────────

describe('generateInvoice — intra-state GST (CGST + SGST)', () => {
  it('calculates 5% GST as CGST 2.5% + SGST 2.5% for Rajasthan customer', () => {
    // WF-26K is a 26 kg bag — bulk packs over 25 kg are GST-exempt, so use a
    // retail-size SKU (WF-5P, 5 kg pouch) which is taxed at 5%.
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.isInterState).toBe(false);
    expect(inv.cgstTotal).toBeCloseTo(4.125);
    expect(inv.sgstTotal).toBeCloseTo(4.125);
    expect(inv.igstTotal).toBe(0);
    expect(inv.totalGST).toBeCloseTo(8.25);
  });

  it('grandTotal = subtotal + GST (rounded)', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 3, rate: 165 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    // subtotal = 3*165 = 495, GST 5% = 24.75, total = 519.75 → round = 520
    expect(inv.subtotal).toBe(495);
    expect(inv.grandTotal).toBe(520);
  });

  it('multi-line order: subtotals and GST aggregate correctly', () => {
    placeOrder('CUST-001', [
      { skuId: 'WF-10P', qty: 3, rate: 320 }, // 960 taxable
      { skuId: 'WF-5P',  qty: 5, rate: 165 }, // 825 taxable
    ]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.subtotal).toBe(1785);
    // 5% on 1785 = 89.25 → cgst = sgst = 44.625
    expect(inv.totalGST).toBeCloseTo(89.25);
    expect(inv.grandTotal).toBe(1874);
  });
});

// ─── GST calculation — inter-state ───────────────────────────────────────────

describe('generateInvoice — inter-state GST (IGST)', () => {
  it('uses IGST only for Delhi customer (different state)', () => {
    placeOrder('CUST-002', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.isInterState).toBe(true);
    expect(inv.igstTotal).toBeCloseTo(8.25);
    expect(inv.cgstTotal).toBe(0);
    expect(inv.sgstTotal).toBe(0);
  });
});

// ─── GST disabled ─────────────────────────────────────────────────────────────

describe('generateInvoice — GST disabled', () => {
  it('all tax fields are 0 when gstEnabled=false', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 2, rate: 780 }], false);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.cgstTotal).toBe(0);
    expect(inv.sgstTotal).toBe(0);
    expect(inv.igstTotal).toBe(0);
    expect(inv.grandTotal).toBe(1560); // 2*780, no tax
  });
});

// ─── Discount ─────────────────────────────────────────────────────────────────

describe('generateInvoice — discount', () => {
  it('applies flat discount to grand total', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    useStore.getState().setOrderDiscount('flat', 50);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    // subtotal=165, GST=8.25, pre-discount=173.25, discount=50, before_round=123.25, grandTotal=123
    expect(inv.discountAmount).toBe(50);
    expect(inv.grandTotal).toBe(123);
  });

  it('applies percent discount correctly', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 1, rate: 165 }]);
    // subtotal=165, GST=8.25, pre-discount=173.25
    useStore.getState().setOrderDiscount('percent', 10);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.discountAmount).toBeCloseTo(17.32);
    expect(inv.grandTotal).toBe(156); // Math.round(173.25 - 17.32) = Math.round(155.93) = 156
  });

  it('no discount when not set', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    expect(inv.discountAmount).toBeUndefined();
  });
});

// ─── Ready stock deduction on invoice ─────────────────────────────────────────

describe('generateInvoice — ready stock deduction', () => {
  it('deducts ordered quantity from ready stock', () => {
    placeOrder('CUST-001', [
      { skuId: 'WF-26K', qty: 3, rate: 780 },
      { skuId: 'WF-5P',  qty: 5, rate: 165 },
    ]);
    useStore.getState().generateInvoice('2026-05-09');
    const { readyStock } = useStore.getState();
    expect(readyStock['WF-26K']).toBe(22); // 25 - 3
    expect(readyStock['WF-5P']).toBe(55);  // 60 - 5
  });

  it('does not reduce other SKUs', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 3, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-09');
    const { readyStock } = useStore.getState();
    expect(readyStock['WF-5P']).toBe(60);  // unchanged
    expect(readyStock['WF-25K']).toBe(10); // unchanged
  });

  it('rejects invoice and leaves stock unchanged when quantity exceeds available stock', () => {
    useStore.setState({ readyStock: { 'WF-26K': 2 } });
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 10, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09');
    expect(inv).toBeNull();
    expect(useStore.getState().readyStock['WF-26K']).toBe(2);
  });

  it('creates DEDUCT ready-stock transactions for each line', () => {
    placeOrder('CUST-001', [
      { skuId: 'WF-26K', qty: 3, rate: 780 },
      { skuId: 'WF-5P',  qty: 5, rate: 165 },
    ]);
    useStore.getState().generateInvoice('2026-05-09');
    const txns = useStore.getState().readyStockTransactions;
    expect(txns).toHaveLength(2);
    expect(txns.every(t => t.type === 'DEDUCT')).toBe(true);
    const w26 = txns.find(t => t.skuId === 'WF-26K')!;
    expect(w26.quantity).toBe(3);
    expect(w26.previousStock).toBe(25);
    expect(w26.newStock).toBe(22);
  });

  it('transaction reason includes invoice number', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    const txn = useStore.getState().readyStockTransactions[0];
    expect(txn.reason).toContain(inv.invoiceNo);
  });
});

// ─── Post-invoice state ────────────────────────────────────────────────────────

describe('generateInvoice — post-generation state', () => {
  it('clears the current order after generating', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-09');
    expect(useStore.getState().currentOrder).toBeNull();
  });

  it('navigates to invoice-view page', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    useStore.getState().generateInvoice('2026-05-09');
    expect(useStore.getState().currentPage).toBe('invoice-view');
  });

  it('stores invoice in invoices array', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    const stored = useStore.getState().invoices.find(i => i.id === inv.id);
    expect(stored).toBeDefined();
    expect(stored!.cancelled).toBe(false);
  });

  it('amountInWords is set correctly', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 3, rate: 165 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    // grandTotal = 520
    expect(inv.amountInWords).toBe('Five Hundred Twenty Rupees Only');
  });
});

// ─── cancelInvoice ────────────────────────────────────────────────────────────

describe('cancelInvoice', () => {
  it('marks the invoice as cancelled', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv = useStore.getState().generateInvoice('2026-05-09')!;
    useStore.getState().cancelInvoice(inv.id);
    const stored = useStore.getState().invoices.find(i => i.id === inv.id)!;
    expect(stored.cancelled).toBe(true);
  });

  it('does not affect other invoices', () => {
    placeOrder('CUST-001', [{ skuId: 'WF-26K', qty: 1, rate: 780 }]);
    const inv1 = useStore.getState().generateInvoice('2026-05-09')!;
    placeOrder('CUST-001', [{ skuId: 'WF-5P', qty: 2, rate: 165 }]);
    const inv2 = useStore.getState().generateInvoice('2026-05-09')!;
    useStore.getState().cancelInvoice(inv1.id);
    expect(useStore.getState().invoices.find(i => i.id === inv2.id)!.cancelled).toBe(false);
  });
});
