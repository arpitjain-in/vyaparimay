/**
 * Store — Order & Cart tests
 * Tests: startNewOrder, setOrderCustomer, upsertCartItem, removeCartItem,
 *        setOrderPaymentMode, setOrderGst, setOrderDiscount, clearOrder
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../../store/useStore';

vi.mock('../../lib/db', () => ({
  FIXED_ORG_ID: 'test-org-id',
  saveCustomer: vi.fn().mockResolvedValue(undefined),
  updateCustomerInDb: vi.fn().mockResolvedValue(undefined),
  saveInvoice: vi.fn().mockResolvedValue(undefined),
  savePackagingEntry: vi.fn().mockResolvedValue(undefined),
  saveReadyStockTransaction: vi.fn().mockResolvedValue(undefined),
  savePrice: vi.fn().mockResolvedValue(undefined),
  saveReorderLevel: vi.fn().mockResolvedValue(undefined),
  saveStockTransaction: vi.fn().mockResolvedValue(undefined),
  saveProductionLog: vi.fn().mockResolvedValue(undefined),
  saveBusinessProfile: vi.fn().mockResolvedValue(undefined),
  savePaymentReceipt: vi.fn().mockResolvedValue(undefined),
  cancelInvoiceInDb: vi.fn().mockResolvedValue(undefined),
  clearAllPackagingData: vi.fn().mockResolvedValue(undefined),
  updateReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
  deleteReadyStockTransactionInDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/db.demo', () => ({
  FIXED_ORG_ID: 'test-org-id',
}));

function resetStore() {
  useStore.setState({
    orgId: 'test-org-id',
    isInitialized: true,
    customers: [
      {
        id: 'CUST-001', name: 'Ramesh Kumar', firmName: 'Ramesh Store',
        mobile: '9876543210', address1: '5 Gandhi Mkt', city: 'Jaipur',
        state: 'Rajasthan', pinCode: '302001', customerType: 'Retailer',
        creditLimit: 50000, paymentTerms: '30 Days', openingBalance: 0,
        createdOn: '01/01/2026', active: true,
      },
    ],
    currentOrder: null,
    invoices: [],
    invoiceCounters: {},
    readyStock: { 'WF-26K': 25, 'WF-5P': 60 },
    packagingStock: { 'PKG-WF-26K': 100, 'PKG-WF-5P': 100 },
    readyStockTransactions: [],
    packagingEntries: [],
    businessProfile: {
      name: 'Test Mill', address1: '1 Test St', city: 'Jaipur',
      state: 'Rajasthan', pinCode: '302001', gstin: '08AAAAA0000A1Z5',
      fssai: '', mobile: '9999999999', gstEnabled: true,
    },
  });
}

beforeEach(resetStore);

// ─── startNewOrder / setOrderCustomer ─────────────────────────────────────────

describe('startNewOrder + setOrderCustomer', () => {
  it('clears any existing order and navigates to new-order', () => {
    useStore.getState().startNewOrder();
    expect(useStore.getState().currentOrder).toBeNull();
    expect(useStore.getState().currentPage).toBe('new-order');
  });

  it('sets customer on the order', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    expect(useStore.getState().currentOrder?.customerId).toBe('CUST-001');
  });

  it('initialises empty cart and default Credit payment mode', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    const order = useStore.getState().currentOrder!;
    expect(order.items).toHaveLength(0);
    expect(order.paymentMode).toBe('Credit');
  });
});

// ─── upsertCartItem ───────────────────────────────────────────────────────────

describe('upsertCartItem', () => {
  beforeEach(() => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
  });

  it('adds a new SKU to the cart', () => {
    useStore.getState().upsertCartItem('WF-26K', 3, 780);
    const items = useStore.getState().currentOrder!.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ skuId: 'WF-26K', quantity: 3, rate: 780 });
  });

  it('updates quantity when SKU already exists in cart (no duplicates)', () => {
    useStore.getState().upsertCartItem('WF-26K', 3, 780);
    useStore.getState().upsertCartItem('WF-26K', 5, 760); // update to 5 @ new rate
    const items = useStore.getState().currentOrder!.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ skuId: 'WF-26K', quantity: 5, rate: 760 });
  });

  it('adds multiple different SKUs', () => {
    useStore.getState().upsertCartItem('WF-26K', 3, 780);
    useStore.getState().upsertCartItem('WF-5P', 5, 165);
    const items = useStore.getState().currentOrder!.items;
    expect(items).toHaveLength(2);
  });
});

// ─── removeCartItem ───────────────────────────────────────────────────────────

describe('removeCartItem', () => {
  beforeEach(() => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    useStore.getState().upsertCartItem('WF-26K', 3, 780);
    useStore.getState().upsertCartItem('WF-5P', 5, 165);
  });

  it('removes the specified SKU from cart', () => {
    useStore.getState().removeCartItem('WF-26K');
    const items = useStore.getState().currentOrder!.items;
    expect(items).toHaveLength(1);
    expect(items[0].skuId).toBe('WF-5P');
  });

  it('does nothing for a SKU not in cart', () => {
    useStore.getState().removeCartItem('WF-25K'); // not in cart
    expect(useStore.getState().currentOrder!.items).toHaveLength(2);
  });

  it('cart can be emptied', () => {
    useStore.getState().removeCartItem('WF-26K');
    useStore.getState().removeCartItem('WF-5P');
    expect(useStore.getState().currentOrder!.items).toHaveLength(0);
  });
});

// ─── setOrderPaymentMode ──────────────────────────────────────────────────────

describe('setOrderPaymentMode', () => {
  it('switches payment mode to Credit', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    useStore.getState().setOrderPaymentMode('Credit');
    expect(useStore.getState().currentOrder?.paymentMode).toBe('Credit');
  });

  it('switches back to Cash', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    useStore.getState().setOrderPaymentMode('Credit');
    useStore.getState().setOrderPaymentMode('Cash');
    expect(useStore.getState().currentOrder?.paymentMode).toBe('Cash');
  });

  it('is a no-op when no order is active', () => {
    useStore.getState().setOrderPaymentMode('Credit');
    expect(useStore.getState().currentOrder).toBeNull();
  });
});

// ─── setOrderGst ──────────────────────────────────────────────────────────────

describe('setOrderGst', () => {
  it('overrides GST flag on current order', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    useStore.getState().setOrderGst(false);
    expect(useStore.getState().currentOrder?.gstEnabled).toBe(false);
  });
});

// ─── setOrderDiscount ─────────────────────────────────────────────────────────

describe('setOrderDiscount', () => {
  beforeEach(() => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
  });

  it('sets flat discount', () => {
    useStore.getState().setOrderDiscount('flat', 100);
    const order = useStore.getState().currentOrder!;
    expect(order.discountType).toBe('flat');
    expect(order.discountValue).toBe(100);
  });

  it('sets percent discount', () => {
    useStore.getState().setOrderDiscount('percent', 5);
    const order = useStore.getState().currentOrder!;
    expect(order.discountType).toBe('percent');
    expect(order.discountValue).toBe(5);
  });

  it('clears discount when value is 0', () => {
    useStore.getState().setOrderDiscount('flat', 0);
    const order = useStore.getState().currentOrder!;
    expect(order.discountValue).toBeUndefined();
  });

  it('clears discount when type is null', () => {
    useStore.getState().setOrderDiscount(null, 0);
    const order = useStore.getState().currentOrder!;
    expect(order.discountType).toBeUndefined();
  });
});

// ─── clearOrder ───────────────────────────────────────────────────────────────

describe('clearOrder', () => {
  it('nulls the current order', () => {
    useStore.getState().startNewOrder();
    useStore.getState().setOrderCustomer('CUST-001');
    useStore.getState().clearOrder();
    expect(useStore.getState().currentOrder).toBeNull();
  });
});
