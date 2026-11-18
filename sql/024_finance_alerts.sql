create table if not exists public.ritmo_finance_alerts (
 user_id uuid not null references public.ritmo_members(user_id),
 month text not null,
 currency text not null check(currency in ('GBP','EUR','BRL')),
 level integer not null check(level in (70,90)),
 created_at timestamptz not null default now(),
 primary key(user_id,month,currency,level)
);
alter table public.ritmo_finance_alerts enable row level security;
alter table public.ritmo_finance_alerts force row level security;
revoke all on public.ritmo_finance_alerts from public,anon,authenticated;
grant insert on public.ritmo_finance_alerts to service_role;
