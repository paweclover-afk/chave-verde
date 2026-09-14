-- Chave Verde — corrige o "bypass de moderação" (publicar como Ativo sem revisão)
-- Rode uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run
--
-- O problema: o navegador define o status do anúncio. Um usuário podia mandar
-- status = 'Ativo' direto (ex: console do Chrome) e o anúncio ia pro ar sem
-- passar pela sua revisão. O JavaScript colocava 'Pendente', mas JavaScript
-- pode ser burlado — a trava de verdade tem que estar no banco.
--
-- O que este trigger faz (para usuários comuns):
--   • INSERT: todo anúncio novo entra SEMPRE como 'Pendente', não importa o que
--     o navegador mande.
--   • UPDATE: enquanto o anúncio estiver 'Pendente', o dono NÃO consegue tirá-lo
--     de 'Pendente' sozinho — só um admin aprova. Depois de aprovado, o dono
--     continua podendo pausar / reativar / marcar como alugado normalmente.
-- Backend (service role) e administradores continuam podendo tudo.

create or replace function public.protect_quartos_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) Backend com a service role key sempre pode
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- 2) Administradores continuam podendo aprovar/editar pelo painel admin
  if auth.uid() in (select user_id from public.admins) then
    return new;
  end if;

  -- 3) Usuário comum
  if tg_op = 'INSERT' then
    -- Anúncio novo SEMPRE nasce pendente de revisão
    new.status := 'Pendente';
  else
    -- Não pode tirar do 'Pendente' por conta própria (só admin aprova)
    if old.status = 'Pendente' and new.status is distinct from 'Pendente' then
      new.status := 'Pendente';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_quartos_status on public.quartos;
create trigger trg_protect_quartos_status
before insert or update on public.quartos
for each row
execute function public.protect_quartos_status();
