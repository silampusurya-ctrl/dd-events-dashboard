insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-documents',
  'event-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_dd_events_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dashboard_data
    where id = 1
      and coalesce(data -> 'adminEmails', '[]'::jsonb) ? lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_dd_events_admin() from public;
grant execute on function public.is_dd_events_admin() to authenticated;

drop policy if exists "Authenticated admins can read event documents" on storage.objects;
create policy "Authenticated admins can read event documents"
on storage.objects for select
to authenticated
using (bucket_id = 'event-documents' and public.is_dd_events_admin());

drop policy if exists "Authenticated admins can upload event documents" on storage.objects;
create policy "Authenticated admins can upload event documents"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-documents' and public.is_dd_events_admin());

drop policy if exists "Authenticated admins can update event documents" on storage.objects;
create policy "Authenticated admins can update event documents"
on storage.objects for update
to authenticated
using (bucket_id = 'event-documents' and public.is_dd_events_admin())
with check (bucket_id = 'event-documents' and public.is_dd_events_admin());

drop policy if exists "Authenticated admins can delete event documents" on storage.objects;
create policy "Authenticated admins can delete event documents"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-documents' and public.is_dd_events_admin());
