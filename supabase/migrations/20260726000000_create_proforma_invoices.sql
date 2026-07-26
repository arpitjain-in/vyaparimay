-- ============================================================
--  Proforma invoices: preliminary, non-tax quote documents.
--  Kept in a table separate from `invoices` so they never leak
--  into GST reports, the customer ledger, or stock deductions —
--  generating one has zero effect on ready/packaging stock.
--  Items are stored as jsonb (no linked line-item table) since
--  proforma documents are never queried per-line for reporting.
-- ============================================================

create table proforma_invoices (
  id                uuid primary key default extensions.uuid_generate_v4(),
  org_id            uuid not null references organizations (id) on delete cascade,
  proforma_no       text not null,            -- 'PRO/2627/05/01'
  invoice_date      date not null,
  invoice_time      time not null,
  customer_id       text not null,
  customer_snapshot jsonb not null,
  items             jsonb not null default '[]',
  subtotal          numeric(12, 2) not null,
  cgst_total        numeric(12, 2) not null default 0,
  sgst_total        numeric(12, 2) not null default 0,
  igst_total        numeric(12, 2) not null default 0,
  total_gst         numeric(12, 2) not null default 0,
  discount_type     text,
  discount_value    numeric(12, 2),
  discount_amount   numeric(12, 2),
  transport_charges numeric(12, 2),
  loading_charges   numeric(12, 2),
  round_off         numeric(6,  2) not null default 0,
  grand_total       numeric(12, 2) not null,
  is_inter_state    boolean not null default false,
  payment_mode      invoice_payment_mode_enum not null,
  amount_in_words   text not null,
  financial_year    text not null,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id),
  unique (org_id, proforma_no)
);

create index idx_proforma_invoices_org_id      on proforma_invoices (org_id);
create index idx_proforma_invoices_customer_id on proforma_invoices (org_id, customer_id);

-- Auth is bypassed in this single-tenant deployment (see
-- 20260504000001_disable_rls_fixed_org.sql) — mirror that here rather than
-- enabling RLS policies that would silently hide all rows.
alter table proforma_invoices disable row level security;
