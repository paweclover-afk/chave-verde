-- Chave Verde — esconder user_id do público — PASSO 1 de 2 (criar a view).
-- Correção do achado "user_id exposto em dados públicos" (pentest 14/09/2026).
--
-- Este passo é ADITIVO: só cria a view e libera a leitura. Não quebra nada,
-- o site continua funcionando normalmente. Rode este PRIMEIRO.
-- Depois que o site novo estiver no ar, rode o PASSO 2 (que fecha o vazamento).
--
-- Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Seguro rodar de novo (idempotente).

-- View pública: só anúncios Ativos, SEM user_id, com o selo "verificado"
-- já calculado no servidor (nenhum UUID sai para o visitante).
-- security_invoker = false => a view roda com o dono e consegue calcular
-- "verificado" sem precisar expor a tabela verificados ao anon.
create or replace view public.anuncios_publicos
with (security_invoker = false) as
select
  q.id,
  q.created_at,
  q.nome,
  q.whatsapp,
  q.cidade,
  q.distrito,
  q.eircode,
  q.titulo,
  q.tipo_quarto,
  q.genero,
  q.valor,
  q.descricao,
  q.disponivel_de,
  q.disponivel_ate,
  q.destaque_ate,
  q.fotos_url,
  q.fotos_extra_pagas,
  q.aceita_sem_pps,
  q.status,
  q.whatsapp_cliques,
  exists (
    select 1 from public.verificados v where v.user_id = q.user_id
  ) as verificado
from public.quartos q
where q.status = 'Ativo';

grant select on public.anuncios_publicos to anon, authenticated;

notify pgrst, 'reload schema';
