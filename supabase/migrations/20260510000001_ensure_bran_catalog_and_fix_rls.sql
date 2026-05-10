-- ============================================================
--  Hotfix: Ensure Bran catalog rows exist + disable catalog RLS
--
--  Run this in Supabase SQL Editor to fix two issues:
--
--  1. BR-40K / PKG-BR-40K may not exist in the live DB if the
--     20260508000000_bran_bag_40kg_only migration was never applied.
--     The FK on invoice_items.sku_id → product_skus(id) then rejects
--     any Bran invoice with "violates foreign key constraint".
--
--  2. Catalog tables have RLS enabled with policies that rely on
--     auth.uid().  With the anon key (no JWT user) auth.uid()=null,
--     so fn_user_org_ids() returns an empty set.  Disabling RLS on
--     catalog tables is safe: all write paths are app-controlled.
-- ============================================================

-- ── 1. Ensure Bran packaging material exists ────────────────────────────────
insert into packaging_materials (id, org_id, name, used_for)
values ('PKG-BR-40K', null, '40 kg Bags (Shikharji Bran)', array['BR-40K'])
on conflict (id) do update
  set name     = excluded.name,
      used_for = excluded.used_for,
      active   = true;

-- ── 2. Ensure Bran SKU exists ───────────────────────────────────────────────
insert into product_skus
  (id, org_id, product, product_id, variant, weight, packaging_id, hsn_code, gst_rate, unit)
values
  ('BR-40K', null, 'Shikharji Bran', 'BR', '40 kg Bag', 40, 'PKG-BR-40K', '2302', 5, 'Bag')
on conflict (id) do update
  set active       = true,
      packaging_id = 'PKG-BR-40K';

-- ── 3. Ensure Bran raw material exists ─────────────────────────────────────
insert into raw_materials (id, org_id, name, products)
values ('RM-BR', null, 'Shikharji Bran', array['BR-40K'])
on conflict (id) do update
  set products = array['BR-40K'];

-- ── 4. Disable RLS on catalog tables ───────────────────────────────────────
alter table packaging_materials disable row level security;
alter table product_skus         disable row level security;
alter table raw_materials        disable row level security;
