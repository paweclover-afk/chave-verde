-- Chave Verde — esconder user_id do público — PASSO 2 de 2 (fechar o vazamento).
-- Correção do achado "user_id exposto em dados públicos" (pentest 14/09/2026).
--
-- Rode este passo SÓ DEPOIS que o site novo estiver no ar (o index.js já usa a view).
-- Aqui o visitante anônimo perde o acesso DIRETO às tabelas quartos e verificados,
-- então o user_id (UUID) e a lista de UUIDs deixam de vazar.
-- O painel do anunciante e o admin (usuário LOGADO = authenticated) continuam iguais.
--
-- Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Seguro rodar de novo (idempotente).

revoke select on public.quartos    from anon;
revoke select on public.verificados from anon;

notify pgrst, 'reload schema';
