-- Chave Verde — hardening (defense-in-depth) dos privilegios do anon.
-- Re-pentest 14/09/2026: o anon tinha grants residuais de escrita (INSERT/UPDATE/
-- DELETE) em varias tabelas por causa do padrao do Supabase. A RLS JA BLOQUEIA
-- todas as linhas (testado: 0 linhas afetadas), entao NAO era exploravel — mas o
-- certo e nao depender so da RLS. Aqui removemos os grants que o anon nao usa.
--
-- Mantemos o que as features precisam:
--   * anon INSERT + SELECT em avaliacoes (enviar avaliacao / ver aprovadas)
--   * anon INSERT em denuncias (denunciar anuncio)
--   * anon SELECT na view anuncios_publicos
-- Os grants de UPDATE/DELETE do usuario LOGADO (authenticated) ficam intactos
-- porque o admin (que e authenticated) precisa deles; a RLS restringe ao admin.
--
-- Supabase: SQL Editor -> New query -> cole tudo -> Run. Idempotente.

-- avaliacoes: anon so envia e le aprovadas (tira update/delete)
revoke update, delete on public.avaliacoes from anon;

-- denuncias: anon so denuncia (tira update/delete/select)
revoke update, delete, select on public.denuncias from anon;

-- feedback_mensagens: anon nao usa nada
revoke insert, update, delete, select on public.feedback_mensagens from anon;

-- pagamentos_processados: anon nao usa nada
revoke insert, update, delete, select on public.pagamentos_processados from anon;

-- admins: anon nao escreve (RLS ja negava; tiramos o grant tambem)
revoke insert, update, delete on public.admins from anon;

-- verificados: anon nao escreve (select ja foi revogado antes)
revoke insert, update, delete on public.verificados from anon;

-- cliques_whatsapp_log: anon nunca mexe direto (quem grava e a funcao RPC)
revoke insert, update, delete on public.cliques_whatsapp_log from anon;

notify pgrst, 'reload schema';
