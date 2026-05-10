-- Adds discount columns that were missed when 20260509000000 was never executed
-- against the live DB (it was only marked applied via migration repair).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type   text         CHECK (discount_type IN ('percent', 'flat')),
  ADD COLUMN IF NOT EXISTS discount_value  numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);
