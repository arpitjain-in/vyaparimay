// ─── Vyaparimay – Supabase Data Access Layer ─────────────────────────────────
// All DB ↔ App type conversions live here.
// snake_case (DB) ↔ camelCase (App)
// DB dates: YYYY-MM-DD  ↔  App dates: DD/MM/YYYY
// DB times: HH:MM:SS    ↔  App times: HH:MM
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
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
import { PRODUCTS, PACKAGING_MATERIALS } from '../data/products';

// ─── Date / Time helpers ──────────────────────────────────────────────────────

function toDbDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function fromDbDate(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split('T')[0].split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/** PostgreSQL time columns may come back as "HH:MM:SS" — strip seconds. */
function fromDbTime(t: string): string {
  return t.substring(0, 5);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Auth uses Supabase email OTP. RLS is disabled; a fixed org is shared.

export const FIXED_ORG_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Ensures every SKU and packaging material defined in the app's local catalog
 * exists as a row in the database.  Uses ON CONFLICT DO NOTHING so existing
 * global (org_id = null) rows are never overwritten — only genuinely missing
 * rows are inserted (with org_id = orgId so the authenticated user's RLS
 * policy allows the write).
 *
 * This is a safety net for catalog migrations that were added after the DB
 * was first seeded (e.g. the Bran 40 kg bag added in May 2026).
 */
export async function initializeCatalog(orgId: string): Promise<void> {
  // 1. Packaging materials — must be inserted before SKUs (FK dependency)
  const pkgRows = PACKAGING_MATERIALS.map((m) => ({
    id: m.id,
    org_id: orgId,
    name: m.name,
    used_for: m.usedFor,
  }));
  const { error: pkgErr } = await supabase
    .from('packaging_materials')
    .upsert(pkgRows, { onConflict: 'id', ignoreDuplicates: true });
  if (pkgErr) throw pkgErr;

  // 2. Product SKUs
  const skuRows = PRODUCTS.map((p) => ({
    id: p.id,
    org_id: orgId,
    product: p.product,
    product_id: p.productId,
    variant: p.variant,
    weight: p.weight,
    packaging_id: p.packagingId,
    hsn_code: p.hsnCode,
    gst_rate: p.gstRate,
    unit: p.unit,
  }));
  const { error: skuErr } = await supabase
    .from('product_skus')
    .upsert(skuRows, { onConflict: 'id', ignoreDuplicates: true });
  if (skuErr) throw skuErr;
}

/** Returns the authenticated user's id, or throws if no session exists. */
export async function initAuth(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error('Not authenticated');
  return session.user.id;
}

/** Signs the current user out. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Organisation ─────────────────────────────────────────────────────────────

/** Always returns the single fixed org id. */
export async function getOrCreateOrg(_userId: string): Promise<string> {
  return FIXED_ORG_ID;
}

// ─── Business Profile ─────────────────────────────────────────────────────────

export async function loadBusinessProfile(
  orgId: string,
): Promise<BusinessProfile | null> {
  const { data } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();

  if (!data) return null;
  return {
    name: data.name,
    address1: data.address1,
    address2: data.address2 ?? undefined,
    city: data.city,
    state: data.state,
    pinCode: data.pin_code,
    gstin: data.gstin,
    fssai: data.fssai,
    mobile: data.mobile,
    email: data.email ?? undefined,
    tagline: data.tagline ?? undefined,
    bankName: data.bank_name ?? undefined,
    accountNo: data.account_no ?? undefined,
    ifscCode: data.ifsc_code ?? undefined,
    upiId: data.upi_id ?? undefined,
    gstEnabled: data.gst_enabled,
  };
}

export async function saveBusinessProfile(
  orgId: string,
  profile: BusinessProfile,
): Promise<void> {
  const { error } = await supabase.from('business_profiles').upsert(
    {
      org_id: orgId,
      name: profile.name,
      address1: profile.address1,
      address2: profile.address2 ?? null,
      city: profile.city,
      state: profile.state,
      pin_code: profile.pinCode,
      gstin: profile.gstin,
      fssai: profile.fssai,
      mobile: profile.mobile,
      email: profile.email ?? null,
      tagline: profile.tagline ?? null,
      bank_name: profile.bankName ?? null,
      account_no: profile.accountNo ?? null,
      ifsc_code: profile.ifscCode ?? null,
      upi_id: profile.upiId ?? null,
      gst_enabled: profile.gstEnabled,
    },
    { onConflict: 'org_id' },
  );
  if (error) throw error;
}

// ─── Customers ────────────────────────────────────────────────────────────────

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    name: row.name as string,
    firmName: (row.firm_name as string | null) ?? undefined,
    mobile: row.mobile as string,
    alternateMobile: (row.alternate_mobile as string | null) ?? undefined,
    address1: row.address1 as string,
    address2: (row.address2 as string | null) ?? undefined,
    city: row.city as string,
    state: row.state as string,
    pinCode: (row.pin_code as string | null) ?? undefined,
    gstin: (row.gstin as string | null) ?? undefined,
    fssai: (row.fssai as string | null) ?? undefined,
    customerType: row.customer_type as Customer['customerType'],
    creditLimit: Number(row.credit_limit),
    paymentTerms: row.payment_terms as Customer['paymentTerms'],
    openingBalance: Number(row.opening_balance),
    notes: (row.notes as string | null) ?? undefined,
    createdOn: fromDbDate(row.created_on as string),
    active: row.active as boolean,
  };
}

