-- ============================================================
--  Two more per-customer aggregates, same shape as
--  fn_customer_outstanding, for Reports:
--
--  1. fn_customer_outstanding_asof — outstanding balance as of
--     an arbitrary cutoff date (not just "now"), for the
--     Quarterly report's "Outstanding Receivables as of
--     <quarter end>" figure, which needs the cumulative balance
--     up to a point in the past, not just activity within the
--     quarter itself.
--
--  2. fn_customer_last_activity — each customer's most recent
--     invoice date and most recent payment date, for the
--     Customer Inactivity report. Previously computed by
--     scanning every invoice and every payment receipt ever
--     created in the browser just to find two MAX() dates per
--     customer.
--
--  See src/components/Reports/ReportsPage.tsx
--  (buildQuarterReportData, buildInactivityData) and
--  src/lib/db.ts (getCustomerOutstandingAsOf,
--  getCustomerLastActivity).
-- ============================================================

create or replace function fn_customer_outstanding_asof(p_org_id uuid, p_asof date)
returns table (customer_id text, outstanding numeric)
language sql
stable
as $$
  select
    c.id as customer_id,
    c.opening_balance
      + coalesce(inv.invoiced, 0)
      - coalesce(pay.paid, 0) as outstanding
  from customers c
  left join (
    select customer_id, sum(grand_total) as invoiced
    from invoices
    where org_id = p_org_id and cancelled = false and invoice_date <= p_asof
    group by customer_id
  ) inv on inv.customer_id = c.id
  left join (
    select customer_id, sum(amount) as paid
    from payment_receipts
    where org_id = p_org_id and date <= p_asof
    group by customer_id
  ) pay on pay.customer_id = c.id
  where c.org_id = p_org_id;
$$;

create or replace function fn_customer_last_activity(p_org_id uuid)
returns table (customer_id text, last_invoice_date date, last_payment_date date)
language sql
stable
as $$
  select
    c.id as customer_id,
    inv.last_invoice_date,
    pay.last_payment_date
  from customers c
  left join (
    select customer_id, max(invoice_date) as last_invoice_date
    from invoices
    where org_id = p_org_id and cancelled = false
    group by customer_id
  ) inv on inv.customer_id = c.id
  left join (
    select customer_id, max(date) as last_payment_date
    from payment_receipts
    where org_id = p_org_id
    group by customer_id
  ) pay on pay.customer_id = c.id
  where c.org_id = p_org_id;
$$;
