/**
 * Store — Customer management tests
 * Tests: addCustomer, updateCustomer, deactivateCustomer, getCustomerInvoices
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';

// Mock both db layers so no network/localStorage calls in tests
vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  initAuth: vi.fn().mockResolvedValue('test-user'),
  getOrCreateOrg: vi.fn().mockResolvedValue('test-org-id'),
  loadBusinessProfile: vi.fn().mockResolvedValue(null),
  loadCustomers: vi.fn().mockResolvedValue({ customers: [], seq: 0 }),
  loadInvoices: vi.fn().mockResolvedValue([]),
  loadPaymentReceipts: vi.fn().mockResolvedValue({ receipts: [], seq: 0 }),
  loadPackagingEntries: vi.fn().mockResolvedValue([]),
  loadProductionLogs: vi.fn().mockResolvedValue([]),
  loadStockData: vi.fn().mockResolvedValue({
    rawMaterialStock: {},
    packagingStock: {},
    packagingEntries: [],
    productionLogs: [],
    stockTransactions: [],
    readyStock: {},
    readyStockTransactions: [],
    lastSyncBatchTime: null,
  }),
  loadPriceList: vi.fn().mockResolvedValue({}),
  loadReorderLevels: vi.fn().mockResolvedValue({ raw: {}, packaging: {}, ready: {} }),
  saveCustomer: vi.fn().mockResolvedValue(undefined),
  updateCustomerInDb: vi.fn().mockResolvedValue(undefined),
  saveBusinessProfile: vi.fn().mockResolvedValue(undefined),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
  savePaymentReceipt: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveProductionLog: vi.fn().mockResolvedValue(undefined),
  saveStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveReorderLevel: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  updateReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  deleteReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  savePrice: vi.fn().mockResolvedValue(undefined),
  clearAllPackagingData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
  initAuth: vi.fn().mockResolvedValue('demo-user'),
  getOrCreateOrg: vi.fn().mockResolvedValue('test-org-id'),
  loadBusinessProfile: vi.fn().mockResolvedValue(null),
  loadCustomers: vi.fn().mockResolvedValue({ customers: [], seq: 0 }),
  loadInvoices: vi.fn().mockResolvedValue([]),
  loadPaymentReceipts: vi.fn().mockResolvedValue({ receipts: [], seq: 0 }),
  loadPackagingEntries: vi.fn().mockResolvedValue([]),
  loadProductionLogs: vi.fn().mockResolvedValue([]),
  loadStockData: vi.fn().mockResolvedValue({
    rawMaterialStock: {},
    packagingStock: {},
    packagingEntries: [],
    productionLogs: [],
    stockTransactions: [],
    readyStock: {},
    readyStockTransactions: [],
    lastSyncBatchTime: null,
  }),
  loadPriceList: vi.fn().mockResolvedValue({}),
  loadReorderLevels: vi.fn().mockResolvedValue({ raw: {}, packaging: {}, ready: {} }),
  saveCustomer: vi.fn().mockResolvedValue(undefined),
  updateCustomerInDb: vi.fn().mockResolvedValue(undefined),
  saveBusinessProfile: vi.fn().mockResolvedValue(undefined),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
  savePaymentReceipt: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveProductionLog: vi.fn().mockResolvedValue(undefined),
  saveStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveReorderLevel: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  updateReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  deleteReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  savePrice: vi.fn().mockResolvedValue(undefined),
  clearAllPackagingData: vi.fn().mockResolvedValue(undefined),
}));

// Reset store to a clean state before each test
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
    packagingStock: {},
    packagingEntries: [],
    productionLogs: [],
    stockTransactions: [],
    readyStock: {},
    readyStockTransactions: [],
    currentOrder: null,
    businessProfile: {
      name: 'Test Mill',
      address1: '1 Test St',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
      gstin: '08AAAAA0000A1Z5',
      fssai: '',
      mobile: '9999999999',
      gstEnabled: true,
    },
  });
}

beforeEach(resetStore);

// ─── addCustomer ─────────────────────────────────────────────────────────────

describe('addCustomer', () => {
  it('adds a customer and returns a sequential ID', () => {
    const { addCustomer } = useStore.getState();
    const id = addCustomer({
      name: 'Ramesh Kumar',
      firmName: 'Ramesh Store',
      mobile: '9876543210',
      address1: '5 Gandhi Mkt',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
      customerType: 'Retailer',
      creditLimit: 50000,
      paymentTerms: '30 Days',
      openingBalance: 0,
    });
    expect(id).toBe('CUST-001');
    const { customers } = useStore.getState();
    expect(customers).toHaveLength(1);
    expect(customers[0].name).toBe('Ramesh Kumar');
    expect(customers[0].active).toBe(true);
  });

  it('increments sequence on each call', () => {
    const { addCustomer } = useStore.getState();
    const id1 = addCustomer({ name: 'A', mobile: '1', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const id2 = addCustomer({ name: 'B', mobile: '2', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const id3 = addCustomer({ name: 'C', mobile: '3', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    expect(id1).toBe('CUST-001');
    expect(id2).toBe('CUST-002');
    expect(id3).toBe('CUST-003');
    expect(useStore.getState().customers).toHaveLength(3);
  });

  it('sets createdOn to today in DD/MM/YYYY format', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({ name: 'A', mobile: '1', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const c = useStore.getState().customers[0];
    expect(c.createdOn).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

// ─── updateCustomer ───────────────────────────────────────────────────────────

describe('updateCustomer', () => {
  it('updates specific fields of a customer', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    addCustomer({ name: 'Old Name', mobile: '1', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const id = useStore.getState().customers[0].id;

    updateCustomer(id, { name: 'New Name', city: 'Jodhpur' });
    const updated = useStore.getState().customers[0];
    expect(updated.name).toBe('New Name');
    expect(updated.city).toBe('Jodhpur');
    expect(updated.mobile).toBe('1'); // unchanged fields preserved
  });

  it('does not affect other customers', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    addCustomer({ name: 'Alice', mobile: '1', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    addCustomer({ name: 'Bob', mobile: '2', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const [alice, bob] = useStore.getState().customers;

    updateCustomer(alice.id, { name: 'Alice Updated' });
    const { customers } = useStore.getState();
    expect(customers.find(c => c.id === bob.id)?.name).toBe('Bob');
  });
});

// ─── deactivateCustomer ───────────────────────────────────────────────────────

describe('deactivateCustomer', () => {
  it('sets active = false without deleting the customer', () => {
    const { addCustomer, deactivateCustomer } = useStore.getState();
    addCustomer({ name: 'Alice', mobile: '1', address1: '', city: '', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const id = useStore.getState().customers[0].id;

    deactivateCustomer(id);
    const c = useStore.getState().customers[0];
    expect(c.active).toBe(false);
    expect(useStore.getState().customers).toHaveLength(1); // still exists
  });
});

// ─── getCustomerInvoices ──────────────────────────────────────────────────────

describe('getCustomerInvoices', () => {
  it('returns only invoices for the given customer, excluding cancelled', () => {
    useStore.setState({
      invoices: [
        { id: 'i1', customerId: 'CUST-001', cancelled: false, invoiceNo: 'INV-2627-001' } as any,
        { id: 'i2', customerId: 'CUST-001', cancelled: true,  invoiceNo: 'INV-2627-002' } as any,
        { id: 'i3', customerId: 'CUST-002', cancelled: false, invoiceNo: 'INV-2627-003' } as any,
      ],
    });
    const result = useStore.getState().getCustomerInvoices('CUST-001');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('i1');
  });

  it('returns empty array when customer has no invoices', () => {
    const result = useStore.getState().getCustomerInvoices('CUST-999');
    expect(result).toHaveLength(0);
  });
});

// ─── addCustomer — detailed field validation ──────────────────────────────────

describe('addCustomer — all fields stored correctly', () => {
  it('stores every mandatory field on the customer record', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'Suresh Agarwal',
      mobile: '9123456789',
      address1: '12 Gandhi Mkt',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302001',
      customerType: 'Retailer',
      creditLimit: 25000,
      paymentTerms: '30 Days',
      openingBalance: 0,
    });
    const c = useStore.getState().customers[0];
    expect(c.name).toBe('Suresh Agarwal');
    expect(c.mobile).toBe('9123456789');
    expect(c.address1).toBe('12 Gandhi Mkt');
    expect(c.city).toBe('Jaipur');
    expect(c.state).toBe('Rajasthan');
    expect(c.pinCode).toBe('302001');
    expect(c.customerType).toBe('Retailer');
    expect(c.creditLimit).toBe(25000);
    expect(c.paymentTerms).toBe('30 Days');
    expect(c.openingBalance).toBe(0);
    expect(c.active).toBe(true);
    expect(c.id).toBe('CUST-001');
    expect(c.createdOn).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('stores all optional fields when provided', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'Manoj Sharma',
      firmName: 'Sharma Traders',
      mobile: '9000000001',
      alternateMobile: '9000000002',
      address1: '1 MG Road',
      address2: 'Near Bus Stand',
      city: 'Jodhpur',
      state: 'Rajasthan',
      pinCode: '342001',
      gstin: '08BBBBB1111B1Z5',
      fssai: 'FSSAI12345',
      customerType: 'Wholesaler',
      creditLimit: 100000,
      paymentTerms: '15 Days',
      openingBalance: 5000,
      notes: 'Pays on time',
    });
    const c = useStore.getState().customers[0];
    expect(c.firmName).toBe('Sharma Traders');
    expect(c.alternateMobile).toBe('9000000002');
    expect(c.address2).toBe('Near Bus Stand');
    expect(c.gstin).toBe('08BBBBB1111B1Z5');
    expect(c.fssai).toBe('FSSAI12345');
    expect(c.notes).toBe('Pays on time');
    expect(c.openingBalance).toBe(5000);
  });

  it('stores all four customer types correctly', () => {
    const { addCustomer } = useStore.getState();
    const types = ['Retailer', 'Wholesaler', 'Distributor', 'Direct Consumer'] as const;
    types.forEach((customerType, i) => {
      addCustomer({
        name: `Customer ${i}`, mobile: `${i}`, address1: '', city: 'Jaipur',
        state: 'Rajasthan', pinCode: '', customerType,
        creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
      });
    });
    const stored = useStore.getState().customers.map(c => c.customerType);
    expect(stored).toEqual(types);
  });

  it('stores all four payment terms correctly', () => {
    const { addCustomer } = useStore.getState();
    const terms = ['Cash', '7 Days', '15 Days', '30 Days'] as const;
    terms.forEach((paymentTerms, i) => {
      addCustomer({
        name: `C${i}`, mobile: `${i}`, address1: '', city: 'Jaipur',
        state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
        creditLimit: 0, paymentTerms, openingBalance: 0,
      });
    });
    const stored = useStore.getState().customers.map(c => c.paymentTerms);
    expect(stored).toEqual(terms);
  });

  it('non-zero opening balance is stored as-is (legacy debt)', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'Old Debtor', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 12500,
    });
    expect(useStore.getState().customers[0].openingBalance).toBe(12500);
  });

  it('customerSeq counter increments and IDs are zero-padded to 3 digits', () => {
    const { addCustomer } = useStore.getState();
    for (let i = 1; i <= 10; i++) {
      addCustomer({
        name: `C${i}`, mobile: `${i}`, address1: '', city: 'Jaipur',
        state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
        creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
      });
    }
    const ids = useStore.getState().customers.map(c => c.id);
    expect(ids[0]).toBe('CUST-001');
    expect(ids[8]).toBe('CUST-009');
    expect(ids[9]).toBe('CUST-010');
    expect(useStore.getState().customerSeq).toBe(10);
  });

  it('adding a customer does not affect existing customers', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'First', mobile: '1', address1: 'Old Addr', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 1000, paymentTerms: 'Cash', openingBalance: 0,
    });
    const firstBefore = useStore.getState().customers[0];

    addCustomer({
      name: 'Second', mobile: '2', address1: '', city: 'Jodhpur',
      state: 'Rajasthan', pinCode: '', customerType: 'Wholesaler',
      creditLimit: 0, paymentTerms: '7 Days', openingBalance: 0,
    });
    const firstAfter = useStore.getState().customers[0];

    // First customer unchanged
    expect(firstAfter).toEqual(firstBefore);
    expect(useStore.getState().customers).toHaveLength(2);
  });

  it('customer state can be any Indian state', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'Delhi Customer', mobile: '1', address1: '', city: 'Delhi',
      state: 'Delhi', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    addCustomer({
      name: 'Gujarat Customer', mobile: '2', address1: '', city: 'Ahmedabad',
      state: 'Gujarat', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const [c1, c2] = useStore.getState().customers;
    expect(c1.state).toBe('Delhi');
    expect(c2.state).toBe('Gujarat');
  });
});

// ─── addCustomer — form-level optional field trimming ─────────────────────────

describe('addCustomer — optional field trimming (mirrors CustomerForm.tsx handleSubmit)', () => {
  /**
   * CustomerForm.tsx trims optional fields and passes undefined for empty strings.
   * These tests verify the store handles both undefined and blank strings correctly.
   */

  it('undefined optional fields do not appear as "undefined" strings', () => {
    const { addCustomer } = useStore.getState();
    addCustomer({
      name: 'No Optional', mobile: '9999999999', address1: '1 MG Rd',
      city: 'Jaipur', state: 'Rajasthan', pinCode: undefined,
      firmName: undefined, alternateMobile: undefined, gstin: undefined,
      fssai: undefined, notes: undefined, address2: undefined,
      customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const c = useStore.getState().customers[0];
    expect(c.firmName).toBeUndefined();
    expect(c.gstin).toBeUndefined();
    expect(c.fssai).toBeUndefined();
    expect(c.notes).toBeUndefined();
    expect(c.alternateMobile).toBeUndefined();
    expect(c.address2).toBeUndefined();
    expect(c.pinCode).toBeUndefined();
  });

  it('blank firmName trimmed to undefined still creates valid customer', () => {
    const { addCustomer } = useStore.getState();
    // Simulate what CustomerForm does: form.firmName?.trim() || undefined
    const firmName = '   '.trim() || undefined; // evaluates to undefined
    addCustomer({
      name: 'No Firm', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
      firmName,
    });
    const c = useStore.getState().customers[0];
    expect(c.id).toBe('CUST-001');
    expect(c.firmName).toBeUndefined();
  });
});

