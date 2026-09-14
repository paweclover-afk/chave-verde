-- Chave Verde — selo de anunciante verificado
-- Rode isso uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run

-- 1) Desfaz a regra anterior: a lista de admins volta a ser privada
drop policy if exists "qualquer um pode ver quem é admin" on public.admins;
drop policy if exists "admin ve seu proprio registro" on public.admins;
create policy "admin ve seu proprio registro"
on public.admins for select
using ( user_id = auth.uid() );

-- 2) Tabela de anunciantes verificados pela equipe
create table if not exists public.verificados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verificado_em timestamptz not null default now()
);

alter table public.verificados enable row level security;

-- Qualquer visitante vê quem tem selo (é isso que mostra o selo no anúncio)
drop policy if exists "qualquer um ve quem e verificado" on public.verificados;
create policy "qualquer um ve quem e verificado"
on public.verificados for select
using ( true );

-- Só admin dá o selo
drop policy if exists "so admin da selo" on public.verificados;
create policy "so admin da selo"
on public.verificados for insert
with check ( auth.uid() in (select user_id from public.admins) );

-- Só admin tira o selo
drop policy if exists "so admin remove selo" on public.verificados;
create policy "so admin remove selo"
on public.verificados for delete
using ( auth.uid() in (select user_id from public.admins) );
