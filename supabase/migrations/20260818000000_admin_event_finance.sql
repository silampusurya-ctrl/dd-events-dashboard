create table if not exists public.event_finance_entries (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  entry_type text not null check (entry_type in ('expense', 'investment')),
  service_key text not null,
  service_name text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  notes text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists event_finance_entries_event_id_idx
  on public.event_finance_entries (event_id);

alter table public.event_finance_entries enable row level security;

revoke all on table public.event_finance_entries from anon;
grant select, insert, update, delete on table public.event_finance_entries to authenticated;

drop policy if exists "Admins can read event finance" on public.event_finance_entries;
create policy "Admins can read event finance"
on public.event_finance_entries for select
to authenticated
using (public.is_dd_events_admin());

drop policy if exists "Admins can add event finance" on public.event_finance_entries;
create policy "Admins can add event finance"
on public.event_finance_entries for insert
to authenticated
with check (public.is_dd_events_admin());

drop policy if exists "Admins can update event finance" on public.event_finance_entries;
create policy "Admins can update event finance"
on public.event_finance_entries for update
to authenticated
using (public.is_dd_events_admin())
with check (public.is_dd_events_admin());

drop policy if exists "Admins can delete event finance" on public.event_finance_entries;
create policy "Admins can delete event finance"
on public.event_finance_entries for delete
to authenticated
using (public.is_dd_events_admin());
