-- ============================================================
--  Migration: Add outer bag packaging materials
--  Also merges PKG-WF-25K into PKG-WF-26K (shared bag pool)
-- ============================================================

-- 1. Add new outer bag materials
insert into packaging_materials (id, org_id, name, used_for)
values
  ('PKG-OUTER-10X3', null, 'Outer Bag 10X3', array[]::text[]),
  ('PKG-OUTER-5X6',  null, 'Outer Bag 5X6',  array[]::text[])
on conflict (id) do nothing;

-- 2. Merge 25 kg bag into the 26 kg bag pool
--    Update PKG-WF-26K to cover both SKUs
update packaging_materials
set name     = '25/26 kg Bags (Shikharji Atta)',
    used_for = array['WF-26K', 'WF-25K']
where id = 'PKG-WF-26K';

--    Point WF-25K SKU to the shared packaging id
update product_skus
set packaging_id = 'PKG-WF-26K'
where id = 'WF-25K';

--    Remove the now-unused PKG-WF-25K row (safe if no entries reference it)
delete from packaging_materials where id = 'PKG-WF-25K';
