-- Chave Verde — CORRECAO CRITICA: view anuncios_publicos estava GRAVAVEL pelo anon.
-- Descoberto no re-pentest (14/09/2026). A view roda com privilegio de dono
-- (security_invoker = false) e o Supabase concede escrita ao anon/authenticated
-- por padrao em objetos novos. Resultado: um visitante anonimo conseguia dar
-- UPDATE em qualquer anuncio (preco, titulo, whatsapp, status, marcar fotos/
-- destaque como pagos) passando por cima da RLS da tabela quartos.
--
-- Correcao: deixar a view SOMENTE LEITURA (so SELECT; revogar insert/update/delete).
-- O site nunca escreve na view (painel/admin escrevem direto na tabela quartos),
-- entao isso nao quebra nada.
--
-- RODE JA no Supabase: Dashboard -> SQL Editor -> New query -> cole tudo -> Run.
-- Seguro rodar de novo (idempotente).

revoke insert, update, delete on public.anuncios_publicos from anon, authenticated;

-- garante que a leitura publica continua
grant select on public.anuncios_publicos to anon, authenticated;

notify pgrst, 'reload schema';
