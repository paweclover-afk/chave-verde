begin;
create table if not exists public.ritmo_device_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.ritmo_members(user_id) on delete restrict,
  device_id uuid not null,
  label text not null check (label in ('leonarda-phone', 'adilson-phone', 'adilson-computer')),
  accessed_at timestamptz not null default now()
);
create index if not exists ritmo_device_access_user_time
  on public.ritmo_device_access (user_id, accessed_at desc);
alter table public.ritmo_device_access enable row level security;
alter table public.ritmo_device_access force row level security;
revoke all on public.ritmo_device_access from public, anon, authenticated;
grant insert on public.ritmo_device_access to service_role;
commit;
