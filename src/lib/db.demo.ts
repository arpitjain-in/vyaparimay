// ─── Demo Mode – localStorage-backed Data Access Layer ───────────────────────
// All data is stored in localStorage under the key prefix `demo_vyaparimay_`.
// Nothing is sent to Supabase. Data resets when the user clicks "Reset Demo".
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BusinessProfile,
  Customer,
  Invoice,
  OrderItem,
  PaymentReceipt,
  PackagingEntry,
  ProductionLog,
  StockTransaction,
  ReadyStockTransaction,
  Expense,
} from '../types';
import { DEFAULT_PRICES, PACKAGING_MATERIALS, PRODUCTS } from '../data/products';

export const FIXED_ORG_ID = '00000000-0000-0000-0000-000000000001';

const P = 'demo_vyaparimay_'; // localStorage key prefix

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(P + key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, val: T): void {
  localStorage.setItem(P + key, JSON.stringify(val));
}

// ─── Seed data (loaded once, on first demo run) ───────────────────────────────

const SEED_BUSINESS: BusinessProfile = {
  name: 'Shikharji Foods (Demo)',
  address1: '123, Test Market, Near Bus Stand',
  city: 'Jaipur',
  state: 'Rajasthan',
  pinCode: '302001',
  gstin: '08AAAAA0000A1Z5',
  fssai: '12345678901234',
  mobile: '9999999999',
  email: 'demo@shikharji.com',
  tagline: 'DEMO MODE – changes are not saved to production',
  bankName: 'State Bank of India',
  accountNo: '00000000000001',
  ifscCode: 'SBIN0000001',
  upiId: 'demo@sbi',
  gstEnabled: true,
};

const TODAY = new Date();
const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-001',
    name: 'Ramesh Kumar',
    firmName: 'Ramesh Kirana Store',
    mobile: '9876543210',
    address1: 'Shop 5, Gandhi Market',
    city: 'Jaipur',
    state: 'Rajasthan',
    pinCode: '302001',
    customerType: 'Retailer',
    creditLimit: 50000,
    paymentTerms: '30 Days',
    openingBalance: 0,
    createdOn: '01/01/2026',
    active: true,
  },
  {
    id: 'CUST-002',
    name: 'Suresh Agarwal',
    firmName: 'Agarwal Wholesale Co.',
    mobile: '9988776655',
    address1: 'Plot 12, RIICO Industrial Area',
    city: 'Jodhpur',
    state: 'Rajasthan',
    customerType: 'Wholesaler',
    creditLimit: 200000,
    paymentTerms: '15 Days',
    openingBalance: 5000,
    createdOn: '15/02/2026',
    active: true,
  },
  {
    id: 'CUST-003',
    name: 'Priya Sharma',
    mobile: '9001122334',
    address1: 'Flat 7B, Green Colony',
    city: 'Ajmer',
    state: 'Rajasthan',
    customerType: 'Direct Consumer',
    creditLimit: 5000,
    paymentTerms: 'Cash',
    openingBalance: 0,
    createdOn: fmt(TODAY),
    active: true,
  },
];

const SEED_RAW_STOCK: Record<string, number> = {
  'RM-WF': 2000,
  'RM-BS': 800,
  'RM-DL': 400,
  'RM-BR': 500,
};

const SEED_PACKAGING_STOCK: Record<string, number> = Object.fromEntries(
  PACKAGING_MATERIALS.map((m) => [m.id, 100]),
);

const SEED_READY_STOCK: Record<string, number> = {
  'WF-26K': 25,
  'WF-25K': 10,
  'WF-5P': 60,
  'WF-10P': 30,
  'WF-5H': 20,
  'WF-10H': 15,
  'BS-40K': 8,
  'BS-500G': 200,
  'DL-500G': 150,
  'BR-40K': 12,
};