export async function loadCustomers(
  orgId: string,
): Promise<{ customers: Customer[]; seq: number }> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', orgId)
    .order('seq', { ascending: true });
  if (error) throw error;

  const customers = (data ?? []).map(rowToCustomer);
  const seq =
    data && data.length > 0
      ? data.reduce((max, r) => Math.max(max, r.seq as number), 0)
      : 0;
  return { customers, seq };
}

export async function saveCustomer(
  orgId: string,
  customer: Customer,
  seq: number,
): Promise<void> {
  const { error } = await supabase.from('customers').upsert({
    id: customer.id,
    org_id: orgId,
    seq,
    name: customer.name,
    firm_name: customer.firmName ?? null,
    mobile: customer.mobile,
    alternate_mobile: customer.alternateMobile ?? null,
    address1: customer.address1,
    address2: customer.address2 ?? null,
    city: customer.city,
    state: customer.state,
    pin_code: customer.pinCode ?? null,
    gstin: customer.gstin ?? null,
    fssai: customer.fssai ?? null,
    customer_type: customer.customerType,
    credit_limit: customer.creditLimit,
    payment_terms: customer.paymentTerms,
    opening_balance: customer.openingBalance,
    notes: customer.notes ?? null,
    active: customer.active,
    deleted_at: customer.active ? null : new Date().toISOString(),
    created_on: toDbDate(customer.createdOn),
  }, { onConflict: 'id,org_id' });
  if (error) throw error;
}

