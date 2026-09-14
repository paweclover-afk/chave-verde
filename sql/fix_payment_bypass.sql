-- Chave Verde — corrige o bypass de pagamento (fotos_extra_pagas / destaque_ate)
-- Rode isso uma vez no Supabase: Dashboard → SQL Editor → New query → cole tudo → Run
--
-- O que isso faz: impede que qualquer usuário comum mude os campos
-- fotos_extra_pagas e destaque_ate direto pelo navegador (ex: console do Chrome).
-- Só continuam podendo mudar esses dois campos:
--   1) O backend, quando confirma um pagamento de verdade (usa a service role key)
--   2) Uma conta de administrador (via admin.html)
-- Qualquer outra tentativa é silenciosamente revertida pro valor anterior.

create or replace function public.protect_quartos_payment_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) Backend com a service role key (create-checkout-session/verify-payment, admin-users) sempre pode
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- 2) Administradores continuam podendo editar manualmente pelo painel admin
  if auth.uid() in (select user_id from public.admins) then
    return new;
  end if;

  -- 3) Qualquer outro caller (usuário comum, anônimo): reverte esses dois campos
  if tg_op = 'INSERT' then
    new.fotos_extra_pagas := false;
    new.destaque_ate := null;
  else
    new.fotos_extra_pagas := old.fotos_extra_pagas;
    new.destaque_ate := old.destaque_ate;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_quartos_payment_columns on public.quartos;
create trigger trg_protect_quartos_payment_columns
before insert or update on public.quartos
for each row
execute function public.protect_quartos_payment_columns();

-- ---------------------------------------------------------------------
-- BÔNUS: corrige também o "replay" do pagamento (mesma sessão do Stripe
-- sendo confirmada várias vezes pra renovar o destaque de graça pra sempre).
-- Cria uma tabela pra lembrar quais session_id do Stripe já foram usados.

create table if not exists public.pagamentos_processados (
  stripe_session_id text primary key,
  anuncio_id bigint not null,
  tipo text not null,
  processado_em timestamptz not null default now()
);

alter table public.pagamentos_processados enable row level security;
-- Ninguém acessa essa tabela pelo cliente (nem select) — só o backend (service role) usa.
