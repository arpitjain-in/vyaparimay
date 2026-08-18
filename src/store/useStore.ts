import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppPage, BusinessProfile, CartItem, CurrentOrder,
  Customer, Invoice, OrderItem, StockTransaction,
  PackagingEntry, ProductionLog, PaymentReceipt,
  ReadyStockTransaction, StockStatus, Expense,
  Employee, EmployeeLeave, EmployeeAdvance, SalaryRecord,
} from '../types';
import { PACKAGING_MATERIALS, PRODUCTS, DEFAULT_PRICES, applyTwinPackSplit } from '../data/products';
import { isInterState, calcGST } from '../utils/gst';
import { numberToWords } from '../utils/numberToWords';
import { formatDate, formatTime, getCurrentFY, getFYFromDate } from '../utils/format';
import * as realDb from '../lib/db';
import * as demoDb from '../lib/db.demo';

const db = import.meta.env.VITE_DEMO_MODE === 'true' ? demoDb : realDb;

const ORDER_DRAFT_STORAGE_KEY = 'millbook-order-draft';

// Supabase errors are plain objects {message, details, hint, code}, not Error instances.
function fmtErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = ([e.message, e.details, e.hint].filter(Boolean) as string[]);
    const unique = [...new Set(parts)];
    return unique.join(' — ') || JSON.stringify(err);
  }
  return String(err);
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface AppState {
  // Auth / tenant
  orgId: string | null;
  isInitialized: boolean;
  initError: string | null;

  // Navigation
  currentPage: AppPage;
  selectedCustomerId: string | null;
  selectedInvoiceId: string | null;
  editCustomerId: string | null;
  selectedEmployeeId: string | null;

  // Business
  businessProfile: BusinessProfile | null;

  // Customers
  customers: Customer[];
  customerSeq: number;

  // Order in progress (persisted to localStorage so it survives screen
  // switches, sidebar nav, and page refresh — see `persist` wrapper below)
  currentOrder: CurrentOrder | null;
  orderStep: number;

  // Proforma in progress — its own draft, entirely separate from
  // `currentOrder` so building a quote never touches a real order in
  // progress (and vice versa). Also persisted (see `persist` wrapper below).
  currentProforma: CurrentOrder | null;
  proformaStep: number;

  // Invoices
  invoices: Invoice[];
  invoiceCounters: Record<string, number>; // FY-MM -> seq
  testInvoiceCounters: Record<string, number>; // FY-MM -> seq, isolated series for the "Test Customer"

  // Proforma invoices — kept separate from `invoices` (own array/table/counter)
  // so they never mix into GST reports, the customer ledger, or stock figures.
  proformaInvoices: Invoice[];
  proformaCounters: Record<string, number>; // FY-MM -> seq

  // Payment Receipts
  paymentReceipts: PaymentReceipt[];
  receiptSeq: number;

  // Inventory
  rawMaterialStock: Record<string, number>;     // RM-WF -> kg (kept for legacy compatibility)
  packagingStock: Record<string, number>;        // PKG-* -> current unit balance
  packagingEntries: PackagingEntry[];           // full purchase/used/damaged ledger
  productionLogs: ProductionLog[];              // standalone daily production records
  stockTransactions: StockTransaction[];         // legacy bulk flour adjustments
  readyStock: Record<string, number>;           // skuId -> count of packed/ready units
  readyStockTransactions: ReadyStockTransaction[]; // history of ready stock changes
  lastSyncBatchTime: string | null; // time string of last ready-stock sync batch (for undo)
  reorderLevels: {
    raw: Record<string, number>;
    packaging: Record<string, number>;
    ready: Record<string, number>;
  };

  // Pricing
  priceList: Record<string, number>; // skuId -> rate
  // Factory pricing managed via UI
  factoryPrices: Record<string, number>;
  factoryPricingParams: Record<string, unknown>;

  // Expenses
  expenses: Expense[];

  // Salary
  employees: Employee[];
  employeeLeaves: EmployeeLeave[];
  employeeAdvances: EmployeeAdvance[];
  salaryRecords: SalaryRecord[];

  // ─── Actions ───────────────────────────────────────────────────────

  // Init
  initializeApp(): Promise<void>;
  // Navigation
  navigate(page: AppPage, params?: { customerId?: string; invoiceId?: string; editCustomerId?: string; employeeId?: string }): void;

  // Business
  setBusinessProfile(profile: BusinessProfile): void;

  // Customers
  addCustomer(data: Omit<Customer, 'id' | 'createdOn' | 'active'>): string;
  updateCustomer(id: string, data: Partial<Customer>): void;
  deactivateCustomer(id: string): void;

  // Order
  startNewOrder(): void;
  setOrderStep(step: number): void;
  setOrderCustomer(customerId: string): void;
  setOrderPaymentMode(mode: 'Cash' | 'Credit'): void;
  setOrderGst(enabled: boolean): void;
  setOrderDiscount(type: 'percent' | 'flat' | null, value: number): void;
  setOrderCharges(transport: number, loading: number): void;
  upsertCartItem(skuId: string, quantity: number, rate: number): void;
  removeCartItem(skuId: string): void;
  clearOrder(): void;

  // Proforma — mirrors the Order actions above but operates on
  // `currentProforma`, a fully independent draft.
  startNewProforma(): void;
  setProformaStep(step: number): void;
  setProformaCustomer(customerId: string): void;
  setProformaGst(enabled: boolean): void;
  setProformaDiscount(type: 'percent' | 'flat' | null, value: number): void;
  setProformaCharges(transport: number, loading: number): void;
  upsertProformaCartItem(skuId: string, quantity: number, rate: number): void;
  removeProformaCartItem(skuId: string): void;
  clearProforma(): void;

  // Invoice
  generateInvoice(saleDate?: string): Invoice | null;
  cancelInvoice(id: string): void;
  updateInvoicePaymentMode(id: string, mode: 'Cash' | 'Credit'): void;

  // Proforma invoice — a non-binding preliminary quote. Its own numbering
  // series, no ready/packaging stock deduction, no GST-ledger effect.
  generateProformaInvoice(saleDate?: string): Invoice | null;

  // Payments
  addPaymentReceipt(data: Omit<PaymentReceipt, 'id' | 'time'>): void;
  updatePaymentReceipt(id: string, data: Pick<PaymentReceipt, 'date' | 'amount' | 'mode' | 'referenceNo' | 'notes'>): void;

  // Stock
  addPackagingEntry(entry: Omit<PackagingEntry, 'id' | 'time'>): void;
  addProductionLog(log: Omit<ProductionLog, 'id' | 'time'>): void;
  adjustStock(type: 'raw' | 'packaging', id: string, qty: number, reason: string): void;
  setReorderLevel(type: 'raw' | 'packaging', id: string, level: number): void;
  addReadyStockEntry(skuId: string, qty: number, reason: string | undefined, date: string): void;
  adjustReadyStock(skuId: string, qty: number, reason: string | undefined, date?: string): void;
  editReadyStockTransaction(txId: string, newQty: number, newReason: string | undefined): void;
  deleteReadyStockTransaction(txId: string): void;
  setReadyStockReorderLevel(skuId: string, level: number): void;
  getReadyStockStatus(skuId: string): StockStatus;
  syncPackagingFromReadyStock(): { materialId: string; materialName: string; qty: number }[];
  revertLastPackagingSync(): void;
  recalculatePackagingStock(): { materialId: string; materialName: string; before: number; after: number }[];
  clearAllPackagingData(): void;

  // Pricing
  updatePrice(skuId: string, rate: number): void;
  setFactoryPricingParams(params: Record<string, unknown>): void;
  setFactoryPrices(prices: Record<string, number>): void;
  updateFactoryPrice(skuId: string, price: number): void;
  exportFactoryPrices(): Record<string, number>;

  // Expenses
  addExpense(amount: number, date: string, time: string, notes: string, createdBy: string): void;
  deleteExpense(id: string): void;

  // Salary
  addEmployee(data: Omit<Employee, 'id' | 'createdAt'>): void;
  updateEmployee(id: string, data: Partial<Pick<Employee, 'name' | 'role' | 'monthlySalary' | 'isActive'>>): void;
  deleteEmployee(id: string): void;
  addEmployeeLeave(employeeId: string, date: string, isHalfDay: boolean, notes: string): void;
  deleteEmployeeLeave(id: string): void;
  addEmployeeAdvance(employeeId: string, amount: number, date: string, notes: string): void;
  deleteEmployeeAdvance(id: string): void;
  upsertSalaryRecord(record: Omit<SalaryRecord, 'id' | 'createdAt' | 'updatedAt'>): void;

  // Computed helpers (not persisted)
  getCustomerInvoices(customerId: string): Invoice[];
  getStockStatus(type: 'raw' | 'packaging', id: string): 'adequate' | 'low' | 'out';

  // Global dialog
  dialog: { title: string; message: string | string[]; variant?: 'error' | 'warning' | 'info' | 'success'; onRetry?: () => void } | null;
  showDialog(config: { title: string; message: string | string[]; variant?: 'error' | 'warning' | 'info' | 'success' }): void;
  closeDialog(): void;
}