export async function updateCustomerInDb(
  orgId: string,
  customerId: string,
  data: Partial<Customer>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.firmName !== undefined) row.firm_name = data.firmName ?? null;
  if (data.mobile !== undefined) row.mobile = data.mobile;
  if (data.alternateMobile !== undefined)
    row.alternate_mobile = data.alternateMobile ?? null;
  if (data.address1 !== undefined) row.address1 = data.address1;
  if (data.address2 !== undefined) row.address2 = data.address2 ?? null;
  if (data.city !== undefined) row.city = data.city;
  if (data.state !== undefined) row.state = data.state;
  if (data.pinCode !== undefined) row.pin_code = data.pinCode ?? null;
  if (data.gstin !== undefined) row.gstin = data.gstin ?? null;
  if (data.fssai !== undefined) row.fssai = data.fssai ?? null;
  if (data.customerType !== undefined) row.customer_type = data.customerType;
  if (data.creditLimit !== undefined) row.credit_limit = data.creditLimit;
  if (data.paymentTerms !== undefined) row.payment_terms = data.paymentTerms;
  if (data.openingBalance !== undefined)
    row.opening_balance = data.openingBalance;
  if (data.notes !== undefined) row.notes = data.notes ?? null;
  if (data.active !== undefined) {
    row.active = data.active;
    row.deleted_at = data.active ? null : new Date().toISOString();
  }

  const { error } = await supabase
    .from('customers')
    .update(row)
    .eq('id', customerId)
    .eq('org_id', orgId);
  if (error) throw error;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function rowToInvoice(row: Record<string, unknown>): Invoice {
  const rawItems = (row.invoice_items as Record<string, unknown>[]) ?? [];
  const items: OrderItem[] = rawItems.map((item) => ({
    skuId: item.sku_id as string,
    product: item.product as string,
    variant: item.variant as string,
    weight: Number(item.weight),
    hsnCode: item.hsn_code as string,
    gstRate: Number(item.gst_rate),
    quantity: Number(item.quantity),
    rate: Number(item.rate),
    taxableValue: Number(item.taxable_value),
    cgst: Number(item.cgst),
    sgst: Number(item.sgst),
    igst: Number(item.igst),
    lineTotal: Number(item.line_total),
    unit: item.unit as string,
  }));

  return {
    id: row.id as string,
    invoiceNo: row.invoice_no as string,
    invoiceDate: fromDbDate(row.invoice_date as string),
    invoiceTime: fromDbTime(row.invoice_time as string),
    customerId: row.customer_id as string,
    customerSnapshot: row.customer_snapshot as Customer,
    items,
    subtotal: Number(row.subtotal),
    cgstTotal: Number(row.cgst_total),
    sgstTotal: Number(row.sgst_total),
    igstTotal: Number(row.igst_total),
    totalGST: Number(row.total_gst),
    discountType:   (row.discount_type as Invoice['discountType']) ?? undefined,
    discountValue:  row.discount_value != null ? Number(row.discount_value) : undefined,
    discountAmount: row.discount_amount != null ? Number(row.discount_amount) : undefined,
    roundOff: Number(row.round_off),
    grandTotal: Number(row.grand_total),
    isInterState: row.is_inter_state as boolean,
    paymentMode: row.payment_mode as Invoice['paymentMode'],
    amountInWords: row.amount_in_words as string,
    financialYear: row.financial_year as string,
    cancelled: row.cancelled as boolean,
  };
}

