-- Chave Verde — configuração do painel administrativo
-- Rode isso uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run

-- 1) Tabela que lista quem é administrador do site.
--    Ninguém entra aqui sozinho: você adiciona cada admin manualmente (veja o passo 3 no final).
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admin ve seu proprio registro" on public.admins;
create policy "admin ve seu proprio registro"
on public.admins for select
using ( user_id = auth.uid() );

-- 2) Permissões extras na tabela "quartos" para administradores.
--    Importante: isso ADICIONA acesso, não remove nada das regras que já existem
--    (usuário comum continua só vendo/editando os próprios anúncios).
drop policy if exists "admins veem todos os quartos" on public.quartos;
create policy "admins veem todos os quartos"
on public.quartos for select
using ( auth.uid() in (select user_id from public.admins) );

drop policy if exists "admins atualizam todos os quartos" on public.quartos;
create policy "admins atualizam todos os quartos"
on public.quartos for update
using ( auth.uid() in (select user_id from public.admins) );

drop policy if exists "admins apagam todos os quartos" on public.quartos;
create policy "admins apagam todos os quartos"
on public.quartos for delete
using ( auth.uid() in (select user_id from public.admins) );

-- 3) Como tornar alguém administrador (faça depois de rodar o script acima):
--    a) Peça pra pessoa criar uma conta normal no site (login/cadastro comum).
--    b) No Supabase: Authentication → Users → encontre o email dela → copie o "User UID".
--    c) Rode o comando abaixo trocando o UID (repita uma vez por pessoa):
--
--    insert into public.admins (user_id) values ('COLE-O-UID-AQUI');
--
--    Pra remover alguém do admin:
--    delete from public.admins where user_id = 'UID-DA-PESSOA';
