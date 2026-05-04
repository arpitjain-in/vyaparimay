-- ============================================================
--  Vyaparimay – Initial Schema
--  Supabase / PostgreSQL 15+
--  Migration: 20260501000000
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- fast ILIKE / trigram search on names

-- ─── Enum Types ──────────────────────────────────────────────────────────────

create type customer_type_enum as enum (
  'Retailer', 'Wholesaler', 'Distributor', 'Direct Consumer'
);

create type payment_terms_enum as enum (
  'Cash', '7 Days', '15 Days', '30 Days'
);

create type payment_mode_enum as enum (
  'Cash', 'Bank Transfer', 'UPI', 'Cheque'
);

create type invoice_payment_mode_enum as enum (
  'Cash', 'Credit'
);

create type stock_tx_type_enum as enum (
  'ADD', 'DEDUCT', 'ADJUST'
);

create type stock_item_type_enum as enum (
  'raw', 'packaging'
);

create type packaging_entry_type_enum as enum (
  'purchase', 'used', 'damaged'
);

create type price_unit_enum as enum (
  'piece', 'kg'
);

create type reorder_category_enum as enum (
  'raw', 'packaging', 'ready'
);

create type org_role_enum as enum (
  'owner', 'admin', 'staff'
);

-- ============================================================
--  MULTI-TENANT CORE
--  All business data is scoped to an `organization`.
--  A single auth.user can belong to multiple organizations
--  (e.g. owner of two branches), and an organization can have
--  multiple users (e.g. owner + staff).
-- ============================================================