export async function loadInvoices(orgId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('org_id', orgId)
    .order('invoice_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToInvoice);
}

export async function saveInvoice(
  orgId: string,
  invoice: Invoice,
  items: OrderItem[],
  readyStockTxns: ReadyStockTransaction[],
  newReadyStock: Record<string, number>,
): Promise<void> {
  const { error: invErr } = await supabase.from('invoices').insert({
    id: invoice.id,
    org_id: orgId,
    invoice_no: invoice.invoiceNo,
    invoice_date: toDbDate(invoice.invoiceDate),
    invoice_time: `${invoice.invoiceTime}:00`,
    customer_id: invoice.customerId,
    customer_snapshot: invoice.customerSnapshot,
    subtotal: invoice.subtotal,
    cgst_total: invoice.cgstTotal,
    sgst_total: invoice.sgstTotal,
    igst_total: invoice.igstTotal,
    total_gst: invoice.totalGST,
    discount_type:   invoice.discountType   ?? null,
    discount_value:  invoice.discountValue  ?? null,
    discount_amount: invoice.discountAmount ?? null,
    round_off: invoice.roundOff,
    grand_total: invoice.grandTotal,
    is_inter_state: invoice.isInterState,
    payment_mode: invoice.paymentMode,
    amount_in_words: invoice.amountInWords,
    financial_year: invoice.financialYear,
    cancelled: false,
  });
  if (invErr) throw invErr;

  // If any step below fails, delete the invoice header so the invoice number can
  // be reused on retry instead of hitting a unique-constraint collision.
  try {
    const itemRows = items.map((item) => ({
      invoice_id: invoice.id,
      sku_id: item.skuId,
      product: item.product,
      variant: item.variant,
      weight: item.weight,
      hsn_code: item.hsnCode,
      gst_rate: item.gstRate,
      quantity: item.quantity,
      rate: item.rate,
      taxable_value: item.taxableValue,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      line_total: item.lineTotal,
      unit: item.unit,
    }));
    const { error: itemsErr } = await supabase
      .from('invoice_items')
      .insert(itemRows);
    if (itemsErr) throw itemsErr;

    // Record ready stock deductions
    if (readyStockTxns.length > 0) {
      const txnRows = readyStockTxns.map((t) => ({
        id: t.id,
        org_id: orgId,
        date: toDbDate(t.date),
        time: `${t.time}:00`,
        sku_id: t.skuId,
        sku_name: t.skuName,
        type: t.type,
        quantity: t.quantity,
        previous_stock: t.previousStock,
        new_stock: t.newStock,
        reason: t.reason,
      }));
      const { error: txnErr } = await supabase
        .from('ready_stock_transactions')
        .insert(txnRows);
      if (txnErr) throw txnErr;
    }

    // Update ready_stock balance snapshots
    const readyStockUpserts = Object.entries(newReadyStock).map(
      ([skuId, quantity]) => ({ org_id: orgId, sku_id: skuId, quantity }),
    );
    if (readyStockUpserts.length > 0) {
      const { error: stockErr } = await supabase
        .from('ready_stock')
        .upsert(readyStockUpserts, { onConflict: 'org_id,sku_id' });
      if (stockErr) throw stockErr;
    }
  } catch (err) {
    // Remove the orphan invoice header so the invoice number is free to reuse.
    await supabase.from('invoices').delete().eq('id', invoice.id).eq('org_id', orgId);
    throw err;
  }
}

export async function cancelInvoiceInDb(
  orgId: string,
  invoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ cancelled: true, cancelled_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export async function updateInvoicePaymentModeInDb(
  orgId: string,
  invoiceId: string,
  paymentMode: 'Cash' | 'Credit',
): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ payment_mode: paymentMode })
    .eq('id', invoiceId)
    .eq('org_id', orgId);
  if (error) throw error;
}

// ─── Payment Receipts ─────────────────────────────────────────────────────────

function rowToReceipt(row: Record<string, unknown>): PaymentReceipt {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    date: fromDbDate(row.date as string),
    time: fromDbTime(row.time as string),
    amount: Number(row.amount),
    mode: row.mode as PaymentReceipt['mode'],
    referenceNo: (row.reference_no as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
  };
}

export async function loadPaymentReceipts(
  orgId: string,
): Promise<{ receipts: PaymentReceipt[]; seq: number }> {
  const { data, error } = await supabase
    .from('payment_receipts')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: false });
  if (error) throw error;

  const receipts = (data ?? []).map(rowToReceipt);
  const seq =
    data && data.length > 0
      ? data.reduce(
          (max, r) => Math.max(max, parseInt((r.id as string).replace('REC-', ''), 10) || 0),
          0,
        )
      : 0;
  return { receipts, seq };
}

export async function savePaymentReceipt(
  orgId: string,
  receipt: PaymentReceipt,
): Promise<void> {
  const { error } = await supabase.from('payment_receipts').insert({
    id: receipt.id,
    org_id: orgId,
    customer_id: receipt.customerId,
    date: toDbDate(receipt.date),
    time: `${receipt.time}:00`,
    amount: receipt.amount,
    mode: receipt.mode,
    reference_no: receipt.referenceNo ?? null,
    notes: receipt.notes ?? null,
  });
  if (error) throw error;
}

export async function updatePaymentReceiptInDb(
  orgId: string,
  receiptId: string,
  amount: number,
): Promise<void> {
  const { error } = await supabase
    .from('payment_receipts')
    .update({ amount })
    .eq('id', receiptId)
    .eq('org_id', orgId);
  if (error) throw error;
}

