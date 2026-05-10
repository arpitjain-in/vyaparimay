-- ============================================================
--  Add optional discount fields to invoices table.
--  discount_type  : 'percent' or 'flat' (nullable)
--  discount_value : user-entered value  (nullable)
--  discount_amount: computed ₹ deduction (nullable)
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type   text         CHECK (discount_type IN ('percent', 'flat')),
  ADD COLUMN IF NOT EXISTS discount_value  numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);