function seedIfNeeded(): void {
  if (lsGet<boolean>('seeded', false)) return;

  lsSet('business_profile', SEED_BUSINESS);
  lsSet('customers', SEED_CUSTOMERS);
  lsSet('customer_seq', SEED_CUSTOMERS.length);
  lsSet('invoices', []);
  lsSet('payment_receipts', []);
  lsSet('receipt_seq', 0);
  lsSet('packaging_entries', []);
  lsSet('packaging_stock', SEED_PACKAGING_STOCK);
  lsSet('production_logs', []);
  lsSet('raw_material_stock', SEED_RAW_STOCK);
  lsSet('ready_stock', SEED_READY_STOCK);
  lsSet('stock_transactions', []);
  lsSet('ready_stock_transactions', []);
  lsSet('price_list', DEFAULT_PRICES);
  lsSet('reorder_levels', { raw: {}, packaging: {}, ready: {} });
  lsSet('seeded', true);
}

/** Wipes all demo localStorage keys and re-seeds. Call from the UI "Reset" button. */
export function resetDemoData(): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(P));
  keys.forEach((k) => localStorage.removeItem(k));
  seedIfNeeded();
}

// ─── Auth (no-op — always returns a fixed demo user) ─────────────────────────

export async function initializeCatalog(_orgId: string): Promise<void> {
  // Demo mode uses localStorage and TypeScript arrays — no DB catalog to sync.
}

export async function initAuth(): Promise<string> {
  seedIfNeeded();
  return 'demo-user-id';
}

export async function signOut(): Promise<void> {
  // In demo mode sign-out just reloads the page; data stays in localStorage.
  window.location.reload();
}

export async function getOrCreateOrg(_userId: string): Promise<string> {
  return FIXED_ORG_ID;
}

// ─── Business Profile ─────────────────────────────────────────────────────────

export async function loadBusinessProfile(
  _orgId: string,
): Promise<BusinessProfile | null> {
  return lsGet<BusinessProfile | null>('business_profile', null);
}