// ─── Packaging Entries ────────────────────────────────────────────────────────

function rowToPackagingEntry(row: Record<string, unknown>): PackagingEntry {
  return {
    id: row.id as string,
    date: fromDbDate(row.date as string),
    time: fromDbTime(row.time as string),
    materialId: row.material_id as string,
    materialName: row.material_name as string,
    entryType: row.entry_type as PackagingEntry['entryType'],
    quantity: Number(row.quantity),
    priceUnit: (row.price_unit as PackagingEntry['priceUnit'] | null) ?? undefined,
    pricePerUnit:
      row.price_per_unit != null ? Number(row.price_per_unit) : undefined,
    totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
    supplier: (row.supplier as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
  };
}

export async function loadPackagingEntries(
  orgId: string,
): Promise<PackagingEntry[]> {
  const { data, error } = await supabase
    .from('packaging_entries')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPackagingEntry);
}

export async function savePackagingEntry(
  orgId: string,
  entry: PackagingEntry,
  newStock: number,
): Promise<void> {
  const { error: entryErr } = await supabase.from('packaging_entries').insert({
    id: entry.id,
    org_id: orgId,
    date: toDbDate(entry.date),
    time: `${entry.time}:00`,
    material_id: entry.materialId,
    material_name: entry.materialName,
    entry_type: entry.entryType,
    quantity: entry.quantity,
    price_unit: entry.priceUnit ?? null,
    price_per_unit: entry.pricePerUnit ?? null,
    total_amount: entry.totalAmount ?? null,
    supplier: entry.supplier ?? null,
    notes: entry.notes ?? null,
  });
  if (entryErr) throw entryErr;

  const { error: stockErr } = await supabase
    .from('packaging_stock')
    .upsert(
      { org_id: orgId, material_id: entry.materialId, quantity: newStock },
      { onConflict: 'org_id,material_id' },
    );
  if (stockErr) throw stockErr;
}

export async function clearAllPackagingData(orgId: string): Promise<void> {
  const { error: entryErr } = await supabase
    .from('packaging_entries')
    .delete()
    .eq('org_id', orgId);
  if (entryErr) throw entryErr;

  const { error: stockErr } = await supabase
    .from('packaging_stock')
    .delete()
    .eq('org_id', orgId);
  if (stockErr) throw stockErr;
}

// ─── Production Logs ──────────────────────────────────────────────────────────

function rowToProductionLog(row: Record<string, unknown>): ProductionLog {
  return {
    id: row.id as string,
    date: fromDbDate(row.date as string),
    time: fromDbTime(row.time as string),
    productName: row.product_name as string,
    quantityProduced: Number(row.quantity_produced),
    notes: (row.notes as string | null) ?? undefined,
  };
}

