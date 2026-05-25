-- ============================================================
--  Add optional transport and loading charge fields to invoices.
--  transport_charges : freight / transport cost (nullable)
--  loading_charges   : loading / unloading cost (nullable)
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS transport_charges numeric(10,2),
  ADD COLUMN IF NOT EXISTS loading_charges   numeric(10,2);