-- ─── Organizations ───────────────────────────────────────────────────────────
create table organizations (
  id         uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Org Members ─────────────────────────────────────────────────────────────
create table org_members (
  org_id    uuid not null references organizations (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      org_role_enum not null default 'owner',
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index idx_org_members_user_id on org_members (user_id);

-- ─── RLS Helper: orgs the current user belongs to ────────────────────────────
-- Returns the set of org_ids for the authenticated user.
-- Used in every operational-table RLS policy to avoid N joins.
create or replace function fn_user_org_ids()
returns setof uuid language sql security definer stable as $$
  select org_id from org_members where user_id = auth.uid();
$$;

-- ─── auto-update updated_at trigger function ─────────────────────────────────
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
--  CATALOG TABLES
--  Global rows (org_id IS NULL) are seeded once and shared.
--  Org-specific rows (org_id IS NOT NULL) allow each business
--  to define custom SKUs / packaging without touching the
--  global catalog — no schema change required.
-- ============================================================

-- ─── Packaging Materials ─────────────────────────────────────────────────────
create table packaging_materials (
  id         text primary key,
  -- null = global catalog; non-null = org-private custom material
  org_id     uuid references organizations (id) on delete cascade,
  name       text not null,
  used_for   text[] not null default '{}',   -- array of SKU ids
  active     boolean not null default true,
  metadata   jsonb not null default '{}',    -- extensible without schema changes
  created_at timestamptz not null default now()
);

create index idx_packaging_materials_org_id on packaging_materials (org_id);
create index idx_packaging_materials_name_trgm
  on packaging_materials using gin (name gin_trgm_ops);

-- ─── Product SKUs ─────────────────────────────────────────────────────────────
create table product_skus (
  id           text primary key,
  org_id       uuid references organizations (id) on delete cascade,  -- null = global
  product      text not null,
  product_id   text not null,
  variant      text not null,
  weight       numeric(8, 3) not null,
  packaging_id text references packaging_materials (id),
  hsn_code     text not null,
  gst_rate     numeric(5, 2) not null,
  unit         text not null,
  active       boolean not null default true,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

create index idx_product_skus_org_id     on product_skus (org_id);
create index idx_product_skus_product_id on product_skus (product_id);
-- Partial index: only active SKUs (hot path)
create index idx_product_skus_active
  on product_skus (org_id, active) where active = true;

-- ─── Raw Materials ───────────────────────────────────────────────────────────
create table raw_materials (
  id         text primary key,
  org_id     uuid references organizations (id) on delete cascade,  -- null = global
  name       text not null,
  products   text[] not null default '{}',
  active     boolean not null default true,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_raw_materials_org_id on raw_materials (org_id);

-- ============================================================
--  OPERATIONAL TABLES  (org-scoped, RLS enforced)
--  Every table carries org_id → organizations(id).
--  created_by / updated_by columns provide a full audit trail.
--  metadata jsonb allows adding custom fields without migrations.
--  deleted_at supports soft-delete on mutable entities.
-- ============================================================

-- ─── Business Profiles ───────────────────────────────────────────────────────
-- Exactly one row per organization (the registered business details).
create table business_profiles (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null,
  address1    text not null,
  address2    text,
  city        text not null,
  state       text not null,
  pin_code    text not null,
  gstin       text not null,
  fssai       text not null,
  mobile      text not null,
  email       text,
  tagline     text,
  bank_name   text,
  account_no  text,
  ifsc_code   text,
  upi_id      text,
  gst_enabled boolean not null default true,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_by  uuid references auth.users (id),
  unique (org_id)
);

create trigger trg_business_profiles_updated_at
  before update on business_profiles
  for each row execute procedure fn_set_updated_at();

-- ─── Customers ───────────────────────────────────────────────────────────────
create table customers (
  id               text not null,          -- 'CUST-001' (app-generated)
  org_id           uuid not null references organizations (id) on delete cascade,
  seq              integer not null,        -- monotonic counter per org
  name             text not null,
  firm_name        text,
  mobile           text not null,
  alternate_mobile text,
  address1         text not null,
  address2         text,
  city             text not null,
  state            text not null,
  pin_code         text,
  gstin            text,
  fssai            text,
  customer_type    customer_type_enum not null,
  credit_limit     numeric(12, 2) not null default 0,
  payment_terms    payment_terms_enum not null,
  opening_balance  numeric(12, 2) not null default 0,
  notes            text,
  active           boolean not null default true,
  metadata         jsonb not null default '{}',
  created_on       date not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,             -- soft delete; null = not deleted
  created_by       uuid references auth.users (id),
  updated_by       uuid references auth.users (id),
  primary key (id, org_id)
);

create index idx_customers_org_id on customers (org_id);
-- Partial index: only active, non-deleted rows (hot path)
create index idx_customers_active
  on customers (org_id) where active = true and deleted_at is null;
-- Trigram search on customer and firm name
create index idx_customers_name_trgm
  on customers using gin (name gin_trgm_ops);
create index idx_customers_firm_name_trgm
  on customers using gin (firm_name gin_trgm_ops)
  where firm_name is not null;

create trigger trg_customers_updated_at
  before update on customers
  for each row execute procedure fn_set_updated_at();

-- ─── Invoices ────────────────────────────────────────────────────────────────
-- Partition hint: add PARTITION BY RANGE (invoice_date) with monthly
-- child tables when row count exceeds ~500k per org.
create table invoices (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references organizations (id) on delete cascade,
  invoice_no        text not null,            -- 'INV-2627-001'
  invoice_date      date not null,
  invoice_time      time not null,
  customer_id       text not null,
  -- Full snapshot at issue time — historical accuracy even if customer changes
  customer_snapshot jsonb not null,
  subtotal          numeric(12, 2) not null,
  cgst_total        numeric(12, 2) not null default 0,
  sgst_total        numeric(12, 2) not null default 0,
  igst_total        numeric(12, 2) not null default 0,
  total_gst         numeric(12, 2) not null default 0,
  round_off         numeric(6,  2) not null default 0,
  grand_total       numeric(12, 2) not null,
  is_inter_state    boolean not null default false,
  payment_mode      invoice_payment_mode_enum not null,
  amount_in_words   text not null,
  financial_year    text not null,
  cancelled         boolean not null default false,
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id),
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id),
  unique (org_id, invoice_no)
);

create index idx_invoices_org_id         on invoices (org_id);
create index idx_invoices_customer_id    on invoices (org_id, customer_id);
create index idx_invoices_invoice_date   on invoices (org_id, invoice_date desc);
create index idx_invoices_financial_year on invoices (org_id, financial_year);
-- Partial index: active invoices only (most queries exclude cancelled)
create index idx_invoices_active
  on invoices (org_id, invoice_date desc) where cancelled = false;
-- GIN on customer_snapshot for ad-hoc JSON queries
create index idx_invoices_customer_snapshot_gin
  on invoices using gin (customer_snapshot);

-- ─── Invoice Items ────────────────────────────────────────────────────────────
-- Rows cascade-deleted with their parent invoice.
-- org_id omitted intentionally — security boundary is enforced via invoice_id.
create table invoice_items (
  id            uuid primary key default uuid_generate_v4(),
  invoice_id    uuid not null references invoices (id) on delete cascade,
  sku_id        text not null references product_skus (id),
  product       text not null,
  variant       text not null,
  weight        numeric(8,  3) not null,
  hsn_code      text not null,
  gst_rate      numeric(5,  2) not null,
  quantity      integer not null check (quantity > 0),
  rate          numeric(10, 2) not null check (rate >= 0),
  taxable_value numeric(12, 2) not null,
  cgst          numeric(10, 2) not null default 0,
  sgst          numeric(10, 2) not null default 0,
  igst          numeric(10, 2) not null default 0,
  line_total    numeric(12, 2) not null,
  unit          text not null,
  metadata      jsonb not null default '{}'
);

create index idx_invoice_items_invoice_id on invoice_items (invoice_id);
create index idx_invoice_items_sku_id     on invoice_items (sku_id);

-- ─── Payment Receipts ────────────────────────────────────────────────────────
create table payment_receipts (
  id           text not null,            -- 'REC-001'
  org_id       uuid not null references organizations (id) on delete cascade,
  customer_id  text not null,
  date         date not null,
  time         time not null,
  amount       numeric(12, 2) not null check (amount > 0),
  mode         payment_mode_enum not null,
  reference_no text,
  notes        text,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id),
  primary key (id, org_id)
);

create index idx_payment_receipts_org_id      on payment_receipts (org_id);
create index idx_payment_receipts_customer_id on payment_receipts (org_id, customer_id);
create index idx_payment_receipts_date        on payment_receipts (org_id, date desc);

-- ─── Packaging Entries ───────────────────────────────────────────────────────
create table packaging_entries (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organizations (id) on delete cascade,
  date           date not null,
  time           time not null,
  material_id    text not null references packaging_materials (id),
  material_name  text not null,
  entry_type     packaging_entry_type_enum not null,
  quantity       numeric(10, 2) not null,
  price_unit     price_unit_enum,
  price_per_unit numeric(10, 2),
  total_amount   numeric(12, 2),
  supplier       text,
  notes          text,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id)
);

create index idx_packaging_entries_org_id      on packaging_entries (org_id);
create index idx_packaging_entries_material_id on packaging_entries (org_id, material_id);
create index idx_packaging_entries_date        on packaging_entries (org_id, date desc);

-- ─── Production Logs ─────────────────────────────────────────────────────────
create table production_logs (
  id                uuid primary key default uuid_generate_v4(),
  org_id            uuid not null references organizations (id) on delete cascade,
  date              date not null,
  time              time not null,
  product_name      text not null,
  quantity_produced numeric(10, 2) not null,
  notes             text,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id)
);

