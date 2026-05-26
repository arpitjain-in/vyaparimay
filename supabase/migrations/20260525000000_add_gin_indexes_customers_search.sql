-- GIN trigram indexes for fast customer search (ILIKE queries on name and mobile)
-- Requires pg_trgm extension (enabled in Supabase by default)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_name_gin
  ON customers USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_mobile_gin
  ON customers USING GIN (mobile gin_trgm_ops);
