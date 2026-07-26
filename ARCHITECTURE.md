# Millbook — Complete Technical Reference

> **Flour Mill Management System** for Shikharji Foods  
> Stack: React 18 · TypeScript · Zustand · Supabase (PostgreSQL) · Tailwind CSS · Vite

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Environment](#2-technology-stack--environment)
3. [Repository Structure](#3-repository-structure)
4. [Authentication](#4-authentication)
5. [Navigation System](#5-navigation-system)
6. [Global State — Zustand Store](#6-global-state--zustand-store)
7. [Database — Full Schema Reference](#7-database--full-schema-reference)
8. [Data Access Layer (db.ts)](#8-data-access-layer-dbts)
9. [Product Catalog & Static Data](#9-product-catalog--static-data)
10. [Pages & Features — Detailed Breakdown](#10-pages--features--detailed-breakdown)
    - 10.1 [Business Setup](#101-business-setup)
    - 10.2 [Dashboard](#102-dashboard)
    - 10.3 [Customer Management](#103-customer-management)
    - 10.4 [New Order (3-Step Flow)](#104-new-order-3-step-flow)
    - 10.5 [Invoice History & Invoice View](#105-invoice-history--invoice-view)
    - 10.6 [Customer Ledger](#106-customer-ledger)
    - 10.7 [Ready Stock](#107-ready-stock)
    - 10.8 [Packaging Inventory](#108-packaging-inventory)
    - 10.9 [Raw Material / Bulk Stock (Add Stock)](#109-raw-material--bulk-stock-add-stock)
    - 10.10 [Production Entry](#1010-production-entry)
    - 10.11 [Price List](#1011-price-list)
    - 10.12 [Reports](#1012-reports)
11. [Cross-Feature Data Flows](#11-cross-feature-data-flows)
    - 11.1 [New Order → Ready Stock](#111-new-order--ready-stock)
    - 11.2 [Ready Stock → Packaging Inventory](#112-ready-stock--packaging-inventory)
    - 11.3 [Ledger Maintenance](#113-ledger-maintenance)
12. [Utility Functions](#12-utility-functions)
13. [GST Calculation Logic](#13-gst-calculation-logic)
14. [Invoice Printing](#14-invoice-printing)
15. [Form Fields — Mandatory vs Optional](#15-form-fields--mandatory-vs-optional)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Demo Mode](#17-demo-mode)
18. [Unit Test Coverage](#18-unit-test-coverage)
19. [Database Migrations History](#19-database-migrations-history)
20. [Security Notes](#20-security-notes)

---

## 1. Project Overview

Millbook is a single-page web application (SPA) designed for flour mill businesses. It covers:

- **Customer Management** — CRM with opening balances and payment terms
- **Order & Invoicing** — GST-compliant (CGST/SGST/IGST), 80mm thermal + A4 print
- **Inventory** — Ready stock (finished SKUs) + Packaging materials + Raw material + Production logs
- **Ledger** — Per-customer account statement with running balance
- **Reports** — Sales, inventory, production analytics with PDF export

All data is scoped to a single, fixed organisation (`FIXED_ORG_ID = 00000000-0000-0000-0000-000000000001`). RLS (Row Level Security) on Supabase is intentionally simplified — a fixed org is shared across all authenticated users of the app.

---

## 2. Technology Stack & Environment

| Layer | Library / Service | Notes |
|---|---|---|
| UI Framework | React 18 | Functional components, hooks only |
| Language | TypeScript 5 | Strict mode |
| State Management | Zustand 4 | Single store, no middleware |
| Backend / DB | Supabase (PostgreSQL 15) | Auth OTP + REST |
| Styling | Tailwind CSS 3 | JIT mode |
| Build Tool | Vite 5 | HMR in dev |
| Icon Library | Lucide React | |
| Date Handling | Native JS Date | No third-party date lib |
| Testing | Vitest + jsdom | Unit only (no E2E in CI) |
| Deployment | Vercel | SPA redirects via `vercel.json` |

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (prod) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon public key |
| `VITE_DEMO_MODE` | Optional | `"true"` activates demo/offline mode |
| `VITE_INVOICE_DELETE_PASSWORD` | Yes | 4-digit PIN for destructive ops |

In **demo mode** (`VITE_DEMO_MODE=true`), the Supabase client is pointed at `http://127.0.0.1:0` (non-routable) — all DB calls fail immediately without touching production. The demo DB layer (`db.demo.ts`) provides in-memory implementations.

---

## 3. Repository Structure

```
src/
├── App.tsx                     # Root: auth guard + page router
├── main.tsx                    # React DOM mount
├── index.css                   # Tailwind base
├── vite-env.d.ts               # Vite env type declarations
│
├── types/index.ts              # ALL TypeScript interfaces/types
├── data/products.ts            # Static product catalog + defaults
│
├── lib/
│   ├── supabase.ts             # Supabase client singleton
│   ├── db.ts                   # Real DB access layer (snake_case ↔ camelCase)
│   └── db.demo.ts              # In-memory demo DB layer
│
├── store/useStore.ts           # Zustand global store + all actions
│
├── utils/
│   ├── format.ts               # Date/time/currency formatting
│   ├── gst.ts                  # GST calculation (CGST/SGST/IGST)
│   ├── invoice.ts              # Thermal + A4 invoice builders
│   └── numberToWords.ts        # Indian number → words (for invoice)
│
├── components/
│   ├── Auth/AuthPage.tsx       # Email OTP login UI
│   ├── Business/BusinessSetup.tsx
│   ├── common/
│   │   ├── AddPaymentModal.tsx
│   │   ├── DemoBanner.tsx
│   │   └── Modal.tsx
│   ├── Customers/
│   │   ├── CustomerForm.tsx
│   │   ├── CustomerLedger.tsx
│   │   └── CustomerList.tsx
│   ├── Dashboard/Dashboard.tsx
│   ├── Inventory/
│   │   ├── AddStock.tsx
│   │   ├── PackagingStockPage.tsx
│   │   ├── ProductionEntry.tsx
│   │   ├── ReadyStockPage.tsx
│   │   └── StockDashboard.tsx
│   ├── Invoices/
│   │   ├── DeletePasswordModal.tsx
│   │   ├── InvoiceHistory.tsx
│   │   └── InvoiceView.tsx
│   ├── Layout/
│   │   ├── Layout.tsx          # Shell with sidebar slot
│   │   └── Sidebar.tsx         # Navigation sidebar
│   ├── Orders/NewOrder.tsx
│   ├── Pricing/PriceList.tsx
│   └── Reports/ReportsPage.tsx
│
└── test/
    ├── setup.ts
    ├── db/db.demo.test.ts
    ├── e2e/flows.test.ts
    ├── store/
    │   ├── customers.test.ts
    │   ├── inventory.test.ts
    │   ├── invoice.test.ts
    │   ├── order.test.ts
    │   └── payments.test.ts
    └── utils/
        ├── format.test.ts
        ├── gst.test.ts
        └── numberToWords.test.ts

supabase/
├── DATABASE.md
├── seed.sql
└── migrations/                 # Versioned PostgreSQL migrations
```

---

## 4. Authentication

### Mechanism: Supabase Email OTP (Magic OTP)

Authentication is handled entirely by Supabase. The flow is password-less:

```
User → enters email → Supabase sends 6-digit OTP → User enters OTP → Supabase session established → App initialises
```

### Auth Flow Steps

1. **`App.tsx`** mounts and calls `supabase.auth.getSession()` to check for an existing session.
2. Subscribes to `supabase.auth.onAuthStateChange` to reactively track sign-in/sign-out.
3. If no session exists (and not demo mode), renders **`AuthPage`** component.
4. `AuthPage` presents a 3-step UI:
   - **Step `email`**: User enters email, clicks "Send OTP". Calls `supabase.auth.signInWithOtp()` with `shouldCreateUser: true` (auto-creates account on first login).
   - **Step `otp`**: User enters 8-digit code (Supabase uses 8-char tokens for email OTP). Calls `supabase.auth.verifyOtp()` with type `'email'`.
   - **Step `success`**: Success screen; the `onAuthStateChange` listener fires and updates session.
5. On successful OTP, `session` state updates → `useEffect` triggers `initializeApp()`.
6. On sign-out, store is reset: `isInitialized: false`, `orgId: null`, `businessProfile: null`.

### Error Handling in Auth

All Supabase auth errors are passed through `friendlyError(err)` which maps:
- SMTP/delivery errors → explains SMTP configuration steps
- OTP/token errors → "Invalid or expired code. Codes expire after 10 minutes"
- Rate limit errors → "Too many attempts. Wait a few minutes."
- All others → raw error message

### Resend OTP

60-second countdown timer before "Resend" is allowed. Timer uses `setInterval` cleaned up on component unmount.

### Organisation (Tenant) Model

Despite having full multi-tenant schema, the app uses a **fixed org ID**:
```typescript
export const FIXED_ORG_ID = '00000000-0000-0000-0000-000000000001';
```
`getOrCreateOrg()` always returns this ID regardless of which user logs in.

---

## 5. Navigation System

### How Navigation Works

Navigation is entirely **client-side** via Zustand store state — no URL routing, no React Router.

```typescript
// AppPage union type (all possible pages):
type AppPage =
  | 'setup' | 'dashboard' | 'customer-list' | 'customer-form'
  | 'customer-ledger' | 'new-order' | 'invoice-history' | 'invoice-view'
  | 'stock-dashboard' | 'ready-stock' | 'packaging-stock' | 'add-stock'
  | 'production-entry' | 'price-list' | 'reports';
```

### `navigate()` Action

```typescript
navigate(page: AppPage, params?: {
  customerId?: string;
  invoiceId?: string;
  editCustomerId?: string;
})
```

Sets `currentPage`, `selectedCustomerId`, `selectedInvoiceId`, `editCustomerId` in the store.

### `App.tsx` Router (Switch Statement)

```typescript
// App.tsx pageContent()
switch (currentPage) {
  case 'setup':            → BusinessSetup
  case 'dashboard':        → Dashboard
  case 'customer-list':    → CustomerList
  case 'customer-form':    → CustomerForm
  case 'customer-ledger':  → CustomerLedger
  case 'new-order':        → NewOrder
  case 'invoice-history':  → InvoiceHistory
  case 'invoice-view':     → InvoiceView
  case 'stock-dashboard':  → ReadyStockPage (same component)
  case 'ready-stock':      → ReadyStockPage
  case 'packaging-stock':  → PackagingStockPage
  case 'add-stock':        → AddStock
  case 'production-entry': → ProductionEntry
  case 'price-list':       → PriceList
  case 'reports':          → ReportsPage
}
```

### Special Navigation Triggers

| Trigger | Result |
|---|---|
| `businessProfile` is null and not on 'setup' | Forces `BusinessSetup` |
| `setBusinessProfile()` | Sets `currentPage: 'dashboard'` |
| `generateInvoice()` | Sets `currentPage: 'invoice-view'`, `selectedInvoiceId` |
| `startNewOrder()` | Sets `currentPage: 'new-order'`, clears `currentOrder` |
| Customer deactivated → navigates to list | `navigate('customer-list')` |

### Sidebar Navigation

`Sidebar.tsx` renders navigation links. Each link calls `navigate(page)` directly. No `<a>` or `<Link>` tags — pure button clicks.

---

## 6. Global State — Zustand Store

File: `src/store/useStore.ts`

### State Shape

```typescript
interface AppState {
  // Auth / Tenant
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
  customerSeq: number;       // monotonic counter → CUST-001, CUST-002, ...

  // Order in progress
  currentOrder: CurrentOrder | null;

  // Invoices
  invoices: Invoice[];
  invoiceCounters: Record<string, number>; // FY code → last seq used

  // Payment Receipts
  paymentReceipts: PaymentReceipt[];
  receiptSeq: number;        // monotonic counter → REC-0001

  // Inventory — Stock balances (snapshots)
  rawMaterialStock: Record<string, number>;     // RM-WF/BS/DL/BR → kg
  packagingStock: Record<string, number>;        // PKG-* → unit count
  readyStock: Record<string, number>;            // skuId → packed units

  // Inventory — Ledger/history
  packagingEntries: PackagingEntry[];            // All purchase/used/damaged events
  productionLogs: ProductionLog[];               // Daily kg produced per product
  stockTransactions: StockTransaction[];         // Raw/pkg bulk adjustments
  readyStockTransactions: ReadyStockTransaction[];

  // Sync utility
  lastSyncBatchTime: string | null;

  // Reorder levels (thresholds for low/out alerts)
  reorderLevels: {
    raw: Record<string, number>;
    packaging: Record<string, number>;
    ready: Record<string, number>;
  };

  // Pricing
  priceList: Record<string, number>;  // skuId → ₹ per unit
}
```

### Initialisation Sequence (`initializeApp`)

All DB calls are parallelised with `Promise.all`:

```
1. initAuth()           → get userId
2. getOrCreateOrg()     → get orgId (always FIXED_ORG_ID)
3. initializeCatalog()  → upsert SKUs + packaging materials (safety net)
4. Promise.all([
     loadBusinessProfile,
     loadCustomers,
     loadInvoices,
     loadPaymentReceipts,
     loadPackagingEntries,
     loadProductionLogs,
     loadStockData,
     loadPriceList,
     loadReorderLevels,
   ])
5. Derive invoiceCounters from loaded invoices (regex on invoice_no)
6. Merge reorder levels (DB overrides defaults)
7. Set currentPage:
   - 'dashboard' if businessProfile exists
   - 'setup' otherwise
```

On failure: `initError` is set to the error message; `isInitialized: true` with `orgId: FIXED_ORG_ID` (allows a degraded state).

### Key Store Actions Summary

| Action | What it does |
|---|---|
| `initializeApp()` | Loads all data from DB, sets up state |
| `navigate(page, params)` | Changes page + optional context IDs |
| `setBusinessProfile(profile)` | Saves profile + navigates to dashboard |
| `addCustomer(data)` | Generates CUST-XXX ID, saves to DB |
| `updateCustomer(id, data)` | Partial update, syncs to DB |
| `deactivateCustomer(id)` | Sets `active: false`, soft-delete in DB |
| `startNewOrder()` | Clears `currentOrder`, navigates to `new-order` |
| `setOrderCustomer(id)` | Sets customer on current order |
| `setOrderGst(enabled)` | Toggles GST calculation |
| `setOrderDiscount(type, value)` | Sets percent or flat discount |
| `upsertCartItem(skuId, qty, rate)` | Adds or updates cart line |
| `removeCartItem(skuId)` | Removes line from cart |
| `generateInvoice(saleDate?)` | Full invoice generation (see §11.1) |
| `cancelInvoice(id)` | Sets cancelled flag in state + DB |
| `addPaymentReceipt(data)` | Generates REC-XXXX, saves to DB |
| `addPackagingEntry(entry)` | Records purchase/used/damaged, updates balance |
| `addProductionLog(log)` | Records daily production kg |
| `adjustStock(type, id, qty, reason)` | Manual raw/pkg stock correction |
| `addReadyStockEntry(skuId, qty, reason, date)` | Adds packed units, auto-deducts packaging |
| `adjustReadyStock(skuId, qty, reason, date?)` | Manual ready-stock correction (no packaging deduction) |
| `editReadyStockTransaction(txId, qty, reason)` | Edits historical ready-stock entry |
| `deleteReadyStockTransaction(txId)` | Deletes + reverses quantity in balance |
| `syncPackagingFromReadyStock()` | One-time bulk sync: deducts packaging for all ADD transactions |
| `revertLastPackagingSync()` | Reverses the sync batch |
| `clearAllPackagingData()` | Wipes all packaging entries + balances |
| `updatePrice(skuId, rate)` | Updates price list |
| `setReorderLevel(type, id, level)` | Sets low-stock threshold |
| `getCustomerInvoices(customerId)` | Filter (not cancelled) invoices for customer |
| `getStockStatus(type, id)` | Returns `'adequate' \| 'low' \| 'out'` |
| `getReadyStockStatus(skuId)` | Same but for ready stock |

---

## 7. Database — Full Schema Reference

### Enum Types

| Enum | Values |
|---|---|
| `customer_type_enum` | `Retailer`, `Wholesaler`, `Distributor`, `Direct Consumer` |
| `payment_terms_enum` | `Cash`, `7 Days`, `15 Days`, `30 Days` |
| `payment_mode_enum` | `Cash`, `Bank Transfer`, `UPI`, `Cheque` |
| `invoice_payment_mode_enum` | `Cash`, `Credit` |
| `stock_tx_type_enum` | `ADD`, `DEDUCT`, `ADJUST` |
| `stock_item_type_enum` | `raw`, `packaging` |
| `packaging_entry_type_enum` | `purchase`, `used`, `damaged` |
| `price_unit_enum` | `piece`, `kg` |
| `reorder_category_enum` | `raw`, `packaging`, `ready` |
| `org_role_enum` | `owner`, `admin`, `staff` |

### Extensions Used

- `uuid-ossp` — `uuid_generate_v4()` for primary keys
- `pg_trgm` — fast ILIKE / trigram full-text search on names

### Tables

#### `organizations`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | Default: `uuid_generate_v4()` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

#### `org_members`
| Column | Type | Notes |
|---|---|---|
| `org_id` | `uuid FK → organizations` | |
| `user_id` | `uuid FK → auth.users` | |
| `role` | `org_role_enum` | Default: `owner` |
| `joined_at` | `timestamptz` | |
PK: `(org_id, user_id)`

#### `packaging_materials`
| Column | Type | Notes |
|---|---|---|
| `id` | `text PK` | e.g. `PKG-WF-26K` |
| `org_id` | `uuid nullable` | null = global catalog |
| `name` | `text` | Human-readable label |
| `used_for` | `text[]` | Array of SKU IDs |
| `active` | `boolean` | Default: true |
| `metadata` | `jsonb` | Extensible |
| `created_at` | `timestamptz` | |

Indexes: `org_id`, trigram on `name`

#### `product_skus`
| Column | Type | Notes |
|---|---|---|
| `id` | `text PK` | e.g. `WF-26K` |
| `org_id` | `uuid nullable` | null = global catalog |
| `product` | `text` | e.g. `Shikharji Atta` |
| `product_id` | `text` | `WF`, `BS`, `DL`, `BR` |
| `variant` | `text` | e.g. `26 kg Bag` |
| `weight` | `numeric(8,3)` | kg per unit |
| `packaging_id` | `text FK → packaging_materials` | |
| `hsn_code` | `text` | |
| `gst_rate` | `numeric(5,2)` | |
| `unit` | `text` | `Bag`, `Pouch`, `Packet` |
| `active` | `boolean` | |
| `metadata` | `jsonb` | |

#### `business_profiles`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK UNIQUE` | No | One per org |
| `name` | `text` | No | Business name |
| `address1` | `text` | No | |
| `address2` | `text` | Yes | |
| `city` | `text` | No | |
| `state` | `text` | No | |
| `pin_code` | `text` | No | |
| `gstin` | `text` | No | |
| `fssai` | `text` | No | |
| `mobile` | `text` | No | |
| `email` | `text` | Yes | |
| `tagline` | `text` | Yes | |
| `bank_name` | `text` | Yes | |
| `account_no` | `text` | Yes | |
| `ifsc_code` | `text` | Yes | |
| `upi_id` | `text` | Yes | |
| `gst_enabled` | `boolean` | No | Default: true |
| `metadata` | `jsonb` | No | |
| `created_at` | `timestamptz` | No | |
| `updated_at` | `timestamptz` | No | Auto-updated by trigger |
| `created_by` | `uuid FK → auth.users` | Yes | |
| `updated_by` | `uuid FK → auth.users` | Yes | |

#### `customers`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `text` | No | `CUST-001` (app-generated) |
| `org_id` | `uuid FK` | No | |
| `seq` | `integer` | No | Monotonic counter per org |
| `name` | `text` | No | |
| `firm_name` | `text` | Yes | |
| `mobile` | `text` | No | |
| `alternate_mobile` | `text` | Yes | |
| `address1` | `text` | No | |
| `address2` | `text` | Yes | |
| `city` | `text` | No | |
| `state` | `text` | No | |
| `pin_code` | `text` | Yes | |
| `gstin` | `text` | Yes | |
| `fssai` | `text` | Yes | |
| `customer_type` | `customer_type_enum` | No | |
| `credit_limit` | `numeric(12,2)` | No | Default: 0 |
| `payment_terms` | `payment_terms_enum` | No | |
| `opening_balance` | `numeric(12,2)` | No | Default: 0 |
| `notes` | `text` | Yes | |
| `active` | `boolean` | No | Default: true |
| `deleted_at` | `timestamptz` | Yes | Soft delete |
| `created_on` | `date` | No | App-supplied date |
| `created_at` | `timestamptz` | No | |
| `updated_at` | `timestamptz` | No | Auto-updated |
PK: `(id, org_id)`

Indexes: `org_id`, partial on active+not-deleted, trigram on `name`, trigram on `firm_name`

#### `invoices`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK` | No | |
| `invoice_no` | `text UNIQUE(org_id)` | No | `INV-2627-001` |
| `invoice_date` | `date` | No | |
| `invoice_time` | `time` | No | |
| `customer_id` | `text` | No | Denormalized ref |
| `customer_snapshot` | `jsonb` | No | Full customer at sale time |
| `subtotal` | `numeric(12,2)` | No | |
| `cgst_total` | `numeric(12,2)` | No | |
| `sgst_total` | `numeric(12,2)` | No | |
| `igst_total` | `numeric(12,2)` | No | |
| `total_gst` | `numeric(12,2)` | No | |
| `discount_type` | `text` | Yes | `'percent'` or `'flat'` |
| `discount_value` | `numeric` | Yes | Input value |
| `discount_amount` | `numeric` | Yes | Computed ₹ deduction |
| `round_off` | `numeric(6,2)` | No | |
| `grand_total` | `numeric(12,2)` | No | |
| `is_inter_state` | `boolean` | No | |
| `payment_mode` | `invoice_payment_mode_enum` | No | `Cash` or `Credit` |
| `amount_in_words` | `text` | No | e.g. "Seven Hundred Eighty..." |
| `financial_year` | `text` | No | e.g. `'2627'` |
| `cancelled` | `boolean` | No | Default: false |
| `cancelled_at` | `timestamptz` | Yes | |
| `cancelled_by` | `uuid` | Yes | |

Indexes: `org_id`, `(org_id, customer_id)`, `(org_id, invoice_date DESC)`, `(org_id, financial_year)`, partial on `cancelled=false`, GIN on `customer_snapshot`

#### `invoice_items`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `invoice_id` | `uuid FK → invoices` | No | CASCADE DELETE |
| `sku_id` | `text FK → product_skus` | No | |
| `product` | `text` | No | |
| `variant` | `text` | No | |
| `weight` | `numeric(8,3)` | No | |
| `hsn_code` | `text` | No | |
| `gst_rate` | `numeric(5,2)` | No | |
| `quantity` | `integer CHECK(>0)` | No | |
| `rate` | `numeric(10,2) CHECK(>=0)` | No | |
| `taxable_value` | `numeric(12,2)` | No | qty × rate |
| `cgst` | `numeric(10,2)` | No | |
| `sgst` | `numeric(10,2)` | No | |
| `igst` | `numeric(10,2)` | No | |
| `line_total` | `numeric(12,2)` | No | taxable + gst |
| `unit` | `text` | No | |
| `metadata` | `jsonb` | No | |

#### `payment_receipts`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `text` | No | `REC-0001` |
| `org_id` | `uuid FK` | No | |
| `customer_id` | `text` | No | |
| `date` | `date` | No | |
| `time` | `time` | No | |
| `amount` | `numeric(12,2) CHECK(>0)` | No | |
| `mode` | `payment_mode_enum` | No | |
| `reference_no` | `text` | Yes | Cheque/UTR/UPI ref |
| `notes` | `text` | Yes | |
PK: `(id, org_id)`

#### `packaging_entries`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK` | No | |
| `date` | `date` | No | |
| `time` | `time` | No | |
| `material_id` | `text FK → packaging_materials` | No | |
| `material_name` | `text` | No | Denormalized |
| `entry_type` | `packaging_entry_type_enum` | No | `purchase`, `used`, `damaged` |
| `quantity` | `numeric(10,2)` | No | |
| `price_unit` | `price_unit_enum` | Yes | `piece` or `kg` |
| `price_per_unit` | `numeric(10,2)` | Yes | |
| `total_amount` | `numeric(12,2)` | Yes | |
| `supplier` | `text` | Yes | |
| `notes` | `text` | Yes | |

#### `production_logs`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK` | No | |
| `date` | `date` | No | |
| `time` | `time` | No | |
| `product_name` | `text` | No | Category-level name |
| `quantity_produced` | `numeric(10,2)` | No | kg |
| `notes` | `text` | Yes | |

#### `stock_transactions` (Raw/Packaging bulk adjustments)
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK` | No | |
| `type` | `stock_tx_type_enum` | No | `ADD`, `DEDUCT`, `ADJUST` |
| `item_type` | `stock_item_type_enum` | No | `raw` or `packaging` |
| `item_id` | `text` | No | e.g. `RM-WF` |
| `item_name` | `text` | No | |
| `quantity` | `numeric(10,2)` | No | |
| `previous_stock` | `numeric(10,2)` | No | |
| `new_stock` | `numeric(10,2)` | No | |
| `reason` | `text` | No | |
| `supplier_name` | `text` | Yes | |
| `invoice_no` | `text` | Yes | |
| `date` | `date` | No | |
| `time` | `time` | No | |

#### `ready_stock_transactions`
| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid PK` | No | |
| `org_id` | `uuid FK` | No | |
| `date` | `date` | No | |
| `time` | `time` | No | |
| `sku_id` | `text` | No | e.g. `WF-26K` |
| `sku_name` | `text` | No | Denormalized display |
| `type` | `stock_tx_type_enum` | No | `ADD`, `DEDUCT`, `ADJUST` |
| `quantity` | `numeric(10,2)` | No | |
| `previous_stock` | `numeric(10,2)` | No | |
| `new_stock` | `numeric(10,2)` | No | |
| `reason` | `text` | Yes | |
| `invoice_no` | `text` | Yes | Linked invoice if sale-deduction |

#### Balance/Snapshot Tables

These hold the **current** computed balance (denormalized for fast reads):

| Table | Columns | Key |
|---|---|---|
| `raw_material_stock` | `org_id, material_id, quantity` | `(org_id, material_id)` UNIQUE |
| `packaging_stock` | `org_id, material_id, quantity` | `(org_id, material_id)` UNIQUE |
| `ready_stock` | `org_id, sku_id, quantity` | `(org_id, sku_id)` UNIQUE |

#### `price_list`
| Column | Type | Notes |
|---|---|---|
| `org_id` | `uuid FK` | |
| `sku_id` | `text FK → product_skus` | |
| `rate` | `numeric(10,2)` | ₹ per unit |
Unique: `(org_id, sku_id)`

#### `reorder_levels`
| Column | Type | Notes |
|---|---|---|
| `org_id` | `uuid FK` | |
| `category` | `reorder_category_enum` | `raw`, `packaging`, `ready` |
| `item_id` | `text` | Raw mat ID / PKG ID / SKU ID |
| `level` | `numeric(10,2)` | Alert threshold |
Unique: `(org_id, category, item_id)`

### Database Triggers

- `trg_business_profiles_updated_at` — updates `updated_at` before any UPDATE on `business_profiles`
- `trg_customers_updated_at` — updates `updated_at` before any UPDATE on `customers`

### Helper Functions

- `fn_user_org_ids()` — returns all `org_id`s for `auth.uid()` (used in RLS policies)
- `fn_set_updated_at()` — trigger function to auto-update `updated_at`

---

## 8. Data Access Layer (db.ts)

File: `src/lib/db.ts`

### Date/Time Conversion Convention

The app uses two date representations:
- **App format**: `DD/MM/YYYY` (display/input)
- **DB format**: `YYYY-MM-DD` (PostgreSQL `date` type)

Helper functions (private to db.ts):
```typescript
toDbDate('09/05/2026')  →  '2026-05-09'
fromDbDate('2026-05-09')  →  '09/05/2026'
fromDbTime('14:30:00')  →  '14:30'   // strips seconds
```

### Row Mapper Pattern

Every table has a `rowToXxx(row)` function that converts snake_case DB rows to camelCase app types, handling `null → undefined` and numeric coercions.

### Write Pattern

All writes follow:
1. **Optimistic update** in Zustand store (immediate UI)
2. **Async DB save** (`.catch(console.error)` or with `alert()` for critical failures)

### Critical Write Functions

#### `saveInvoice(orgId, invoice, items, readyStockTxns, newReadyStock)`
Transactional-ish write sequence (3 separate inserts — not a true DB transaction):
1. Insert row into `invoices`
2. Insert rows into `invoice_items` (batch)
3. Insert rows into `ready_stock_transactions` (batch)
4. Upsert rows into `ready_stock` (balance snapshots)

If step 1 fails → throws → caller shows `alert()` with full error message.
If steps 2-4 fail → invoice header exists but items/stock may be missing → alert shown.

#### `saveReadyStockTransaction(orgId, txn)`
1. Insert into `ready_stock_transactions`
2. Upsert into `ready_stock` (updates balance snapshot)

#### `savePackagingEntry(orgId, entry, newStock)`
1. Insert into `packaging_entries`
2. Upsert into `packaging_stock` (updates balance snapshot)

---

## 9. Product Catalog & Static Data

File: `src/data/products.ts`

### Product SKUs (10 total)

| SKU ID | Product | Variant | Weight (kg) | Packaging | HSN | GST |
|---|---|---|---|---|---|---|
| `WF-26K` | Shikharji Atta | 26 kg Bag | 26 | `PKG-WF-26K` | 1101 | 5% |
| `WF-25K` | Shikharji Atta | 25 kg Bag | 25 | `PKG-WF-26K` | 1101 | 5% |
| `WF-5P` | Shikharji Atta | 5 kg Pouch | 5 | `PKG-WF-5P` | 1101 | 5% |
| `WF-10P` | Shikharji Atta | 10 kg Pouch | 10 | `PKG-WF-10P` | 1101 | 5% |
| `WF-5H` | Shikharji Atta | 5 kg Handle Bag | 5 | `PKG-WF-5H` | 1101 | 5% |
| `WF-10H` | Shikharji Atta | 10 kg Handle Bag | 10 | `PKG-WF-10H` | 1101 | 5% |
| `BS-40K` | Shikharji Besan | 40 kg Bag | 40 | `PKG-BS-40K` | 1106 | 5% |
| `BS-500G` | Shikharji Besan | 500 gm Packet | 0.5 | `PKG-BS-500G` | 1106 | 5% |
| `DL-500G` | Shikharji Dalia | 500 gm Packet | 0.5 | `PKG-DL-500G` | 1104 | 5% |
| `BR-40K` | Shikharji Bran | 40 kg Bag | 40 | `PKG-BR-40K` | 2302 | 5% |

> **Note**: `WF-25K` and `WF-26K` share the same packaging material `PKG-WF-26K` (25/26 kg Bags).

### Packaging Materials (11 total)

| PKG ID | Name | Used For |
|---|---|---|
| `PKG-WF-26K` | 25/26 kg Bags (Shikharji Atta) | WF-26K, WF-25K |
| `PKG-WF-5P` | 5 kg Pouches (Shikharji Atta) | WF-5P |
| `PKG-WF-10P` | 10 kg Pouches (Shikharji Atta) | WF-10P |
| `PKG-WF-5H` | 5 kg Handle Bags (Shikharji Atta) | WF-5H |
| `PKG-WF-10H` | 10 kg Handle Bags (Shikharji Atta) | WF-10H |
| `PKG-BS-40K` | 40 kg Bags (Shikharji Besan) | BS-40K |
| `PKG-BS-500G` | 500 gm Packets (Shikharji Besan) | BS-500G |
| `PKG-DL-500G` | 500 gm Packets (Shikharji Dalia) | DL-500G |
| `PKG-BR-40K` | 40 kg Bags (Shikharji Bran) | BR-40K |
| `PKG-OUTER-10X3` | Outer Bag 10X3 | [] (no SKU link) |
| `PKG-OUTER-5X6` | Outer Bag 5X6 | [] (no SKU link) |

### Raw Materials (4 total)

| RM ID | Name | Associated SKUs |
|---|---|---|
| `RM-WF` | Shikharji Atta | WF-26K, WF-25K, WF-5P, WF-10P, WF-5H, WF-10H |
| `RM-BS` | Shikharji Besan | BS-40K, BS-500G |
| `RM-DL` | Shikharji Dalia | DL-500G |
| `RM-BR` | Shikharji Bran | BR-40K |

### Default Prices (₹ per unit)

| SKU | Default Price |
|---|---|
| WF-26K | ₹780 |
| WF-25K | ₹750 |
| WF-5P | ₹165 |
| WF-10P | ₹320 |
| WF-5H | ₹175 |
| WF-10H | ₹340 |
| BS-40K | ₹2,400 |
| BS-500G | ₹35 |
| DL-500G | ₹28 |
| BR-40K | ₹480 |

---

## 10. Pages & Features — Detailed Breakdown

### 10.1 Business Setup

**Component**: `BusinessSetup.tsx`  
**Route**: `'setup'`  
**Triggered**: First run (no `businessProfile` in DB) or explicit navigate.

#### What it does
Collects and saves the business profile. After saving, navigates to `'dashboard'`.

#### Mandatory vs Optional Fields

| Field | Mandatory | Notes |
|---|---|---|
| Business Name | **Yes** | |
| Address Line 1 | **Yes** | |
| City | **Yes** | |
| State | **Yes** | Dropdown from `INDIAN_STATES` |
| PIN Code | **Yes** | |
| GSTIN | **Yes** | |
| FSSAI Number | **Yes** | |
| Mobile | **Yes** | |
| Address Line 2 | No | Landmark |
| Email | No | |
| Tagline | No | |
| Bank Name | No | For invoice footer |
| Account No | No | |
| IFSC Code | No | |
| UPI ID | No | |
| GST Enabled | **Yes** | Toggle (default: true) |

#### Store Interaction
`setBusinessProfile(profile)` → calls `db.saveBusinessProfile(orgId, profile)` → navigates to `'dashboard'`.

---

### 10.2 Dashboard

**Component**: `Dashboard.tsx`  
**Route**: `'dashboard'`

#### KPI Cards (top row)
- **Today's Revenue**: Sum of non-cancelled invoice `grandTotal` where `invoiceDate === today`
  - Sub-label: count of today's orders
- **Today's Production**: Sum of `productionLogs.quantityProduced` where `date === today`
  - Sub-label: per-product breakdown
- **7-Day Revenue**: Rolling 7-day sum of invoice grand totals
  - Sub-label: total kg produced in 7 days
- **Active Customers**: Count of `customers.filter(c => c.active)`
  - Sub-label: customer count

All KPI cards are clickable — they navigate to the relevant page.

#### Alerts Section
- **Low Ready Stock**: SKUs where status is `'low'` (reorder level set + stock ≤ level) OR status is `'out'` AND SKU has at least one recorded transaction.
- **Low Packaging**: Packaging materials where reorder level is set and stock ≤ level, OR out-of-stock with prior activity.

Smart alert logic prevents false alarms: a material at 0 with no history is NOT shown (default zero ≠ actually depleted).

#### Today's Sales by SKU
Groups today's invoice items by SKU, shows quantity and amount sold.

#### Recent Invoices
Last 5 non-cancelled invoices sorted by `invoiceNo` descending.

---

### 10.3 Customer Management

#### Customer List (`CustomerList.tsx`, route: `'customer-list'`)
- Shows all **active** customers (`c.active === true`).
- Search: filters by name, firm name, or mobile.
- Each row: navigate to ledger (`navigate('customer-ledger', { customerId })`) or edit (`navigate('customer-form', { editCustomerId })`).
- Deactivate button: calls `deactivateCustomer(id)` — sets `active: false`, sets `deleted_at` in DB (soft delete).

#### Customer Form (`CustomerForm.tsx`, route: `'customer-form'`)

Used for both **Add** and **Edit** (determined by `editCustomerId` in store).

##### Mandatory Fields

| Field | Mandatory | Validation |
|---|---|---|
| Customer Name | **Yes** | Not empty |
| Mobile Number | **Yes** | Not empty |
| Address Line 1 | **Yes** | Not empty |
| City | **Yes** | Not empty |
| State | **Yes** | Must select from dropdown |

##### Optional Fields

| Field | Notes |
|---|---|
| Business / Firm Name | Optional display name |
| Alternate Mobile | Second contact |
| Address Line 2 | Landmark |
| PIN Code | 6-digit |
| GSTIN | For B2B customers |
| FSSAI Number | For food business customers |
| Customer Type | Dropdown: Retailer / Wholesaler / Distributor / Direct Consumer (default: Retailer) |
| Payment Terms | Cash / 7 Days / 15 Days / 30 Days (default: Cash) |
| Credit Limit (₹) | Default: 0 |
| Opening Balance (₹) | Pre-existing outstanding, default: 0 |
| Notes | Free text |

##### Form Logic
- On **Add**: calls `addCustomer()`, redirects to customer list.
- On **Edit**: loads `existing` customer from store (via `editCustomerId`), pre-populates form. Calls `updateCustomer(id, data)` on save, shows "✓ Saved!" inline.
- Client-side validation runs on submit via `validate()`. Errors shown inline beneath each field.
- Submit error caught in try/catch, shown in a red alert banner at top of form.

#### ID Generation
```
seq = customerSeq + 1
id = `CUST-${String(seq).padStart(3, '0')}`  // CUST-001, CUST-002, ...
```

---

### 10.4 New Order (3-Step Flow)

**Component**: `NewOrder.tsx`  
**Route**: `'new-order'`

#### Step 1: Select Customer

- Search box filters active customers by name, firm name, mobile.
- Click to select → calls `setOrderCustomer(customerId)`.
- Selected customer shown with confirmation badge.
- Warning shown if `openingBalance > 0` (outstanding debt).
- "Next" button disabled until a customer is selected.

#### Step 2: Add Products

- Category filter tabs (Atta / Besan / Dalia / Bran + All).
- SKU cards with packaging type badge (Handle Bag / Pouch / Packet / Bag).
- Click SKU card → pre-fills rate from `priceList[sku.id]`.
- Rate is editable (₹ per bag). Per-kg rate auto-calculated: `rate / sku.weight`.
- Editing per-kg rate updates per-bag rate: `perKgRate × sku.weight`.
- Quantity spinner (min 1).
- "Add to Cart" → `upsertCartItem(skuId, qty, rate)`. Green badge briefly shown.
- Cart shown at bottom-right with running subtotal.
- Stock alerts shown if any line item would exceed:
  - Raw material stock (calculated as `sku.weight × qty` per RM category)
  - Packaging stock (calculated as `qty` per `sku.packagingId`)

**Stock Alert Logic:**
```typescript
// For each cart item:
rawNeeded[RM-WF] += sku.weight * item.quantity
pkgNeeded[sku.packagingId] += item.quantity
// Compare to rawMaterialStock and packagingStock
```

#### Step 3: Review & Confirm

- Sale date: defaults to today. User can enter in `DD/MM/YYYY` format. Validated with `isValidDDMMYYYY()`.
- GST toggle: per-order override of business-level GST setting.
- Discount: optional flat ₹ or percentage discount.
- Live invoice preview: subtotal, GST breakdown (CGST+SGST or IGST), discount, round-off, grand total.
- **Print Preview**: generates a dummy invoice and opens thermal print preview in new window without saving.
- **Generate Invoice**: calls `generateInvoice(saleDate)`.

#### generateInvoice() Full Logic

```
1. Validate: currentOrder and businessProfile must exist
2. Resolve customer from store
3. Parse saleDate → Date object → derive financial year (FY)
4. Increment invoiceCounters[fy] → seq → invoiceNo = `INV-{fy}-{seq.padStart(3,'0')}`
5. Determine isInterState: businessProfile.state !== customer.state
6. For each cart item:
   a. Find SKU in PRODUCTS catalog
   b. taxableValue = qty × rate
   c. GST: if gstEnabled → calcGST(taxableValue, sku.gstRate, isInterState)
      else all GST = 0
   d. lineTotal = taxableValue + cgst + sgst + igst
7. Aggregate: subtotal, cgstTotal, sgstTotal, igstTotal, totalGST
8. preDiscount = subtotal + totalGST
9. Discount:
   - flat: discountAmount = discountValue
   - percent: discountAmount = preDiscount × (discountValue / 100)
10. beforeRound = preDiscount - discountAmount
11. grandTotal = Math.round(beforeRound)
12. roundOff = grandTotal - beforeRound
13. amountInWords = numberToWords(grandTotal)
14. Build Invoice object with UUID, customerSnapshot, financialYear
15. Deduct from readyStock:
    for each item:
      prevReady = readyStock[skuId]
      readyStock[skuId] = max(0, prevReady - qty)
      Create ReadyStockTransaction (type: DEDUCT, reason: "Sale – {invoiceNo}")
16. Update state:
    invoices += [invoice]
    invoiceCounters[fy] = seq
    readyStock = newReady
    readyStockTransactions += newReadyTxns
    currentOrder = null
    currentPage = 'invoice-view'
    selectedInvoiceId = invoice.id
17. Async: db.saveInvoice(orgId, invoice, items, readyStockTxns, newReadyStock)
    On failure: alert() with full error message
```

#### Invoice Numbering

Format: `INV-{YYMM}-{SEQ}`

Financial year code: `getFYFromDate(date)`:
- April → March financial year
- May 2026 → FY 2026-27 → code `'2627'`
- April 2027 → FY 2027-28 → code `'2728'`

Sequence resets each FY. Padded to 3 digits: `001`, `002`, etc.

---

### 10.5 Invoice History & Invoice View

#### Invoice History (`InvoiceHistory.tsx`, route: `'invoice-history'`)
- Lists all invoices (including cancelled, shown with strikethrough/badge).
- Filter by: FY, customer, status (all/active/cancelled), payment mode.
- Search by invoice number or customer name.
- Click row → `navigate('invoice-view', { invoiceId: inv.id })`.
- Cancel button: requires password (via `DeletePasswordModal`). Calls `cancelInvoice(id)`.

#### Invoice View (`InvoiceView.tsx`, route: `'invoice-view'`)
- Displays selected invoice from `selectedInvoiceId`.
- **Print options**:
  - **80mm Original**: thermal receipt, 38-char wide, monospace, `buildThermalText()`
  - **80mm Copy**: customer copy with "CUSTOMER COPY" header, `buildCustomerCopyText()`
  - **A4 Original**: full formatted A4 invoice, `buildA4Html()`
  - **A4 Copy**: A4 with "CUSTOMER COPY" label
  - **Copy Text**: copies thermal text to clipboard
- All print formats open a new browser window → auto-trigger `window.print()` → auto-close after print.
- Warning shown if `invoice.items.length === 0` (DB save failure).
- Shows CGST+SGST or IGST badge based on `isInterState`.
- Shows CANCELLED badge if `invoice.cancelled === true`.

#### Delete/Cancel Password

Stored in `VITE_INVOICE_DELETE_PASSWORD` env var (4-digit PIN).  
4 individual `<input type="password" maxLength={1}>` fields.  
Auto-advances on digit entry. Backspace moves to previous field.  
On correct PIN → action proceeds. On incorrect → error message, fields reset.

---

### 10.6 Customer Ledger

**Component**: `CustomerLedger.tsx`  
**Route**: `'customer-ledger'`  
**Requires**: `selectedCustomerId` in store

#### What it shows

Per-customer account statement with running balance. Loads customer from DB on mount (fresh fetch, not from store cache).

#### Ledger Construction

```typescript
// Sources combined into unified rows:
1. Opening balance → debit row (date: customer.createdOn, time: '00:00')
2. Non-cancelled invoices → debit rows (amount: invoice.grandTotal)
3. Payment receipts → credit rows (amount: receipt.amount)

// Sort: chronological by (date, time)
// Running balance:
balance += row.debit - row.credit

// Summary:
outstanding = totalDebit - totalCredit
// Positive = customer owes money
// Zero = fully settled
// Negative = advance/credit balance
```

#### Summary Stats
- Total Orders: count of non-cancelled invoices
- Total Dues: sum of all debits
- Total Received: sum of all credits
- Outstanding / Advance / Settled status

#### Add Payment
- "Add Payment" button opens `AddPaymentModal`.
- Payment is added via `addPaymentReceipt(data)`.
- Ledger immediately refreshes (reactive store subscription).

---

### 10.7 Ready Stock

**Component**: `ReadyStockPage.tsx`  
**Route**: `'ready-stock'` (also `'stock-dashboard'` maps here)

#### What it tracks
Number of **packed/ready-to-sell units** per SKU.

#### Status Badges
- **OK** (green): stock > 0 and above reorder level (or no reorder set)
- **Low** (amber): reorder level configured and stock ≤ reorder level
- **Out** (red): stock = 0

#### Adding Ready Stock Entry
- Select product category + specific SKU
- Enter quantity (units packed)
- Enter date (DD/MM/YYYY) — defaults to today
- Optional reason note
- Submit → `addReadyStockEntry(skuId, qty, reason, date)`

**Side effect**: auto-deducts the linked packaging material:
```
sku.packagingId → packaging material
packagingStock[pkgId] -= qty
packagingEntries += { entryType: 'used', quantity: qty, notes: 'Auto-deducted for Ready Stock: ...' }
```

#### Manual Adjustment
- Positive qty → ADD (e.g., found extra stock)
- Negative qty → DEDUCT (e.g., damaged/lost)
- Does NOT auto-deduct packaging (manual adjustments are corrections, not new packing events)

#### Edit/Delete Transactions
Password-protected (4-digit PIN from `VITE_INVOICE_DELETE_PASSWORD`).

**Edit**: Updates quantity and reason. Delta applied to current balance:
```
delta = newQty - old.quantity
signedDelta = type === 'DEDUCT' ? -delta : +delta
newCurrentStock = currentStock + signedDelta
```

**Delete**: Reverses the transaction quantity from current balance:
```
signedQty = type === 'DEDUCT' ? +txn.quantity : -txn.quantity
newCurrentStock = max(0, currentStock + signedQty)
```

#### Reorder Level
Per-SKU threshold. Set via inline input on each SKU card.

#### Transaction History
Date-sortable table of all ADD/DEDUCT/ADJUST events per SKU.

---

### 10.8 Packaging Inventory

**Component**: `PackagingStockPage.tsx`  
**Route**: `'packaging-stock'`

#### What it tracks
Balance of each packaging material (units/pieces).

#### Entry Types
- **Purchase** (stock in): increases balance
- **Used** (consumption): decreases balance
- **Damaged** (loss): decreases balance

#### Standard Entry Panel
Click any packaging material card → opens a slide-in panel:
- Enter quantity
- Optional notes
- Save → `addPackagingEntry({ entryType: 'purchase', ... })`
  (Panel always records as "purchase"; used/damaged via history or bulk)

#### Bulk Purchase Entry
PIN-gated (4-digit). Opens a bulk modal to enter purchase quantities for multiple materials at once with a single date and notes field.

#### Sync with Ready Stock (`syncPackagingFromReadyStock`)
A one-time utility for businesses migrating from manual tracking.

**What it does**: Calculates total packaging consumed from **all ADD transactions in ready stock history** and deducts that total from the current packaging balance.

```
For each ADD transaction in readyStockTransactions:
  qty → maps to sku.packagingId → accumulates total per packaging material

For each accumulated total:
  packagingStock[materialId] -= totalUsed
  packagingEntries += { entryType: 'used', notes: 'One-time sync...' }
```

**Undo** (`revertLastPackagingSync`): Creates reverse purchase entries for all sync entries (identified by specific `notes` string). Does NOT delete the original sync entries.

#### Clear All Packaging Data
Destructive action (no PIN gate — only accessible in settings panel). Wipes all `packagingEntries` and `packagingStock` rows from DB.

---

### 10.9 Raw Material / Bulk Stock (Add Stock)

**Component**: `AddStock.tsx`  
**Route**: `'add-stock'`

Manages bulk flour stock (kg) for the 4 raw materials (RM-WF, RM-BS, RM-DL, RM-BR).

#### Actions
- **ADD**: increase stock (receipt from supplier)
- **ADJUST**: manual correction (positive or negative)

Each action writes a `StockTransaction` record and updates the balance snapshot in `raw_material_stock`.

**Fields**: material ID, quantity (kg), type, reason (free text), supplier name (optional), invoice number (optional).

---

### 10.10 Production Entry

**Component**: `ProductionEntry.tsx`  
**Route**: `'production-entry'`

Records daily milling/production output in kg.

**Note**: Production logs are **standalone records** — they do NOT automatically add to ready stock or raw material stock. They are purely informational logs for monitoring output.

#### Form Fields

| Field | Mandatory | Notes |
|---|---|---|
| Product Category | **Yes** | Dropdown: Atta / Besan / Dalia / Bran |
| Quantity (kg) | **Yes** | Numeric, > 0 |
| Date | **Yes** | Defaults to today |
| Notes | No | |

Saves via `addProductionLog()` → `db.saveProductionLog()`.

---

### 10.11 Price List

**Component**: `PriceList.tsx`  
**Route**: `'price-list'`

#### What it does
Displays all 10 SKUs with their current price (₹ per unit). Prices are editable inline.

Editing a price → `updatePrice(skuId, rate)` → `db.savePrice(orgId, skuId, rate)`.

Prices are loaded from DB on init; if no DB prices exist, defaults from `DEFAULT_PRICES` are used.

Per-kg rate is shown alongside per-unit rate (calculated: `rate / sku.weight`).

---

### 10.12 Reports

**Component**: `ReportsPage.tsx`  
**Route**: `'reports'`

#### Date Range Selection

Presets: Today / This Week / This Month / This FY / Custom.

- "This Week" starts from Monday of the current week.
- "This FY" starts from April 1 of the current financial year.
- "Custom" shows two HTML `<input type="date">` fields with min/max guards.

Dates in reports are compared using `toOrd(ddmmyyyy)`:
```typescript
toOrd('09/05/2026') → 20260509  // YYYYMMDD number for comparison
```

#### Report Tabs

**Sales Report**

- Groups non-cancelled invoices by product category.
- For each SKU in each category: quantity sold, total revenue, average rate.
- Category totals + grand total.
- PDF export opens a new window with `@page { size: A4 }` styled HTML and triggers `window.print()`.

**Ready Stock Report**

- Current balance + all ADD/DEDUCT transactions within date range.
- Grouped by product category.
- Shows net change in period.

**Packaging Report**

- Packaging stock levels + all purchase/used/damaged entries within date range.
- Per-material: opening, purchased, used, damaged, closing balance.

---

## 11. Cross-Feature Data Flows

### 11.1 New Order → Ready Stock

```
User places order
    ↓
generateInvoice() called
    ↓
For each OrderItem:
    prevReady = readyStock[skuId]
    newReady = max(0, prevReady - item.quantity)
    Creates ReadyStockTransaction:
        type: 'DEDUCT'
        reason: 'Sale – INV-2627-001'
        invoiceNo: 'INV-2627-001'
    ↓
State updated:
    readyStock[skuId] = newReady
    readyStockTransactions += deductionTxn
    invoices += newInvoice
    currentPage → 'invoice-view'
    ↓
Async DB:
    saveInvoice(... readyStockTxns, newReadyStock)
    → Inserts invoice + items
    → Inserts ready_stock_transactions rows
    → Upserts ready_stock balance
```

Ready stock can go to 0 (not below). No error/block if stock is insufficient — sale proceeds and stock floors at 0. Stock alerts are informational only.

---

### 11.2 Ready Stock → Packaging Inventory

Two pathways:

#### Pathway A: `addReadyStockEntry` (Normal packing event)

```
User records N units packed of SKU WF-26K
    ↓
addReadyStockEntry('WF-26K', N, reason, date)
    ↓
readyStock['WF-26K'] += N
readyStockTransactions += ADD txn
    ↓
Lookup: sku.packagingId = 'PKG-WF-26K'
packagingStock['PKG-WF-26K'] -= N    (floor 0)
packagingEntries += { entryType: 'used', notes: 'Auto-deducted for Ready Stock: ...' }
    ↓
DB: saveReadyStockTransaction + savePackagingEntry (two separate writes)
```

#### Pathway B: `syncPackagingFromReadyStock` (One-time bulk sync)

```
User clicks "Sync Packaging from Ready Stock"
    ↓
Iterate ALL readyStockTransactions where type === 'ADD'
Group by sku.packagingId → sum quantities
    ↓
For each packaging material with accumulated total:
    packagingStock[materialId] -= total
    packagingEntries += { entryType: 'used', notes: 'One-time sync: deducted for existing Ready Stock' }
    ↓
DB: savePackagingEntry for each entry
```

Use case: business had ready stock before packaging tracking was set up. This sync retroactively reconciles the packaging balance.

#### Pathway B Undo:

```
revertLastPackagingSync()
    ↓
Find all packagingEntries with notes === 'One-time sync: deducted for existing Ready Stock'
For each:
    packagingStock[materialId] += entry.quantity
    packagingEntries += { entryType: 'purchase', notes: 'Undo: reversed one-time ready-stock sync' }
    ↓
DB: savePackagingEntry for each reversal
```

Note: Sync entries are not deleted — reversals are new purchase entries. This creates an audit trail.

---

### 11.3 Ledger Maintenance

The customer ledger is built **entirely at read time** (no materialised ledger table). Three sources are merged:

```
1. Customer.openingBalance (if > 0)
   → kind: 'opening', debit: openingBalance, date: createdOn, time: '00:00'

2. invoices (non-cancelled, same customerId)
   → kind: 'invoice', debit: grandTotal

3. paymentReceipts (same customerId)
   → kind: 'payment', credit: amount

All rows sorted chronologically (DD/MM/YYYY + HH:MM)
Running balance: balance += debit - credit (per row)
outstanding = sum(debit) - sum(credit)
```

**Debit** = money owed (invoice issued, opening balance)  
**Credit** = money received (payment receipt)  
**Outstanding > 0** = customer owes money  
**Outstanding < 0** = customer has advance/credit  
**Outstanding = 0** = fully settled  

---

## 12. Utility Functions

### `src/utils/format.ts`

| Function | Signature | Description |
|---|---|---|
| `formatDate(d)` | `(Date) → string` | `'DD/MM/YYYY'` |
| `formatTime(d)` | `(Date) → string` | `'HH:MM'` |
| `getFYFromDate(d)` | `(Date) → string` | `'2627'` for FY26-27 |
| `getCurrentFY()` | `() → string` | `getFYFromDate(new Date())` |
| `fmtINR(amount, showPaise?)` | `(number, bool?) → string` | Indian currency format with ₹ symbol and 2-digit grouping |
| `isValidDDMMYYYY(value)` | `(string) → boolean` | Validates date string |
| `parseDDMMYYYY(date, time?)` | `(string, string?) → number` | Returns ms timestamp for sorting |
| `pad(str, n, align?)` | `(string, number, 'left'\|'right') → string` | Fixed-width string |

**`fmtINR` Indian grouping logic**: last 3 digits as hundreds group, then groups of 2 for thousands. Example: `₹12,34,567`.

### `src/utils/gst.ts`

| Function | Signature | Description |
|---|---|---|
| `isInterState(bState, cState)` | `(string, string) → boolean` | Case-insensitive state comparison |
| `calcGST(taxableValue, gstRate, inter)` | `(number, number, boolean) → {cgst, sgst, igst}` | GST split calculator |

### `src/utils/numberToWords.ts`

Converts numeric amount to Indian English words for invoice footer. Handles Paise when fractional.

Examples:
- `780` → `"Seven Hundred Eighty Rupees Only"`
- `780.50` → `"Seven Hundred Eighty Rupees And Fifty Paise"`
- `100000` → `"One Lakh Rupees Only"`
- `10000000` → `"One Crore Rupees Only"`

### `src/utils/invoice.ts`

| Function | Description |
|---|---|
| `buildThermalText(invoice, bp)` | 38-char wide monospace thermal receipt text |
| `buildCustomerCopyText(invoice, bp)` | Same as thermal but with "CUSTOMER COPY" header |
| `buildA4Html(invoice, bp, copyLabel?, logoUrl?)` | Full HTML string for A4 paper print |

#### Thermal Receipt Format (38 chars wide)
```
======================================
        SHIKHARJI FOODS
        1 Test St
        Jaipur - 302001
        GSTIN: 08AAAAA0000A1Z5
        Ph: 9999999999
======================================
INVOICE NO : INV-2627-001
DATE       : 09/05/2026     TIME: 14:30
======================================
CUSTOMER   : Ramesh Kumar
FIRM       : Ramesh Store
ADDRESS    : Jaipur, RJ
MOBILE     : 9876543210
======================================
             I T E M S
======================================
1. Shikharji Atta           Rs.819
   26 kg Bag  x  1 Bag
   Rs.30/kg | Rs.780/bag | 26 kg
======================================
TOTAL WEIGHT              26 kg
SUBTOTAL                  Rs.780.00
CGST  (2.5%)              Rs.19.50
SGST  (2.5%)              Rs.19.50
======================================
GRAND TOTAL              Rs.819
======================================
  SEVEN HUNDRED EIGHTY
  RUPEES AND FIFTY PAISE
======================================
PAYMENT : CASH
UPI: ...
--------------------------------------
Thank you for your business!
```

---

## 13. GST Calculation Logic

All GST is at **5%** (standard rate for food products).

### Intra-State (`isInterState = false`)
- Business state === Customer state
- Split equally: CGST = 2.5%, SGST = 2.5%
- Formula: `cgst = sgst = (taxableValue × gstRate) / 100 / 2`

### Inter-State (`isInterState = true`)
- Business state ≠ Customer state
- Single charge: IGST = 5%
- Formula: `igst = taxableValue × gstRate / 100`, `cgst = sgst = 0`

### State Comparison
```typescript
isInterState(businessState, customerState):
  businessState.trim().toLowerCase() !== customerState.trim().toLowerCase()
```

Leading/trailing spaces and case are both normalised.

### When GST is Disabled
If `gstEnabled = false` on the order (or business profile), all GST amounts are 0. Invoice still records `cgstTotal: 0`, `sgstTotal: 0`, `igstTotal: 0`.

### Round-Off
```
grandTotal = Math.round(preDiscount - discountAmount)
roundOff = grandTotal - (preDiscount - discountAmount)
```
`roundOff` can be positive (rounded up) or negative (rounded down).

---

## 14. Invoice Printing

### Print Mechanism
All print formats use `window.open()` + `window.print()`:
```javascript
const w = window.open('', '_blank', 'width=302,height=600');
w.document.write(html);
w.document.close();
w.onload = () => { w.print(); w.onafterprint = () => w.close(); };
```
HTML special characters are escaped (`&`, `<`, `>`) before insertion into `<pre>` tags.

### 80mm Thermal
- Width: 38 chars (constant `W = 38`)
- Font: `Courier New` monospace, 12px, bold
- Page size: `80mm auto`
- Margin: `3mm`

### A4 Format
- Standard A4 page
- Business logo embedded as base64 data URL
- GST-compliant layout with company details, customer details, itemised table, tax summary, authorised signatory space
- Generated entirely as HTML string — no external CSS files needed

---

## 15. Form Fields — Mandatory vs Optional

### Business Setup Form
| Field | Mandatory |
|---|---|
| Business Name | **Yes** |
| Address Line 1 | **Yes** |
| City | **Yes** |
| State | **Yes** |
| PIN Code | **Yes** |
| GSTIN | **Yes** |
| FSSAI Number | **Yes** |
| Mobile | **Yes** |
| Address Line 2, Email, Tagline, Bank Name, Account No, IFSC Code, UPI ID | No |

### Customer Form
| Field | Mandatory |
|---|---|
| Customer Name | **Yes** |
| Mobile Number | **Yes** |
| Address Line 1 | **Yes** |
| City | **Yes** |
| State | **Yes** |
| Firm Name, Alt Mobile, Address 2, PIN, GSTIN, FSSAI | No |
| Customer Type | No (default: Retailer) |
| Payment Terms | No (default: Cash) |
| Credit Limit | No (default: 0) |
| Opening Balance | No (default: 0) |
| Notes | No |

### New Order — Step 2 (Cart)
| Field | Mandatory |
|---|---|
| Customer (Step 1) | **Yes** |
| At least 1 cart item | **Yes** |
| SKU selection | **Yes** |
| Quantity (≥1) | **Yes** |
| Rate (>0) | **Yes** |
| Sale Date | **Yes** (default: today) |
| GST Toggle | No (default: business setting) |
| Discount Type | No |
| Discount Value | No |

### Payment Receipt
| Field | Mandatory |
|---|---|
| Amount (>0) | **Yes** |
| Mode | **Yes** |
| Date | **Yes** |
| Reference No | No |
| Notes | No |

### Packaging Entry
| Field | Mandatory |
|---|---|
| Material | **Yes** |
| Entry Type | **Yes** |
| Quantity (>0) | **Yes** |
| Date | **Yes** |
| Price Unit | No (purchase only) |
| Price per Unit | No |
| Supplier | No |
| Notes | No |

### Ready Stock Entry
| Field | Mandatory |
|---|---|
| SKU | **Yes** |
| Quantity (>0) | **Yes** |
| Date | **Yes** (default: today) |
| Reason | No |

### Production Log
| Field | Mandatory |
|---|---|
| Product Category | **Yes** |
| Quantity (kg, >0) | **Yes** |
| Date | **Yes** (default: today) |
| Notes | No |

---

## 16. Error Handling Strategy

### Layered Error Handling

#### Layer 1: Auth Errors
Handled in `AuthPage.tsx` via `friendlyError()`.
- Maps technical errors to user-friendly messages.
- Shown in red alert box below the form.

#### Layer 2: App Initialisation Errors
`initializeApp()` catches all errors:
```typescript
catch (err) {
  set({ isInitialized: true, initError: msg, orgId: FIXED_ORG_ID });
}
```
App renders in a degraded state. `initError` can be shown to the user via the UI.

#### Layer 3: Form Validation (Client-side)
`validate()` functions in each form check required fields and set per-field error messages.
Errors shown inline beneath each field with a red border.
Submit blocked until validation passes.

#### Layer 4: Async DB Write Failures

**Critical failures** (invoice save) use `alert()`:
```typescript
db.saveInvoice(...).catch((err) => {
  alert(`Invoice ${invoiceNo} was created but could not be saved to the database.\n\nError: ${err.message}\n\nPlease note down the items...`);
});
```

**Non-critical failures** (packaging entries, production logs) use `console.error` silently, OR:
```typescript
db.savePackagingEntry(...).catch((err) => {
  alert(`Packaging entry was recorded locally but could not be saved...`);
});
```

**Pattern**: All async DB calls from the store use `.catch(console.error)` or `.catch(alertFn)`. State is always updated optimistically first — the DB write is the backup.

#### Layer 5: Component-Level DB Load Errors
`CustomerLedger` fetches customer from DB on mount:
```typescript
.catch(err => setError(err instanceof Error ? err.message : 'Failed to load customer'))
```
Error shown in an `<AlertCircle>` red banner. Loading state shown with `<Loader2 />` spinner.

#### Layer 6: Null Guards
All components check `if (!invoice || !businessProfile)` before rendering → fallback "not found" message.

---

## 17. Demo Mode

Activated via `VITE_DEMO_MODE=true`.

### What changes in Demo Mode:
1. **Auth bypassed**: `session` immediately set to `{}` (fake Session). `AuthPage` never shown.
2. **Supabase client**: pointed at `http://127.0.0.1:0` — all network calls fail immediately.
3. **DB layer**: switches to `db.demo.ts` (in-memory implementation).
4. **`DemoBanner`**: yellow sticky banner at top of every page.
5. **Session persistence disabled**: `persistSession: false` on Supabase client.

### `db.demo.ts`
Provides identical function signatures to `db.ts` but stores data in module-level memory objects (lost on page refresh). Used for showcasing the app without a real Supabase instance.

`FIXED_ORG_ID` is the same in both layers.

---

## 18. Unit Test Coverage

Framework: **Vitest** with `jsdom` environment.

All tests mock both `../../lib/db` and `../../lib/db.demo` to prevent any network calls.

### Test Files Summary

#### `test/utils/gst.test.ts` — GST Utility
- `isInterState`: same state (case-insensitive, with spaces), different states
- `calcGST` intra-state: CGST+SGST split, exact values on ₹780/₹1000
- `calcGST` inter-state: IGST only
- Edge cases: zero taxable value, fractional values, 18% rate

#### `test/utils/numberToWords.test.ts` — Number to Words
- Zero, single digits, teens, tens
- Hundreds, thousands
- Lakhs (Indian grouping: 1,00,000)
- Crores (1,00,00,000)
- Paise (fractional amounts)
- Real invoice totals: ₹3,323 and ₹2,457

#### `test/utils/format.test.ts`
- `formatDate`, `formatTime`, `fmtINR`, `isValidDDMMYYYY`, `parseDDMMYYYY`

#### `test/store/customers.test.ts` — Customer Store
- `addCustomer`: sequential ID generation (`CUST-001`, `CUST-002`...), `createdOn` in `DD/MM/YYYY`, active flag
- `updateCustomer`: partial field update, other customers unaffected
- `deactivateCustomer`: sets `active: false`, record retained
- `getCustomerInvoices`: returns only non-cancelled invoices for that customer

#### `test/store/invoice.test.ts` — Invoice Generation (Critical)

**Invoice Numbering**:
- First invoice of FY → `INV-2627-001`
- Subsequent → `INV-2627-002`, ...
- New FY → resets to `INV-2728-001`
- No current order → returns `null`

**Intra-State GST**:
- 5% as CGST 2.5% + SGST 2.5%
- Multi-line aggregation correct
- `grandTotal = subtotal + GST`

**Inter-State GST**:
- IGST only, CGST+SGST = 0

**GST Disabled**:
- All tax fields = 0

**Discount**:
- Flat discount subtracted from grand total
- Percent discount calculated on pre-discount total
- No discount when not set (`discountAmount` undefined)

**Ready Stock Deduction**:
- Ordered qty deducted from `readyStock`
- Multiple SKUs each deducted correctly
- `ReadyStockTransaction` created with type `DEDUCT`
- Ready stock floors at 0

**Cancel Invoice**:
- Sets `cancelled: true`
- Does not affect other invoices
- Excluded from `getCustomerInvoices`

#### `test/store/inventory.test.ts` — Inventory Store

**`addPackagingEntry`**:
- Purchase increases balance
- Used decreases balance
- Damaged decreases balance
- Balance never below 0
- Entry appended to ledger

**`addReadyStockEntry` (THE CRITICAL FUNCTION)**:
- Increases ready stock by qty
- Auto-deducts linked packaging material
- Does NOT touch other packaging materials
- Creates packaging entry of type `'used'` in ledger
- Creates ready-stock ADD transaction with correct previousStock/newStock
- Works for all SKU types (WF-5P, WF-10H, etc.)
- Packaging never below 0 on large qty
- WF-25K and WF-26K share PKG-WF-26K (shared packaging)

**`adjustReadyStock`**:
- Positive delta → ADD type
- Negative delta → DEDUCT type
- Does NOT deduct packaging (correction-only)
- Floors at 0

**`editReadyStockTransaction`**:
- Delta correctly applied to current balance
- Transaction updated in list

**`deleteReadyStockTransaction`**:
- DEDUCT txn deleted → balance increased back
- ADD txn deleted → balance decreased

**`adjustStock` (raw/packaging)**:
- Positive → balance increases
- Negative → balance decreases
- Balance floors at 0
- `StockTransaction` recorded

**`setReorderLevel`**:
- Sets threshold for raw/packaging/ready
- `getStockStatus` / `getReadyStockStatus` returns correct status

#### `test/store/payments.test.ts` — Payment & Ledger

**`addPaymentReceipt`**:
- Sequential IDs: `REC-0001`, `REC-0002`, ...
- All payment modes: Cash, UPI, Bank Transfer, Cheque
- Optional `referenceNo` and `notes` stored
- Receipts isolated per customer (different customers' receipts don't mix)

**Ledger Math**:
- Opening balance → first debit
- Invoice issued → debit
- Payment → credit
- Running balance correct per row
- Outstanding = totalDebit − totalCredit
- Partial payment: outstanding reduces
- Full payment: outstanding = 0
- Over-payment: outstanding < 0
- Cancelled invoices excluded from ledger

**Date Ordering**:
- Earlier date appears before later date regardless of insertion order

#### `test/store/order.test.ts` — Order Flow
- `startNewOrder` clears cart and navigates
- `setOrderCustomer` sets customer
- `upsertCartItem` add + update
- `removeCartItem` removes item
- `setOrderDiscount` sets type + value
- `clearOrder` resets

#### `test/db/db.demo.test.ts`
- Demo DB layer functions work in isolation
- All CRUD operations on in-memory store

#### `test/e2e/flows.test.ts`
- End-to-end store-level flows (not browser E2E)
- Full order → invoice → ledger flow

---

## 19. Database Migrations History

| Migration | Date | Description |
|---|---|---|
| `20260501000000_initial_schema.sql` | 2026-05-01 | Full initial schema: all tables, indexes, enums, triggers, RLS helpers |
| `20260504000000_fix_org_rls.sql` | 2026-05-04 | Fix org-level RLS policies |
| `20260504000001_disable_rls_fixed_org.sql` | 2026-05-04 | Disable RLS for fixed-org approach (simplification) |
| `20260504000002_optional_reason_and_wf25k.sql` | 2026-05-04 | Make `reason` optional in ready_stock_transactions; add WF-25K SKU |
| `20260504000003_add_outer_bags.sql` | 2026-05-04 | Add PKG-OUTER-10X3 and PKG-OUTER-5X6 packaging materials |
| `20260508000000_bran_bag_40kg_only.sql` | 2026-05-08 | Add BR-40K (Bran 40kg Bag) SKU and PKG-BR-40K packaging |
| `20260509000000_add_discount_to_invoices.sql` | 2026-05-09 | Add `discount_type`, `discount_value`, `discount_amount` columns to `invoices` |
| `20260510000001_ensure_bran_catalog_and_fix_rls.sql` | 2026-05-10 | Ensure Bran catalog row exists + additional RLS fixes |
| `20260510000002_add_missing_discount_columns.sql` | 2026-05-10 | Ensure discount columns exist (idempotent guard) |
| `20260510000003_fix_reason_nullable.sql` | 2026-05-10 | Make `reason` nullable in `ready_stock_transactions` |

---

## 20. Security Notes

### OWASP Considerations

- **Authentication**: Supabase email OTP — no passwords stored, no SQL injection via auth.
- **Input Validation**: Client-side validation for required fields. DB enforces types via enum columns, check constraints (`quantity > 0`, `amount > 0`).
- **SQL Injection**: All queries use Supabase client with parameterised queries — no raw SQL from user input.
- **XSS in Print**: Invoice text is HTML-escaped before insertion into `<pre>` tags (`&`, `<`, `>` escaped).
- **PIN for Destructive Operations**: Delete/edit/cancel operations require a 4-digit PIN from env variable. PIN is not hashed — stored as plaintext in env. **Limitation**: PIN visible in browser env if devtools are open. Consider server-side validation for production.
- **RLS**: Row Level Security is intentionally simplified (fixed org). All authenticated users share the same org. The system is designed for single-business use.
- **CORS**: Supabase handles CORS for the anon key.
- **Secrets**: Supabase anon key is exposed client-side (by design — it's a public key). The `VITE_INVOICE_DELETE_PASSWORD` is also client-side — treat as a UX guard, not a security control.
- **Soft Deletes**: Customers are soft-deleted (`deleted_at`, `active: false`) — data is never permanently erased from DB.
- **Audit Trail**: `created_by`, `created_at`, `updated_by`, `updated_at` on key tables. `cancelled_at`, `cancelled_by` on invoices.

### `initializeCatalog` Safety Net

On every login, `initializeCatalog()` upserts all SKUs and packaging materials with `ignoreDuplicates: true`. This ensures that when new SKUs are added to the app's `products.ts` catalog, they are automatically seeded into the DB for that org without a manual migration — useful when the DB was already set up before the new product was added.

---

*Document generated: 10 May 2026*  
*Covers codebase state as of migration `20260510000003`*