export async function saveBusinessProfile(
  _orgId: string,
  profile: BusinessProfile,
): Promise<void> {
  lsSet('business_profile', profile);
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function loadCustomers(
  _orgId: string,
): Promise<{ customers: Customer[]; seq: number }> {
  const customers = lsGet<Customer[]>('customers', []);
  const seq = lsGet<number>('customer_seq', 0);
  return { customers, seq };
}

export async function saveCustomer(
  _orgId: string,
  customer: Customer,
  seq: number,
): Promise<void> {
  const customers = lsGet<Customer[]>('customers', []);
  const idx = customers.findIndex((c) => c.id === customer.id);
  if (idx >= 0) customers[idx] = customer;
  else customers.push(customer);
  lsSet('customers', customers);
  lsSet('customer_seq', seq);
}

export async function updateCustomerInDb(
  _orgId: string,
  customerId: string,
  data: Partial<Customer>,
): Promise<void> {
  const customers = lsGet<Customer[]>('customers', []);
  const idx = customers.findIndex((c) => c.id === customerId);
  if (idx >= 0) customers[idx] = { ...customers[idx], ...data };
  lsSet('customers', customers);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function loadInvoices(_orgId: string): Promise<Invoice[]> {
  return lsGet<Invoice[]>('invoices', []);
}

export async function saveInvoice(
  _orgId: string,
  invoice: Invoice,
  items: OrderItem[],
  readyStockTxns: ReadyStockTransaction[],
  newReadyStock: Record<string, number>,
): Promise<void> {
  // Store invoice with items embedded
  const invoices = lsGet<Invoice[]>('invoices', []);
  invoices.push({ ...invoice, items });
  lsSet('invoices', invoices);

  // Persist ready-stock side effects
  if (readyStockTxns.length > 0) {
    const txns = lsGet<ReadyStockTransaction[]>('ready_stock_transactions', []);
    txns.push(...readyStockTxns);
    lsSet('ready_stock_transactions', txns);
  }
  const currentReadyStock = lsGet<Record<string, number>>('ready_stock', {});
  lsSet('ready_stock', { ...currentReadyStock, ...newReadyStock });
}

export async function cancelInvoiceInDb(
  _orgId: string,
  invoiceId: string,
): Promise<void> {
  const invoices = lsGet<Invoice[]>('invoices', []);
  const idx = invoices.findIndex((inv) => inv.id === invoiceId);
  if (idx >= 0) invoices[idx] = { ...invoices[idx], cancelled: true };
  lsSet('invoices', invoices);
}

// ─── Payment Receipts ─────────────────────────────────────────────────────────

export async function loadPaymentReceipts(
  _orgId: string,
): Promise<{ receipts: PaymentReceipt[]; seq: number }> {
  const receipts = lsGet<PaymentReceipt[]>('payment_receipts', []);
  const seq = lsGet<number>('receipt_seq', 0);
  return { receipts, seq };
}

export async function savePaymentReceipt(
  _orgId: string,
  receipt: PaymentReceipt,
): Promise<void> {
  const receipts = lsGet<PaymentReceipt[]>('payment_receipts', []);
  receipts.push(receipt);
  lsSet('payment_receipts', receipts);

  const seq = parseInt(receipt.id.replace('REC-', ''), 10) || 0;
  const prev = lsGet<number>('receipt_seq', 0);
  lsSet('receipt_seq', Math.max(prev, seq));
}

// ─── Packaging Entries ────────────────────────────────────────────────────────

export async function loadPackagingEntries(
  _orgId: string,
): Promise<PackagingEntry[]> {
  return lsGet<PackagingEntry[]>('packaging_entries', []);
}

export async function savePackagingEntry(
  _orgId: string,
  entry: PackagingEntry,
  newStock: number,
): Promise<void> {
  const entries = lsGet<PackagingEntry[]>('packaging_entries', []);
  entries.push(entry);
  lsSet('packaging_entries', entries);

  const stock = lsGet<Record<string, number>>('packaging_stock', {});
  stock[entry.materialId] = newStock;
  lsSet('packaging_stock', stock);
}

export async function clearAllPackagingData(_orgId: string): Promise<void> {
  lsSet('packaging_entries', []);
  lsSet('packaging_stock', {});
}

// ─── Production Logs ──────────────────────────────────────────────────────────

export async function loadProductionLogs(_orgId: string): Promise<ProductionLog[]> {
  return lsGet<ProductionLog[]>('production_logs', []);
}

export async function saveProductionLog(
  _orgId: string,
  log: ProductionLog,
): Promise<void> {
  const logs = lsGet<ProductionLog[]>('production_logs', []);
  logs.push(log);
  lsSet('production_logs', logs);
}

// ─── Stock Data ───────────────────────────────────────────────────────────────

export async function loadStockData(_orgId: string): Promise<{
  rawMaterialStock: Record<string, number>;
  packagingStock: Record<string, number>;
  readyStock: Record<string, number>;
  stockTransactions: StockTransaction[];
  readyStockTransactions: ReadyStockTransaction[];
}> {
  return {
    rawMaterialStock: lsGet<Record<string, number>>('raw_material_stock', {}),
    packagingStock: lsGet<Record<string, number>>('packaging_stock', {}),
    readyStock: lsGet<Record<string, number>>('ready_stock', {}),
    stockTransactions: lsGet<StockTransaction[]>('stock_transactions', []),
    readyStockTransactions: lsGet<ReadyStockTransaction[]>('ready_stock_transactions', []),
  };
}

export async function saveStockTransaction(
  _orgId: string,
  txn: StockTransaction,
  newStockQty: number,
): Promise<void> {
  const txns = lsGet<StockTransaction[]>('stock_transactions', []);
  txns.push(txn);
  lsSet('stock_transactions', txns);

  const stockKey = txn.itemType === 'raw' ? 'raw_material_stock' : 'packaging_stock';
  const stock = lsGet<Record<string, number>>(stockKey, {});
  stock[txn.itemId] = newStockQty;
  lsSet(stockKey, stock);
}

export async function saveReadyStockTransaction(
  _orgId: string,
  txn: ReadyStockTransaction,
): Promise<void> {
  const txns = lsGet<ReadyStockTransaction[]>('ready_stock_transactions', []);
  txns.push(txn);
  lsSet('ready_stock_transactions', txns);

  const stock = lsGet<Record<string, number>>('ready_stock', {});
  stock[txn.skuId] = txn.newStock;
  lsSet('ready_stock', stock);
}

export async function updateReadyStockTransactionInDb(
  _orgId: string,
  txn: ReadyStockTransaction,
): Promise<void> {
  const txns = lsGet<ReadyStockTransaction[]>('ready_stock_transactions', []);
  const idx = txns.findIndex((t) => t.id === txn.id);
  if (idx >= 0) txns[idx] = { ...txns[idx], quantity: txn.quantity, newStock: txn.newStock, reason: txn.reason };
  lsSet('ready_stock_transactions', txns);

  const stock = lsGet<Record<string, number>>('ready_stock', {});
  stock[txn.skuId] = txn.newStock;
  lsSet('ready_stock', stock);
}

export async function deleteReadyStockTransactionInDb(
  _orgId: string,
  txnId: string,
  skuId: string,
  newCurrentStock: number,
): Promise<void> {
  const txns = lsGet<ReadyStockTransaction[]>('ready_stock_transactions', []);
  lsSet('ready_stock_transactions', txns.filter((t) => t.id !== txnId));

  const stock = lsGet<Record<string, number>>('ready_stock', {});
  stock[skuId] = newCurrentStock;
  lsSet('ready_stock', stock);
}

// ─── Price List ───────────────────────────────────────────────────────────────

export async function loadPriceList(_orgId: string): Promise<Record<string, number>> {
  return lsGet<Record<string, number>>('price_list', {});
}

export async function savePrice(
  _orgId: string,
  skuId: string,
  rate: number,
): Promise<void> {
  const prices = lsGet<Record<string, number>>('price_list', {});
  prices[skuId] = rate;
  lsSet('price_list', prices);
}

// ─── Reorder Levels ───────────────────────────────────────────────────────────

export async function loadReorderLevels(_orgId: string): Promise<{
  raw: Record<string, number>;
  packaging: Record<string, number>;
  ready: Record<string, number>;
}> {
  return lsGet('reorder_levels', { raw: {}, packaging: {}, ready: {} });
}

export async function saveReorderLevel(
  _orgId: string,
  category: 'raw' | 'packaging' | 'ready',
  itemId: string,
  level: number,
): Promise<void> {
  const levels = lsGet<{
    raw: Record<string, number>;
    packaging: Record<string, number>;
    ready: Record<string, number>;
  }>('reorder_levels', { raw: {}, packaging: {}, ready: {} });
  levels[category][itemId] = level;
  lsSet('reorder_levels', levels);
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export async function loadExpenses(_orgId: string): Promise<Expense[]> {
  return lsGet('expenses', []);
}

export async function saveExpense(
  _orgId: string,
  amount: number,
  date: string,
  time: string,
  notes: string | undefined,
  createdBy: string,
): Promise<Expense> {
  const expenses = lsGet<Expense[]>('expenses', []);
  const id = 'exp_' + Date.now();
  const expense: Expense = {
    id,
    amount,
    date,
    time,
    notes,
    createdBy,
    createdAt: new Date().toISOString(),
  };
  expenses.push(expense);
  lsSet('expenses', expenses);
  return expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const expenses = lsGet<Expense[]>('expenses', []);
  const index = expenses.findIndex((e) => e.id === id);
  if (index >= 0) {
    expenses.splice(index, 1);
    lsSet('expenses', expenses);
  }
}

// ─── Unused by demo but referenced generically ────────────────────────────────
// These satisfy the full type surface of db.ts so the store can swap freely.
export const _demoProducts = PRODUCTS; // exported to keep import used
