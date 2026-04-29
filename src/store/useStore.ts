import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppPage, BusinessProfile, CartItem, CurrentOrder,
  Customer, Invoice, OrderItem, StockTransaction,
  PackagingEntry, ProductionLog, PaymentReceipt,
} from '../types';
import { PACKAGING_MATERIALS, PRODUCTS, DEFAULT_PRICES, getRawMaterialId, RAW_MATERIALS } from '../data/products';
import { isInterState, calcGST } from '../utils/gst';
import { numberToWords } from '../utils/numberToWords';
import { formatDate, formatTime, getCurrentFY } from '../utils/format';

// ─── State shape ─────────────────────────────────────────────────────────────

interface AppState {
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
  rawMaterialStock: Record<string, number>;     // RM-WF -> kg (bulk flour)
  packagingStock: Record<string, number>;        // PKG-* -> current unit balance
  packagingEntries: PackagingEntry[];           // full purchase/used/damaged ledger
  productionLogs: ProductionLog[];              // standalone daily production records
  stockTransactions: StockTransaction[];         // bulk flour adjustments
  reorderLevels: {
    raw: Record<string, number>;
    packaging: Record<string, number>;
  };

  // Pricing
  priceList: Record<string, number>; // skuId -> rate

  // ─── Actions ───────────────────────────────────────────────────────

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
  upsertCartItem(skuId: string, quantity: number, rate: number): void;
  removeCartItem(skuId: string): void;
  clearOrder(): void;

  // Invoice
  generateInvoice(): Invoice | null;
  cancelInvoice(id: string): void;

  // Payments
  addPaymentReceipt(data: Omit<PaymentReceipt, 'id' | 'time'>): void;

  // Stock
  addPackagingEntry(entry: Omit<PackagingEntry, 'id' | 'time'>): void;
  addProductionLog(log: Omit<ProductionLog, 'id' | 'time'>): void;
  adjustStock(type: 'raw' | 'packaging', id: string, qty: number, reason: string): void;
  setReorderLevel(type: 'raw' | 'packaging', id: string, level: number): void;

  // Pricing
  updatePrice(skuId: string, rate: number): void;

  // Computed helpers (not persisted)
  getCustomerInvoices(customerId: string): Invoice[];
  getStockStatus(type: 'raw' | 'packaging', id: string): 'adequate' | 'low' | 'out';
}

// ─── Initial stock maps ───────────────────────────────────────────────────────