create index idx_production_logs_org_id on production_logs (org_id);
create index idx_production_logs_date   on production_logs (org_id, date desc);

-- ─── Stock Transactions ───────────────────────────────────────────────────────
create table stock_transactions (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organizations (id) on delete cascade,
  type           stock_tx_type_enum not null,
  item_type      stock_item_type_enum not null,
  item_id        text not null,
  item_name      text not null,
  quantity       numeric(10, 2) not null,
  previous_stock numeric(10, 2) not null,
  new_stock      numeric(10, 2) not null,
  reason         text not null,
  supplier_name  text,
  invoice_no     text,
  date           date not null,
  time           time not null,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id)
);

create index idx_stock_tx_org_id  on stock_transactions (org_id);
create index idx_stock_tx_item_id on stock_transactions (org_id, item_id);
create index idx_stock_tx_date    on stock_transactions (org_id, date desc);

-- ─── Ready Stock Transactions ────────────────────────────────────────────────
create table ready_stock_transactions (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organizations (id) on delete cascade,
  date           date not null,
  time           time not null,
  sku_id         text not null references product_skus (id),
  sku_name       text not null,
  type           stock_tx_type_enum not null,
  quantity       integer not null,
  previous_stock integer not null,
  new_stock      integer not null,
  reason         text not null,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id)
);

