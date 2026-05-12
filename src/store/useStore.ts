import { create } from 'zustand';
import {
  AppPage, BusinessProfile, CartItem, CurrentOrder,
  Customer, Invoice, OrderItem, StockTransaction,
  PackagingEntry, ProductionLog, PaymentReceipt,
  ReadyStockTransaction, StockStatus, Expense,
} from '../types';
import { PACKAGING_MATERIALS, PRODUCTS, DEFAULT_PRICES } from '../data/products';
import { isInterState, calcGST } from '../utils/gst';
import { numberToWords } from '../utils/numberToWords';
import { formatDate, formatTime, getCurrentFY, getFYFromDate } from '../utils/format';
import * as realDb from '../lib/db';
import * as demoDb from '../lib/db.demo';

const db = import.meta.env.VITE_DEMO_MODE === 'true' ? demoDb : realDb;

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

  // Business
  businessProfile: BusinessProfile | null;

  // Customers
  customers: Customer[];
  customerSeq: number;

  // Order in progress
  currentOrder: CurrentOrder | null;

  // Invoices
  invoices: Invoice[];
  invoiceCounters: Record<string, number>; // FY -> seq

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

  // Expenses
  expenses: Expense[];

  // ─── Actions ───────────────────────────────────────────────────────

  // Init
  initializeApp(): Promise<void>;
  // Navigation
  navigate(page: AppPage, params?: { customerId?: string; invoiceId?: string; editCustomerId?: string }): void;

  // Business
  setBusinessProfile(profile: BusinessProfile): void;

  // Customers
  addCustomer(data: Omit<Customer, 'id' | 'createdOn' | 'active'>): string;
  updateCustomer(id: string, data: Partial<Customer>): void;
  deactivateCustomer(id: string): void;

  // Order
  startNewOrder(): void;
  setOrderCustomer(customerId: string): void;
  setOrderPaymentMode(mode: 'Cash' | 'Credit'): void;
  setOrderGst(enabled: boolean): void;
  setOrderDiscount(type: 'percent' | 'flat' | null, value: number): void;
  upsertCartItem(skuId: string, quantity: number, rate: number): void;
  removeCartItem(skuId: string): void;
  clearOrder(): void;

  // Invoice
  generateInvoice(saleDate?: string): Invoice | null;
  cancelInvoice(id: string): void;

  // Payments
  addPaymentReceipt(data: Omit<PaymentReceipt, 'id' | 'time'>): void;

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
  clearAllPackagingData(): void;

  // Pricing
  updatePrice(skuId: string, rate: number): void;

  // Expenses
  addExpense(amount: number, date: string, time: string, notes: string, createdBy: string): void;
  deleteExpense(id: string): void;

  // Computed helpers (not persisted)
  getCustomerInvoices(customerId: string): Invoice[];
  getStockStatus(type: 'raw' | 'packaging', id: string): 'adequate' | 'low' | 'out';
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

      // Business
      businessProfile: null,

      // Customers
      customers: [],
      customerSeq: 0,

      // Order
      currentOrder: null,

      // Invoices
      invoices: [],
      invoiceCounters: {},

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
      priceList: { ...DEFAULT_PRICES },

      // Expenses
      expenses: [],

      // ─── Init ────────────────────────────────────────────────────────

      async initializeApp() {
        try {
          const userId = await db.initAuth();
          const orgId = await db.getOrCreateOrg(userId);

          // Seed catalog entries (SKUs, packaging materials) on first login or after
          // a catalog update. Bump CATALOG_VERSION whenever src/data/products.ts changes.
          const CATALOG_VERSION = 'v5';
          const catalogKey = `catalog_seeded_${orgId}`;
          if (localStorage.getItem(catalogKey) !== CATALOG_VERSION) {
            await db.initializeCatalog(orgId);
            localStorage.setItem(catalogKey, CATALOG_VERSION);
          }

          const [
            businessProfile,
            { customers, seq: customerSeq },
            invoices,
            { receipts: paymentReceipts, seq: receiptSeq },
            packagingEntries,
            productionLogs,
            stockData,
            dbPriceList,
            dbReorderLevels,
            expenses,
          ] = await Promise.all([
            db.loadBusinessProfile(orgId),
            db.loadCustomers(orgId),
            db.loadInvoices(orgId),
            db.loadPaymentReceipts(orgId),
            db.loadPackagingEntries(orgId),
            db.loadProductionLogs(orgId),
            db.loadStockData(orgId),
            db.loadPriceList(orgId),
            db.loadReorderLevels(orgId),
            db.loadExpenses(orgId),
          ]);

          // Derive invoice counters from loaded invoices
          const invoiceCounters: Record<string, number> = {};
          for (const inv of invoices) {
            const match = inv.invoiceNo.match(/INV-(\d{4})-(\d+)/);
            if (match) {
              const fy = match[1];
              const seq = parseInt(match[2], 10);
              invoiceCounters[fy] = Math.max(invoiceCounters[fy] ?? 0, seq);
            }
          }

          const s = get();

          set({
            orgId,
            isInitialized: true,
            businessProfile,
            customers,
            customerSeq,
            invoices,
            invoiceCounters,
            paymentReceipts,
            receiptSeq,
            packagingEntries,
            productionLogs,
            ...stockData,
            priceList:
              Object.keys(dbPriceList).length > 0 ? dbPriceList : s.priceList,
            reorderLevels: {
              raw: { ...s.reorderLevels.raw, ...dbReorderLevels.raw },
              packaging: {
                ...s.reorderLevels.packaging,
                ...dbReorderLevels.packaging,
              },
              ready: { ...s.reorderLevels.ready, ...dbReorderLevels.ready },
            },
            expenses,
            currentPage: get().isInitialized ? get().currentPage : (businessProfile ? 'dashboard' : 'setup'),
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
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
        });
      },

      // ─── Business ────────────────────────────────────────────────────

      setBusinessProfile(profile) {
        set({ businessProfile: profile, currentPage: 'dashboard' });
        const { orgId } = get();
        if (orgId) db.saveBusinessProfile(orgId, profile).catch(console.error);
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
        set({ currentOrder: null, currentPage: 'new-order' });
      },

      setOrderCustomer(customerId) {
        set(s => ({
          currentOrder: {
            customerId,
            items: s.currentOrder?.items ?? [],
            paymentMode: 'Cash',
          },
        }));
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
        set({ currentOrder: null });
      },

      // ─── Invoice Generation ───────────────────────────────────────────

      generateInvoice(saleDate?: string) {
        const s = get();
        const { currentOrder, businessProfile, invoiceCounters, customers } = s;
        if (!currentOrder || !businessProfile) return null;

        const customer = customers.find(c => c.id === currentOrder.customerId);
        if (!customer) return null;

        // Use saleDate if provided (YYYY-MM-DD), otherwise use today
        const invoiceDateObj = saleDate
          ? (() => { const [y, m, d] = saleDate.split('-').map(Number); return new Date(y, m - 1, d); })()
          : new Date();
        const fy = getFYFromDate(invoiceDateObj);
        const seq = (invoiceCounters[fy] ?? 0) + 1;
        const invoiceNo = `INV-${fy}-${String(seq).padStart(3, '0')}`;
        const inter = isInterState(businessProfile.state, customer.state);
        const gstEnabled = currentOrder.gstEnabled ?? businessProfile.gstEnabled ?? false;
        const now = new Date();

        const items: OrderItem[] = currentOrder.items.map(cartItem => {
          const sku = PRODUCTS.find(p => p.id === cartItem.skuId)!;
          const taxableValue = cartItem.quantity * cartItem.rate;
          const raw = gstEnabled ? calcGST(taxableValue, sku.gstRate, inter) : { cgst: 0, sgst: 0, igst: 0 };
          const { cgst, sgst, igst } = raw;
          return {
            ...cartItem,
            product: sku.product,
            variant: sku.variant,
            weight: sku.weight,
            hsnCode: sku.hsnCode,
            gstRate: sku.gstRate,
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

        const beforeRound = preDiscount - discountAmount;
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
          discountType:   discountType ?? undefined,
          discountValue:  discountValue > 0 ? discountValue : undefined,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
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
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);

        for (const item of items) {
          const sku = PRODUCTS.find(p => p.id === item.skuId)!;
          const skuName = `${sku.product} – ${sku.variant}`;
          const prevReady = newReady[item.skuId] ?? 0;
          newReady[item.skuId] = Math.max(0, prevReady - item.quantity);
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

        set({
          invoices: [...s.invoices, invoice],
          invoiceCounters: { ...s.invoiceCounters, [fy]: seq },
          readyStock: newReady,
          readyStockTransactions: [...s.readyStockTransactions, ...newReadyTxns],
          currentOrder: null,
          currentPage: 'invoice-view',
          selectedInvoiceId: invoice.id,
        });

        const { orgId } = get();
        if (orgId) {
          db.saveInvoice(orgId, invoice, items, newReadyTxns, newReady)
            .catch((err) => {
              // Revert the invoice counter so the next attempt reuses the same sequence number.
              set(cur => ({
                invoiceCounters: { ...cur.invoiceCounters, [fy]: s.invoiceCounters[fy] ?? 0 },
              }));
              console.error('[saveInvoice] Failed to save invoice items:', err);
              alert(
                `Invoice ${invoiceNo} was created but could not be saved to the database.\n\n` +
                `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
                `Please note down the items and contact support, or re-create the invoice after checking your connection.`,
              );
            });
        }

        return invoice;
      },

      cancelInvoice(id) {
        set(s => ({
          invoices: s.invoices.map(inv => inv.id === id ? { ...inv, cancelled: true } : inv),
        }));
        const { orgId } = get();
        if (orgId) db.cancelInvoiceInDb(orgId, id).catch(console.error);
      },

      // ─── Payment Receipts ────────────────────────────────────────────

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
            set({ paymentReceipts: prevReceipts, receiptSeq: prevSeq });
            alert(
              `Payment ${id} was recorded locally but could NOT be saved to the database.\n\n` +
              `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
              `Please check your connection and re-enter this payment after reconnecting.`,
            );
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
            alert(
              `Packaging entry was recorded locally but could not be saved to the database.\n\n` +
              `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
              `Please check your connection and database setup, then retry.`
            );
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
            set({ productionLogs: prevLogs });
            alert(
              `Production log was recorded locally but could NOT be saved to the database.\n\n` +
              `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
              `Please check your connection and re-enter this entry after reconnecting.`,
            );
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
          db.saveReadyStockTransaction(orgId, txn).catch((err) => {
            console.error('[saveReadyStockTransaction] DB save failed:', err);
            alert(
              `Ready stock entry was recorded locally but could not be saved to the database.\n\n` +
              `Error: ${err instanceof Error ? err.message : String(err)}\n\n` +
              `Please check your connection and database setup, then retry.`
            );
          });
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
          const updatedTxns = s.readyStockTransactions.map(t =>
            t.id === txId
              ? { ...t, quantity: newQty, newStock: old.newStock + signedDelta, reason: newReason }
              : t
          );
          const newCurrentStock = Math.max(0, (s.readyStock[old.skuId] ?? 0) + signedDelta);
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
          const txn = s.readyStockTransactions.find(t => t.id === txId);
          if (!txn) return {};
          deletedSkuId = txn.skuId;
          const signedQty = txn.type === 'DEDUCT' ? txn.quantity : -txn.quantity;
          newCurrentStock = Math.max(0, (s.readyStock[txn.skuId] ?? 0) + signedQty);
          return {
            readyStockTransactions: s.readyStockTransactions.filter(t => t.id !== txId),
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
        if (orgId) db.saveExpense(orgId, amount, date, time, notes, createdBy).catch(console.error);
      },

      deleteExpense(id) {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }));
        const { orgId } = get();
        if (orgId) db.deleteExpense(id).catch(console.error);
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

      clearAllPackagingData() {
        const { orgId } = get();
        const emptyStock = Object.fromEntries(PACKAGING_MATERIALS.map(m => [m.id, 0]));
        set({ packagingEntries: [], packagingStock: emptyStock });
        if (orgId) db.clearAllPackagingData(orgId).catch(console.error);
      },
  }),
);

export type Store = AppState;