// ─── Initial stock maps ───────────────────────────────────────────────────────

const initRaw: Record<string, number> = { 'RM-WF': 0, 'RM-BS': 0, 'RM-DL': 0, 'RM-BR': 0 };
const initPkg: Record<string, number> = Object.fromEntries(
  PACKAGING_MATERIALS.map(p => [p.id, 0])
);
const initReady: Record<string, number> = Object.fromEntries(
  PRODUCTS.map(p => [p.id, 0])
);
const initReorder = {
      raw:       { 'RM-WF': 0, 'RM-BS': 0, 'RM-DL': 0, 'RM-BR': 0 },
  packaging: Object.fromEntries(PACKAGING_MATERIALS.map(p => [p.id, 0])),
  ready:     Object.fromEntries(PRODUCTS.map(p => [p.id, 0])),
};

// ─── Store ───────────────────────────────────────────────────────────────────
export const useStore = create<AppState>()(
  persist(
  (set, get) => ({
      // Auth / tenant
      orgId: null,
      isInitialized: false,
      initError: null,

      // Navigation
      currentPage: 'setup',
      selectedCustomerId: null,
      selectedInvoiceId: null,
      editCustomerId: null,
      selectedEmployeeId: null,

      // Business
      businessProfile: null,

      // Customers
      customers: [],
      customerSeq: 0,

      // Order
      currentOrder: null,
      orderStep: 1,

      // Proforma
      currentProforma: null,
      proformaStep: 1,

      // Invoices
      invoices: [],
      invoiceCounters: {},
      testInvoiceCounters: {},

      proformaInvoices: [],
      proformaCounters: {},

      // Payment Receipts
      paymentReceipts: [],
      receiptSeq: 0,

      // Inventory
      rawMaterialStock: initRaw,
      packagingStock: initPkg,
      packagingEntries: [],
      productionLogs: [],
      stockTransactions: [],
      readyStock: initReady,
      readyStockTransactions: [],
      lastSyncBatchTime: null,
      reorderLevels: initReorder,

      // Pricing
      // Load persisted factory prices from localStorage (client-side only)
      factoryPrices: (() => {
        try {
          const raw = localStorage.getItem('factory_prices');
          return raw ? JSON.parse(raw) as Record<string, number> : {};
        } catch (e) { return {}; }
      })(),
      factoryPricingParams: (() => {
        try {
          const raw = localStorage.getItem('factory_pricing_params');
          const parsed = raw ? JSON.parse(raw) : {};
          return { wheatWastage: 1, ...parsed };
        } catch (e) { return { wheatWastage: 1 }; }
      })(),
      priceList: (() => {
        try {
          const raw = localStorage.getItem('factory_prices');
          const factory = raw ? JSON.parse(raw) as Record<string, number> : {};
          return { ...DEFAULT_PRICES, ...factory };
        } catch (e) { return { ...DEFAULT_PRICES }; }
      })(),

      // Expenses
      expenses: [],

      // Salary
      employees: [],
      employeeLeaves: [],
      employeeAdvances: [],
      salaryRecords: [],

      // Dialog
      dialog: null,

      // ─── Factory pricing helpers ───────────────────────────────────
      setFactoryPricingParams(params) {
        set(s => ({ factoryPricingParams: { ...s.factoryPricingParams, ...params } }));
        try { localStorage.setItem('factory_pricing_params', JSON.stringify({ ...get().factoryPricingParams, ...params })); } catch(e){}
      },

      setFactoryPrices(prices) {
        set(s => ({ factoryPrices: { ...s.factoryPrices, ...prices }, priceList: { ...s.priceList, ...prices } }));
        try { localStorage.setItem('factory_prices', JSON.stringify({ ...get().factoryPrices, ...prices })); } catch(e){}
      },

      updateFactoryPrice(skuId, price) {
        set(s => ({ factoryPrices: { ...s.factoryPrices, [skuId]: price }, priceList: { ...s.priceList, [skuId]: price } }));
        try { localStorage.setItem('factory_prices', JSON.stringify({ ...get().factoryPrices, [skuId]: price })); } catch(e){}
      },

      exportFactoryPrices() {
        return get().factoryPrices;
      },

      // ─── Init ────────────────────────────────────────────────────────

      async initializeApp() {
        try {
          const userId = await db.initAuth();
          const orgId = await db.getOrCreateOrg(userId);

          // Remove stale localStorage keys written by the old cache layer.
          localStorage.removeItem(`bp_cache_${orgId}`);
          localStorage.removeItem(`catalog_seeded_${orgId}`);

          // Seed catalog entries (SKUs, packaging materials) on every startup.
          // initializeCatalog uses ON CONFLICT DO NOTHING so it is always safe to run.
          try {
            await db.initializeCatalog(orgId);
          } catch (catErr) {
            console.warn('[initializeCatalog] Failed to seed catalog, will retry on next startup:', catErr);
          }

          const [
            businessProfile,
            { customers, seq: customerSeq },
            invoices,
            proformaInvoices,
            { receipts: paymentReceipts, seq: receiptSeq },
            packagingEntries,
            productionLogs,
            stockData,
            dbPriceList,
            dbReorderLevels,
            expenses,
            employees,
            employeeLeaves,
            employeeAdvances,
            salaryRecords,
          ] = await Promise.all([
            db.loadBusinessProfile(orgId),
            db.loadCustomers(orgId),
            db.loadInvoices(orgId),
            db.loadProformaInvoices(orgId),
            db.loadPaymentReceipts(orgId),
            db.loadPackagingEntries(orgId),
            db.loadProductionLogs(orgId),
            db.loadStockData(orgId),
            db.loadPriceList(orgId),
            db.loadReorderLevels(orgId),
            db.loadExpenses(orgId),
            db.loadEmployees(orgId),
            db.loadEmployeeLeaves(orgId),
            db.loadEmployeeAdvances(orgId),
            db.loadSalaryRecords(orgId),
          ]);

          // Derive invoice counters from loaded invoices
          const invoiceCounters: Record<string, number> = {};
          const testInvoiceCounters: Record<string, number> = {};
          for (const inv of invoices) {
            const match = inv.invoiceNo.match(/^(INV|TEST)\/(\d{4})\/(\d{2})\/(\d+)/);
            if (match) {
              const key = `${match[2]}-${match[3]}`;
              const seq = parseInt(match[4], 10);
              const counters = match[1] === 'TEST' ? testInvoiceCounters : invoiceCounters;
              counters[key] = Math.max(counters[key] ?? 0, seq);
            }
          }

          // Derive proforma counters from loaded proforma invoices
          const proformaCounters: Record<string, number> = {};
          for (const inv of proformaInvoices) {
            const match = inv.invoiceNo.match(/^PRO\/(\d{4})\/(\d{2})\/(\d+)/);
            if (match) {
              const key = `${match[1]}-${match[2]}`;
              const seq = parseInt(match[3], 10);
              proformaCounters[key] = Math.max(proformaCounters[key] ?? 0, seq);
            }
          }

          const s = get();

          set({
            orgId,
            isInitialized: true,
            initError: null,
            businessProfile,
            customers,
            customerSeq,
            invoices,
            invoiceCounters,
            testInvoiceCounters,
            proformaInvoices,
            proformaCounters,
            paymentReceipts,
            receiptSeq,
            packagingEntries,
            productionLogs,
            ...stockData,
            // Keep local (factory) prices as the final authority — do not let DB overwrite them.
            priceList: {
              ...DEFAULT_PRICES,
              ...dbPriceList,
              ...s.priceList,
            },
            reorderLevels: {
              raw: { ...s.reorderLevels.raw, ...dbReorderLevels.raw },
              packaging: {
                ...s.reorderLevels.packaging,
                ...dbReorderLevels.packaging,
              },
              ready: { ...s.reorderLevels.ready, ...dbReorderLevels.ready },
            },
            expenses,
            employees,
            employeeLeaves,
            employeeAdvances,
            salaryRecords,
            currentPage: businessProfile ? 'dashboard' : 'setup',
          });
        } catch (err) {
          const msg = fmtErr(err);
          console.error('[initializeApp] Failed to connect to database:', msg);
          set({ isInitialized: true, initError: msg, orgId: db.FIXED_ORG_ID });
        }
      },

      // ─── Navigation ──────────────────────────────────────────────────

      navigate(page, params = {}) {
        set({
          currentPage: page,
          selectedCustomerId: params.customerId ?? get().selectedCustomerId,
          selectedInvoiceId: params.invoiceId ?? get().selectedInvoiceId,
          editCustomerId: params.editCustomerId ?? null,
          selectedEmployeeId: params.employeeId ?? get().selectedEmployeeId,
        });
      },

      // ─── Business ────────────────────────────────────────────────────

      setBusinessProfile(profile) {
        set({ businessProfile: profile, currentPage: 'dashboard' });
        const { orgId } = get();
        if (orgId) {
          db.saveBusinessProfile(orgId, profile).catch(console.error);
        }
      },

      // ─── Customers ───────────────────────────────────────────────────

      addCustomer(data) {
        const seq = get().customerSeq + 1;
        const id = `CUST-${String(seq).padStart(3, '0')}`;
        const customer: Customer = {
          ...data,
          id,
          createdOn: formatDate(new Date()),
          active: true,
        };
        set(s => ({ customers: [...s.customers, customer], customerSeq: seq }));
        const { orgId } = get();
        if (orgId) db.saveCustomer(orgId, customer, seq).catch(console.error);
        return id;
      },

      updateCustomer(id, data) {
        set(s => ({
          customers: s.customers.map(c => (c.id === id ? { ...c, ...data } : c)),
        }));
        const { orgId } = get();
        if (orgId) db.updateCustomerInDb(orgId, id, data).catch(console.error);
      },

      deactivateCustomer(id) {
        set(s => ({
          customers: s.customers.map(c => (c.id === id ? { ...c, active: false } : c)),
        }));
        const { orgId } = get();
        if (orgId)
          db.updateCustomerInDb(orgId, id, { active: false }).catch(console.error);
      },

      // ─── Order ───────────────────────────────────────────────────────

      startNewOrder() {
        // If an order is already in progress (e.g. the user navigated away
        // mid-order), resume it instead of wiping it — only start blank
        // when there's nothing to resume.
        if (get().currentOrder) {
          set({ currentPage: 'new-order' });
        } else {
          set({ currentOrder: null, orderStep: 1, currentPage: 'new-order' });
        }
      },

      setOrderStep(step) {
        set({ orderStep: step });
      },

      setOrderCustomer(customerId) {
        set(s => {
          // Re-selecting the same customer is a no-op — keep the cart as-is.
          if (s.currentOrder?.customerId === customerId) return {};
          // Switching to a different customer starts a clean order: cart,
          // GST override, discount and charges from the previous customer
          // don't carry over.
          return {
            currentOrder: {
              customerId,
              items: [],
              paymentMode: 'Credit',
            },
          };
        });
      },

      setOrderPaymentMode(mode) {
        set(s => ({
          currentOrder: s.currentOrder ? { ...s.currentOrder, paymentMode: mode } : null,
        }));
      },

      setOrderGst(enabled) {
        set(s => ({
          currentOrder: s.currentOrder ? { ...s.currentOrder, gstEnabled: enabled } : null,
        }));
      },

      setOrderDiscount(type, value) {
        set(s => ({
          currentOrder: s.currentOrder
            ? { ...s.currentOrder, discountType: type ?? undefined, discountValue: value > 0 ? value : undefined }
            : null,
        }));
      },

      setOrderCharges(transport, loading) {
        set(s => ({
          currentOrder: s.currentOrder
            ? {
                ...s.currentOrder,
                transportCharges: transport > 0 ? transport : undefined,
                loadingCharges: loading > 0 ? loading : undefined,
              }
            : null,
        }));
      },

      upsertCartItem(skuId, quantity, rate) {
        set(s => {
          if (!s.currentOrder) return {};
          const existing = s.currentOrder.items.findIndex(i => i.skuId === skuId);
          let items: CartItem[];
          if (existing >= 0) {
            items = s.currentOrder.items.map(i =>
              i.skuId === skuId ? { ...i, quantity, rate } : i,
            );
          } else {
            items = [...s.currentOrder.items, { skuId, quantity, rate }];
          }
          return { currentOrder: { ...s.currentOrder, items } };
        });
      },

      removeCartItem(skuId) {
        set(s => ({
          currentOrder: s.currentOrder
            ? { ...s.currentOrder, items: s.currentOrder.items.filter(i => i.skuId !== skuId) }
            : null,
        }));
      },

      clearOrder() {
        set({ currentOrder: null, orderStep: 1 });
      },

      // ─── Proforma ────────────────────────────────────────────────────
      // Fully independent draft from `currentOrder` above — building a quote
      // never touches a real order in progress, and vice versa.

      startNewProforma() {
        // If a proforma is already in progress (e.g. the user navigated away
        // mid-draft), resume it instead of wiping it — only start blank
        // when there's nothing to resume.
        if (get().currentProforma) {
          set({ currentPage: 'new-proforma' });
        } else {
          set({ currentProforma: null, proformaStep: 1, currentPage: 'new-proforma' });
        }
      },

      setProformaStep(step) {
        set({ proformaStep: step });
      },

      setProformaCustomer(customerId) {
        set(s => {
          // Re-selecting the same customer is a no-op — keep the cart as-is.
          if (s.currentProforma?.customerId === customerId) return {};
          // Switching to a different customer starts a clean draft: cart,
          // GST override, discount and charges from the previous customer
          // don't carry over.
          return {
            currentProforma: {
              customerId,
              items: [],
              paymentMode: 'Credit',
            },
          };
        });
      },

      setProformaGst(enabled) {
        set(s => ({
          currentProforma: s.currentProforma ? { ...s.currentProforma, gstEnabled: enabled } : null,
        }));
      },

      setProformaDiscount(type, value) {
        set(s => ({
          currentProforma: s.currentProforma
            ? { ...s.currentProforma, discountType: type ?? undefined, discountValue: value > 0 ? value : undefined }
            : null,
        }));
      },

      setProformaCharges(transport, loading) {
        set(s => ({
          currentProforma: s.currentProforma
            ? {
                ...s.currentProforma,
                transportCharges: transport > 0 ? transport : undefined,
                loadingCharges: loading > 0 ? loading : undefined,
              }
            : null,
        }));
      },

      upsertProformaCartItem(skuId, quantity, rate) {
        set(s => {
          if (!s.currentProforma) return {};
          const existing = s.currentProforma.items.findIndex(i => i.skuId === skuId);
          let items: CartItem[];
          if (existing >= 0) {
            items = s.currentProforma.items.map(i =>
              i.skuId === skuId ? { ...i, quantity, rate } : i,
            );
          } else {
            items = [...s.currentProforma.items, { skuId, quantity, rate }];
          }
          return { currentProforma: { ...s.currentProforma, items } };
        });
      },

      removeProformaCartItem(skuId) {
        set(s => ({
          currentProforma: s.currentProforma
            ? { ...s.currentProforma, items: s.currentProforma.items.filter(i => i.skuId !== skuId) }
            : null,
        }));
      },

      clearProforma() {
        set({ currentProforma: null, proformaStep: 1 });
      },

      // ─── Invoice Generation ───────────────────────────────────────────

      generateInvoice(saleDate?: string) {
        const s = get();
        const { currentOrder, businessProfile, invoiceCounters, testInvoiceCounters, customers } = s;
        if (!currentOrder || !businessProfile) return null;

        const customer = customers.find(c => c.id === currentOrder.customerId);
        if (!customer) return null;

        // The designated test customer gets its own TEST/... numbering series so
        // testing orders never consume or disturb the real INV/... invoice sequence.
        const TEST_CUSTOMER_NAMES = ['test', 'test customer'];
        const isTestCustomer =
          TEST_CUSTOMER_NAMES.includes(customer.name.trim().toLowerCase()) ||
          TEST_CUSTOMER_NAMES.includes((customer.firmName ?? '').trim().toLowerCase());
        const prefix = isTestCustomer ? 'TEST' : 'INV';
        const activeCounters = isTestCustomer ? testInvoiceCounters : invoiceCounters;

        // Use saleDate if provided (YYYY-MM-DD), otherwise use today
        const invoiceDateObj = saleDate
          ? (() => { const [y, m, d] = saleDate.split('-').map(Number); return new Date(y, m - 1, d); })()
          : new Date();
        const fy = getFYFromDate(invoiceDateObj);
        const mm = String(invoiceDateObj.getMonth() + 1).padStart(2, '0');
        const fyMonth = `${fy}-${mm}`;
        const seq = (activeCounters[fyMonth] ?? 0) + 1;
        const invoiceNo = `${prefix}/${fy}/${mm}/${String(seq).padStart(2, '0')}`;
        const inter = isInterState(businessProfile.state, customer.state);
        const gstEnabled = currentOrder.gstEnabled ?? businessProfile.gstEnabled ?? false;
        const now = new Date();

        const items: OrderItem[] = applyTwinPackSplit(currentOrder.items).map(cartItem => {
          const sku = PRODUCTS.find(p => p.id === cartItem.skuId)!;
          const taxableValue = cartItem.quantity * cartItem.rate;
          const gstRate = sku.weight > 25 ? 0 : sku.gstRate;
          const raw = gstEnabled ? calcGST(taxableValue, gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
          const { cgst, sgst, igst } = raw;
          return {
            ...cartItem,
            product: sku.product,
            variant: (sku.innerSkuId || sku.useIdAsLabel) ? sku.id : sku.variant,
            weight: sku.weight,
            hsnCode: sku.hsnCode,
            gstRate,
            unit: sku.unit,
            taxableValue,
            cgst,
            sgst,
            igst,
            lineTotal: taxableValue + cgst + sgst + igst,
          };
        });

        const subtotal    = items.reduce((a, i) => a + i.taxableValue, 0);
        const cgstTotal   = items.reduce((a, i) => a + i.cgst, 0);
        const sgstTotal   = items.reduce((a, i) => a + i.sgst, 0);
        const igstTotal   = items.reduce((a, i) => a + i.igst, 0);
        const totalGST    = cgstTotal + sgstTotal + igstTotal;
        const preDiscount = subtotal + totalGST;

        // Discount (optional)
        const discountType  = currentOrder.discountType;
        const discountValue = currentOrder.discountValue ?? 0;
        const discountAmount = discountType && discountValue > 0
          ? (discountType === 'percent' ? parseFloat((preDiscount * discountValue / 100).toFixed(2)) : discountValue)
          : 0;

        const transportCharges = currentOrder.transportCharges ?? 0;
        const loadingCharges   = currentOrder.loadingCharges   ?? 0;

        const beforeRound = preDiscount - discountAmount + transportCharges + loadingCharges;
        const grandTotal  = Math.round(beforeRound);
        const roundOff    = parseFloat((grandTotal - beforeRound).toFixed(2));

        const invoice: Invoice = {
          id: crypto.randomUUID(),
          invoiceNo,
          invoiceDate: formatDate(invoiceDateObj),
          invoiceTime: formatTime(now),
          customerId: customer.id,
          customerSnapshot: { ...customer },
          items,
          subtotal,
          cgstTotal,
          sgstTotal,
          igstTotal,
          totalGST,
          discountType:     discountType ?? undefined,
          discountValue:    discountValue > 0 ? discountValue : undefined,
          discountAmount:   discountAmount > 0 ? discountAmount : undefined,
          transportCharges: transportCharges > 0 ? transportCharges : undefined,
          loadingCharges:   loadingCharges   > 0 ? loadingCharges   : undefined,
          roundOff,
          grandTotal,
          isInterState: inter,
          paymentMode: currentOrder.paymentMode,
          amountInWords: numberToWords(grandTotal),
          financialYear: fy,
          cancelled: false,
        };

        // Deduct from ready stock per SKU
        const newReady = { ...s.readyStock };
        const newReadyTxns: ReadyStockTransaction[] = [];
        const newPkgStock = { ...s.packagingStock };
        const newPkgEntries: PackagingEntry[] = [];
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);

        for (const item of items) {
          const sku = PRODUCTS.find(p => p.id === item.skuId)!;
          if (sku.innerSkuId && sku.innerSkuQty) {
            // Bundle SKU (AT30): deduct from inner SKU's ready stock
            const innerSku = PRODUCTS.find(p => p.id === sku.innerSkuId)!;
            const innerSkuName = `${innerSku.product} – ${innerSku.variant}`;
            const innerQty = item.quantity * sku.innerSkuQty;
            const prevReady = newReady[sku.innerSkuId] ?? 0;
            newReady[sku.innerSkuId] = prevReady - innerQty;
            newReadyTxns.push({
              id: crypto.randomUUID(),
              date: dateStr, time: timeStr,
              skuId: sku.innerSkuId, skuName: innerSkuName,
              type: 'DEDUCT',
              quantity: innerQty,
              previousStock: prevReady,
              newStock: newReady[sku.innerSkuId],
              reason: `Sale via ${sku.id} – ${invoiceNo}`,
              invoiceNo,
            });
            // Deduct the outer bag packaging at invoice time
            const outerMat = sku.skipOuterPackaging ? undefined : PACKAGING_MATERIALS.find(m => m.id === sku.packagingId);
            if (outerMat) {
              const prevPkg = newPkgStock[sku.packagingId] ?? 0;
              newPkgStock[sku.packagingId] = Math.max(0, prevPkg - item.quantity);
              newPkgEntries.push({
                id: crypto.randomUUID(),
                date: dateStr, time: timeStr,
                materialId: sku.packagingId,
                materialName: outerMat.name,
                entryType: 'used',
                quantity: item.quantity,
                notes: `Auto-deducted for Sale: ${sku.product} – ${sku.variant} (${invoiceNo})`,
              });
            }
          } else {
            // Normal SKU: deduct from own ready stock
            const skuName = `${sku.product} – ${sku.variant}`;
            const prevReady = newReady[item.skuId] ?? 0;
            newReady[item.skuId] = prevReady - item.quantity;
            newReadyTxns.push({
              id: crypto.randomUUID(),
              date: dateStr, time: timeStr,
              skuId: item.skuId, skuName,
              type: 'DEDUCT',
              quantity: item.quantity,
              previousStock: prevReady,
              newStock: newReady[item.skuId],
              reason: `Sale – ${invoiceNo}`,
              invoiceNo,
            });
          }
        }

        // Guard: reject if any ready stock goes below zero
        const insufficientLines: string[] = [];
        for (const item of items) {
          const sku = PRODUCTS.find(p => p.id === item.skuId)!;
          if (sku.innerSkuId && sku.innerSkuQty) {
            if ((newReady[sku.innerSkuId] ?? 0) < 0) {
              const innerSku = PRODUCTS.find(p => p.id === sku.innerSkuId)!;
              insufficientLines.push(
                `${sku.product} – ${sku.variant}: needs ${item.quantity * sku.innerSkuQty} × ${innerSku.variant} (available ${s.readyStock[sku.innerSkuId] ?? 0})`
              );
            }
          } else {
            if ((newReady[item.skuId] ?? 0) < 0) {
              insufficientLines.push(
                `${sku.product} – ${sku.variant}: available ${s.readyStock[item.skuId] ?? 0}, requested ${item.quantity}`
              );
            }
          }
        }
        if (insufficientLines.length > 0) {
          set({ dialog: { title: 'Insufficient Ready Stock', variant: 'error', message: insufficientLines } });
          return null;
        }

        set({
          invoices: [...s.invoices, invoice],
          ...(isTestCustomer
            ? { testInvoiceCounters: { ...s.testInvoiceCounters, [fyMonth]: seq } }
            : { invoiceCounters: { ...s.invoiceCounters, [fyMonth]: seq } }),
          readyStock: newReady,
          readyStockTransactions: [...s.readyStockTransactions, ...newReadyTxns],
          packagingStock: newPkgStock,
          packagingEntries: [...s.packagingEntries, ...newPkgEntries],
          currentOrder: null,
          orderStep: 1,
          currentPage: 'invoice-view',
          selectedInvoiceId: invoice.id,
        });
        // Invoice generated successfully — the persisted draft is no longer
        // relevant, so remove it outright rather than leaving a null entry.
        try { localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY); } catch (e) {}

        const { orgId } = get();
        if (orgId) {
          db.saveInvoice(orgId, invoice, items, newReadyTxns, newReady)
            .catch((err) => {
              // Revert the invoice counter so the next attempt reuses the same sequence number.
              set(cur => (
                isTestCustomer
                  ? { testInvoiceCounters: { ...cur.testInvoiceCounters, [fyMonth]: s.testInvoiceCounters[fyMonth] ?? 0 } }
                  : { invoiceCounters: { ...cur.invoiceCounters, [fyMonth]: s.invoiceCounters[fyMonth] ?? 0 } }
              ));
              console.error('[saveInvoice] Failed to save invoice items:', err);
              set({ dialog: {
                title: `Invoice ${invoiceNo} Not Saved`,
                variant: 'error',
                message: [
                  'The invoice was created locally but could not be saved to the database.',
                  `Error: ${fmtErr(err)}`,
                  'Please note down the items and contact support, or re-create the invoice after checking your connection.',
                ],
              } });
            });
          // Save outer bag packaging deductions for bundle SKUs (AT30)
          for (const entry of newPkgEntries) {
            db.savePackagingEntry(orgId, entry, newPkgStock[entry.materialId]).catch(console.error);
          }
        }

        return invoice;
      },

      generateProformaInvoice(saleDate?: string) {
        const s = get();
        const { currentOrder, businessProfile, proformaCounters, customers } = s;
        if (!currentOrder || !businessProfile) return null;

        const customer = customers.find(c => c.id === currentOrder.customerId);
        if (!customer) return null;

        // Use saleDate if provided (YYYY-MM-DD), otherwise use today
        const invoiceDateObj = saleDate
          ? (() => { const [y, m, d] = saleDate.split('-').map(Number); return new Date(y, m - 1, d); })()
          : new Date();
        const fy = getFYFromDate(invoiceDateObj);
        const mm = String(invoiceDateObj.getMonth() + 1).padStart(2, '0');
        const fyMonth = `${fy}-${mm}`;
        const seq = (proformaCounters[fyMonth] ?? 0) + 1;
        const invoiceNo = `PRO/${fy}/${mm}/${String(seq).padStart(2, '0')}`;
        const inter = isInterState(businessProfile.state, customer.state);
        const gstEnabled = currentOrder.gstEnabled ?? businessProfile.gstEnabled ?? false;
        const now = new Date();

        const items: OrderItem[] = applyTwinPackSplit(currentOrder.items).map(cartItem => {
          const sku = PRODUCTS.find(p => p.id === cartItem.skuId)!;
          const taxableValue = cartItem.quantity * cartItem.rate;
          const gstRate = sku.weight > 25 ? 0 : sku.gstRate;
          const raw = gstEnabled ? calcGST(taxableValue, gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
          const { cgst, sgst, igst } = raw;
          return {
            ...cartItem,
            product: sku.product,
            variant: (sku.innerSkuId || sku.useIdAsLabel) ? sku.id : sku.variant,
            weight: sku.weight,
            hsnCode: sku.hsnCode,
            gstRate,
            unit: sku.unit,
            taxableValue,
            cgst,
            sgst,
            igst,
            lineTotal: taxableValue + cgst + sgst + igst,
          };
        });

        const subtotal    = items.reduce((a, i) => a + i.taxableValue, 0);
        const cgstTotal   = items.reduce((a, i) => a + i.cgst, 0);
        const sgstTotal   = items.reduce((a, i) => a + i.sgst, 0);
        const igstTotal   = items.reduce((a, i) => a + i.igst, 0);
        const totalGST    = cgstTotal + sgstTotal + igstTotal;
        const preDiscount = subtotal + totalGST;

        const discountType  = currentOrder.discountType;
        const discountValue = currentOrder.discountValue ?? 0;
        const discountAmount = discountType && discountValue > 0
          ? (discountType === 'percent' ? parseFloat((preDiscount * discountValue / 100).toFixed(2)) : discountValue)
          : 0;

        const transportCharges = currentOrder.transportCharges ?? 0;
        const loadingCharges   = currentOrder.loadingCharges   ?? 0;

        const beforeRound = preDiscount - discountAmount + transportCharges + loadingCharges;
        const grandTotal  = Math.round(beforeRound);
        const roundOff    = parseFloat((grandTotal - beforeRound).toFixed(2));

        const invoice: Invoice = {
          id: crypto.randomUUID(),
          invoiceNo,
          invoiceDate: formatDate(invoiceDateObj),
          invoiceTime: formatTime(now),
          customerId: customer.id,
          customerSnapshot: { ...customer },
          items,
          subtotal,
          cgstTotal,
          sgstTotal,
          igstTotal,
          totalGST,
          discountType:     discountType ?? undefined,
          discountValue:    discountValue > 0 ? discountValue : undefined,
          discountAmount:   discountAmount > 0 ? discountAmount : undefined,
          transportCharges: transportCharges > 0 ? transportCharges : undefined,
          loadingCharges:   loadingCharges   > 0 ? loadingCharges   : undefined,
          roundOff,
          grandTotal,
          isInterState: inter,
          paymentMode: currentOrder.paymentMode,
          amountInWords: numberToWords(grandTotal),
          financialYear: fy,
          cancelled: false,
          docType: 'proforma',
        };

        // No stock deduction, no stock guard, and no side effects on ready/packaging
        // stock or the real invoice numbering series — a proforma is a non-binding quote.
        set({
          proformaInvoices: [...s.proformaInvoices, invoice],
          proformaCounters: { ...s.proformaCounters, [fyMonth]: seq },
        });

        const { orgId } = get();
        if (orgId) {
          db.saveProformaInvoice(orgId, invoice).catch((err) => {
            // Revert the counter so the next attempt reuses the same sequence number.
            set(cur => ({ proformaCounters: { ...cur.proformaCounters, [fyMonth]: s.proformaCounters[fyMonth] ?? 0 } }));
            console.error('[saveProformaInvoice] Failed to save proforma invoice:', err);
            set({ dialog: {
              title: `Proforma ${invoiceNo} Not Saved`,
              variant: 'error',
              message: [
                'The proforma invoice was created locally but could not be saved to the database.',
                `Error: ${fmtErr(err)}`,
              ],
            } });
          });
        }

        return invoice;
      },

      cancelInvoice(id) {
        const s = get();
        const invoice = s.invoices.find(inv => inv.id === id);
        if (!invoice) return;

        const now = new Date();
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);
        const newReady = { ...s.readyStock };
        const restorationTxns: ReadyStockTransaction[] = [];

        const cancelPkgStock = { ...s.packagingStock };
        const cancelPkgEntries: PackagingEntry[] = [];

        for (const item of invoice.items) {
          const sku = PRODUCTS.find(p => p.id === item.skuId)!;
          if (sku.innerSkuId && sku.innerSkuQty) {
            // Bundle SKU (AT30): restore inner SKU's ready stock
            const innerSku = PRODUCTS.find(p => p.id === sku.innerSkuId)!;
            const innerSkuName = `${innerSku.product} – ${innerSku.variant}`;
            const innerQty = item.quantity * sku.innerSkuQty;
            const prevReady = newReady[sku.innerSkuId] ?? 0;
            newReady[sku.innerSkuId] = prevReady + innerQty;
            restorationTxns.push({
              id: crypto.randomUUID(),
              date: dateStr, time: timeStr,
              skuId: sku.innerSkuId, skuName: innerSkuName,
              type: 'ADD',
              quantity: innerQty,
              previousStock: prevReady,
              newStock: newReady[sku.innerSkuId],
              reason: `Cancellation via ${sku.id} – ${invoice.invoiceNo}`,
              invoiceNo: invoice.invoiceNo,
            });
            // Restore outer bag packaging
            const outerMat = sku.skipOuterPackaging ? undefined : PACKAGING_MATERIALS.find(m => m.id === sku.packagingId);
            if (outerMat) {
              const prevPkg = cancelPkgStock[sku.packagingId] ?? 0;
              cancelPkgStock[sku.packagingId] = prevPkg + item.quantity;
              cancelPkgEntries.push({
                id: crypto.randomUUID(),
                date: dateStr, time: timeStr,
                materialId: sku.packagingId,
                materialName: outerMat.name,
                entryType: 'used',
                quantity: item.quantity,
                notes: `Restored on cancellation: ${sku.product} – ${sku.variant} (${invoice.invoiceNo})`,
              });
            }
          } else {
            // Normal SKU: restore own ready stock
            const skuName = `${sku.product} – ${sku.variant}`;
            const prevReady = newReady[item.skuId] ?? 0;
            newReady[item.skuId] = prevReady + item.quantity;
            restorationTxns.push({
              id: crypto.randomUUID(),
              date: dateStr, time: timeStr,
              skuId: item.skuId, skuName,
              type: 'ADD',
              quantity: item.quantity,
              previousStock: prevReady,
              newStock: newReady[item.skuId],
              reason: `Cancellation – ${invoice.invoiceNo}`,
              invoiceNo: invoice.invoiceNo,
            });
          }
        }

        set(cur => ({
          invoices: cur.invoices.map(inv => inv.id === id ? { ...inv, cancelled: true } : inv),
          readyStock: newReady,
          readyStockTransactions: [...cur.readyStockTransactions, ...restorationTxns],
          packagingStock: cancelPkgStock,
          packagingEntries: [...cur.packagingEntries, ...cancelPkgEntries],
        }));

        const { orgId } = get();
        if (orgId) {
          db.cancelInvoiceInDb(orgId, id, restorationTxns, newReady).catch(console.error);
          for (const entry of cancelPkgEntries) {
            db.savePackagingEntry(orgId, entry, cancelPkgStock[entry.materialId]).catch(console.error);
          }
        }
      },

      updateInvoicePaymentMode(id, mode) {
        set(s => ({
          invoices: s.invoices.map(inv => inv.id === id ? { ...inv, paymentMode: mode } : inv),
        }));
        const { orgId } = get();
        if (orgId) db.updateInvoicePaymentModeInDb(orgId, id, mode).catch(console.error);
      },


      // ─── Payment Receipts ────────────────────────────────────────────

      updatePaymentReceipt(id, data) {
        set(s => ({
          paymentReceipts: s.paymentReceipts.map(r => r.id === id ? { ...r, ...data } : r),
        }));
        const { orgId } = get();
        if (orgId) db.updatePaymentReceiptInDb(orgId, id, data).catch(console.error);
      },

      addPaymentReceipt(data) {
        const prevReceipts = get().paymentReceipts;
        const prevSeq = get().receiptSeq;
        const seq = prevSeq + 1;
        const id = `REC-${String(seq).padStart(4, '0')}`;
        const rec: PaymentReceipt = { ...data, id, time: formatTime(new Date()) };
        set(s => ({
          paymentReceipts: [...s.paymentReceipts, rec],
          receiptSeq: seq,
        }));
        const { orgId } = get();
        if (orgId) {
          db.savePaymentReceipt(orgId, rec).catch((err) => {
            set({ paymentReceipts: prevReceipts, receiptSeq: prevSeq, dialog: {
              title: 'Payment Not Saved',
              variant: 'warning',
              message: [
                `Payment ${id} was recorded locally but could not be saved to the database.`,
                `Error: ${fmtErr(err)}`,
                'Please check your connection and re-enter this payment after reconnecting.',
              ],
            } });
          });
        }
      },

      // ─── Stock ───────────────────────────────────────────────────────

      addPackagingEntry(entry) {
        const now = new Date();
        const id = crypto.randomUUID();
        const rec: PackagingEntry = { ...entry, id, time: formatTime(now) };
        let newStock = 0;
        set(s => {
          const prev = s.packagingStock[entry.materialId] ?? 0;
          newStock = entry.entryType === 'purchase'
            ? prev + entry.quantity
            : Math.max(0, prev - entry.quantity);
          return {
            packagingEntries: [...s.packagingEntries, rec],
            packagingStock: { ...s.packagingStock, [entry.materialId]: newStock },
          };
        });
        const { orgId } = get();
        if (orgId) {
          db.savePackagingEntry(orgId, rec, newStock).catch((err) => {
            console.error('[savePackagingEntry] DB save failed:', err);
            set({ dialog: {
              title: 'Entry Not Saved',
              variant: 'warning',
              message: [
                'Packaging entry was recorded locally but could not be saved to the database.',
                `Error: ${fmtErr(err)}`,
                'Please check your connection and retry.',
              ],
            } });
          });
        }
      },

      addProductionLog(log) {
        const prevLogs = get().productionLogs;
        const now = new Date();
        const rec: ProductionLog = { ...log, id: crypto.randomUUID(), time: formatTime(now) };
        set(s => ({ productionLogs: [...s.productionLogs, rec] }));
        const { orgId } = get();
        if (orgId) {
          db.saveProductionLog(orgId, rec).catch((err) => {
            set({ productionLogs: prevLogs, dialog: {
              title: 'Log Not Saved',
              variant: 'warning',
              message: [
                'Production log was recorded locally but could not be saved to the database.',
                `Error: ${fmtErr(err)}`,
                'Please check your connection and re-enter this entry after reconnecting.',
              ],
            } });
          });
        }
      },

      adjustStock(type, id, qty, reason) {
        const now = new Date();
        let txn!: StockTransaction;
        let newStockQty = 0;
        set(s => {
          const txId = crypto.randomUUID();
          if (type === 'raw') {
            const prev = s.rawMaterialStock[id] ?? 0;
            newStockQty = Math.max(0, prev + qty);
            txn = {
              id: txId,
              type: qty >= 0 ? 'ADD' : 'ADJUST', itemType: 'raw', itemId: id,
              itemName: id,
              quantity: Math.abs(qty), previousStock: prev, newStock: newStockQty,
              reason, date: formatDate(now), time: formatTime(now),
            };
            return {
              rawMaterialStock: { ...s.rawMaterialStock, [id]: newStockQty },
              stockTransactions: [...s.stockTransactions, txn],
            };
          } else {
            const prev = s.packagingStock[id] ?? 0;
            newStockQty = Math.max(0, prev + qty);
            const pkgName = PACKAGING_MATERIALS.find(p => p.id === id)?.name ?? id;
            txn = {
              id: txId,
              type: qty >= 0 ? 'ADD' : 'ADJUST', itemType: 'packaging', itemId: id,
              itemName: pkgName,
              quantity: Math.abs(qty), previousStock: prev, newStock: newStockQty,
              reason, date: formatDate(now), time: formatTime(now),
            };
            return {
              packagingStock: { ...s.packagingStock, [id]: newStockQty },
              stockTransactions: [...s.stockTransactions, txn],
            };
          }
        });
        const { orgId } = get();
        if (orgId) db.saveStockTransaction(orgId, txn, newStockQty).catch(console.error);
      },

      setReorderLevel(type, id, level) {
        set(s => ({
          reorderLevels: {
            ...s.reorderLevels,
            [type]: { ...(s.reorderLevels as Record<string, Record<string, number>>)[type], [id]: level },
          },
        }));
        const { orgId } = get();
        if (orgId) db.saveReorderLevel(orgId, type, id, level).catch(console.error);
      },

      addReadyStockEntry(skuId, qty, reason, date) {
        const now = new Date();
        const sku = PRODUCTS.find(p => p.id === skuId);
        const skuName = sku ? `${sku.product} – ${sku.variant}` : skuId;
        let txn!: ReadyStockTransaction;
        let pkgEntry: PackagingEntry | null = null;
        let newPkgStock = 0;
        set(s => {
          const prev = s.readyStock[skuId] ?? 0;
          const newStock = prev + qty;
          txn = {
            id: crypto.randomUUID(),
            date, time: formatTime(now),
            skuId, skuName,
            type: 'ADD',
            quantity: qty,
            previousStock: prev,
            newStock,
            reason,
          };
          // Auto-deduct the corresponding packaging material
          const pkgMaterial = sku
            ? PACKAGING_MATERIALS.find(m => m.id === sku.packagingId)
            : null;
          let newPackagingStock = s.packagingStock;
          if (pkgMaterial) {
            const prevPkg = s.packagingStock[pkgMaterial.id] ?? 0;
            newPkgStock = Math.max(0, prevPkg - qty);
            pkgEntry = {
              id: crypto.randomUUID(),
              date,
              time: formatTime(now),
              materialId: pkgMaterial.id,
              materialName: pkgMaterial.name,
              entryType: 'used',
              quantity: qty,
              notes: `Auto-deducted for Ready Stock: ${skuName}`,
            };
            newPackagingStock = { ...s.packagingStock, [pkgMaterial.id]: newPkgStock };
          }
          return {
            readyStock: { ...s.readyStock, [skuId]: newStock },
            readyStockTransactions: [...s.readyStockTransactions, txn],
            packagingStock: newPackagingStock,
            packagingEntries: pkgEntry
              ? [...s.packagingEntries, pkgEntry]
              : s.packagingEntries,
          };
        });
        const { orgId } = get();
        if (orgId) {
          const attemptSave = () => {
            db.saveReadyStockTransaction(orgId!, txn).catch((err) => {
              console.error('[saveReadyStockTransaction] DB save failed:', err);
              set({ dialog: {
                title: 'Entry Not Saved',
                variant: 'warning',
                message: [
                  'Ready stock entry was recorded locally but could not be saved to the database.',
                  `Error: ${fmtErr(err)}`,
                  'Tap Retry to try again, or check your connection.',
                ],
                onRetry: attemptSave,
              } });
            });
          };
          attemptSave();
          if (pkgEntry) {
            db.savePackagingEntry(orgId, pkgEntry, newPkgStock).catch((err) => {
              console.error('[savePackagingEntry/auto-deduct] DB save failed:', err);
            });
          }
        }
      },

      adjustReadyStock(skuId, qty, reason?: string, date?) {
        const now = new Date();
        const sku = PRODUCTS.find(p => p.id === skuId);
        const skuName = sku ? `${sku.product} – ${sku.variant}` : skuId;
        let txn!: ReadyStockTransaction;
        set(s => {
          const prev = s.readyStock[skuId] ?? 0;
          const newStock = Math.max(0, prev + qty);
          txn = {
            id: crypto.randomUUID(),
            date: date ?? formatDate(now), time: formatTime(now),
            skuId, skuName,
            type: qty > 0 ? 'ADD' : 'DEDUCT',
            quantity: Math.abs(qty),
            previousStock: prev,
            newStock,
            reason,
          };
          return {
            readyStock: { ...s.readyStock, [skuId]: newStock },
            readyStockTransactions: [...s.readyStockTransactions, txn],
          };
        });
        const { orgId } = get();
        if (orgId) db.saveReadyStockTransaction(orgId, txn).catch(console.error);
      },

      editReadyStockTransaction(txId, newQty, newReason?) {
        let updatedTxn!: ReadyStockTransaction;
        set(s => {
          const idx = s.readyStockTransactions.findIndex(t => t.id === txId);
          if (idx === -1) return {};
          const old = s.readyStockTransactions[idx];
          const delta = newQty - old.quantity;
          const signedDelta = old.type === 'DEDUCT' ? -delta : delta;
          const updatedTxns = s.readyStockTransactions.map((t, i) => {
            if (t.id === txId) {
              return { ...t, quantity: newQty, newStock: old.newStock + signedDelta, reason: newReason };
            }
            if (i > idx && t.skuId === old.skuId) {
              return { ...t, previousStock: t.previousStock + signedDelta, newStock: t.newStock + signedDelta };
            }
            return t;
          });
          const newCurrentStock = (s.readyStock[old.skuId] ?? 0) + signedDelta;
          updatedTxn = updatedTxns[idx];
          return {
            readyStockTransactions: updatedTxns,
            readyStock: { ...s.readyStock, [old.skuId]: newCurrentStock },
          };
        });
        const { orgId } = get();
        if (orgId && updatedTxn) db.updateReadyStockTransactionInDb(orgId, updatedTxn).catch(console.error);
      },

      deleteReadyStockTransaction(txId) {
        let deletedSkuId = '';
        let newCurrentStock = 0;
        set(s => {
          const deletedIdx = s.readyStockTransactions.findIndex(t => t.id === txId);
          if (deletedIdx === -1) return {};
          const txn = s.readyStockTransactions[deletedIdx];
          deletedSkuId = txn.skuId;
          const signedQty = txn.type === 'DEDUCT' ? txn.quantity : -txn.quantity;
          newCurrentStock = (s.readyStock[txn.skuId] ?? 0) + signedQty;
          const updatedTxns = s.readyStockTransactions
            .map((t, i) => {
              if (i === deletedIdx) return null;
              if (i > deletedIdx && t.skuId === txn.skuId) {
                return { ...t, previousStock: t.previousStock + signedQty, newStock: t.newStock + signedQty };
              }
              return t;
            })
            .filter(Boolean) as ReadyStockTransaction[];
          return {
            readyStockTransactions: updatedTxns,
            readyStock: { ...s.readyStock, [txn.skuId]: newCurrentStock },
          };
        });
        const { orgId } = get();
        if (orgId && deletedSkuId) db.deleteReadyStockTransactionInDb(orgId, txId, deletedSkuId, newCurrentStock).catch(console.error);
      },

      setReadyStockReorderLevel(skuId, level) {
        set(s => ({
          reorderLevels: {
            ...s.reorderLevels,
            ready: { ...s.reorderLevels.ready, [skuId]: level },
          },
        }));
        const { orgId } = get();
        if (orgId) db.saveReorderLevel(orgId, 'ready', skuId, level).catch(console.error);
      },

      // ─── Pricing ─────────────────────────────────────────────────────

      updatePrice(skuId, rate) {
        set(s => ({ priceList: { ...s.priceList, [skuId]: rate } }));
        const { orgId } = get();
        if (orgId) db.savePrice(orgId, skuId, rate).catch(console.error);
      },

      // ─── Expenses ────────────────────────────────────────────────────

      addExpense(amount, date, time, notes, createdBy) {
        const expense: Expense = {
          id: crypto.randomUUID(), amount, date, time, notes, createdBy,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ expenses: [...s.expenses, expense] }));
        const { orgId } = get();
        if (orgId) db.saveExpense(orgId, expense.id, amount, date, time, notes, createdBy).catch(console.error);
      },

      deleteExpense(id) {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
        const { orgId } = get();
        if (orgId) db.deleteExpense(id).catch(console.error);
      },

      // ─── Salary ──────────────────────────────────────────────────────

      addEmployee(data) {
        const employee: Employee = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ employees: [...s.employees, employee] }));
        const { orgId } = get();
        if (orgId) db.saveEmployee(orgId, employee).catch(console.error);
      },

      updateEmployee(id, data) {
        set(s => ({ employees: s.employees.map(e => e.id === id ? { ...e, ...data } : e) }));
        const { orgId } = get();
        if (orgId) db.updateEmployee(id, data).catch(console.error);
      },

      deleteEmployee(id) {
        set(s => ({
          employees: s.employees.filter(e => e.id !== id),
          employeeLeaves: s.employeeLeaves.filter(l => l.employeeId !== id),
          employeeAdvances: s.employeeAdvances.filter(a => a.employeeId !== id),
          salaryRecords: s.salaryRecords.filter(r => r.employeeId !== id),
        }));
        const { orgId } = get();
        if (orgId) db.deleteEmployee(id).catch(console.error);
      },

      addEmployeeLeave(employeeId, date, isHalfDay, notes) {
        const leave: EmployeeLeave = {
          id: crypto.randomUUID(), employeeId, date, isHalfDay, notes,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ employeeLeaves: [...s.employeeLeaves, leave] }));
        const { orgId } = get();
        if (orgId) db.saveEmployeeLeave(orgId, leave).catch(console.error);
      },

      deleteEmployeeLeave(id) {
        set(s => ({ employeeLeaves: s.employeeLeaves.filter(l => l.id !== id) }));
        const { orgId } = get();
        if (orgId) db.deleteEmployeeLeave(id).catch(console.error);
      },

      addEmployeeAdvance(employeeId, amount, date, notes) {
        const advance: EmployeeAdvance = {
          id: crypto.randomUUID(), employeeId, amount, date, notes,
          createdAt: new Date().toISOString(),
        };
        set(s => ({ employeeAdvances: [...s.employeeAdvances, advance] }));
        const { orgId } = get();
        if (orgId) db.saveEmployeeAdvance(orgId, advance).catch(console.error);
      },

      deleteEmployeeAdvance(id) {
        set(s => ({ employeeAdvances: s.employeeAdvances.filter(a => a.id !== id) }));
        const { orgId } = get();
        if (orgId) db.deleteEmployeeAdvance(id).catch(console.error);
      },

      upsertSalaryRecord(record) {
        const now = new Date().toISOString();
        const existing = get().salaryRecords.find(
          r => r.employeeId === record.employeeId && r.month === record.month,
        );
        const full: SalaryRecord = {
          id: existing?.id ?? crypto.randomUUID(),
          ...record,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        set(s => ({
          salaryRecords: existing
            ? s.salaryRecords.map(r => r.id === existing.id ? full : r)
            : [...s.salaryRecords, full],
        }));
        const { orgId } = get();
        if (orgId) db.upsertSalaryRecord(orgId, full).catch(console.error);
      },

      // ─── Computed helpers ────────────────────────────────────────────

      getCustomerInvoices(customerId) {
        return get().invoices.filter(inv => inv.customerId === customerId && !inv.cancelled);
      },

      getStockStatus(type, id) {
        const stock = type === 'raw'
          ? (get().rawMaterialStock[id] ?? 0)
          : (get().packagingStock[id] ?? 0);
        const reorder = type === 'raw'
          ? (get().reorderLevels.raw[id] ?? 0)
          : (get().reorderLevels.packaging[id] ?? 0);
        if (stock === 0) return 'out';
        if (reorder > 0 && stock <= reorder) return 'low';
        return 'adequate';
      },

      getReadyStockStatus(skuId) {
        const stock = get().readyStock[skuId] ?? 0;
        const reorder = get().reorderLevels.ready[skuId] ?? 0;
        if (stock === 0) return 'out';
        if (reorder > 0 && stock <= reorder) return 'low';
        return 'adequate';
      },

      syncPackagingFromReadyStock() {
        const { readyStockTransactions, orgId } = get();
        const now = new Date();
        const date = formatDate(now);
        // Sum all ADD transactions per packaging material (not current balance,
        // because sales deduct from ready stock but NOT from packaging)
        const pkgTotals: Record<string, number> = {};
        for (const txn of readyStockTransactions) {
          if (txn.type !== 'ADD') continue;
          const sku = PRODUCTS.find(p => p.id === txn.skuId);
          if (!sku?.packagingId) continue;
          pkgTotals[sku.packagingId] = (pkgTotals[sku.packagingId] ?? 0) + txn.quantity;
        }
        const deductions: { materialId: string; materialName: string; qty: number }[] = [];
        const entries: PackagingEntry[] = [];
        const newStocks: Record<string, number> = {};
        for (const [materialId, qty] of Object.entries(pkgTotals)) {
          if (qty <= 0) continue;
          const mat = PACKAGING_MATERIALS.find(m => m.id === materialId);
          if (!mat) continue;
          const prevPkg = get().packagingStock[materialId] ?? 0;
          const newStock = Math.max(0, prevPkg - qty);
          newStocks[materialId] = newStock;
          const entry: PackagingEntry = {
            id: crypto.randomUUID(),
            date,
            time: formatTime(now),
            materialId,
            materialName: mat.name,
            entryType: 'used',
            quantity: qty,
            notes: 'One-time sync: deducted for existing Ready Stock',
          };
          entries.push(entry);
          deductions.push({ materialId, materialName: mat.name, qty });
        }
        if (entries.length === 0) return deductions;
        set(s => ({
          packagingStock: { ...s.packagingStock, ...newStocks },
          packagingEntries: [...s.packagingEntries, ...entries],
          lastSyncBatchTime: formatTime(now),
        }));
        if (orgId) {
          entries.forEach(e =>
            db.savePackagingEntry(orgId, e, newStocks[e.materialId]).catch(console.error),
          );
        }
        return deductions;
      },

      revertLastPackagingSync() {
        const { packagingEntries, orgId } = get();
        const SYNC_NOTE = 'One-time sync: deducted for existing Ready Stock';
        const batchEntries = packagingEntries.filter(
          e => e.entryType === 'used' && e.notes === SYNC_NOTE,
        );
        if (batchEntries.length === 0) return;
        const now = new Date();
        const date = formatDate(now);
        const reversalEntries: PackagingEntry[] = [];
        const newStocks: Record<string, number> = {};
        for (const orig of batchEntries) {
          const prevPkg = get().packagingStock[orig.materialId] ?? 0;
          const newStock = prevPkg + orig.quantity;
          newStocks[orig.materialId] = newStock;
          reversalEntries.push({
            id: crypto.randomUUID(),
            date,
            time: formatTime(now),
            materialId: orig.materialId,
            materialName: orig.materialName,
            entryType: 'purchase',
            quantity: orig.quantity,
            notes: 'Undo: reversed one-time ready-stock sync',
          });
        }
        set(s => ({
          packagingStock: { ...s.packagingStock, ...newStocks },
          packagingEntries: [...s.packagingEntries, ...reversalEntries],
        }));
        if (orgId) {
          reversalEntries.forEach(e =>
            db.savePackagingEntry(orgId, e, newStocks[e.materialId]).catch(console.error),
          );
        }
      },

      recalculatePackagingStock() {
        const { packagingEntries, packagingStock, orgId } = get();
        const diffs: { materialId: string; materialName: string; before: number; after: number }[] = [];
        const newStocks: Record<string, number> = {};
        for (const mat of PACKAGING_MATERIALS) {
          let balance = 0;
          for (const e of packagingEntries) {
            if (e.materialId !== mat.id) continue;
            balance += e.entryType === 'purchase' ? e.quantity : -e.quantity;
          }
          const after = Math.max(0, balance);
          const before = packagingStock[mat.id] ?? 0;
          if (after !== before) diffs.push({ materialId: mat.id, materialName: mat.name, before, after });
          newStocks[mat.id] = after;
        }
        if (diffs.length === 0) return diffs;
        set(s => ({ packagingStock: { ...s.packagingStock, ...newStocks } }));
        if (orgId) {
          db.saveRecalculatedPackagingStock(
            orgId,
            diffs.map(d => ({ materialId: d.materialId, quantity: d.after })),
          ).catch(console.error);
        }
        return diffs;
      },

      clearAllPackagingData() {
        const { orgId } = get();
        const emptyStock = Object.fromEntries(PACKAGING_MATERIALS.map(m => [m.id, 0]));
        set({ packagingEntries: [], packagingStock: emptyStock });
        if (orgId) db.clearAllPackagingData(orgId).catch(console.error);
      },

      showDialog(config) {
        set({ dialog: config });
      },

      closeDialog() {
        set({ dialog: null });
      },

  }),
  {
    name: ORDER_DRAFT_STORAGE_KEY,
    // Only the in-progress order/proforma drafts are persisted — everything
    // else is reloaded from Supabase on init, so we don't want a stale local
    // copy of customers/invoices/etc. shadowing the server data.
    partialize: (state) => ({
      currentOrder: state.currentOrder, orderStep: state.orderStep,
      currentProforma: state.currentProforma, proformaStep: state.proformaStep,
    }),
  },
  ),
);

export type Store = AppState;