const initRaw: Record<string, number> = { 'RM-WF': 0, 'RM-BS': 0, 'RM-DL': 0, 'RM-BR': 0 };
const initPkg: Record<string, number> = Object.fromEntries(
  PACKAGING_MATERIALS.map(p => [p.id, 0])
);
const initReorder = {
  raw:       { 'RM-WF': 0, 'RM-BS': 0, 'RM-DL': 0 },
  packaging: Object.fromEntries(PACKAGING_MATERIALS.map(p => [p.id, 0])),
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      reorderLevels: initReorder,

      // Pricing
      priceList: { ...DEFAULT_PRICES },

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
        return id;
      },

      updateCustomer(id, data) {
        set(s => ({
          customers: s.customers.map(c => (c.id === id ? { ...c, ...data } : c)),
        }));
      },

      deactivateCustomer(id) {
        set(s => ({
          customers: s.customers.map(c => (c.id === id ? { ...c, active: false } : c)),
        }));
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

      generateInvoice() {
        const s = get();
        const { currentOrder, businessProfile, invoiceCounters, customers } = s;
        if (!currentOrder || !businessProfile) return null;

        const customer = customers.find(c => c.id === currentOrder.customerId);
        if (!customer) return null;

        const fy = getCurrentFY();
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
        const beforeRound = subtotal + totalGST;
        const grandTotal  = Math.round(beforeRound);
        const roundOff    = parseFloat((grandTotal - beforeRound).toFixed(2));

        const invoice: Invoice = {
          id: `INV-${Date.now()}`,
          invoiceNo,
          invoiceDate: formatDate(now),
          invoiceTime: formatTime(now),
          customerId: customer.id,
          customerSnapshot: { ...customer },
          items,
          subtotal,
          cgstTotal,
          sgstTotal,
          igstTotal,
          totalGST,
          roundOff,
          grandTotal,
          isInterState: inter,
          paymentMode: currentOrder.paymentMode,
          amountInWords: numberToWords(grandTotal),
          financialYear: fy,
          cancelled: false,
        };

        // Deduct stock
        const newRaw = { ...s.rawMaterialStock };
        const newPkg = { ...s.packagingStock };
        const newTxns: StockTransaction[] = [...s.stockTransactions];
        const newPkgEntries: PackagingEntry[] = [...s.packagingEntries];
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);

        for (const item of items) {
          const sku = PRODUCTS.find(p => p.id === item.skuId)!;
          const rawId = getRawMaterialId(sku.productId);
          const rawQty = item.weight * item.quantity;
          const prevRaw = newRaw[rawId] ?? 0;
          newRaw[rawId] = Math.max(0, prevRaw - rawQty);
          newTxns.push({
            id: `TXN-${Date.now()}-R-${rawId}`,
            type: 'DEDUCT', itemType: 'raw', itemId: rawId,
            itemName: `${sku.product} (Bulk)`,
            quantity: rawQty, previousStock: prevRaw, newStock: newRaw[rawId],
            reason: `Sale – ${invoiceNo}`, invoiceNo, date: dateStr, time: timeStr,
          });

          const pkgId = sku.packagingId;
          const prevPkg = newPkg[pkgId] ?? 0;
          newPkg[pkgId] = Math.max(0, prevPkg - item.quantity);
          const pkgName = PACKAGING_MATERIALS.find(p => p.id === pkgId)?.name ?? pkgId;
          newTxns.push({
            id: `TXN-${Date.now()}-P-${pkgId}`,
            type: 'DEDUCT', itemType: 'packaging', itemId: pkgId,
            itemName: pkgName,
            quantity: item.quantity, previousStock: prevPkg, newStock: newPkg[pkgId],
            reason: `Sale – ${invoiceNo}`, invoiceNo, date: dateStr, time: timeStr,
          });

          // Auto-log packaging usage in the packaging ledger
          newPkgEntries.push({
            id: `PKG-E-${Date.now()}-${pkgId}`,
            date: dateStr, time: timeStr,
            materialId: pkgId, materialName: pkgName,
            entryType: 'used',
            quantity: item.quantity,
            notes: `Auto – ${invoiceNo}`,
          });
        }

        set({
          invoices: [...s.invoices, invoice],
          invoiceCounters: { ...s.invoiceCounters, [fy]: seq },
          rawMaterialStock: newRaw,
          packagingStock: newPkg,
          packagingEntries: newPkgEntries,
          stockTransactions: newTxns,
          currentOrder: null,
          currentPage: 'invoice-view',
          selectedInvoiceId: invoice.id,
        });

        return invoice;
      },

      cancelInvoice(id) {
        set(s => ({
          invoices: s.invoices.map(inv => inv.id === id ? { ...inv, cancelled: true } : inv),
        }));
      },

      // ─── Payment Receipts ────────────────────────────────────────────

      addPaymentReceipt(data) {
        const seq = get().receiptSeq + 1;
        const id = `REC-${String(seq).padStart(4, '0')}`;
        const rec: PaymentReceipt = { ...data, id, time: formatTime(new Date()) };
        set(s => ({
          paymentReceipts: [...s.paymentReceipts, rec],
          receiptSeq: seq,
        }));
      },

      // ─── Stock ───────────────────────────────────────────────────────

      addPackagingEntry(entry) {
        const now = new Date();
        const id = `PKG-E-${Date.now()}`;
        const rec: PackagingEntry = { ...entry, id, time: formatTime(now) };
        set(s => {
          const prev = s.packagingStock[entry.materialId] ?? 0;
          let newStock = prev;
          if (entry.entryType === 'purchase') newStock = prev + entry.quantity;
          else newStock = Math.max(0, prev - entry.quantity);
          return {
            packagingEntries: [...s.packagingEntries, rec],
            packagingStock: { ...s.packagingStock, [entry.materialId]: newStock },
          };
        });
      },

      addProductionLog(log) {
        const now = new Date();
        const rec: ProductionLog = { ...log, id: `PLOG-${Date.now()}`, time: formatTime(now) };
        set(s => ({ productionLogs: [...s.productionLogs, rec] }));
      },

      adjustStock(type, id, qty, reason) {
        const now = new Date();
        set(s => {
          if (type === 'raw') {
            const prev = s.rawMaterialStock[id] ?? 0;
            const newStock = Math.max(0, prev + qty);
            const txn: StockTransaction = {
              id: `TXN-${Date.now()}`,
              type: qty >= 0 ? 'ADD' : 'ADJUST', itemType: 'raw', itemId: id,
              itemName: id,
              quantity: Math.abs(qty), previousStock: prev, newStock,
              reason, date: formatDate(now), time: formatTime(now),
            };
            return {
              rawMaterialStock: { ...s.rawMaterialStock, [id]: newStock },
              stockTransactions: [...s.stockTransactions, txn],
            };
          } else {
            const prev = s.packagingStock[id] ?? 0;
            const newStock = Math.max(0, prev + qty);
            const pkgName = PACKAGING_MATERIALS.find(p => p.id === id)?.name ?? id;
            const txn: StockTransaction = {
              id: `TXN-${Date.now()}`,
              type: qty >= 0 ? 'ADD' : 'ADJUST', itemType: 'packaging', itemId: id,
              itemName: pkgName,
              quantity: Math.abs(qty), previousStock: prev, newStock,
              reason, date: formatDate(now), time: formatTime(now),
            };
            return {
              packagingStock: { ...s.packagingStock, [id]: newStock },
              stockTransactions: [...s.stockTransactions, txn],
            };
          }
        });
      },

      setReorderLevel(type, id, level) {
        set(s => ({
          reorderLevels: {
            ...s.reorderLevels,
            [type]: { ...(s.reorderLevels as Record<string, Record<string, number>>)[type], [id]: level },
          },
        }));
      },

      // ─── Pricing ─────────────────────────────────────────────────────

      updatePrice(skuId, rate) {
        set(s => ({ priceList: { ...s.priceList, [skuId]: rate } }));
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
    }),
    { name: 'vyaparimay-v1' },
  ),
);

export type Store = AppState;
