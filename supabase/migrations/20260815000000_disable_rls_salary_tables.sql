-- ============================================================
--  Fix: employee insert fails with 42501 (RLS policy violation).
--
--  The salary feature tables (employees, employee_leaves,
--  employee_advances, salary_records) ended up with RLS enabled
--  and no policies — likely from being created via the Supabase
--  Studio table editor, which defaults new tables to RLS-on.
--  20260523000000_create_salary_tables.sql then ran as a no-op
--  `create table if not exists` against the already-existing
--  tables, so it never got the RLS-disable treatment.
--
--  Auth is bypassed in this single-tenant deployment (see
--  20260504000001_disable_rls_fixed_org.sql) — mirror that here
--  rather than enabling RLS policies that would silently deny
--  every insert/select (as seen with the employees table).
-- ============================================================

alter table employees         disable row level security;
alter table employee_leaves   disable row level security;
alter table employee_advances disable row level security;
alter table salary_records    disable row level security;
