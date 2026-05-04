-- ============================================================
--  Fix: RLS policies for org creation + fn_create_org helper
--  Applied: 2026-05-04
-- ============================================================

-- Allow any authenticated user to create an organization row
do $do$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'organizations' and policyname = 'authenticated create org'
  ) then
    execute 'create policy "authenticated create org"
      on organizations for insert
      with check (auth.uid() is not null)';
  end if;
end $do$;

-- Allow a user to add themselves as owner when enrolling into a new org
do $do$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'org_members' and policyname = 'self enroll as owner'
  ) then
    execute 'create policy "self enroll as owner"
      on org_members for insert
      with check (user_id = auth.uid())';
  end if;
end $do$;

-- Atomic helper called by the app to create org + membership in one transaction.
-- security definer means it runs as the DB owner, bypassing RLS for the inserts,
-- while still scoping to the calling user via auth.uid().
create or replace function fn_create_org()
returns uuid language plpgsql security definer as $$
declare
  v_org_id uuid;
begin
  insert into organizations default values returning id into v_org_id;
  insert into org_members (org_id, user_id, role)
    values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end;
$$;
