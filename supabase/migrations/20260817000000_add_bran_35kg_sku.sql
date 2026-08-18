-- ============================================================
--  Add Bran 35 kg SKU
--
--  BR-35K is a new sellable variant of Shikharji Bran that shares
--  the existing 40 kg bag packaging material (PKG-BR-40K) with
--  BR-40K — same physical bag, less fill. Selling either BR-40K
--  or BR-35K deducts from the same PKG-BR-40K packaging stock
--  (see src/store/useStore.ts addReadyStockEntry, which deducts
--  packaging by sku.packagingId).
-- ============================================================

-- 1. Insert new SKU, reusing the existing 40 kg packaging material
insert into product_skus
  (id, org_id, product, product_id, variant, weight, packaging_id, hsn_code, gst_rate, unit)
values
  ('BR-35K', null, 'Shikharji Bran', 'BR', '35 kg Bag', 35, 'PKG-BR-40K', '2302', 0, 'Bag')
on conflict (id) do update
  set active       = true,
      packaging_id = 'PKG-BR-40K';

-- 2. Record BR-35K as another consumer of the 40 kg packaging material
update packaging_materials
set used_for = array['BR-40K', 'BR-35K']
where id = 'PKG-BR-40K';

-- 3. Extend the Bran raw material to cover the new SKU
update raw_materials
set products = array['BR-40K', 'BR-35K']
where id = 'RM-BR';
