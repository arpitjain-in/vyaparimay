-- ============================================================
--  Bran bag configuration change
--  Remove 25 kg and 50 kg; add 40 kg only.
--
--  Old SKUs (BR-50K, BR-25K) and packaging materials
--  (PKG-BR-50K, PKG-BR-25K) are deactivated (not deleted)
--  to preserve historical invoice / stock transaction data.
-- ============================================================

-- 1. Insert new packaging material
insert into packaging_materials (id, org_id, name, used_for)
values ('PKG-BR-40K', null, '40 kg Bags (Shikharji Bran)', array['BR-40K'])
on conflict (id) do nothing;

-- 2. Insert new SKU
insert into product_skus (id, org_id, product, product_id, variant, weight, packaging_id, hsn_code, gst_rate, unit)
values ('BR-40K', null, 'Shikharji Bran', 'BR', '40 kg Bag', 40, 'PKG-BR-40K', '2302', 5, 'Bag')
on conflict (id) do nothing;

-- 3. Update raw material to reference only the new SKU
update raw_materials
set products = array['BR-40K']
where id = 'RM-BR';

-- 4. Deactivate old SKUs (preserves FK integrity with invoice_items, ready_stock_transactions, etc.)
update product_skus
set active = false
where id in ('BR-50K', 'BR-25K');

-- 5. Deactivate old packaging materials
update packaging_materials
set active = false
where id in ('PKG-BR-50K', 'PKG-BR-25K');
