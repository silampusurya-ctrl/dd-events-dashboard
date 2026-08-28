alter table public.push_subscriptions
    add column if not exists subscriber_department text,
    add column if not exists staff_profile_id text;

create index if not exists push_subscriptions_staff_department_idx
    on public.push_subscriptions (subscriber_role, subscriber_department);

create index if not exists push_subscriptions_staff_profile_idx
    on public.push_subscriptions (staff_profile_id);
