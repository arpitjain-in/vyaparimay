-- ============================================================
--  Per-customer outstanding balance aggregate
--
--  Computes (opening_balance + invoiced − paid) server-side for
--  every customer in one indexed GROUP BY pass, instead of the
--  Dashboard's "Top Debtors" card scanning every invoice × every
--  payment receipt in the browser (O(customers × invoices), and
--  requiring the full org invoice/payment history to be loaded
--  just to render one card). See
--  src/components/Dashboard/Dashboard.tsx (topDebtors) and
--  src/lib/db.ts (getCustomerOutstanding).
-- ============================================================

create or replace function fn_customer_outstanding(p_org_id uuid)
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
    where org_id = p_org_id and cancelled = false
    group by customer_id
  ) inv on inv.customer_id = c.id
  left join (
    select customer_id, sum(amount) as paid
    from payment_receipts
    where org_id = p_org_id
    group by customer_id
  ) pay on pay.customer_id = c.id
  where c.org_id = p_org_id;
$$;
