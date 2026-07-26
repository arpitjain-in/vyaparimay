# Millbook – Database Design

## Stack
- **Database**: Supabase (PostgreSQL 15+)
- **Auth**: Supabase Auth
- **Files**: `supabase/migrations/` · `supabase/seed.sql`

---

## Entity-Relationship Overview

```
auth.users (N) ──── (N) organizations  ← via org_members (role: owner/admin/staff)
                          │
                          ├── business_profiles (1:1)
                          ├── customers (1:N)
                          │     └── (customer_id, customer_snapshot JSONB)
                          ├── invoices (1:N) ──── invoice_items (1:N) → product_skus
                          ├── payment_receipts (1:N) → customers
                          │
                          ├── packaging_entries (1:N) → packaging_materials
                          ├── production_logs (1:N)
                          ├── stock_transactions (1:N)
                          ├── ready_stock_transactions (1:N) → product_skus
                          │
                          ├── price_list (1:N) → product_skus
                          ├── reorder_levels (1:N)
                          │
                          ├── raw_material_stock (balance snapshot) → raw_materials
                          ├── packaging_stock (balance snapshot) → packaging_materials
                          ├── ready_stock (balance snapshot) → product_skus
                          │
                          ├── app_sequences { customer_seq, receipt_seq }
                          └── invoice_counters { per financial-year seq }

── Catalog (org_id IS NULL = global; org_id = custom org SKUs) ─────────
  packaging_materials  (org_id nullable)
  product_skus         (org_id nullable) ──→ packaging_materials
  raw_materials        (org_id nullable)
```

---

## Table Reference

### Catalog Tables *(seeded globally; org-extensible)*

| Table | Key Columns | Notes |
|---|---|---|
| `packaging_materials` | `id` text PK, `org_id` nullable | `org_id IS NULL` = global; non-null = org-private custom |
| `product_skus` | `id` text PK, `org_id` nullable | FK → `packaging_materials`; `active` bool |
| `raw_materials` | `id` text PK, `org_id` nullable | `products` text[] of SKU ids |

All catalog tables have: `active boolean`, `metadata jsonb`, GIN trigram index on name.

### Multi-tenant Core

| Table | PK | Notes |
|---|---|---|
| `organizations` | `uuid` | One per business / branch |
| `org_members` | `(org_id, user_id)` | Role: `owner` \| `admin` \| `staff` |

### Operational Tables *(org-scoped, RLS enforced)*

| Table | PK | org_id | Notes |
|---|---|---|---|
| `business_profiles` | `uuid` | ✓ unique | One row per org |
| `customers` | `(id, org_id)` | ✓ | id = `CUST-NNN`; `deleted_at` soft delete |
| `invoices` | `uuid` | ✓ | `invoice_no` unique per org; `customer_snapshot` JSONB; `cancelled_at/by` |
| `invoice_items` | `uuid` | via `invoice_id` | Cascades on invoice delete |
| `payment_receipts` | `(id, org_id)` | ✓ | id = `REC-NNN` |
| `packaging_entries` | `uuid` | ✓ | purchase / used / damaged ledger |
| `production_logs` | `uuid` | ✓ | Daily milling records |
| `stock_transactions` | `uuid` | ✓ | Raw + packaging adjustments |
| `ready_stock_transactions` | `uuid` | ✓ | Packed units add/deduct/adjust |
| `price_list` | `(org_id, sku_id)` | ✓ | Org-editable price per SKU |
| `reorder_levels` | `(org_id, category, item_id)` | ✓ | raw / packaging / ready |
| `raw_material_stock` | `(org_id, material_id)` | ✓ | Current balance snapshot |
| `packaging_stock` | `(org_id, material_id)` | ✓ | Current balance snapshot |
| `ready_stock` | `(org_id, sku_id)` | ✓ | Current packed-units snapshot |
| `app_sequences` | `(org_id, name)` | ✓ | Atomic counter via `fn_next_seq()` |
| `invoice_counters` | `(org_id, financial_year)` | ✓ | Atomic via `fn_next_invoice_seq()` |

All operational tables have: `metadata jsonb`, `created_by uuid`, and where mutable `updated_by uuid`.

---

## Key Design Decisions

### 1. Organization-based multi-tenancy (`org_id`)
The pivot from `user_id` to `org_id` means:
- Multiple staff (owner + warehouse + sales) can share the same business data.
- One user can own/manage multiple branches (each is a separate `organization`).
- RLS uses `fn_user_org_ids()` — a single stable function returning the set of orgs for the current user — so every policy is one line.

### 2. Org-extensible catalog
Catalog tables (`product_skus`, `packaging_materials`, `raw_materials`) have a nullable `org_id`. `NULL` = global seeded row visible to all. A non-null value = org-private custom SKU/material, living in the same table. No union queries or separate tables needed.

### 3. `metadata jsonb` everywhere
Every operational and catalog table carries `metadata jsonb not null default '{}'`. Future custom fields (e.g. delivery zone, vehicle number, FSSAI batch) can be stored here without a schema migration.

### 4. Soft deletes on mutable entities
`customers` has `deleted_at timestamptz` (null = live). Partial indexes exclude deleted rows from the hot-path queries. Invoices use `cancelled` + `cancelled_at` + `cancelled_by` for the same effect.

### 5. Audit trail (`created_by` / `updated_by`)
All operational tables record which `auth.users` row performed the write. This supports activity logs, conflict resolution between staff, and compliance requirements.

### 6. Atomic sequence functions
`fn_next_seq(org_id, name)` and `fn_next_invoice_seq(org_id, fy)` use `INSERT … ON CONFLICT DO UPDATE RETURNING` — a single atomic statement that is safe under concurrent requests. No duplicate `CUST-NNN` or `INV-NNN` IDs even with multiple staff submitting simultaneously.

### 7. `customer_snapshot` JSONB in `invoices`
The full customer record is frozen at invoice time. Historical invoices remain accurate even when addresses, GSTIN, or state changes later.

### 8. Normalised `invoice_items`
Line items in a dedicated table (not JSONB array) enable SQL aggregations: revenue per SKU, top products this month, GST reports — without parsing JSON in application code.

### 9. Stock balance snapshots
`raw_material_stock`, `packaging_stock`, `ready_stock` mirror Zustand's in-memory maps. The app writes the snapshot on every transaction. This gives O(1) current-balance reads without `SUM(quantity)` over the full ledger.

### 10. Future partitioning path
High-volume ledger tables (`invoices`, `invoice_items`, `packaging_entries`, `ready_stock_transactions`) are commented with a partition hint. When any table exceeds ~500k rows per org, add `PARTITION BY RANGE (invoice_date)` with monthly child tables — no application code change required.

### 11. Trigram search (`pg_trgm`)
GIN trigram indexes on `customers.name`, `customers.firm_name`, and `packaging_materials.name` allow fast `ILIKE '%search%'` queries for typeahead search without a full-text search engine.

---

## Running Locally with Supabase CLI

```bash
# 1. Install the CLI
brew install supabase/tap/supabase

# 2. Initialise project (first time only)
supabase init

# 3. Start local Supabase stack (Docker required)
supabase start

# 4. Apply migrations + seed
supabase db reset          # runs migrations then seed.sql

# 5. Generate TypeScript types from schema
supabase gen types typescript --local > src/types/supabase.ts
```

---

## Environment Variables

Add to `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```
