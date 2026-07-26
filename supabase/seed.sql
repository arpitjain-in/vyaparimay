-- ============================================================
--  Millbook – Seed Data
--  Run AFTER the initial schema migration.
--  Populates shared catalog tables (packaging, SKUs, raw materials).
-- ============================================================

-- ─── Packaging Materials ─────────────────────────────────────────────────────
-- org_id is NULL for all global catalog rows (shared across all organizations)
insert into packaging_materials (id, org_id, name, used_for) values
  ('PKG-WF-26K',      null, '25/26 kg Bags (Shikharji Atta)',    array['WF-26K', 'WF-25K']),
  ('PKG-WF-5P',       null, '5 kg Pouches (Shikharji Atta)',      array['WF-5P']),
  ('PKG-WF-10P',      null, '10 kg Pouches (Shikharji Atta)',     array['WF-10P']),
  ('PKG-WF-5H',       null, '5 kg Handle Bags (Shikharji Atta)',  array['WF-5H']),
  ('PKG-WF-10H',      null, '10 kg Handle Bags (Shikharji Atta)', array['WF-10H']),
  ('PKG-BS-40K',      null, '40 kg Bags (Shikharji Besan)',        array['BS-40K']),
  ('PKG-BS-500G',     null, '500 gm Packets (Shikharji Besan)',    array['BS-500G']),
  ('PKG-DL-500G',     null, '500 gm Packets (Shikharji Dalia)',   array['DL-500G']),
  ('PKG-BR-40K',      null, '40 kg Bags (Shikharji Bran)',         array['BR-40K']),
  ('PKG-OUTER-10X3',  null, 'Outer Bag 10X3',                      array[]::text[]),
  ('PKG-OUTER-5X6',   null, 'Outer Bag 5X6',                       array[]::text[]);

-- ─── Product SKUs ─────────────────────────────────────────────────────────────
insert into product_skus (id, org_id, product, product_id, variant, weight, packaging_id, hsn_code, gst_rate, unit) values
  -- Shikharji Atta
  ('WF-26K',  null, 'Shikharji Atta', 'WF', '26 kg Bag',         26,    'PKG-WF-26K',  '1101', 5, 'Bag'),
  ('WF-25K',  null, 'Shikharji Atta', 'WF', '25 kg Bag',         25,    'PKG-WF-26K',  '1101', 5, 'Bag'),
  ('WF-5P',   null, 'Shikharji Atta', 'WF', '5 kg Pouch',         5,    'PKG-WF-5P',   '1101', 5, 'Pouch'),
  ('WF-10P',  null, 'Shikharji Atta', 'WF', '10 kg Pouch',        10,   'PKG-WF-10P',  '1101', 5, 'Pouch'),
  ('WF-5H',   null, 'Shikharji Atta', 'WF', '5 kg Handle Bag',    5,    'PKG-WF-5H',   '1101', 5, 'Bag'),
  ('WF-10H',  null, 'Shikharji Atta', 'WF', '10 kg Handle Bag',   10,   'PKG-WF-10H',  '1101', 5, 'Bag'),
  -- Shikharji Besan
  ('BS-40K',  null, 'Shikharji Besan',       'BS', '40 kg Bag',          40,   'PKG-BS-40K',  '1106', 5, 'Bag'),
  ('BS-500G', null, 'Shikharji Besan',       'BS', '500 gm Packet',       0.5, 'PKG-BS-500G', '1106', 5, 'Packet'),
  -- Shikharji Dalia
  ('DL-500G', null, 'Shikharji Dalia',      'DL', '500 gm Packet',       0.5, 'PKG-DL-500G', '1104', 5, 'Packet'),
  -- Shikharji Bran
  ('BR-40K',  null, 'Shikharji Bran',        'BR', '40 kg Bag',           40,  'PKG-BR-40K',  '2302', 5, 'Bag');

-- ─── Raw Materials ───────────────────────────────────────────────────────────
insert into raw_materials (id, org_id, name, products) values
  ('RM-WF', null, 'Shikharji Atta', array['WF-26K', 'WF-25K', 'WF-5P', 'WF-10P', 'WF-5H', 'WF-10H']),
  ('RM-BS', null, 'Shikharji Besan',       array['BS-40K', 'BS-500G']),
  ('RM-DL', null, 'Shikharji Dalia',      array['DL-500G']),
  ('RM-BR', null, 'Shikharji Bran',        array['BR-40K']);
