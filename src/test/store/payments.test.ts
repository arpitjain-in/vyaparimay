/**
 * Payment & Customer Ledger Tests
 *
 * Covers:
 *  - addPaymentReceipt: sequential IDs, all payment modes, receipt stored
 *  - Ledger balance math:
 *      opening balance  → debit
 *      invoice          → debit
 *      payment receipt  → credit
 *      running balance  per row (chronological)
 *      outstanding      = totalDebit − totalCredit
 *  - Date-ordering of ledger entries (earlier date before later date)
 *  - Cancelled invoices excluded from ledger
 *  - Multiple customers: receipts are isolated per customer
 *  - Partial payments: outstanding reduces but doesn't go negative unless over-paid
 *  - Full payment: outstanding reaches 0
 *  - Over-payment: outstanding goes negative (credit balance)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';
import { DEFAULT_PRICES } from '../../data/products';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      'PKG-WF-26K': 500, 'PKG-WF-5P': 500, 'PKG-WF-10P': 200,
      'PKG-WF-5H': 200, 'PKG-WF-10H': 200,
      'PKG-BS-40K': 50, 'PKG-BS-500G': 500, 'PKG-DL-500G': 300, 'PKG-BR-40K': 30,
    },
    packagingEntries: [],
    readyStock: {
      'WF-26K': 100, 'WF-5P': 200, 'WF-10P': 80,
      'WF-5H': 60, 'WF-10H': 60, 'WF-25K': 30,
      'BS-40K': 20, 'BS-500G': 500, 'DL-500G': 400, 'BR-40K': 40,
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

/** Build the same ledger logic that CustomerLedger.tsx uses */
function buildLedger(customerId: string) {
  const { customers, invoices, paymentReceipts } = useStore.getState();
  const customer = customers.find(c => c.id === customerId)!;

  type LedgerRow = {
    kind: 'opening' | 'invoice' | 'payment';
    date: string; time: string;
    debit: number; credit: number;
    label?: string;
  };

  const rows: LedgerRow[] = [];

  if (customer.openingBalance > 0) {
    rows.push({ kind: 'opening', date: customer.createdOn, time: '00:00',
                debit: customer.openingBalance, credit: 0 });
  }

  invoices
    .filter(inv => inv.customerId === customerId && !inv.cancelled)
    .forEach(inv => rows.push({
      kind: 'invoice', date: inv.invoiceDate, time: inv.invoiceTime,
      debit: inv.grandTotal, credit: 0, label: inv.invoiceNo,
    }));

  paymentReceipts
    .filter(r => r.customerId === customerId)
    .forEach(r => rows.push({
      kind: 'payment', date: r.date, time: r.time,
      debit: 0, credit: r.amount, label: r.id,
    }));

  rows.sort((a, b) => {
    const toTs = (d: string, t: string) => {
      const [dd, mm, yyyy] = d.split('/');
      return new Date(`${yyyy}-${mm}-${dd}T${t}`).getTime();
    };
    return toTs(a.date, a.time) - toTs(b.date, b.time);
  });

  let balance = 0;
  const ledger = rows.map(row => {
    balance += row.debit - row.credit;
    return { ...row, balance };
  });

  const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const outstanding = totalDebit - totalCredit;

  return { ledger, totalDebit, totalCredit, outstanding };
}

// Tests hardcode transaction dates from 01/05/2026 onward and rely on
// customer.createdOn (= "today") sorting before all of them in the ledger.
// Pin the clock so this doesn't depend on when the suite actually runs.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-20T10:00:00'));
  resetStore();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─── addPaymentReceipt ────────────────────────────────────────────────────────

