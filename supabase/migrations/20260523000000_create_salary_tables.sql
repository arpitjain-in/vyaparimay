-- ─── Salary Feature Tables ────────────────────────────────────────────────────

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  role text not null default '',
  monthly_salary numeric(12,2) not null default 0,
  employment_start_date date not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists employee_leaves (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  is_half_day boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists employee_advances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null references employees(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- One salary record per employee per month (YYYY-MM).
-- advance_deducted tracks how much advance was recovered this month.
-- Net pending advance = sum(employee_advances.amount) - sum(salary_records.advance_deducted)
create table if not exists salary_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  employee_id uuid not null references employees(id) on delete cascade,
  month text not null,
  gross_salary numeric(12,2) not null default 0,
  working_days integer not null default 0,
  leave_days numeric(4,1) not null default 0,
  leave_deduction numeric(12,2) not null default 0,
  advance_deducted numeric(12,2) not null default 0,
  bonus_amount numeric(12,2) not null default 0,
  net_payable numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_records_employee_month_unique unique (employee_id, month)
);
