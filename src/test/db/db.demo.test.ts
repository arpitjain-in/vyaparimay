/**
 * Demo DB layer (db.demo.ts) tests
 * Verifies that all localStorage read/write operations are correct
 * and that seed data is correct for demo mode.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initAuth,
  getOrCreateOrg,
  loadBusinessProfile,
  saveBusinessProfile,
  loadCustomers,
  saveCustomer,
  updateCustomerInDb,
  loadInvoices,
  saveInvoice,
  cancelInvoiceInDb,
  loadPackagingEntries,
  savePackagingEntry,
  saveReadyStockTransaction,
  loadStockData,
  loadPaymentReceipts,
  savePaymentReceipt,
  resetDemoData,
  FIXED_ORG_ID,
} from '../../lib/db.demo';
import type {
  BusinessProfile, Customer, Invoice, PackagingEntry,
  PaymentReceipt, ReadyStockTransaction, OrderItem,
} from '../../types';

const ORG = FIXED_ORG_ID;

const SAMPLE_PROFILE: BusinessProfile = {
  name: 'Test Mill', address1: '1 Test St', city: 'Jaipur',
  state: 'Rajasthan', pinCode: '302001', gstin: '08AAAAA0000A1Z5',
  fssai: '', mobile: '9999999999', gstEnabled: true,
};

const SAMPLE_CUSTOMER: Customer = {
  id: 'CUST-099', name: 'Test Customer', mobile: '9000000001',
  address1: '1 Main Rd', city: 'Jaipur', state: 'Rajasthan',
  pinCode: '302001', customerType: 'Retailer', creditLimit: 10000,
  paymentTerms: 'Cash', openingBalance: 0, createdOn: '09/05/2026', active: true,
};

beforeEach(() => {
  localStorage.clear();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('initAuth', () => {
  it('returns a demo user id string', async () => {
    const userId = await initAuth();
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  });
});

describe('getOrCreateOrg', () => {
  it('returns the fixed demo org id', async () => {
    const orgId = await getOrCreateOrg('demo-user');
    expect(orgId).toBe(FIXED_ORG_ID);
  });
});

// ─── Seeding ──────────────────────────────────────────────────────────────────

describe('seedIfNeeded (via initAuth)', () => {
  it('seeds business profile on first call', async () => {
    await initAuth();
    const profile = await loadBusinessProfile(ORG);
    expect(profile).not.toBeNull();
    expect(profile!.name).toContain('Demo');
  });

  it('seeds 3 demo customers', async () => {
    await initAuth();
    const { customers } = await loadCustomers(ORG);
    expect(customers).toHaveLength(3);
  });

  it('does not re-seed on second call (idempotent)', async () => {
    await initAuth();
    // Manually modify business profile
    await saveBusinessProfile(ORG, { ...SAMPLE_PROFILE, name: 'Modified Name' });
    // Call initAuth again — should NOT overwrite our manual change
    await initAuth();
    const profile = await loadBusinessProfile(ORG);
    expect(profile!.name).toBe('Modified Name');
  });
});

describe('resetDemoData', () => {
  it('wipes and re-seeds all data', async () => {
    await initAuth();
    await saveBusinessProfile(ORG, { ...SAMPLE_PROFILE, name: 'Modified' });
    resetDemoData();
    const profile = await loadBusinessProfile(ORG);
    expect(profile!.name).toContain('Demo'); // back to seed data
  });

  it('resets customer list back to 3 seed customers', async () => {
    await initAuth();
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 4);
    resetDemoData();
    const { customers } = await loadCustomers(ORG);
    expect(customers).toHaveLength(3);
  });
});

// ─── Business Profile ─────────────────────────────────────────────────────────

describe('saveBusinessProfile / loadBusinessProfile', () => {
  it('round-trips a business profile', async () => {
    await saveBusinessProfile(ORG, SAMPLE_PROFILE);
    const loaded = await loadBusinessProfile(ORG);
    expect(loaded).toMatchObject(SAMPLE_PROFILE);
  });

  it('returns null when nothing is stored', async () => {
    const loaded = await loadBusinessProfile(ORG);
    expect(loaded).toBeNull();
  });
});

// ─── Customers ────────────────────────────────────────────────────────────────

describe('saveCustomer / loadCustomers', () => {
  it('saves and loads a customer', async () => {
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 1);
    const { customers } = await loadCustomers(ORG);
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Test Customer');
  });

  it('returns correct seq', async () => {
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 7);
    const { seq } = await loadCustomers(ORG);
    expect(seq).toBe(7);
  });

  it('updates existing customer instead of duplicating', async () => {
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 1);
    await saveCustomer(ORG, { ...SAMPLE_CUSTOMER, name: 'Updated Name' }, 1);
    const { customers } = await loadCustomers(ORG);
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Updated Name');
  });
});

describe('updateCustomerInDb', () => {
  it('partially updates an existing customer', async () => {
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 1);
    await updateCustomerInDb(ORG, SAMPLE_CUSTOMER.id, { city: 'Jodhpur', active: false });
    const { customers } = await loadCustomers(ORG);
    expect(customers[0].city).toBe('Jodhpur');
    expect(customers[0].active).toBe(false);
    expect(customers[0].name).toBe('Test Customer'); // unchanged
  });

  it('does nothing for unknown customer id', async () => {
    await saveCustomer(ORG, SAMPLE_CUSTOMER, 1);
    await updateCustomerInDb(ORG, 'CUST-999', { city: 'Mumbai' });
    const { customers } = await loadCustomers(ORG);
    expect(customers[0].city).toBe('Jaipur'); // unchanged
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe('saveInvoice / loadInvoices / cancelInvoiceInDb', () => {
  const SAMPLE_INVOICE: Invoice = {
    id: 'inv-001',
    invoiceNo: 'INV-2627-001',
    invoiceDate: '09/05/2026',
    invoiceTime: '10:30',
    customerId: 'CUST-001',
    customerSnapshot: SAMPLE_CUSTOMER,
    items: [],
    subtotal: 780,
    cgstTotal: 19.5,
    sgstTotal: 19.5,
    igstTotal: 0,
    totalGST: 39,
    roundOff: 0,
    grandTotal: 819,
    isInterState: false,
    paymentMode: 'Cash',
    amountInWords: 'Eight Hundred Nineteen Rupees Only',
    financialYear: '2627',
    cancelled: false,
  };

  it('saves and loads an invoice', async () => {
    await saveInvoice(ORG, SAMPLE_INVOICE, [], [], {});
    const invoices = await loadInvoices(ORG);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].invoiceNo).toBe('INV-2627-001');
  });

  it('cancels an invoice', async () => {
    await saveInvoice(ORG, SAMPLE_INVOICE, [], [], {});
    await cancelInvoiceInDb(ORG, 'inv-001');
    const invoices = await loadInvoices(ORG);
    expect(invoices[0].cancelled).toBe(true);
  });

  it('returns empty array when no invoices saved', async () => {
    const invoices = await loadInvoices(ORG);
    expect(invoices).toHaveLength(0);
  });
});

// ─── Packaging Entries ────────────────────────────────────────────────────────

describe('savePackagingEntry / loadPackagingEntries', () => {
  const ENTRY: PackagingEntry = {
    id: 'pkg-001',
    date: '09/05/2026',
    time: '09:00',
    materialId: 'PKG-WF-26K',
    materialName: '25/26 kg Bags',
    entryType: 'purchase',
    quantity: 100,
  };

  it('saves and loads a packaging entry', async () => {
    await savePackagingEntry(ORG, ENTRY, 100);
    const entries = await loadPackagingEntries(ORG);
    expect(entries).toHaveLength(1);
    expect(entries[0].quantity).toBe(100);
    expect(entries[0].entryType).toBe('purchase');
  });

  it('accumulates multiple entries', async () => {
    await savePackagingEntry(ORG, ENTRY, 100);
    await savePackagingEntry(ORG, { ...ENTRY, id: 'pkg-002', entryType: 'used', quantity: 20 }, 80);
    const entries = await loadPackagingEntries(ORG);
    expect(entries).toHaveLength(2);
  });
});

// ─── Payment Receipts ─────────────────────────────────────────────────────────

describe('savePaymentReceipt / loadPaymentReceipts', () => {
  const RECEIPT: PaymentReceipt = {
    id: 'REC-0001',
    customerId: 'CUST-001',
    date: '09/05/2026',
    time: '11:00',
    amount: 5000,
    mode: 'Cash',
    notes: 'Advance payment',
  };

  it('saves and loads a payment receipt', async () => {
    await savePaymentReceipt(ORG, RECEIPT);
    const { receipts } = await loadPaymentReceipts(ORG);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].amount).toBe(5000);
  });

  it('returns correct seq from receipt id', async () => {
    await savePaymentReceipt(ORG, RECEIPT); // REC-0001 → seq = 1
    const { seq } = await loadPaymentReceipts(ORG);
    expect(seq).toBe(1);
  });
});

// ─── Bran end-to-end DB persistence ──────────────────────────────────────────

describe('Bran DB persistence: packaging → ready stock → invoice → ready stock deducted', () => {
  const BRAN_CUSTOMER: Customer = {
    id: 'CUST-099', name: 'Bran Buyer', firmName: 'Cattle Feed Co',
    mobile: '9876543210', address1: '10 Farm Rd', city: 'Jaipur',
    state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer',
    creditLimit: 100000, paymentTerms: '30 Days', openingBalance: 0,
    createdOn: '10/05/2026', active: true,
  };

  it('saves packaging entry for PKG-BR-40K and updates packaging stock', async () => {
    const entry: PackagingEntry = {
      id: 'pkg-br-001',
      date: '10/05/2026',
      time: '09:00',
      materialId: 'PKG-BR-40K',
      materialName: '40 kg Bags (Shikharji Bran)',
      entryType: 'purchase',
      quantity: 100,
    };
    // Initial packaging stock seeded at 100 for all materials
    // Purchase 100 more → 200
    await savePackagingEntry(ORG, entry, 200);
    const entries = await loadPackagingEntries(ORG);
    expect(entries.some(e => e.materialId === 'PKG-BR-40K' && e.entryType === 'purchase')).toBe(true);

    const { packagingStock } = await loadStockData(ORG);
    expect(packagingStock['PKG-BR-40K']).toBe(200);
  });

  it('saves ready stock transaction for BR-40K and updates ready stock', async () => {
    const addTxn: ReadyStockTransaction = {
      id: 'rst-br-001',
      date: '10/05/2026',
      time: '09:30',
      skuId: 'BR-40K',
      skuName: 'Shikharji Bran – 40 kg Bag',
      type: 'ADD',
      quantity: 25,
      previousStock: 12,   // seed has BR-40K: 12
      newStock: 37,
      reason: 'Packing run – Bran',
    };
    await saveReadyStockTransaction(ORG, addTxn);

    const { readyStock, readyStockTransactions } = await loadStockData(ORG);
    expect(readyStock['BR-40K']).toBe(37);
    expect(readyStockTransactions.some(t => t.skuId === 'BR-40K' && t.type === 'ADD')).toBe(true);
  });

  it('saves auto-deduct packaging entry when adding ready stock', async () => {
    const autoDeductEntry: PackagingEntry = {
      id: 'pkg-br-auto-001',
      date: '10/05/2026',
      time: '09:30',
      materialId: 'PKG-BR-40K',
      materialName: '40 kg Bags (Shikharji Bran)',
      entryType: 'used',
      quantity: 25,
      notes: 'Auto-deducted for Ready Stock: Shikharji Bran – 40 kg Bag',
    };
    // Packaging was at 200 (from previous test state), now 200 - 25 = 175
    await savePackagingEntry(ORG, autoDeductEntry, 175);

    const { packagingStock } = await loadStockData(ORG);
    expect(packagingStock['PKG-BR-40K']).toBe(175);
  });

  it('saves a Bran invoice with items and deducts ready stock', async () => {
    await saveCustomer(ORG, BRAN_CUSTOMER, 99);

    const branItem: OrderItem = {
      skuId: 'BR-40K',
      product: 'Shikharji Bran',
      variant: '40 kg Bag',
      weight: 40,
      hsnCode: '2302',
      gstRate: 5,
      quantity: 10,
      rate: 480,
      taxableValue: 4800,
      cgst: 120,
      sgst: 120,
      igst: 0,
      lineTotal: 5040,
      unit: 'Bag',
    };

    const deductTxn: ReadyStockTransaction = {
      id: 'rst-br-deduct-001',
      date: '10/05/2026',
      time: '10:00',
      skuId: 'BR-40K',
      skuName: 'Shikharji Bran – 40 kg Bag',
      type: 'DEDUCT',
      quantity: 10,
      previousStock: 37,
      newStock: 27,
      reason: 'Sale – INV-2627-001',
      invoiceNo: 'INV-2627-001',
    };

    const branInvoice: Invoice = {
      id: 'inv-br-001',
      invoiceNo: 'INV-2627-001',
      invoiceDate: '10/05/2026',
      invoiceTime: '10:00',
      customerId: 'CUST-099',
      customerSnapshot: BRAN_CUSTOMER,
      items: [branItem],
      subtotal: 4800,
      cgstTotal: 120,
      sgstTotal: 120,
      igstTotal: 0,
      totalGST: 240,
      roundOff: 0,
      grandTotal: 5040,
      isInterState: false,
      paymentMode: 'Cash',
      amountInWords: 'Five Thousand and Forty Rupees Only',
      financialYear: '2627',
      cancelled: false,
    };

    // Save invoice with DEDUCT ready stock transaction and new ready stock level
    await saveInvoice(ORG, branInvoice, [branItem], [deductTxn], { 'BR-40K': 27 });

    // Verify invoice is loadable with correct items
    const invoices = await loadInvoices(ORG);
    const saved = invoices.find(i => i.id === 'inv-br-001');
    expect(saved).toBeDefined();
    expect(saved!.invoiceNo).toBe('INV-2627-001');
    expect(saved!.grandTotal).toBe(5040);
    expect(saved!.items).toHaveLength(1);
    expect(saved!.items[0].skuId).toBe('BR-40K');
    expect(saved!.items[0].quantity).toBe(10);

    // Verify ready stock was deducted in DB: 37 - 10 = 27
    const { readyStock, readyStockTransactions } = await loadStockData(ORG);
    expect(readyStock['BR-40K']).toBe(27);
    const deduct = readyStockTransactions.find(t => t.type === 'DEDUCT' && t.skuId === 'BR-40K');
    expect(deduct).toBeDefined();
    expect(deduct!.quantity).toBe(10);
    expect(deduct!.reason).toContain('INV-2627-001');

    // Non-Bran SKUs are untouched — readyStock only contains keys explicitly set
    expect(readyStock['WF-26K']).toBeUndefined(); // not touched in this isolated test
  });

  it('cancelling a Bran invoice marks it cancelled in DB', async () => {
    const branInvoice: Invoice = {
      id: 'inv-br-cancel-001',
      invoiceNo: 'INV-2627-002',
      invoiceDate: '10/05/2026',
      invoiceTime: '11:00',
      customerId: 'CUST-001',
      customerSnapshot: {} as Customer,
      items: [],
      subtotal: 4800,
      cgstTotal: 120,
      sgstTotal: 120,
      igstTotal: 0,
      totalGST: 240,
      roundOff: 0,
      grandTotal: 5040,
      isInterState: false,
      paymentMode: 'Cash',
      amountInWords: 'Five Thousand and Forty Rupees Only',
      financialYear: '2627',
      cancelled: false,
    };
    await saveInvoice(ORG, branInvoice, [], [], {});
    await cancelInvoiceInDb(ORG, 'inv-br-cancel-001');

    const invoices = await loadInvoices(ORG);
    const found = invoices.find(i => i.id === 'inv-br-cancel-001');
    expect(found!.cancelled).toBe(true);
  });
});