describe('addPaymentReceipt', () => {
  it('generates sequential IDs starting from REC-0001', () => {
    const { addCustomer, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'A', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    addPaymentReceipt({ customerId: custId, date: '09/05/2026', amount: 500, mode: 'Cash' });
    const receipts = useStore.getState().paymentReceipts;
    expect(receipts).toHaveLength(1);
    expect(receipts[0].id).toBe('REC-0001');
  });

  it('increments ID for each new receipt', () => {
    const { addCustomer, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'A', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    addPaymentReceipt({ customerId: custId, date: '01/05/2026', amount: 1000, mode: 'Cash' });
    addPaymentReceipt({ customerId: custId, date: '05/05/2026', amount: 2000, mode: 'UPI' });
    addPaymentReceipt({ customerId: custId, date: '09/05/2026', amount: 3000, mode: 'Bank Transfer' });
    const receipts = useStore.getState().paymentReceipts;
    expect(receipts.map(r => r.id)).toEqual(['REC-0001', 'REC-0002', 'REC-0003']);
  });

  it('stores all payment modes correctly', () => {
    const { addCustomer, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'A', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const modes = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] as const;
    modes.forEach((mode, i) =>
      addPaymentReceipt({ customerId: custId, date: `0${i + 1}/05/2026`, amount: 100 * (i + 1), mode })
    );
    const receipts = useStore.getState().paymentReceipts;
    expect(receipts.map(r => r.mode)).toEqual(modes);
  });

  it('stores optional referenceNo and notes', () => {
    const { addCustomer, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'A', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    addPaymentReceipt({
      customerId: custId, date: '09/05/2026', amount: 5000,
      mode: 'Cheque', referenceNo: 'CHQ-1234', notes: 'May payment',
    });
    const r = useStore.getState().paymentReceipts[0];
    expect(r.referenceNo).toBe('CHQ-1234');
    expect(r.notes).toBe('May payment');
  });

  it('receipts from different customers are isolated', () => {
    const { addCustomer, addPaymentReceipt } = useStore.getState();
    const c1 = addCustomer({ name: 'C1', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const c2 = addCustomer({ name: 'C2', mobile: '2', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    addPaymentReceipt({ customerId: c1, date: '09/05/2026', amount: 1000, mode: 'Cash' });
    addPaymentReceipt({ customerId: c2, date: '09/05/2026', amount: 2000, mode: 'UPI' });
    const all = useStore.getState().paymentReceipts;
    expect(all.filter(r => r.customerId === c1)).toHaveLength(1);
    expect(all.filter(r => r.customerId === c2)).toHaveLength(1);
    expect(all.find(r => r.customerId === c1)!.amount).toBe(1000);
    expect(all.find(r => r.customerId === c2)!.amount).toBe(2000);
  });
});

// ─── Ledger balance math ──────────────────────────────────────────────────────

describe('Customer Ledger — balance math', () => {
  it('invoice only: debit = grandTotal, outstanding = grandTotal', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();
    const custId = addCustomer({
      name: 'Ramesh', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 2, 780); // 2×780=1560, GST 5%=78, total=1638
    const inv = generateInvoice('2026-05-01')!;

    const { ledger, totalDebit, totalCredit, outstanding } = buildLedger(custId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].kind).toBe('invoice');
    expect(ledger[0].debit).toBe(inv.grandTotal);
    expect(ledger[0].credit).toBe(0);
    expect(ledger[0].balance).toBe(inv.grandTotal);
    expect(totalDebit).toBe(inv.grandTotal);
    expect(totalCredit).toBe(0);
    expect(outstanding).toBe(inv.grandTotal);
  });

  it('partial payment: outstanding = invoice total − payment', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Suresh', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 4, 780); // 4×780=3120, GST=156, total=3276
    const inv = generateInvoice('2026-05-01')!;

    addPaymentReceipt({ customerId: custId, date: '05/05/2026', amount: 1000, mode: 'Cash' });

    const { outstanding, totalDebit, totalCredit } = buildLedger(custId);
    expect(totalDebit).toBe(inv.grandTotal);
    expect(totalCredit).toBe(1000);
    expect(outstanding).toBe(inv.grandTotal - 1000);
  });

  it('full payment: outstanding reaches 0', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Vijay', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780); // total=819
    const inv = generateInvoice('2026-05-01')!;

    addPaymentReceipt({ customerId: custId, date: '09/05/2026', amount: inv.grandTotal, mode: 'UPI' });

    const { outstanding } = buildLedger(custId);
    expect(outstanding).toBe(0);
  });

  it('over-payment: outstanding goes negative (credit balance)', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Over', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780); // total=819
    const inv = generateInvoice('2026-05-01')!;

    addPaymentReceipt({ customerId: custId, date: '09/05/2026', amount: inv.grandTotal + 500, mode: 'Cash' });

    const { outstanding } = buildLedger(custId);
    expect(outstanding).toBe(-500);
  });

  it('opening balance is included in totalDebit', () => {
    const { addCustomer } = useStore.getState();
    const custId = addCustomer({
      name: 'Old Debt', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 5000,
    });
    const { totalDebit, outstanding, ledger } = buildLedger(custId);
    expect(ledger[0].kind).toBe('opening');
    expect(ledger[0].debit).toBe(5000);
    expect(totalDebit).toBe(5000);
    expect(outstanding).toBe(5000);
  });

  it('opening balance + invoice + payment → correct running balance', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Full Cycle', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 2000,
    });

    // Invoice on 10/05 (after customer createdOn = today 09/05)
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    const inv = generateInvoice('2026-05-10')!;

    // Payment on 15/05
    addPaymentReceipt({ customerId: custId, date: '15/05/2026', amount: 1500, mode: 'Bank Transfer' });

    const { ledger, outstanding } = buildLedger(custId);
    // Row 0: opening (date=customer.createdOn = 09/05/2026, time=00:00)
    expect(ledger[0].kind).toBe('opening');
    expect(ledger[0].balance).toBe(2000);
    // Row 1: invoice on 10/05
    expect(ledger[1].kind).toBe('invoice');
    expect(ledger[1].balance).toBe(2000 + inv.grandTotal);
    // Row 2: payment on 15/05
    expect(ledger[2].kind).toBe('payment');
    expect(ledger[2].balance).toBe(2000 + inv.grandTotal - 1500);
    // Outstanding
    expect(outstanding).toBe(2000 + inv.grandTotal - 1500);
  });
});