create index idx_ready_stock_tx_org_id on ready_stock_transactions (org_id);
create index idx_ready_stock_tx_sku_id on ready_stock_transactions (org_id, sku_id);
create index idx_ready_stock_tx_date   on ready_stock_transactions (org_id, date desc);

-- ─── Price List ──────────────────────────────────────────────────────────────
create table price_list (
  org_id     uuid not null references organizations (id) on delete cascade,
  sku_id     text not null references product_skus (id),
  rate       numeric(10, 2) not null check (rate >= 0),
  metadata   jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (org_id, sku_id)
);

create index idx_price_list_org_id on price_list (org_id);

create trigger trg_price_list_updated_at
  before update on price_list
  for each row execute procedure fn_set_updated_at();

-- ─── Reorder Levels ──────────────────────────────────────────────────────────
create table reorder_levels (
  org_id     uuid not null references organizations (id) on delete cascade,
  category   reorder_category_enum not null,
  item_id    text not null,
  level      numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (org_id, category, item_id)
);

create index idx_reorder_levels_org_id on reorder_levels (org_id);

create trigger trg_reorder_levels_updated_at
  before update on reorder_levels
  for each row execute procedure fn_set_updated_at();

-- ─── Stock Balance Snapshots ─────────────────────────────────────────────────
-- Current balance per item; maintained by the app on every transaction.
-- Enables O(1) reads without summing the full ledger.
-- check (quantity >= 0) prevents going negative at the DB layer.

create table raw_material_stock (
  org_id      uuid not null references organizations (id) on delete cascade,
  material_id text not null references raw_materials (id),
  quantity    numeric(10, 2) not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  primary key (org_id, material_id)
);

create trigger trg_raw_material_stock_updated_at
  before update on raw_material_stock
  for each row execute procedure fn_set_updated_at();

create table packaging_stock (
  org_id      uuid not null references organizations (id) on delete cascade,
  material_id text not null references packaging_materials (id),
  quantity    numeric(10, 2) not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  primary key (org_id, material_id)
);

create trigger trg_packaging_stock_updated_at
  before update on packaging_stock
  for each row execute procedure fn_set_updated_at();

create table ready_stock (
  org_id     uuid not null references organizations (id) on delete cascade,
  sku_id     text not null references product_skus (id),
  quantity   integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  primary key (org_id, sku_id)
);

create trigger trg_ready_stock_updated_at
  before update on ready_stock
  for each row execute procedure fn_set_updated_at();

-- ─── Sequences / Counters ────────────────────────────────────────────────────
-- fn_next_seq / fn_next_invoice_seq use INSERT … ON CONFLICT DO UPDATE
-- to guarantee atomicity under concurrent requests — no duplicate IDs
-- even with multiple staff using the app simultaneously.

create table app_sequences (
  org_id uuid not null references organizations (id) on delete cascade,
  name   text not null,   -- 'customer_seq' | 'receipt_seq'
  value  integer not null default 0,
  primary key (org_id, name)
);

create table invoice_counters (
  org_id         uuid not null references organizations (id) on delete cascade,
  financial_year text not null,   -- '2627'
  seq            integer not null default 0,
  primary key (org_id, financial_year)
);