export async function loadProductionLogs(
  orgId: string,
): Promise<ProductionLog[]> {
  const { data, error } = await supabase
    .from('production_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToProductionLog);
}

export async function saveProductionLog(
  orgId: string,
  log: ProductionLog,
): Promise<void> {
  const { error } = await supabase.from('production_logs').insert({
    id: log.id,
    org_id: orgId,
    date: toDbDate(log.date),
    time: `${log.time}:00`,
    product_name: log.productName,
    quantity_produced: log.quantityProduced,
    notes: log.notes ?? null,
  });
  if (error) throw error;
}

// ─── Stock Data ───────────────────────────────────────────────────────────────

function rowToStockTx(row: Record<string, unknown>): StockTransaction {
  return {
    id: row.id as string,
    type: row.type as StockTransaction['type'],
    itemType: row.item_type as StockTransaction['itemType'],
    itemId: row.item_id as string,
    itemName: row.item_name as string,
    quantity: Number(row.quantity),
    previousStock: Number(row.previous_stock),
    newStock: Number(row.new_stock),
    reason: row.reason as string,
    supplierName: (row.supplier_name as string | null) ?? undefined,
    invoiceNo: (row.invoice_no as string | null) ?? undefined,
    date: fromDbDate(row.date as string),
    time: fromDbTime(row.time as string),
  };
}

function rowToReadyStockTx(row: Record<string, unknown>): ReadyStockTransaction {
  return {
    id: row.id as string,
    date: fromDbDate(row.date as string),
    time: fromDbTime(row.time as string),
    skuId: row.sku_id as string,
    skuName: row.sku_name as string,
    type: row.type as ReadyStockTransaction['type'],
    quantity: Number(row.quantity),
    previousStock: Number(row.previous_stock),
    newStock: Number(row.new_stock),
    reason: row.reason as string,
  };
}

export async function loadStockData(orgId: string): Promise<{
  rawMaterialStock: Record<string, number>;
  packagingStock: Record<string, number>;
  readyStock: Record<string, number>;
  stockTransactions: StockTransaction[];
  readyStockTransactions: ReadyStockTransaction[];
}> {
  const [rawRes, pkgRes, readyRes, stockTxRes, readyTxRes] = await Promise.all([
    supabase.from('raw_material_stock').select('*').eq('org_id', orgId),
    supabase.from('packaging_stock').select('*').eq('org_id', orgId),
    supabase.from('ready_stock').select('*').eq('org_id', orgId),
    supabase
      .from('stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('date', { ascending: false }),
    supabase
      .from('ready_stock_transactions')
      .select('*')
      .eq('org_id', orgId)
      .order('date', { ascending: false }),
  ]);

  const rawMaterialStock: Record<string, number> = {};
  for (const r of rawRes.data ?? []) {
    rawMaterialStock[r.material_id as string] = Number(r.quantity);
  }

  const packagingStock: Record<string, number> = {};
  for (const r of pkgRes.data ?? []) {
    packagingStock[r.material_id as string] = Number(r.quantity);
  }

  const readyStock: Record<string, number> = {};
  for (const r of readyRes.data ?? []) {
    readyStock[r.sku_id as string] = Number(r.quantity);
  }

  const stockTransactions = (stockTxRes.data ?? []).map(rowToStockTx);
  const readyStockTransactions = (readyTxRes.data ?? []).map(rowToReadyStockTx);

  return {
    rawMaterialStock,
    packagingStock,
    readyStock,
    stockTransactions,
    readyStockTransactions,
  };
}

export async function saveStockTransaction(
  orgId: string,
  txn: StockTransaction,
  newStockQty: number,
): Promise<void> {
  const { error: txErr } = await supabase.from('stock_transactions').insert({
    id: txn.id,
    org_id: orgId,
    type: txn.type,
    item_type: txn.itemType,
    item_id: txn.itemId,
    item_name: txn.itemName,
    quantity: txn.quantity,
    previous_stock: txn.previousStock,
    new_stock: txn.newStock,
    reason: txn.reason,
    supplier_name: txn.supplierName ?? null,
    invoice_no: txn.invoiceNo ?? null,
    date: toDbDate(txn.date),
    time: `${txn.time}:00`,
  });
  if (txErr) throw txErr;

  const stockTable =
    txn.itemType === 'raw' ? 'raw_material_stock' : 'packaging_stock';
  const idCol = txn.itemType === 'raw' ? 'material_id' : 'material_id';
  const { error: stockErr } = await supabase
    .from(stockTable)
    .upsert(
      { org_id: orgId, [idCol]: txn.itemId, quantity: newStockQty },
      { onConflict: `org_id,${idCol}` },
    );
  if (stockErr) throw stockErr;
}

export async function saveReadyStockTransaction(
  orgId: string,
  txn: ReadyStockTransaction,
): Promise<void> {
  const { error: txErr } = await supabase
    .from('ready_stock_transactions')
    .insert({
      id: txn.id,
      org_id: orgId,
      date: toDbDate(txn.date),
      time: `${txn.time}:00`,
      sku_id: txn.skuId,
      sku_name: txn.skuName,
      type: txn.type,
      quantity: txn.quantity,
      previous_stock: txn.previousStock,
      new_stock: txn.newStock,
      reason: txn.reason ?? null,
    });
  if (txErr) throw txErr;

  const { error: stockErr } = await supabase
    .from('ready_stock')
    .upsert(
      { org_id: orgId, sku_id: txn.skuId, quantity: txn.newStock },
      { onConflict: 'org_id,sku_id' },
    );
  if (stockErr) throw stockErr;
}

export async function updateReadyStockTransactionInDb(
  orgId: string,
  txn: ReadyStockTransaction,
): Promise<void> {
  const { error: txErr } = await supabase
    .from('ready_stock_transactions')
    .update({
      quantity: txn.quantity,
      new_stock: txn.newStock,
      reason: txn.reason ?? null,
    })
    .eq('id', txn.id)
    .eq('org_id', orgId);
  if (txErr) throw txErr;

  const { error: stockErr } = await supabase
    .from('ready_stock')
    .upsert(
      { org_id: orgId, sku_id: txn.skuId, quantity: txn.newStock },
      { onConflict: 'org_id,sku_id' },
    );
  if (stockErr) throw stockErr;
}

export async function deleteReadyStockTransactionInDb(
  orgId: string,
  txnId: string,
  skuId: string,
  newCurrentStock: number,
): Promise<void> {
  const { error: txErr } = await supabase
    .from('ready_stock_transactions')
    .delete()
    .eq('id', txnId)
    .eq('org_id', orgId);
  if (txErr) throw txErr;

  const { error: stockErr } = await supabase
    .from('ready_stock')
    .upsert(
      { org_id: orgId, sku_id: skuId, quantity: newCurrentStock },
      { onConflict: 'org_id,sku_id' },
    );
  if (stockErr) throw stockErr;
}

// ─── Price List ───────────────────────────────────────────────────────────────

export async function loadPriceList(
  orgId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('price_list')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const r of data ?? []) result[r.sku_id as string] = Number(r.rate);
  return result;
}

export async function savePrice(
  orgId: string,
  skuId: string,
  rate: number,
): Promise<void> {
  const { error } = await supabase
    .from('price_list')
    .upsert(
      { org_id: orgId, sku_id: skuId, rate },
      { onConflict: 'org_id,sku_id' },
    );
  if (error) throw error;
}

// ─── Reorder Levels ───────────────────────────────────────────────────────────

export async function loadReorderLevels(orgId: string): Promise<{
  raw: Record<string, number>;
  packaging: Record<string, number>;
  ready: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('reorder_levels')
    .select('*')
    .eq('org_id', orgId);
  if (error) throw error;

  const result = {
    raw: {} as Record<string, number>,
    packaging: {} as Record<string, number>,
    ready: {} as Record<string, number>,
  };
  for (const r of data ?? []) {
    const cat = r.category as 'raw' | 'packaging' | 'ready';
    result[cat][r.item_id as string] = Number(r.level);
  }
  return result;
}

export async function saveReorderLevel(
  orgId: string,
  category: 'raw' | 'packaging' | 'ready',
  itemId: string,
  level: number,
): Promise<void> {
  const { error } = await supabase
    .from('reorder_levels')
    .upsert(
      { org_id: orgId, category, item_id: itemId, level },
      { onConflict: 'org_id,category,item_id' },
    );
  if (error) throw error;
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export async function loadExpenses(orgId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('org_id', orgId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    amount: Number(r.amount),
    date: fromDbDate(r.date as string),
    time: fromDbTime(r.time as string),
    notes: (r.notes as string) ?? '',
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
  }));
}

export async function saveExpense(
  orgId: string,
  id: string,
  amount: number,
  date: string,
  time: string,
  notes: string,
  createdBy: string,
): Promise<void> {
  const { error } = await supabase.from('expenses').insert({
    id,
    org_id: orgId,
    amount,
    date: toDbDate(date),
    time: `${time}:00`,
    notes,
    created_by: createdBy,
  });
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
