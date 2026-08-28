-- Standalone sales bills must not be stored in staff-readable dashboard_data.
create table if not exists public.sales_bills (
  id uuid primary key,
  bill_number bigint generated always as identity unique,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_bills enable row level security;
revoke all on public.sales_bills from anon;
grant select, insert, update on public.sales_bills to authenticated;
grant usage, select on sequence public.sales_bills_bill_number_seq to authenticated;

create policy "Admins read sales bills" on public.sales_bills
  for select to authenticated using (public.is_dd_events_admin());
create policy "Admins create sales bills" on public.sales_bills
  for insert to authenticated with check (public.is_dd_events_admin());
create policy "Admins update sales bills" on public.sales_bills
  for update to authenticated using (public.is_dd_events_admin()) with check (public.is_dd_events_admin());
