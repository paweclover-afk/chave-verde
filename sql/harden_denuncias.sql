-- Chave Verde — reforço da tabela de denúncias (VULN-001 do pentest de 2026-09-14)
-- Problema: a política de INSERT era `with check (true)`, então qualquer visitante podia
-- inserir denúncias sem limite (risco de spam / flood da fila de moderação).
--
-- Rode uma vez no Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Não apaga nada; só adiciona validação e limites. Seguro rodar novamente (idempotente).

-- 1) Limite de tamanho do motivo (vale para todo mundo, inclusive edições)
alter table public.denuncias
  drop constraint if exists denuncias_motivo_tamanho;
alter table public.denuncias
  add constraint denuncias_motivo_tamanho
  check (char_length(motivo) between 3 and 500);

-- 2) Trigger que valida e limita cada denúncia nova.
--    SECURITY DEFINER: roda com o dono da função, então consegue contar as denúncias
--    (a RLS de leitura sozinha impediria essa contagem para o visitante anônimo).
create or replace function public.checar_denuncia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recentes_no_anuncio int;
  recentes_no_total int;
begin
  -- só aceita denúncia de anúncio que existe e está publicado (Ativo)
  if not exists (
    select 1 from public.quartos q
    where q.id = new.anuncio_id and q.status = 'Ativo'
  ) then
    raise exception 'Anúncio inválido para denúncia';
  end if;

  -- o cliente nunca decide se já está resolvida
  new.resolvida := false;
  new.criado_em := now();

  -- no máximo 10 denúncias por anúncio na última hora
  select count(*) into recentes_no_anuncio
  from public.denuncias
  where anuncio_id = new.anuncio_id
    and criado_em > now() - interval '1 hour';
  if recentes_no_anuncio >= 10 then
    raise exception 'Muitas denúncias para este anúncio agora. Tente mais tarde.';
  end if;

  -- teto global de segurança contra flood: 200 denúncias/hora no site todo
  select count(*) into recentes_no_total
  from public.denuncias
  where criado_em > now() - interval '1 hour';
  if recentes_no_total >= 200 then
    raise exception 'Sistema de denúncias temporariamente ocupado. Tente mais tarde.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_checar_denuncia on public.denuncias;
create trigger trg_checar_denuncia
  before insert on public.denuncias
  for each row execute function public.checar_denuncia();

-- 3) A política de INSERT continua pública, mas agora exige anuncio_id preenchido.
--    (a trigger acima é quem faz a validação de verdade)
drop policy if exists "qualquer um pode denunciar" on public.denuncias;
create policy "qualquer um pode denunciar"
on public.denuncias for insert
with check ( anuncio_id is not null );