// ─── Date ordering ────────────────────────────────────────────────────────────

describe('Customer Ledger — chronological ordering', () => {
  it('entries are sorted by date ascending regardless of insertion order', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Sort Test', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });

    // Payment added BEFORE invoice in insertion order
    addPaymentReceipt({ customerId: custId, date: '15/05/2026', amount: 500, mode: 'Cash' });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    generateInvoice('2026-05-01'); // invoice dated 01/05

    const { ledger } = buildLedger(custId);
    // Invoice (01/05) must come before payment (15/05)
    expect(ledger[0].kind).toBe('invoice');
    expect(ledger[0].date).toBe('01/05/2026');
    expect(ledger[1].kind).toBe('payment');
    expect(ledger[1].date).toBe('15/05/2026');
  });

  it('multiple payments across different dates accumulate balance correctly', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();
    const custId = addCustomer({
      name: 'Multi Pay', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });

    // Invoice on 01/05
    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 5, 780); // 5×780=3900, GST=195, total=4095
    const inv = generateInvoice('2026-05-01')!;

    // Three partial payments on different dates
    addPaymentReceipt({ customerId: custId, date: '05/05/2026', amount: 1000, mode: 'Cash' });
    addPaymentReceipt({ customerId: custId, date: '09/05/2026', amount: 1500, mode: 'UPI' });
    addPaymentReceipt({ customerId: custId, date: '15/05/2026', amount: 1000, mode: 'Bank Transfer' });

    const { ledger, outstanding } = buildLedger(custId);
    expect(ledger).toHaveLength(4); // 1 invoice + 3 payments

    // Row 0: invoice
    expect(ledger[0].balance).toBe(inv.grandTotal);
    // Row 1: after 1st payment
    expect(ledger[1].balance).toBe(inv.grandTotal - 1000);
    // Row 2: after 2nd payment
    expect(ledger[2].balance).toBe(inv.grandTotal - 2500);
    // Row 3: after 3rd payment
    expect(ledger[3].balance).toBe(inv.grandTotal - 3500);

    expect(outstanding).toBe(inv.grandTotal - 3500);
  });

  it('two invoices on different dates accumulate debit in order', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice } = useStore.getState();
    const custId = addCustomer({
      name: 'Two Inv', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780); // total ≈ 819
    const inv1 = generateInvoice('2026-05-01')!;

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 2, 780); // total ≈ 1638
    const inv2 = generateInvoice('2026-05-10')!;

    const { ledger, totalDebit, outstanding } = buildLedger(custId);
    expect(ledger).toHaveLength(2);
    // First invoice comes first
    expect(ledger[0].label).toBe(inv1.invoiceNo);
    expect(ledger[0].balance).toBe(inv1.grandTotal);
    // Second invoice added on top
    expect(ledger[1].label).toBe(inv2.invoiceNo);
    expect(ledger[1].balance).toBe(inv1.grandTotal + inv2.grandTotal);
    expect(totalDebit).toBe(inv1.grandTotal + inv2.grandTotal);
    expect(outstanding).toBe(inv1.grandTotal + inv2.grandTotal);
  });
});

