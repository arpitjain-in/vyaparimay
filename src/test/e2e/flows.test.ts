/**
 * End-to-end flow tests (store-level, no UI)
 *
 * Flow 1: Full order → invoice cycle
 *   customer created → order placed → invoice generated → ready stock deducted
 *
 * Flow 2: Inventory cycle
 *   packaging purchased → ready stock added (auto-deducts packaging) →
 *   invoice generated (deducts ready stock) → final stock levels correct
 *
 * Flow 3: Multiple invoices — running totals & sequential numbering
 *
 * Flow 4: Credit customer ledger balance
 *
 * Flow 5: Edge-case — ordering more than available stock
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';
import { DEFAULT_PRICES } from '../../data/products';

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  saveCustomer: vi.fn().mockResolvedValue(undefined),
  updateCustomerInDb: vi.fn().mockResolvedValue(undefined),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveReorderLevel: vi.fn().mockResolvedValue(undefined),
  savePrice: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
  savePaymentReceipt: vi.fn().mockResolvedValue(undefined),
  saveProductionLog: vi.fn().mockResolvedValue(undefined),
  saveBusinessProfile: vi.fn().mockResolvedValue(undefined),
  clearAllPackagingData: vi.fn().mockResolvedValue(undefined),
  updateReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  deleteReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/db.demo', () => ({ FIXED_ORG_ID: 'test-org-id' }));

function resetStore() {
  useStore.setState({
    orgId: 'test-org-id',
    isInitialized: true,
    customers: [],
    customerSeq: 0,
    invoices: [],
    invoiceCounters: {},
    paymentReceipts: [],
    receiptSeq: 0,
    currentOrder: null,
    packagingStock: {
      'PKG-WF-26K': 200, 'PKG-WF-5P': 200, 'PKG-WF-10P': 100,
      'PKG-WF-5H': 100,  'PKG-WF-10H': 100,
      'PKG-BS-40K': 50, 'PKG-BS-500G': 500, 'PKG-DL-500G': 300, 'PKG-BR-40K': 30,
    },
    packagingEntries: [],
    readyStock: {
      'WF-26K': 50, 'WF-5P': 100, 'WF-10P': 40,
      'WF-5H': 30, 'WF-10H': 20, 'WF-25K': 15,
      'BS-40K': 10, 'BS-500G': 300, 'DL-500G': 200, 'BR-40K': 20,
    },
    readyStockTransactions: [],
    rawMaterialStock: { 'RM-WF': 5000, 'RM-BS': 1000, 'RM-DL': 500, 'RM-BR': 800 },
    stockTransactions: [],
    productionLogs: [],
    reorderLevels: { raw: {}, packaging: {}, ready: {} },
    lastSyncBatchTime: null,
    priceList: { ...DEFAULT_PRICES },
    businessProfile: {
      name: 'Shikharji Foods', address1: '1 Test St', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '302001', gstin: '08AAAAA0000A1Z5',
      fssai: '', mobile: '9999999999', gstEnabled: true,
    },
  });
}

beforeEach(resetStore);

// ─── Flow 1: Full order-to-invoice ─────────────────────────────────────────────

describe('E2E Flow 1: create customer → place order → generate invoice', () => {
  it('completes the full cycle and verifies stock reduction', () => {
    const { addCustomer, startNewOrder, setOrderCustomer, upsertCartItem,
            setOrderGst, generateInvoice } = useStore.getState();

    // 1. Add customer
    const custId = addCustomer({
      name: 'Ramesh Kumar', firmName: 'Ramesh Store', mobile: '9876543210',
      address1: '5 Gandhi Mkt', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '302001', customerType: 'Retailer', creditLimit: 50000,
      paymentTerms: '30 Days', openingBalance: 0,
    });
    expect(custId).toBe('CUST-001');

    // 2. Place order: 3 × 26 kg Bag + 5 × 5 kg Pouch
    startNewOrder();
    setOrderCustomer(custId);
    setOrderGst(true);
    upsertCartItem('WF-26K', 3, 780);
    upsertCartItem('WF-5P', 5, 165);

    // 3. Generate invoice
    const inv = generateInvoice('2026-05-09')!;
    expect(inv).not.toBeNull();
    expect(inv.invoiceNo).toBe('INV-2627-001');
    expect(inv.grandTotal).toBe(3323); // 2340+825 = 3165 + 5%GST = 3323.25 → round = 3323

    // 4. Verify ready stock deductions
    const { readyStock } = useStore.getState();
    expect(readyStock['WF-26K']).toBe(47); // 50 - 3
    expect(readyStock['WF-5P']).toBe(95);  // 100 - 5
    // Other SKUs untouched
    expect(readyStock['WF-10P']).toBe(40);
    expect(readyStock['BS-40K']).toBe(10);

    // 5. Verify ready stock transaction records
    const txns = useStore.getState().readyStockTransactions;
    expect(txns).toHaveLength(2);
    expect(txns.every(t => t.type === 'DEDUCT')).toBe(true);
    expect(txns.every(t => t.reason?.includes('INV-2627-001'))).toBe(true);
  });
});

// ─── Flow 2: Inventory cycle ───────────────────────────────────────────────────

describe('E2E Flow 2: purchase packaging → add ready stock → sell', () => {
  it('full inventory lifecycle with correct stock levels at each step', () => {
    const { addPackagingEntry, addReadyStockEntry, startNewOrder,
            setOrderCustomer, upsertCartItem, setOrderGst, generateInvoice,
            addCustomer } = useStore.getState();

    const custId = addCustomer({
      name: 'Test Customer', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });

    // Step 1: Purchase 100 packaging bags (PKG-WF-26K starts at 200)
    addPackagingEntry({
      date: '09/05/2026', materialId: 'PKG-WF-26K',
      materialName: '25/26 kg Bags', entryType: 'purchase', quantity: 100,
    });
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(300);

    // Step 2: Pack 20 units of 26 kg Bag into ready stock
    //         → packaging deducted automatically by 20
    addReadyStockEntry('WF-26K', 20, 'Production run A', '09/05/2026');
    expect(useStore.getState().readyStock['WF-26K']).toBe(70);          // 50+20
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(280); // 300-20

    // Step 3: Sell 10 units via invoice
    startNewOrder();
    setOrderCustomer(custId);
    setOrderGst(true);
    upsertCartItem('WF-26K', 10, 780);
    generateInvoice('2026-05-09');
    expect(useStore.getState().readyStock['WF-26K']).toBe(60);          // 70-10
    expect(useStore.getState().packagingStock['PKG-WF-26K']).toBe(280); // unchanged by sale

    // Final sanity: packaging transaction log
    const pkgEntries = useStore.getState().packagingEntries;
    expect(pkgEntries).toHaveLength(2); // purchase + auto-deduct from addReadyStockEntry
  });
});

// ─── Flow 3: Multiple invoices — sequential numbering ─────────────────────────

describe('E2E Flow 3: multiple invoices in sequence', () => {
  it('numbers invoices sequentially within a financial year', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'C1', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });

    for (let i = 0; i < 5; i++) {
      startNewOrder();
      setOrderCustomer(custId);
      setOrderGst(true);
      upsertCartItem('WF-26K', 1, 780);
      const inv = generateInvoice('2026-05-09')!;
      const expectedNo = `INV-2627-${String(i + 1).padStart(3, '0')}`;
      expect(inv.invoiceNo).toBe(expectedNo);
    }

    expect(useStore.getState().invoices).toHaveLength(5);
    // Ready stock should have been deducted 5 times
    expect(useStore.getState().readyStock['WF-26K']).toBe(45); // 50 - 5
  });
});

// ─── Flow 4: Inter-state vs intra-state for same order ────────────────────────

describe('E2E Flow 4: intra-state vs inter-state GST comparison', () => {
  it('intra-state (Rajasthan) generates CGST+SGST, inter-state (Delhi) generates IGST', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    const raj = addCustomer({
      name: 'Rajasthan Customer', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const del = addCustomer({
      name: 'Delhi Customer', mobile: '2', address1: '', city: 'Delhi',
      state: 'Delhi', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });

    // Intra-state order
    startNewOrder(); setOrderCustomer(raj); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    const intraInv = generateInvoice('2026-05-09')!;

    // Inter-state order
    startNewOrder(); setOrderCustomer(del); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    const interInv = generateInvoice('2026-05-09')!;

    expect(intraInv.isInterState).toBe(false);
    expect(intraInv.cgstTotal).toBeGreaterThan(0);
    expect(intraInv.igstTotal).toBe(0);

    expect(interInv.isInterState).toBe(true);
    expect(interInv.igstTotal).toBeGreaterThan(0);
    expect(interInv.cgstTotal).toBe(0);

    // Total GST amount should be the same regardless
    expect(intraInv.totalGST).toBeCloseTo(interInv.totalGST, 2);
  });
});

// ─── Flow 5: Edge case — stock goes to 0 ──────────────────────────────────────

describe('E2E Flow 5: edge cases and data integrity', () => {
  it('ready stock floors at 0 even when invoice exceeds available stock', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    useStore.setState({ readyStock: { 'WF-26K': 3 } });

    const custId = addCustomer({
      name: 'C', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 100, 780); // more than available
    generateInvoice('2026-05-09');

    expect(useStore.getState().readyStock['WF-26K']).toBe(0);
  });

  it('no double-counting: two separate invoice lines deduct correctly', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'C', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 5, 780);
    upsertCartItem('WF-5P',  10, 165);
    upsertCartItem('WF-10P', 3, 320);
    generateInvoice('2026-05-09');

    const { readyStock } = useStore.getState();
    expect(readyStock['WF-26K']).toBe(45);  // 50-5
    expect(readyStock['WF-5P']).toBe(90);   // 100-10
    expect(readyStock['WF-10P']).toBe(37);  // 40-3
    expect(readyStock['WF-5H']).toBe(30);   // unchanged
    expect(readyStock['BS-40K']).toBe(10);  // unchanged
  });

  it('cancel invoice does not restore ready stock (by design)', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, cancelInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'C', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 5, 780);
    const inv = generateInvoice('2026-05-09')!;
    const stockAfterSale = useStore.getState().readyStock['WF-26K'];

    cancelInvoice(inv.id);

    // Ready stock is NOT restored on cancel (business rule: manual adjustment needed)
    expect(useStore.getState().readyStock['WF-26K']).toBe(stockAfterSale);
    expect(useStore.getState().invoices.find(i => i.id === inv.id)!.cancelled).toBe(true);
  });
});

// ─── Flow 6: Payment mode on invoice ──────────────────────────────────────────

describe('E2E Flow 6: payment mode captured on invoice', () => {
  it('Cash order is stored as Cash on the invoice', () => {
    const { addCustomer, startNewOrder, setOrderCustomer, setOrderPaymentMode,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'C', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    setOrderPaymentMode('Cash');
    upsertCartItem('WF-26K', 1, 780);
    const inv = generateInvoice('2026-05-09')!;
    expect(inv.paymentMode).toBe('Cash');
  });

  it('Credit order is stored as Credit on the invoice', () => {
    const { addCustomer, startNewOrder, setOrderCustomer, setOrderPaymentMode,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'C', mobile: '1', address1: '', city: '', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0,
      paymentTerms: 'Cash', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    setOrderPaymentMode('Credit');
    upsertCartItem('WF-26K', 1, 780);
    const inv = generateInvoice('2026-05-09')!;
    expect(inv.paymentMode).toBe('Credit');
  });
});

// ─── Flow 7: New customer → invoice with discount → ready stock deduction ──────

describe('E2E Flow 7: new customer → discounted invoice → ready stock deducted', () => {
  it('flat discount: grand total is reduced AND ready stock is fully deducted', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, setOrderDiscount, generateInvoice } = useStore.getState();

    // 1. Add a brand-new customer
    const custId = addCustomer({
      name: 'Suresh Agarwal', firmName: 'Agarwal Kirana', mobile: '9123456780',
      address1: '12 Market St', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '302001', customerType: 'Retailer', creditLimit: 20000,
      paymentTerms: '15 Days', openingBalance: 0,
    });
    expect(custId).toBe('CUST-001');
    expect(useStore.getState().customers).toHaveLength(1);

    // 2. Create order: 4 × 26 kg Bag + 6 × 5 kg Pouch
    //    Subtotal = 4×780 + 6×165 = 3120 + 990 = 4110
    //    GST 5% intra-state = 205.5 → CGST 102.75, SGST 102.75
    //    Pre-discount total = 4110 + 205.5 = 4315.5 → ~4316
    startNewOrder();
    setOrderCustomer(custId);
    setOrderGst(true);
    upsertCartItem('WF-26K', 4, 780);
    upsertCartItem('WF-5P',  6, 165);

    // 3. Apply flat discount of ₹100
    setOrderDiscount('flat', 100);

    // 4. Generate invoice
    const inv = generateInvoice('2026-05-09')!;
    expect(inv).not.toBeNull();
    expect(inv.invoiceNo).toBe('INV-2627-001');

    // 5. Validate discount on invoice
    expect(inv.discountType).toBe('flat');
    expect(inv.discountAmount).toBe(100);
    // Grand total must be lower than pre-discount total by exactly ₹100
    const subtotal = 4 * 780 + 6 * 165; // 4110
    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const expectedGrandTotal = Math.round(subtotal + gst - 100);
    expect(inv.grandTotal).toBe(expectedGrandTotal);

    // 6. Validate ready stock deduction — happens even with discount
    const { readyStock } = useStore.getState();
    expect(readyStock['WF-26K']).toBe(46);  // 50 - 4
    expect(readyStock['WF-5P']).toBe(94);   // 100 - 6
    // Unrelated SKUs must be untouched
    expect(readyStock['WF-10P']).toBe(40);
    expect(readyStock['WF-10H']).toBe(20);
    expect(readyStock['BS-40K']).toBe(10);

    // 7. Verify DEDUCT transactions were created for every line item
    const txns = useStore.getState().readyStockTransactions;
    expect(txns).toHaveLength(2);
    expect(txns.every(t => t.type === 'DEDUCT')).toBe(true);
    expect(txns.find(t => t.skuId === 'WF-26K')!.quantity).toBe(4);
    expect(txns.find(t => t.skuId === 'WF-5P')!.quantity).toBe(6);
    expect(txns.every(t => t.reason?.includes('INV-2627-001'))).toBe(true);
  });

  it('percent discount: grand total reduced by percentage AND ready stock deducted', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, setOrderDiscount, generateInvoice } = useStore.getState();

    const custId = addCustomer({
      name: 'Manoj Sharma', mobile: '9000000001', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });

    // Order: 2 × 26 kg Bag
    // Subtotal = 2×780 = 1560, GST 5% = 78, pre-discount = 1638
    // 10% discount = 163.8, grand total = round(1638 - 163.8) = 1474
    startNewOrder();
    setOrderCustomer(custId);
    setOrderGst(true);
    upsertCartItem('WF-26K', 2, 780);
    setOrderDiscount('percent', 10);

    const inv = generateInvoice('2026-05-09')!;
    expect(inv.discountType).toBe('percent');
    expect(inv.discountAmount).toBeCloseTo(163.8, 1);

    const expectedGrandTotal = Math.round(1560 * 1.05 - 1560 * 1.05 * 0.10);
    expect(inv.grandTotal).toBe(expectedGrandTotal);

    // Ready stock deducted regardless of discount type
    expect(useStore.getState().readyStock['WF-26K']).toBe(48); // 50 - 2
    expect(useStore.getState().readyStockTransactions).toHaveLength(1);
    expect(useStore.getState().readyStockTransactions[0].type).toBe('DEDUCT');
    expect(useStore.getState().readyStockTransactions[0].quantity).toBe(2);
  });
});

// ─── Flow 8: Bran end-to-end — packaging → ready stock → order → invoice ──────

describe('E2E Flow 8: Bran — add packaging → add ready stock → order → invoice', () => {
  it('completes the full Bran cycle with correct stock levels at every step', () => {
    const {
      addCustomer, addPackagingEntry, addReadyStockEntry,
      startNewOrder, setOrderCustomer, setOrderGst,
      upsertCartItem, generateInvoice,
    } = useStore.getState();

    // Initial state (from resetStore):
    //   packagingStock['PKG-BR-40K'] = 30
    //   readyStock['BR-40K']         = 20

    // ── Step 1: Add a customer ────────────────────────────────────────────────
    const custId = addCustomer({
      name: 'Bran Buyer', firmName: 'Cattle Feed Co', mobile: '9876543210',
      address1: '10 Farm Rd', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '302001', customerType: 'Retailer',
      creditLimit: 100000, paymentTerms: '30 Days', openingBalance: 0,
    });
    expect(custId).toBe('CUST-001');

    // ── Step 2: Purchase 100 bags of Bran packaging ───────────────────────────
    addPackagingEntry({
      date: '10/05/2026', materialId: 'PKG-BR-40K',
      materialName: '40 kg Bags (Shikharji Bran)', entryType: 'purchase', quantity: 100,
    });
    // 30 (initial) + 100 = 130
    expect(useStore.getState().packagingStock['PKG-BR-40K']).toBe(130);

    // ── Step 3: Add 25 bags to ready stock (auto-deducts packaging) ───────────
    addReadyStockEntry('BR-40K', 25, 'Packing run – Bran', '10/05/2026');
    // ready stock: 20 + 25 = 45
    expect(useStore.getState().readyStock['BR-40K']).toBe(45);
    // packaging: 130 - 25 = 105  (auto-deducted by addReadyStockEntry)
    expect(useStore.getState().packagingStock['PKG-BR-40K']).toBe(105);

    // Confirm the packaging ledger has both entries: 1 purchase + 1 auto-used
    const pkgEntries = useStore.getState().packagingEntries;
    expect(pkgEntries).toHaveLength(2);
    expect(pkgEntries[0].entryType).toBe('purchase');
    expect(pkgEntries[1].entryType).toBe('used');
    expect(pkgEntries[1].quantity).toBe(25);

    // ── Step 4: Place an order for 10 × 40 kg Bran bags ──────────────────────
    startNewOrder();
    setOrderCustomer(custId);
    setOrderGst(true);
    upsertCartItem('BR-40K', 10, 480);

    // ── Step 5: Generate invoice ──────────────────────────────────────────────
    // Subtotal = 10 × 480 = 4800
    // GST 5% (intra-state Rajasthan) = 240  → CGST 120 + SGST 120
    // Grand total = 4800 + 240 = 5040
    const inv = generateInvoice('2026-05-10')!;
    expect(inv).not.toBeNull();
    expect(inv.invoiceNo).toBe('INV-2627-001');
    expect(inv.grandTotal).toBe(5040);
    expect(inv.isInterState).toBe(false);
    expect(inv.cgstTotal).toBe(120);
    expect(inv.sgstTotal).toBe(120);
    expect(inv.igstTotal).toBe(0);

    // ── Step 6: Verify ready stock deduction after invoice ────────────────────
    // 45 - 10 = 35
    expect(useStore.getState().readyStock['BR-40K']).toBe(35);

    // Packaging stock must NOT change due to a sale
    expect(useStore.getState().packagingStock['PKG-BR-40K']).toBe(105);

    // ── Step 7: Verify ready-stock transaction record ─────────────────────────
    const txns = useStore.getState().readyStockTransactions;
    // Two transactions: one ADD (from addReadyStockEntry) + one DEDUCT (from generateInvoice)
    expect(txns).toHaveLength(2);

    const addTxn = txns.find(t => t.type === 'ADD')!;
    expect(addTxn).toBeDefined();
    expect(addTxn.skuId).toBe('BR-40K');
    expect(addTxn.quantity).toBe(25);
    expect(addTxn.previousStock).toBe(20);
    expect(addTxn.newStock).toBe(45);

    const deductTxn = txns.find(t => t.type === 'DEDUCT')!;
    expect(deductTxn).toBeDefined();
    expect(deductTxn.skuId).toBe('BR-40K');
    expect(deductTxn.quantity).toBe(10);
    expect(deductTxn.reason).toContain('INV-2627-001');

    // Other SKUs must be completely untouched
    const { readyStock } = useStore.getState();
    expect(readyStock['WF-26K']).toBe(50);
    expect(readyStock['BS-40K']).toBe(10);
    expect(readyStock['DL-500G']).toBe(200);
  });
});
