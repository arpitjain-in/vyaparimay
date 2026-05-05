-- ============================================================
--  Make ready_stock_transactions.reason optional (nullable)
--  and add 25 kg Bag (WF-25K) to catalog tables.
-- ============================================================

-- ─── reason column: allow NULL ────────────────────────────────────────────────
alter table ready_stock_transactions
  alter column reason drop not null;

-- ─── 25 kg Bag – Shikharji Atta ──────────────────────────────────────────────
insert into packaging_materials (id, org_id, name, used_for)
values ('PKG-WF-25K', null, '25 kg Bags (Shikharji Atta)', array['WF-25K'])
on conflict (id) do nothing;

insert into product_skus (id, org_id, product, product_id, variant, weight, packaging_id, hsn_code, gst_rate, unit)
values ('WF-25K', null, 'Shikharji Atta', 'WF', '25 kg Bag', 25, 'PKG-WF-25K', '1101', 5, 'Bag')
on conflict (id) do nothing;

-- Update raw_material RM-WF to include WF-25K
update raw_materials
set products = array_append(products, 'WF-25K')
where id = 'RM-WF'
  and not ('WF-25K' = any(products));