// ─── updateCustomer — detailed ────────────────────────────────────────────────

describe('updateCustomer — detailed field updates', () => {
  it('updates credit limit and payment terms independently', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    addCustomer({
      name: 'Test', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 5000, paymentTerms: 'Cash', openingBalance: 0,
    });
    const id = useStore.getState().customers[0].id;

    updateCustomer(id, { creditLimit: 50000 });
    expect(useStore.getState().customers[0].creditLimit).toBe(50000);
    expect(useStore.getState().customers[0].paymentTerms).toBe('Cash'); // unchanged

    updateCustomer(id, { paymentTerms: '30 Days' });
    expect(useStore.getState().customers[0].paymentTerms).toBe('30 Days');
    expect(useStore.getState().customers[0].creditLimit).toBe(50000); // still updated
  });

  it('updates address fields', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    addCustomer({
      name: 'Test', mobile: '1', address1: 'Old Addr', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const id = useStore.getState().customers[0].id;

    updateCustomer(id, { address1: 'New Addr', city: 'Jodhpur', pinCode: '342001' });
    const c = useStore.getState().customers[0];
    expect(c.address1).toBe('New Addr');
    expect(c.city).toBe('Jodhpur');
    expect(c.pinCode).toBe('342001');
    expect(c.name).toBe('Test'); // unchanged
  });

  it('updates GSTIN for a customer who got registered', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    addCustomer({
      name: 'Unregistered', mobile: '1', address1: '', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '', customerType: 'Retailer',
      creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0,
    });
    const id = useStore.getState().customers[0].id;
    expect(useStore.getState().customers[0].gstin).toBeUndefined();

    updateCustomer(id, { gstin: '08ZZZZZ9999Z1Z5' });
    expect(useStore.getState().customers[0].gstin).toBe('08ZZZZZ9999Z1Z5');
  });

  it('updating one customer does not mutate another', () => {
    const { addCustomer, updateCustomer } = useStore.getState();
    const id1 = addCustomer({ name: 'Alpha', mobile: '1', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });
    const id2 = addCustomer({ name: 'Beta',  mobile: '2', address1: '', city: 'Jaipur', state: 'Rajasthan', pinCode: '', customerType: 'Retailer', creditLimit: 0, paymentTerms: 'Cash', openingBalance: 0 });

    updateCustomer(id1, { name: 'Alpha Updated', creditLimit: 99999 });

    const c2 = useStore.getState().customers.find(c => c.id === id2)!;
    expect(c2.name).toBe('Beta');
    expect(c2.creditLimit).toBe(0);
  });
});
