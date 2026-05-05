// ─── Business Profile ──────────────────────────────────────────────────────
export interface BusinessProfile {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pinCode: string;
  gstin: string;
  fssai: string;
  mobile: string;
  email?: string;
  tagline?: string;
  bankName?: string;
  accountNo?: string;
  ifscCode?: string;
  upiId?: string;
  gstEnabled: boolean;
}

// ─── Customer ──────────────────────────────────────────────────────────────
export type CustomerType = 'Retailer' | 'Wholesaler' | 'Distributor' | 'Direct Consumer';
export type PaymentTerms = 'Cash' | '7 Days' | '15 Days' | '30 Days';

export interface Customer {
  id: string;           // CUST-001
  name: string;
  firmName?: string;
  mobile: string;
  alternateMobile?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  pinCode?: string;
  gstin?: string;
  fssai?: string;
  customerType: CustomerType;
  creditLimit: number;
  paymentTerms: PaymentTerms;
  openingBalance: number;  // outstanding, if any
  notes?: string;
  createdOn: string;        // DD/MM/YYYY
  active: boolean;
}

// ─── Product Catalogue ────────────────────────────────────────────────────
export interface ProductSKU {
  id: string;           // 'WF-26K'
  product: string;      // 'Shikharji Atta'
  productId: string;    // 'WF' | 'BS' | 'DL'
  variant: string;      // '26 kg Bag'
  weight: number;       // kg per unit
  packagingId: string;  // references PackagingMaterial
  hsnCode: string;
  gstRate: number;      // 5
  unit: string;         // 'Bag' | 'Pouch' | 'Packet'
}

export interface PackagingMaterial {
  id: string;
  name: string;
  usedFor: string[];    // skuId list
}

export interface RawMaterialDef {
  id: string;   // 'RM-WF'
  name: string; // 'Shikharji Atta'
  products: string[]; // skuIds
}

// ─── Packaging Entry ─────────────────────────────────────────────────────
// Tracks purchases, usage, and damage for each packaging material
export type PackagingEntryType = 'purchase' | 'used' | 'damaged';

export interface PackagingEntry {
  id: string;
  date: string;          // DD/MM/YYYY
  time: string;          // HH:MM
  materialId: string;    // PKG-*
  materialName: string;
  entryType: PackagingEntryType;
  quantity: number;      // pieces (or kg for purchase if priceUnit='kg')
  // Purchase-only fields
  priceUnit?: 'piece' | 'kg'; // how price is quoted
  pricePerUnit?: number; // ₹ per piece or ₹ per kg
  totalAmount?: number;  // pricePerUnit × quantity
  supplier?: string;
  notes?: string;
}

// ─── Production Log ───────────────────────────────────────────────────────
// Standalone daily production tracking (no linkage to stock)
export interface ProductionLog {
  id: string;
  date: string;          // DD/MM/YYYY
  time: string;          // HH:MM
  productName: string;   // 'Shikharji Atta' | 'Shikharji Besan' | 'Shikharji Dalia'
  quantityProduced: number; // kg
  notes?: string;
}

// ─── Cart / Order ─────────────────────────────────────────────────────────
export interface CartItem {
  skuId: string;
  quantity: number;
  rate: number;
}

export interface CurrentOrder {
  customerId: string;
  items: CartItem[];
  paymentMode: 'Cash' | 'Credit';
  notes?: string;
  gstEnabled?: boolean;
}

// ─── Invoice ──────────────────────────────────────────────────────────────
export interface OrderItem extends CartItem {
  product: string;
  variant: string;
  weight: number;
  hsnCode: string;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
  unit: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;  // DD/MM/YYYY
  invoiceTime: string;  // HH:MM
  customerId: string;
  customerSnapshot: Customer;
  items: OrderItem[];
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalGST: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
  paymentMode: 'Cash' | 'Credit';
  amountInWords: string;
  financialYear: string;  // '2627'
  cancelled: boolean;
}

// ─── Payment Receipts ─────────────────────────────────────────────────────
export type PaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque';

export interface PaymentReceipt {
  id: string;           // REC-001
  customerId: string;
  date: string;         // DD/MM/YYYY
  time: string;         // HH:MM
  amount: number;
  mode: PaymentMode;
  referenceNo?: string; // cheque no / UTR / UPI ref
  notes?: string;
}

// ─── Stock ────────────────────────────────────────────────────────────────
export interface StockTransaction {
  id: string;
  type: 'ADD' | 'DEDUCT' | 'ADJUST';
  itemType: 'raw' | 'packaging';
  itemId: string;
  itemName: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  supplierName?: string;
  invoiceNo?: string;
  date: string;
  time: string;
}

export type StockStatus = 'adequate' | 'low' | 'out';

// ─── Ready Stock ──────────────────────────────────────────────────────────
// Tracks packed/ready-to-sell units per SKU
export interface ReadyStockTransaction {
  id: string;
  date: string;      // DD/MM/YYYY
  time: string;      // HH:MM
  skuId: string;
  skuName: string;   // e.g. "Shikharji Atta – 26 kg Bag"
  type: 'ADD' | 'DEDUCT' | 'ADJUST';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  invoiceNo?: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────
export type AppPage =
  | 'setup'
  | 'dashboard'
  | 'customer-list'
  | 'customer-form'
  | 'customer-ledger'
  | 'new-order'
  | 'invoice-history'
  | 'invoice-view'
  | 'stock-dashboard'
  | 'ready-stock'
  | 'packaging-stock'
  | 'add-stock'
  | 'production-entry'
  | 'price-list';