// ─── Cancelled invoices ───────────────────────────────────────────────────────

describe('Customer Ledger — cancelled invoices', () => {
  it('cancelled invoice is excluded from ledger debit', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, cancelInvoice } = useStore.getState();
    const custId = addCustomer({
      name: 'Cancel Test', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 2, 780);
    const inv = generateInvoice('2026-05-01')!;

    cancelInvoice(inv.id);

    const { ledger, totalDebit, outstanding } = buildLedger(custId);
    expect(ledger).toHaveLength(0);
    expect(totalDebit).toBe(0);
    expect(outstanding).toBe(0);
  });

  it('only active invoices count; cancelled ones are skipped', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, cancelInvoice } = useStore.getState();
    const custId = addCustomer({
      name: 'Mixed', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan',
      pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0,
    });

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    const cancelled = generateInvoice('2026-05-01')!;
    cancelInvoice(cancelled.id);

    startNewOrder(); setOrderCustomer(custId); setOrderGst(true);
    upsertCartItem('WF-26K', 2, 780);
    const active = generateInvoice('2026-05-05')!;

    const { ledger, totalDebit } = buildLedger(custId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].label).toBe(active.invoiceNo);
    expect(totalDebit).toBe(active.grandTotal);
  });
});

// ─── Customer isolation ───────────────────────────────────────────────────────

describe('Customer Ledger — multi-customer isolation', () => {
  it('each customer ledger only contains their own invoices and payments', () => {
    const { addCustomer, startNewOrder, setOrderCustomer,
            upsertCartItem, setOrderGst, generateInvoice, addPaymentReceipt } = useStore.getState();

    const c1 = addCustomer({ name: 'C1', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0 });
    const c2 = addCustomer({ name: 'C2', mobile: '2', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Credit', openingBalance: 0 });

    // C1: 3 units, paid 500
    startNewOrder(); setOrderCustomer(c1); setOrderGst(true);
    upsertCartItem('WF-26K', 3, 780);
    const inv1 = generateInvoice('2026-05-01')!;
    addPaymentReceipt({ customerId: c1, date: '05/05/2026', amount: 500, mode: 'Cash' });

    // C2: 1 unit, no payment
    startNewOrder(); setOrderCustomer(c2); setOrderGst(true);
    upsertCartItem('WF-26K', 1, 780);
    const inv2 = generateInvoice('2026-05-02')!;

    const l1 = buildLedger(c1);
    const l2 = buildLedger(c2);

    expect(l1.totalDebit).toBe(inv1.grandTotal);
    expect(l1.totalCredit).toBe(500);
    expect(l1.outstanding).toBe(inv1.grandTotal - 500);

    expect(l2.totalDebit).toBe(inv2.grandTotal);
    expect(l2.totalCredit).toBe(0);
    expect(l2.outstanding).toBe(inv2.grandTotal);
  });
});
