-- Chave Verde — anti-inflar o contador de cliques no WhatsApp.
-- Correção do achado "contador de cliques inflável" (pentest 14/09/2026).
--
-- Antes: qualquer visitante podia chamar a função em loop e inflar o número.
-- Agora: conta no máximo 1 clique por visitante (IP) por anúncio por dia.
--   -> o loop deixa de funcionar (mesmo IP só soma 1/dia);
--   -> a métrica fica mais honesta ("pessoas diferentes que clicaram").
-- Por privacidade, guardamos só um HASH do IP (md5), nunca o IP em si.
--
-- A assinatura da função NÃO muda, então o site continua chamando igual
-- (rpc registrar_clique_whatsapp) — não precisa alterar o front nem publicar.
--
-- Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Seguro rodar de novo (idempotente).

-- 1) tabela de deduplicação: 1 linha por (anúncio, hash do IP, dia)
create table if not exists public.cliques_whatsapp_log (
  anuncio_id bigint not null,
  ip_hash    text   not null,
  dia        date   not null default (now() at time zone 'utc')::date,
  primary key (anuncio_id, ip_hash, dia)
);

-- Só a função (security definer) e o service role escrevem aqui.
-- RLS ligado e SEM policies => visitante/logado não leem nem gravam direto.
alter table public.cliques_whatsapp_log enable row level security;

-- 2) função que conta o clique com deduplicação por IP/dia
create or replace function public.registrar_clique_whatsapp(p_anuncio_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip    text;
  v_hash  text;
  v_rows  int;
begin
  -- só conta se o anúncio existe e está Ativo
  if not exists (select 1 from public.quartos where id = p_anuncio_id and status = 'Ativo') then
    return;
  end if;

  -- pega o IP do visitante do cabeçalho da requisição (PostgREST expõe em request.headers)
  v_ip := split_part(
            coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
            ',', 1);
  v_ip := nullif(trim(v_ip), '');
  v_hash := md5(coalesce(v_ip, 'desconhecido'));

  -- registra o par (anúncio, ip, dia). Se já existe hoje, não faz nada.
  insert into public.cliques_whatsapp_log (anuncio_id, ip_hash)
  values (p_anuncio_id, v_hash)
  on conflict (anuncio_id, ip_hash, dia) do nothing;

  get diagnostics v_rows = row_count;

  -- só soma no contador se foi um clique NOVO (não duplicado)
  if v_rows > 0 then
    update public.quartos
       set whatsapp_cliques = coalesce(whatsapp_cliques, 0) + 1
     where id = p_anuncio_id and status = 'Ativo';
  end if;
end;
$$;

-- 3) mantém a permissão para visitante e usuário logado chamarem a função
grant execute on function public.registrar_clique_whatsapp(bigint) to anon, authenticated;
