begin;
create table if not exists public.daybyday_members (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid unique references auth.users(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.daybyday_days (
  user_id uuid not null references public.daybyday_members(user_id) on delete restrict,
  day date not null,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id,day)
);
create table if not exists public.daybyday_changes (
  event_id uuid primary key,
  user_id uuid not null references public.daybyday_members(user_id) on delete restrict,
  day date not null,
  revision bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id,day,revision)
);
alter table public.daybyday_members enable row level security;
alter table public.daybyday_members force row level security;
alter table public.daybyday_days enable row level security;
alter table public.daybyday_days force row level security;
alter table public.daybyday_changes enable row level security;
alter table public.daybyday_changes force row level security;
revoke all on public.daybyday_members, public.daybyday_days, public.daybyday_changes from public, anon, authenticated;
grant select,update on public.daybyday_members to service_role;
grant select,insert,update on public.daybyday_days to service_role;
grant select,insert on public.daybyday_changes to service_role;
create or replace function public.daybyday_save_day(p_user uuid,p_day date,p_expected bigint,p_payload jsonb,p_event uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row public.daybyday_days; old_event public.daybyday_changes;
begin
  if not exists (select 1 from public.daybyday_members where user_id=p_user and active) then
    raise exception 'Access denied' using errcode='42501';
  end if;
  if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>262144 then
    raise exception 'Invalid payload' using errcode='22023';
  end if;
  insert into public.daybyday_days(user_id,day) values(p_user,p_day) on conflict do nothing;
  select * into current_row from public.daybyday_days where user_id=p_user and day=p_day for update;
  select * into old_event from public.daybyday_changes where event_id=p_event;
  if found then
    if old_event.user_id<>p_user or old_event.day<>p_day or old_event.payload<>p_payload then
      raise exception 'Invalid event reuse' using errcode='22023';
    end if;
    return jsonb_build_object('revision',old_event.revision,'updated_at',old_event.created_at,'duplicate',true);
  end if;
  if current_row.revision<>p_expected then
    return jsonb_build_object('conflict',true,'revision',current_row.revision);
  end if;
  update public.daybyday_days set payload=p_payload,revision=revision+1,updated_at=clock_timestamp()
    where user_id=p_user and day=p_day returning * into current_row;
  insert into public.daybyday_changes(event_id,user_id,day,revision,payload,created_at)
    values(p_event,p_user,p_day,current_row.revision,p_payload,current_row.updated_at);
  return jsonb_build_object('revision',current_row.revision,'updated_at',current_row.updated_at);
end; $$;
revoke all on function public.daybyday_save_day(uuid,date,bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.daybyday_save_day(uuid,date,bigint,jsonb,uuid) to service_role;

commit;
