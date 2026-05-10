-- Applies schema changes from 20260504000002 that were never executed on the live DB:
-- Makes ready_stock_transactions.reason optional (nullable).
ALTER TABLE ready_stock_transactions
  ALTER COLUMN reason DROP NOT NULL;
