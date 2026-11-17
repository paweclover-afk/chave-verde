begin;
create table if not exists public.support_chat_members (
  side text primary key check (side in ('ritmo','daybyday')),
  user_id uuid not null unique references auth.users(id)
);
create table if not exists public.support_chat_messages (
  id uuid not null,
  sender text not null references public.support_chat_members(side),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (sender,id)
);
create index if not exists support_chat_messages_recent
  on public.support_chat_messages(created_at desc,id desc);
alter table public.support_chat_members enable row level security;
alter table public.support_chat_messages enable row level security;
alter table public.support_chat_members force row level security;
alter table public.support_chat_messages force row level security;
revoke all on public.support_chat_members, public.support_chat_messages from public, anon, authenticated;
grant select on public.support_chat_members to service_role;
grant select, insert, update on public.support_chat_messages to service_role;
commit;