create or replace function fn_next_seq(p_org_id uuid, p_name text)
returns integer language plpgsql security definer as $$
declare
  v_seq integer;
begin
  insert into app_sequences (org_id, name, value)
    values (p_org_id, p_name, 1)
  on conflict (org_id, name) do update
    set value = app_sequences.value + 1
  returning value into v_seq;
  return v_seq;
end;
$$;

create or replace function fn_next_invoice_seq(p_org_id uuid, p_financial_year text)
returns integer language plpgsql security definer as $$
declare
  v_seq integer;
begin
  insert into invoice_counters (org_id, financial_year, seq)
    values (p_org_id, p_financial_year, 1)
  on conflict (org_id, financial_year) do update
    set seq = invoice_counters.seq + 1
  returning seq into v_seq;
  return v_seq;
end;
$$;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

-- Catalog tables: globally readable; org-private rows writable by org members
alter table packaging_materials enable row level security;
alter table product_skus         enable row level security;
alter table raw_materials        enable row level security;

create policy "catalog global read"
  on packaging_materials for select
  using (org_id is null or org_id in (select fn_user_org_ids()));

create policy "catalog org write"
  on packaging_materials for insert
  with check (org_id in (select fn_user_org_ids()));

create policy "catalog org modify"
  on packaging_materials for update
  using (org_id in (select fn_user_org_ids()));

create policy "catalog global read"
  on product_skus for select
  using (org_id is null or org_id in (select fn_user_org_ids()));

create policy "catalog org write"
  on product_skus for insert
  with check (org_id in (select fn_user_org_ids()));

create policy "catalog org modify"
  on product_skus for update
  using (org_id in (select fn_user_org_ids()));

create policy "catalog global read"
  on raw_materials for select
  using (org_id is null or org_id in (select fn_user_org_ids()));

create policy "catalog org write"
  on raw_materials for insert
  with check (org_id in (select fn_user_org_ids()));

create policy "catalog org modify"
  on raw_materials for update
  using (org_id in (select fn_user_org_ids()));

-- Operational tables
alter table organizations            enable row level security;
alter table org_members              enable row level security;
alter table business_profiles        enable row level security;
alter table customers                enable row level security;
alter table invoices                 enable row level security;
alter table invoice_items            enable row level security;
alter table payment_receipts         enable row level security;
alter table packaging_entries        enable row level security;
alter table production_logs          enable row level security;
alter table stock_transactions       enable row level security;
alter table ready_stock_transactions enable row level security;
alter table price_list               enable row level security;
alter table reorder_levels           enable row level security;
alter table raw_material_stock       enable row level security;
alter table packaging_stock          enable row level security;
alter table ready_stock              enable row level security;
alter table app_sequences            enable row level security;
alter table invoice_counters         enable row level security;

create policy "org member read" on organizations for select
  using (id in (select fn_user_org_ids()));
create policy "org member modify" on organizations for update
  using (id in (select fn_user_org_ids()));

create policy "org member read" on org_members for select
  using (org_id in (select fn_user_org_ids()));
-- Only owners can add/remove members
create policy "org owner manage" on org_members for all
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id
        and om.user_id = auth.uid()
        and om.role = 'owner'
    )
  );

create policy "org access" on business_profiles
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on customers
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on invoices
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

-- invoice_items inherit security from their parent invoice
create policy "org access via invoice" on invoice_items
  for all using (
    exists (
      select 1 from invoices
      where invoices.id = invoice_items.invoice_id
        and invoices.org_id in (select fn_user_org_ids())
    )
  );

create policy "org access" on payment_receipts
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on packaging_entries
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on production_logs
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on stock_transactions
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on ready_stock_transactions
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on price_list
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on reorder_levels
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on raw_material_stock
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on packaging_stock
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on ready_stock
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on app_sequences
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));

create policy "org access" on invoice_counters
  for all using (org_id in (select fn_user_org_ids()))
  with check (org_id in (select fn_user_org_ids()));
