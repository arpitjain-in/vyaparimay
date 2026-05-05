-- ============================================================
--  Fix: Disable RLS on operational tables for single-tenant
--  auth-bypass mode + seed the fixed org row.
--
--  Context: The app uses a fixed org ID and bypasses Supabase
--  Auth entirely (anon key, no JWT user). All RLS policies that
--  rely on auth.uid() therefore silently return 0 rows, causing
--  data to vanish on refresh. The correct fix for this auth-bypass
--  architecture is to disable RLS and seed the fixed org.
-- ============================================================

-- ─── Ensure the fixed org row exists ─────────────────────────────────────────
insert into organizations (id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ─── Disable RLS on all operational tables ───────────────────────────────────
-- (Auth is bypassed: the anon key accesses the DB directly with no JWT user.
--  RLS based on auth.uid() would always deny access in this mode.)

alter table organizations            disable row level security;
alter table org_members              disable row level security;
alter table business_profiles        disable row level security;
alter table customers                disable row level security;
alter table invoices                 disable row level security;
alter table invoice_items            disable row level security;
alter table payment_receipts         disable row level security;
alter table packaging_entries        disable row level security;
alter table production_logs          disable row level security;
alter table stock_transactions       disable row level security;
alter table ready_stock_transactions disable row level security;
alter table price_list               disable row level security;
alter table reorder_levels           disable row level security;
alter table raw_material_stock       disable row level security;
alter table packaging_stock          disable row level security;
alter table ready_stock              disable row level security;
alter table app_sequences            disable row level security;
alter table invoice_counters         disable row level security;
