-- Execute no SQL Editor do Supabase antes de publicar o novo painel.
-- Anúncios novos entram no ar imediatamente. O dono pode gerir e apagar os seus.

create or replace function public.protect_quartos_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
     or auth.uid() in (select user_id from public.admins) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'Ativo';
  end if;
  -- Mantém registros pendentes antigos sem publicá-los em lote.
  -- O anunciante pode publicá-los explicitamente no próprio painel.
  if new.status is null or new.status not in ('Ativo', 'Pausado', 'Alugado', 'Pendente') then
    raise exception 'Status de anúncio inválido';
  end if;
  return new;
end;
$$;

-- Preserva o gatilho já instalado por fix_moderacao_status.sql.
drop trigger if exists trg_protect_quartos_status on public.quartos;
create trigger trg_protect_quartos_status
before insert or update on public.quartos
for each row execute function public.protect_quartos_status();

drop policy if exists "anunciante apaga seus quartos" on public.quartos;
grant delete on public.quartos to authenticated;
create policy "anunciante apaga seus quartos"
on public.quartos for delete to authenticated
using (user_id = auth.uid());
